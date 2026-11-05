import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  listAdminUsers,
  setAdminUserSuspension,
  syncUserSubscriptionFromPaddle,
} from "@/lib/admin/users";
import { adminUsersPatchSchema } from "@/lib/admin/users-types";
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

  const users = await listAdminUsers();
  return NextResponse.json({ users });
}

export async function PATCH(request: Request) {
  const auth = await ensureAdminApi();
  if ("error" in auth) return auth.error;

  const json = await request.json().catch(() => null);
  const parsed = adminUsersPatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 },
    );
  }

  if (parsed.data.action === "set_suspension") {
    const res = await setAdminUserSuspension({
      actorId: auth.user.id,
      actorRole: auth.role,
      targetUserId: parsed.data.userId,
      suspended: parsed.data.suspended,
    });
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${parsed.data.userId}`);
    return NextResponse.json({ ok: true, suspended: res.suspended });
  }

  const syncRes = await syncUserSubscriptionFromPaddle({
    actorId: auth.user.id,
    targetUserId: parsed.data.userId,
  });
  if (!syncRes.ok) {
    return NextResponse.json({ error: syncRes.error }, { status: 400 });
  }

  revalidatePath(`/admin/users/${parsed.data.userId}`);
  revalidatePath("/admin/subscriptions");
  return NextResponse.json(syncRes);
}
