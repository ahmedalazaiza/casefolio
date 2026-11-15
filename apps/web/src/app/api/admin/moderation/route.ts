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
import { revalidatePublicProject } from "@/lib/projects/public-cache";

async function ensureAdminApi() {
  const session = await getServerSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  }
  if (!hasAdminRole(session.user.role)) {
    return { error: NextResponse.json({ error: "Admin access required." }, { status: 403 }) };
  }
  const actorRole: "admin" | "superadmin" =
    session.user.role === "superadmin" ? "superadmin" : "admin";
  return { user: session.user, actorRole };
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
    const bulkRes = await dismissAllOpenModerationReports({
      actorId: auth.user.id,
      actorRole: auth.actorRole,
      confirmed: parsed.data.confirmed,
      reason: parsed.data.reason,
    });
    if (!bulkRes.ok) {
      return NextResponse.json({ error: bulkRes.error }, { status: bulkRes.status });
    }
    revalidatePath("/admin/moderation");
    revalidatePath("/admin");
    const overview = await listAdminModerationQueue();
    return NextResponse.json({ ok: true, overview });
  }

  const res = await resolveModerationForProject({
    actorId: auth.user.id,
    projectId: parsed.data.projectId,
    decision: parsed.data.action,
    reason: parsed.data.action === "restore" ? parsed.data.reason : undefined,
  });

  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 400 });
  }

  revalidatePath("/admin/moderation");
  revalidatePath("/admin");
  revalidatePublicProject(res.slug);

  const overview = await listAdminModerationQueue();
  return NextResponse.json({ ok: true, decision: res.decision, overview });
}
