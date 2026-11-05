import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import {
  listNotificationsForUser,
  markAllNotificationsReadForUser,
  markNotificationReadForUser,
  getUnreadNotificationCount,
} from "@/lib/notifications/service";
import {
  markNotificationsInputSchema,
  notificationFilterSchema,
} from "@/lib/notifications/types";

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const rawFilter = url.searchParams.get("filter") ?? "all";
  const rawLimit = Number(url.searchParams.get("limit") ?? "25");

  const parsedFilter = notificationFilterSchema.safeParse(rawFilter);
  const filter = parsedFilter.success ? parsedFilter.data : "all";
  const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, rawLimit)) : 25;

  const data = await listNotificationsForUser(session.user.id, {
    filter,
    limit,
  });

  return NextResponse.json({
    ok: true,
    unreadCount: data.unreadCount,
    notifications: data.notifications,
  });
}

export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = markNotificationsInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid notification action.",
      },
      { status: 400 },
    );
  }

  if (parsed.data.action === "mark_all") {
    await markAllNotificationsReadForUser(session.user.id);
  } else {
    await markNotificationReadForUser(session.user.id, parsed.data.notificationId);
  }

  const unreadCount = await getUnreadNotificationCount(session.user.id);

  return NextResponse.json({
    ok: true,
    unreadCount,
  });
}
