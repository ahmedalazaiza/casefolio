import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  dismissAllOpenModerationReports,
  listAdminModerationQueue,
  resolveModerationForProject,
} from "@/lib/admin/moderation";
import { adminModerationPatchSchema } from "@/lib/admin/moderation-types";
import { hasAdminRole } from "@/lib/auth/guards";
import { getServerSession } from "@/lib/auth/session";

async function ensureAdminApi() {
  const session = await getServerSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  }
  if (!hasAdminRole(session.user.role)) {
    return { error: NextResponse.json({ error: "Admin access required." }, { status: 403 }) };
  }
  return { user: session.user };
}

export async function GET() {
  const auth = await ensureAdminApi();
  if ("error" in auth) return auth.error;

  const overview = await listAdminModerationQueue();
  return NextResponse.json(overview);
}

export async function PATCH(request: Request) {
  const auth = await ensureAdminApi();
  if ("error" in auth) return auth.error;

  const json = await request.json().catch(() => null);
  const parsed = adminModerationPatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 },
    );
  }

  if (parsed.data.action === "dismiss_all_open") {
    await dismissAllOpenModerationReports({ actorId: auth.user.id });
    revalidatePath("/admin/moderation");
    revalidatePath("/admin");
    const overview = await listAdminModerationQueue();
    return NextResponse.json({ ok: true, overview });
  }

  const res = await resolveModerationForProject({
    actorId: auth.user.id,
    projectId: parsed.data.projectId,
    decision: parsed.data.action,
  });

  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 400 });
  }

  revalidatePath("/admin/moderation");
  revalidatePath("/admin");
  if (res.slug) {
    revalidatePath(`/p/${res.slug}`);
  }

  const overview = await listAdminModerationQueue();
  return NextResponse.json({ ok: true, decision: res.decision, overview });
}
