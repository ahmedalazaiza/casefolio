import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { supportTicketInputSchema } from "@/lib/help/contact";
import {
  attemptSupportTicketDelivery,
  createSupportTicket,
  sanitizeSubjectFragment,
  summarizeDeliveryError,
} from "@/lib/help/tickets";
import { extractClientIp } from "@/lib/security/auth-rate-limit";
import { consumeSharedRateLimit } from "@/lib/security/shared-rate-limit";

/** Shown to the user so the expectation matches what support actually commits to. */
const EXPECTED_RESPONSE = "within 1 business day";

export async function POST(request: Request) {
  const session = await getServerSession();
  const ip = extractClientIp(request.headers);
  const actorKey = session?.user.id ?? ip;

  const limitCheck = await consumeSharedRateLimit(`help-contact:${actorKey}`, 8, 60_000);
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
    return NextResponse.json({ ok: false, error: "Invalid JSON request body." }, { status: 400 });
  }

  const parsed = supportTicketInputSchema.safeParse(rawBody);
  if (!parsed.success) {
    const firstMessage = parsed.error.issues[0]?.message ?? "Invalid support request.";
    return NextResponse.json({ ok: false, error: firstMessage }, { status: 400 });
  }

  const data = parsed.data;
  const verifiedSessionEmail =
    session?.user?.emailVerified &&
    session.user.email.trim().toLowerCase() === data.email.trim().toLowerCase()
      ? session.user.email.trim()
      : null;

  const fullMessage =
    data.includeDiagnostics && data.diagnosticSummary
      ? `${data.message}\n\n---\nDiagnostics: ${data.diagnosticSummary}`
      : data.message;

  // 1. Persist FIRST so the customer's message can never be lost to an email outage.
  let ticket;
  try {
    ticket = await createSupportTicket({
      userId: session?.user?.id ?? null,
      email: data.email,
      topic: data.topic,
      subject: sanitizeSubjectFragment(data.subject),
      message: fullMessage,
      projectRef: data.relatedProject || null,
    });
  } catch (err) {
    console.error("[help/contact] could not persist support ticket:", summarizeDeliveryError(err));
    return NextResponse.json(
      {
        ok: false,
        error: "We couldn't save your request right now. Please try again in a moment.",
      },
      { status: 503 },
    );
  }

  // 2. Then try to notify the team. Intake always goes to the support inbox with Reply-To set to the
  // requester; the receipt only goes to a verified session email so this endpoint can never be used
  // as an anonymous third-party relay. Failures are recorded on the ticket, not swallowed.
  const delivery = await attemptSupportTicketDelivery(ticket, {
    receiptTo: verifiedSessionEmail,
  });

  return NextResponse.json({
    ok: true,
    ticketCode: ticket.code,
    replyToEmail: data.email,
    delivery,
    expectedResponse: EXPECTED_RESPONSE,
  });
}
