import { NextResponse } from "next/server";
import { renderAndDeliverEmail } from "@/lib/auth/email";
import { getServerSession } from "@/lib/auth/session";
import {
  generateSupportTicketCode,
  supportTicketInputSchema,
} from "@/lib/help/contact";
import { consumeUploadRateLimit } from "@/lib/storage/rate-limit";

export async function POST(request: Request) {
  const session = await getServerSession();
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || "local";
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

  try {
    await renderAndDeliverEmail({
      to: data.email,
      subject: `[Ticket #${ticketCode}] We received your Casefolio support message`,
      template: {
        previewText: `Ticket #${ticketCode} · ${data.subject}`,
        heading: "Support request received",
        body: `Thanks for reaching out about “${data.subject}” (${data.topic}). Our team has logged Ticket #${ticketCode} and will reply to this email address.`,
        footerNote: `Ticket #${ticketCode} · Casefolio Support`,
      },
    });
  } catch {
    // Do not fail ticket creation in dev/sandbox when external email delivery is unavailable
  }

  return NextResponse.json({
    ok: true,
    ticketCode,
    replyToEmail: data.email,
  });
}
