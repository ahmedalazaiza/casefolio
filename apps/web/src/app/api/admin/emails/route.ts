import { NextResponse } from "next/server";
import { adminEmailsPostSchema } from "@/lib/admin/emails-types";
import { hasAdminRole } from "@/lib/auth/guards";
import { getServerSession } from "@/lib/auth/session";
import {
  findCatalogTemplateByKey,
  isLiveResendKey,
  renderCatalogTemplatePreview,
  sendAdminCustomNoticeEmail,
  sendCasefolioEmail,
} from "@/lib/email";
import { recordAdminAuditLog } from "@/lib/template/service";

async function ensureAdminApi() {
  const session = await getServerSession();
  if (!session) {
    return {
      error: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
    };
  }
  if (!hasAdminRole(session.user.role)) {
    return {
      error: NextResponse.json({ error: "Admin access required." }, { status: 403 }),
    };
  }
  return { user: session.user };
}

export async function GET(request: Request) {
  const auth = await ensureAdminApi();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const templateKey = searchParams.get("template")?.trim() || "welcome.new_user";

  const preview = await renderCatalogTemplatePreview(templateKey);
  if (!preview) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }

  return NextResponse.json({
    preview: {
      key: preview.entry.key,
      title: preview.entry.title,
      department: preview.department,
      from: preview.from,
      senderAddress: preview.senderAddress,
      replyTo: preview.replyTo,
      subject: preview.subject,
      triggerSummary: preview.entry.triggerSummary,
      html: preview.html,
      text: preview.text,
    },
  });
}

export async function POST(request: Request) {
  const auth = await ensureAdminApi();
  if ("error" in auth) return auth.error;

  const json = await request.json().catch(() => null);
  const parsed = adminEmailsPostSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid email request." },
      { status: 400 },
    );
  }

  const liveResend = isLiveResendKey();

  if (parsed.data.action === "send_test") {
    const entry = findCatalogTemplateByKey(parsed.data.templateKey);
    if (!entry) {
      return NextResponse.json({ error: "Template not found." }, { status: 404 });
    }

    const samplePayload = entry.buildSample();
    try {
      const dispatched = await sendCasefolioEmail({
        to: parsed.data.recipientEmail,
        ...samplePayload,
        subject: `[Test] ${samplePayload.subject}`,
      });

      await recordAdminAuditLog(auth.user.id, "admin.email.test_sent", {
        templateKey: entry.key,
        department: dispatched.department,
        from: dispatched.senderAddress,
        deliveredViaResend: dispatched.delivered,
      });

      return NextResponse.json({
        ok: true,
        delivered: dispatched.delivered,
        liveResend,
        from: dispatched.from,
        replyTo: dispatched.replyTo,
        subject: dispatched.subject,
      });
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? err.message
              : "Failed to dispatch test email through Resend.",
        },
        { status: 502 },
      );
    }
  }

  try {
    const dispatched = await sendAdminCustomNoticeEmail({
      to: parsed.data.recipientEmail,
      recipientName: parsed.data.recipientName || null,
      subject: parsed.data.subject,
      heading: parsed.data.heading,
      message: parsed.data.message,
      ctaLabel: parsed.data.ctaLabel || null,
      ctaUrl: parsed.data.ctaUrl || null,
    });

    await recordAdminAuditLog(auth.user.id, "admin.email.dispatched", {
      targetUserId: parsed.data.targetUserId ?? null,
      subject: parsed.data.subject,
      from: dispatched.senderAddress,
      deliveredViaResend: dispatched.delivered,
    });

    return NextResponse.json({
      ok: true,
      delivered: dispatched.delivered,
      liveResend,
      from: dispatched.from,
      replyTo: dispatched.replyTo,
      subject: dispatched.subject,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to dispatch administrative email.",
      },
      { status: 502 },
    );
  }
}

