import { createHash } from "node:crypto";
import { eq, type UserRole } from "@casefolio/db";
import { isSameOriginHttpUrl, type AdminEmailsPostInput } from "@/lib/admin/emails-types";
import { db, dbSchema } from "@/lib/db";
import {
  findCatalogTemplateByKey,
  isLiveResendKey,
  sendAdminCustomNoticeEmail,
  sendCasefolioEmail,
} from "@/lib/email";
import { sanitizeErrorForLogging } from "@/lib/security/redact";
import { consumeSharedRateLimit } from "@/lib/security/shared-rate-limit";
import { recordAdminAuditLog } from "@/lib/template/service";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const ADMIN_EMAIL_LIMITS = {
  perAdminPerHour: 20,
  perAdminPerDay: 100,
  globalPerDay: 300,
} as const;

export interface AdminEmailActor {
  id: string;
  email: string;
  role: UserRole;
}

export interface AdminEmailActionResult {
  status: number;
  body: Record<string, unknown>;
  retryAfterSeconds?: number;
}

export function resolveAdminEmailAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.BETTER_AUTH_URL ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

/** Stable, non-reversible fingerprint stored in audit rows instead of the raw address. */
export function hashEmailRecipient(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

async function consumeAdminEmailBudget(actorId: string): Promise<number | null> {
  const hourly = await consumeSharedRateLimit(
    `admin-email:h:${actorId}`,
    ADMIN_EMAIL_LIMITS.perAdminPerHour,
    HOUR_MS,
  );
  if (!hourly.allowed) return hourly.retryAfterSeconds;
  const daily = await consumeSharedRateLimit(
    `admin-email:d:${actorId}`,
    ADMIN_EMAIL_LIMITS.perAdminPerDay,
    DAY_MS,
  );
  if (!daily.allowed) return daily.retryAfterSeconds;
  const global = await consumeSharedRateLimit(
    "admin-email:global:d",
    ADMIN_EMAIL_LIMITS.globalPerDay,
    DAY_MS,
  );
  if (!global.allowed) return global.retryAfterSeconds;
  return null;
}

const GENERIC_DISPATCH_ERROR = "The email could not be sent right now. Please try again later.";

export async function runAdminEmailAction(
  actor: AdminEmailActor,
  input: AdminEmailsPostInput,
): Promise<AdminEmailActionResult> {
  if (input.action === "send_admin_notice" && actor.role !== "superadmin") {
    return {
      status: 403,
      body: { error: "Only a superadmin can send official notices to users." },
    };
  }

  const retryAfter = await consumeAdminEmailBudget(actor.id);
  if (retryAfter !== null) {
    return {
      status: 429,
      body: { error: "Admin email limit reached. Please try again later." },
      retryAfterSeconds: retryAfter,
    };
  }

  const liveResend = isLiveResendKey();

  if (input.action === "send_test") {
    const entry = findCatalogTemplateByKey(input.templateKey);
    if (!entry) {
      return { status: 404, body: { error: "Template not found." } };
    }

    const samplePayload = entry.buildSample();
    try {
      // Test dispatches always go to the calling admin's own address, never to a client-supplied one.
      const dispatched = await sendCasefolioEmail({
        to: actor.email,
        ...samplePayload,
        subject: `[Test] ${samplePayload.subject}`,
      });

      await recordAdminAuditLog(actor.id, "admin.email.test_sent", {
        templateKey: entry.key,
        department: dispatched.department,
        recipientHash: hashEmailRecipient(actor.email),
        targetUserId: actor.id,
        subject: `[Test] ${samplePayload.subject}`,
        deliveredViaResend: dispatched.delivered,
      });

      return {
        status: 200,
        body: {
          ok: true,
          delivered: dispatched.delivered,
          liveResend,
          from: dispatched.from,
          replyTo: dispatched.replyTo,
          subject: dispatched.subject,
        },
      };
    } catch (err) {
      console.error("[admin-email] test dispatch failed", sanitizeErrorForLogging(err));
      return { status: 502, body: { error: GENERIC_DISPATCH_ERROR } };
    }
  }

  const ctaUrl = input.ctaUrl?.trim() || null;
  if (ctaUrl && !isSameOriginHttpUrl(ctaUrl, resolveAdminEmailAppUrl())) {
    return {
      status: 400,
      body: { error: "The button link must point to this Casefolio site." },
    };
  }

  const [target] = await db
    .select({ id: dbSchema.users.id, email: dbSchema.users.email, name: dbSchema.users.name })
    .from(dbSchema.users)
    .where(eq(dbSchema.users.id, input.targetUserId))
    .limit(1);
  if (!target) {
    return { status: 404, body: { error: "Recipient user not found." } };
  }

  try {
    const dispatched = await sendAdminCustomNoticeEmail({
      to: target.email,
      recipientName: target.name,
      subject: input.subject,
      heading: input.heading,
      message: input.message,
      ctaLabel: input.ctaLabel || null,
      ctaUrl,
    });

    await recordAdminAuditLog(actor.id, "admin.email.dispatched", {
      targetUserId: target.id,
      recipientHash: hashEmailRecipient(target.email),
      subject: input.subject,
      department: dispatched.department,
      deliveredViaResend: dispatched.delivered,
    });

    return {
      status: 200,
      body: {
        ok: true,
        delivered: dispatched.delivered,
        liveResend,
        from: dispatched.from,
        replyTo: dispatched.replyTo,
        subject: dispatched.subject,
      },
    };
  } catch (err) {
    console.error("[admin-email] notice dispatch failed", sanitizeErrorForLogging(err));
    return { status: 502, body: { error: GENERIC_DISPATCH_ERROR } };
  }
}
