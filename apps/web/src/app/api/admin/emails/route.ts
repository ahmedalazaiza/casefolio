import { NextResponse } from "next/server";
import { runAdminEmailAction } from "@/lib/admin/emails";
import { adminEmailsPostSchema } from "@/lib/admin/emails-types";
import { hasAdminRole } from "@/lib/auth/guards";
import { getServerSession } from "@/lib/auth/session";
import { renderCatalogTemplatePreview } from "@/lib/email";

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

  const result = await runAdminEmailAction(
    { id: auth.user.id, email: auth.user.email, role: auth.user.role },
    parsed.data,
  );
  return NextResponse.json(result.body, {
    status: result.status,
    headers: result.retryAfterSeconds
      ? { "Retry-After": String(result.retryAfterSeconds) }
      : undefined,
  });
}
