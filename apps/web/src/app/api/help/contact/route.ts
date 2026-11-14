import { NextResponse } from "next/server";
import { renderAndDeliverEmail } from "@/lib/auth/email";
import { getServerSession } from "@/lib/auth/session";
import {
  buildSupportTicketIntakeAlertEmail,
  buildSupportTicketReceiptEmail,
  resolveSupportInboxMailbox,
} from "@/lib/email";
import {
  generateSupportTicketCode,
  supportTicketInputSchema,
} from "@/lib/help/contact";
import { extractClientIp } from "@/lib/security/auth-rate-limit";
import { consumeUploadRateLimit } from "@/lib/storage/rate-limit";

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

  const fullMessage =
    data.includeDiagnostics && data.diagnosticSummary
      ? `${data.message}\n\n---\nDiagnostics: ${data.diagnosticSummary}`
      : data.message;

  try {
    // Always route the full ticket to Casefolio's support@casefolio.com inbox with Reply-To set to
    // the requester; only send an external auto-receipt to `data.email` when it matches the caller's
    // verified session email so anonymous callers can never abuse `/api/help/contact` as a relay.
    const intake = buildSupportTicketIntakeAlertEmail({
      ticketCode,
      requesterEmail: data.email,
      requesterUserId: session?.user?.id ?? null,
      topic: data.topic,
      subjectLine: safeSubject,
      message: fullMessage,
      projectRef: data.relatedProject || null,
    });

    await renderAndDeliverEmail({
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

    if (verifiedSessionEmail) {
      const receipt = buildSupportTicketReceiptEmail({
        ticketCode,
        topic: data.topic,
        subjectLine: safeSubject,
      });

      await renderAndDeliverEmail({
        to: verifiedSessionEmail,
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
  } catch {
    // Do not fail ticket creation in dev/sandbox when external email delivery is unavailable
  }

  return NextResponse.json({
    ok: true,
    ticketCode,
    replyToEmail: data.email,
  });
}
