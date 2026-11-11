import { NextResponse } from "next/server";
import { renderAndDeliverEmail } from "@/lib/auth/email";
import { getServerSession } from "@/lib/auth/session";
import {
  generateSupportTicketCode,
  supportTicketInputSchema,
} from "@/lib/help/contact";
import { extractClientIp } from "@/lib/security/auth-rate-limit";
import { consumeUploadRateLimit } from "@/lib/storage/rate-limit";

const SUPPORT_INBOX_EMAIL = "support@casefolio.app";

function sanitizeSubjectFragment(raw: string): string {
  return raw.replace(/[\r\n<>]/g, " ").trim().slice(0, 120);
}

export async function POST(request: Request) {
  const session = await getServerSession();
  const ip = extractClientIp(request.headers);
  const actorKey = session?.user.id ?? ip;

  const limitCheck = consumeUploadRateLimit(
    `help-contact:${actorKey}`,
    8,
    60_000,
  );
  if (!limitCheck.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "Too many support requests. Please wait a minute and try again.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(limitCheck.retryAfterSeconds) },
      },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON request body." },
      { status: 400 },
    );
  }

  const parsed = supportTicketInputSchema.safeParse(rawBody);
  if (!parsed.success) {
    const firstMessage =
      parsed.error.issues[0]?.message ?? "Invalid support request.";
    return NextResponse.json(
      { ok: false, error: firstMessage },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const ticketCode = generateSupportTicketCode();
  const safeSubject = sanitizeSubjectFragment(data.subject);
  const verifiedSessionEmail =
    session?.user?.emailVerified &&
    session.user.email.trim().toLowerCase() === data.email.trim().toLowerCase()
      ? session.user.email.trim()
      : null;

  try {
    // Always route the full ticket to Casefolio's internal support inbox; only send an external
    // auto-reply to `data.email` when it matches the caller's verified session email so anonymous
    // attackers can never abuse `/api/help/contact` as an outbound spam relay to third parties.
    await renderAndDeliverEmail({
      to: SUPPORT_INBOX_EMAIL,
      subject: `[Ticket #${ticketCode}] ${data.topic}: ${safeSubject}`,
      template: {
        previewText: `Ticket #${ticketCode} from ${data.email}`,
        heading: `New support ticket #${ticketCode}`,
        body: `Reply-To: ${data.email} · Topic: ${data.topic} · Subject: ${safeSubject}\n\n${data.message.slice(0, 4000)}`,
        footerNote: `Ticket #${ticketCode} · Casefolio Support Intake`,
      },
    });

    if (verifiedSessionEmail) {
      await renderAndDeliverEmail({
        to: verifiedSessionEmail,
        subject: `[Ticket #${ticketCode}] We received your Casefolio support message`,
        template: {
          previewText: `Ticket #${ticketCode} · ${safeSubject}`,
          heading: "Support request received",
          body: `Thanks for reaching out about “${safeSubject}” (${data.topic}). Our team has logged Ticket #${ticketCode} and will reply to this email address.`,
          footerNote: `Ticket #${ticketCode} · Casefolio Support`,
        },
      });
    }
  } catch {
    // Do not fail ticket creation in dev/sandbox when external email delivery is unavailable
  }

  return NextResponse.json({
    ok: true,
    ticketCode,
    replyToEmail: data.email,
  });
}

