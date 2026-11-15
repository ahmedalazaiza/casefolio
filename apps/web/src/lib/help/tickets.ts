import { eq, sql } from "@casefolio/db";
import { renderAndDeliverEmail } from "@/lib/auth/email";
import { db, dbSchema } from "@/lib/db";
import {
  buildSupportTicketIntakeAlertEmail,
  buildSupportTicketReceiptEmail,
  resolveSupportInboxMailbox,
} from "@/lib/email";
import { generateSupportTicketCode } from "@/lib/help/contact";
import { redactSensitiveText } from "@/lib/security/redact";

export type SupportTicketRow = typeof dbSchema.supportTickets.$inferSelect;

export type SupportTicketDelivery = "sent" | "queued";

export const SUPPORT_TICKET_MAX_DELIVERY_ATTEMPTS = 5;
const CODE_COLLISION_RETRIES = 8;
const MAX_ERROR_LENGTH = 300;
/** Retry n (after n failed attempts) waits `BASE * 2^n` since ticket creation. */
const RETRY_BACKOFF_BASE_MS = 60_000;

export interface CreateSupportTicketInput {
  userId: string | null;
  email: string;
  topic: string;
  subject: string;
  message: string;
  projectRef: string | null;
}

/** Redacts secrets/emails and truncates so a provider error can never bloat or leak through the DB. */
export function summarizeDeliveryError(err: unknown): string {
  const raw =
    err instanceof Error
      ? `${err.name}: ${err.message}`
      : typeof err === "string"
        ? err
        : "Unknown delivery error";
  return redactSensitiveText(raw).replace(/\s+/g, " ").trim().slice(0, MAX_ERROR_LENGTH);
}

export function sanitizeSubjectFragment(raw: string): string {
  return raw.replace(/[\r\n<>]/g, " ").trim().slice(0, 120);
}

/** Persists a ticket with a unique code. Retries on code collision. Throws if no code could be reserved. */
export async function createSupportTicket(
  input: CreateSupportTicketInput,
  generateCode: () => string = generateSupportTicketCode,
): Promise<SupportTicketRow> {
  for (let attempt = 0; attempt < CODE_COLLISION_RETRIES; attempt += 1) {
    const [row] = await db
      .insert(dbSchema.supportTickets)
      .values({
        code: generateCode(),
        userId: input.userId,
        email: input.email,
        topic: input.topic,
        subject: input.subject,
        message: input.message,
        projectRef: input.projectRef,
      })
      .onConflictDoNothing({ target: dbSchema.supportTickets.code })
      .returning();
    if (row) return row;
  }
  throw new Error("Could not allocate a unique support ticket code.");
}

export interface DeliverTicketOptions {
  /** Verified address that gets the receipt; null when the requester is anonymous/unverified. */
  receiptTo: string | null;
}

async function sendIntake(ticket: SupportTicketRow): Promise<boolean> {
  const intake = buildSupportTicketIntakeAlertEmail({
    ticketCode: ticket.code,
    requesterEmail: ticket.email,
    requesterUserId: ticket.userId,
    topic: ticket.topic,
    subjectLine: sanitizeSubjectFragment(ticket.subject),
    message: ticket.message,
    projectRef: ticket.projectRef,
  });
  const result = await renderAndDeliverEmail({
    to: resolveSupportInboxMailbox(),
    department: intake.department,
    templateKey: intake.templateKey,
    replyTo: intake.replyTo,
    subject: intake.subject,
    template: {
      previewText: intake.content.previewText,
      eyebrow: intake.content.eyebrow,
      heading: intake.content.heading,
      body: intake.content.paragraphs.join("\n\n"),
      specs: intake.content.specs,
      quoteBlock: intake.content.quoteBlock,
      ctaLabel: intake.content.ctaLabel,
      ctaUrl: intake.content.ctaUrl,
      footerNote: intake.content.footerNote,
    },
  });
  return result.delivered;
}

async function sendReceipt(ticket: SupportTicketRow, to: string): Promise<void> {
  const receipt = buildSupportTicketReceiptEmail({
    ticketCode: ticket.code,
    topic: ticket.topic,
    subjectLine: sanitizeSubjectFragment(ticket.subject),
  });
  await renderAndDeliverEmail({
    to,
    department: receipt.department,
    templateKey: receipt.templateKey,
    subject: receipt.subject,
    template: {
      previewText: receipt.content.previewText,
      eyebrow: receipt.content.eyebrow,
      heading: receipt.content.heading,
      body: receipt.content.paragraphs.join("\n\n"),
      specs: receipt.content.specs,
      ctaLabel: receipt.content.ctaLabel,
      ctaUrl: receipt.content.ctaUrl,
      footerNote: receipt.content.footerNote,
    },
  });
}

/**
 * Makes ONE delivery attempt for an already-persisted ticket and records the outcome. Never throws:
 * failures are stored on the row (redacted + truncated) and reported as `queued` so the caller can
 * tell the user honestly that the request was saved but not yet sent.
 */
export async function attemptSupportTicketDelivery(
  ticket: SupportTicketRow,
  options: DeliverTicketOptions,
): Promise<SupportTicketDelivery> {
  await db
    .update(dbSchema.supportTickets)
    .set({ deliveryAttempts: sql`${dbSchema.supportTickets.deliveryAttempts} + 1` })
    .where(eq(dbSchema.supportTickets.id, ticket.id));
  return runDeliveryAttempt(ticket, options);
}

async function runDeliveryAttempt(
  ticket: SupportTicketRow,
  options: DeliverTicketOptions,
): Promise<SupportTicketDelivery> {
  let intakeDelivered = false;
  let errorSummary: string | null = null;

  try {
    intakeDelivered = await sendIntake(ticket);
    if (!intakeDelivered) {
      errorSummary = "Email provider is not configured for live delivery.";
    }
  } catch (err) {
    errorSummary = summarizeDeliveryError(err);
  }

  if (intakeDelivered && options.receiptTo) {
    try {
      await sendReceipt(ticket, options.receiptTo);
    } catch (err) {
      // The team already has the ticket; a missed receipt must not trigger duplicate intake mail.
      errorSummary = `Receipt email failed: ${summarizeDeliveryError(err)}`.slice(0, MAX_ERROR_LENGTH);
    }
  }

  await db
    .update(dbSchema.supportTickets)
    .set({
      intakeEmailDeliveredAt: intakeDelivered ? new Date() : null,
      lastDeliveryError: errorSummary,
    })
    .where(eq(dbSchema.supportTickets.id, ticket.id));

  return intakeDelivered ? "sent" : "queued";
}

export interface RetrySupportTicketDeliveriesResult {
  claimed: number;
  delivered: number;
  stillQueued: number;
}

/**
 * Retries undelivered tickets (intake not delivered, fewer than 5 attempts) using exponential backoff
 * measured from `createdAt` (`60s * 2^attempts`). Rows are claimed with FOR UPDATE SKIP LOCKED and their
 * attempt counter is bumped inside the claim, so overlapping cron runs never double-send a ticket.
 */
export async function retrySupportTicketDeliveries(
  limit = 20,
  now: Date = new Date(),
): Promise<RetrySupportTicketDeliveriesResult> {
  const boundedLimit = Math.max(1, Math.min(Math.trunc(limit), 100));
  const nowIso = now.toISOString();

  const claimed = await db.execute<{ id: string }>(sql`
    WITH picked AS MATERIALIZED (
      SELECT id FROM support_tickets
      WHERE intake_email_delivered_at IS NULL
        AND delivery_attempts < ${SUPPORT_TICKET_MAX_DELIVERY_ATTEMPTS}
        AND created_at + (${RETRY_BACKOFF_BASE_MS} * power(2, delivery_attempts)) * interval '1 millisecond'
            <= ${nowIso}::timestamptz
      ORDER BY created_at ASC
      LIMIT ${boundedLimit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE support_tickets AS st
    SET delivery_attempts = st.delivery_attempts + 1
    FROM picked
    WHERE st.id = picked.id
    RETURNING st.id
  `);

  let delivered = 0;
  let stillQueued = 0;
  for (const { id } of claimed.rows) {
    const [ticket] = await db
      .select()
      .from(dbSchema.supportTickets)
      .where(eq(dbSchema.supportTickets.id, id))
      .limit(1);
    if (!ticket) continue;

    let receiptTo: string | null = null;
    if (ticket.userId) {
      const [user] = await db
        .select({ email: dbSchema.users.email, emailVerified: dbSchema.users.emailVerified })
        .from(dbSchema.users)
        .where(eq(dbSchema.users.id, ticket.userId))
        .limit(1);
      if (
        user?.emailVerified &&
        user.email.trim().toLowerCase() === ticket.email.trim().toLowerCase()
      ) {
        receiptTo = user.email.trim();
      }
    }

    const outcome = await runDeliveryAttempt(ticket, { receiptTo });
    if (outcome === "sent") delivered += 1;
    else stillQueued += 1;
  }

  return { claimed: claimed.rows.length, delivered, stillQueued };
}
