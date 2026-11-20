import { NextResponse } from "next/server";
import {
  listAdminProjectsOverview,
  performAdminProjectAction,
} from "@/lib/admin/projects";
import {
  adminProjectDeleteSchema,
  adminProjectPatchSchema,
} from "@/lib/admin/projects-types";
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
  return { user: session.user, role: session.user.role };
}

export async function GET(request: Request) {
  const auth = await ensureAdminApi();
  if ("error" in auth) return auth.error;

  const url = new URL(request.url);
  const ownerId = url.searchParams.get("ownerId")?.trim() || undefined;
  const overview = await listAdminProjectsOverview({ ownerId });
  return NextResponse.json(overview);
}

export async function PATCH(request: Request) {
  const auth = await ensureAdminApi();
  if ("error" in auth) return auth.error;

  const json = await request.json().catch(() => null);
  const parsed = adminProjectPatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid project action payload." },
      { status: 400 },
    );
  }

  const res = await performAdminProjectAction({
    actorId: auth.user.id,
    actorRole: auth.role,
    projectId: parsed.data.projectId,
    action: parsed.data.action,
    reason: parsed.data.action === "takedown" ? parsed.data.reason : undefined,
  });

  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 400 });
  }

  const overview = await listAdminProjectsOverview();
  return NextResponse.json({ ok: true, overview });
}

export async function DELETE(request: Request) {
  const auth = await ensureAdminApi();
  if ("error" in auth) return auth.error;

  const json = await request.json().catch(() => null);
  const parsed = adminProjectDeleteSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid delete payload." },
      { status: 400 },
    );
  }

  const res = await performAdminProjectAction({
    actorId: auth.user.id,
    actorRole: auth.role,
    projectId: parsed.data.projectId,
    action: "delete",
  });

  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 400 });
  }

  const overview = await listAdminProjectsOverview();
  return NextResponse.json({ ok: true, overview });
}
