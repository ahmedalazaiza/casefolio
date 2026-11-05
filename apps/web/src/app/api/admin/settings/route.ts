import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  getAdminSettingsOverview,
  promoteAdminByEmail,
  updateAdminUserRole,
  updatePlatformSettings,
} from "@/lib/admin/settings";
import { adminSettingsPatchSchema } from "@/lib/admin/settings-types";
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

export async function GET() {
  const auth = await ensureAdminApi();
  if ("error" in auth) return auth.error;

  const overview = await getAdminSettingsOverview();
  return NextResponse.json(overview);
}

export async function PATCH(request: Request) {
  const auth = await ensureAdminApi();
  if ("error" in auth) return auth.error;

  const json = await request.json().catch(() => null);
  const parsed = adminSettingsPatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 },
    );
  }

  if (parsed.data.action === "update_role") {
    const res = await updateAdminUserRole({
      actorId: auth.user.id,
      actorRole: auth.role,
      targetUserId: parsed.data.userId,
      nextRole: parsed.data.role,
    });
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }
    revalidatePath("/admin/settings");
    revalidatePath("/admin/users");
    const overview = await getAdminSettingsOverview();
    return NextResponse.json({ ok: true, overview });
  }

  if (parsed.data.action === "promote_by_email") {
    const res = await promoteAdminByEmail({
      actorId: auth.user.id,
      actorRole: auth.role,
      email: parsed.data.email,
      role: parsed.data.role,
    });
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }
    revalidatePath("/admin/settings");
    revalidatePath("/admin/users");
    const overview = await getAdminSettingsOverview();
    return NextResponse.json({ ok: true, overview });
  }

  const platRes = await updatePlatformSettings({
    actorId: auth.user.id,
    actorRole: auth.role,
    settings: parsed.data.settings,
  });
  if (!platRes.ok) {
    return NextResponse.json({ error: platRes.error }, { status: 400 });
  }

  revalidatePath("/admin/settings");
  const overview = await getAdminSettingsOverview();
  return NextResponse.json({ ok: true, overview });
}
