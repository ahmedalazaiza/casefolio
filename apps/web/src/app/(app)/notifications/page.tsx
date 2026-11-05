import type { Metadata } from "next";
import { NotificationsPageClient } from "@/components/notifications/notifications-page-client";
import { requireSession } from "@/lib/auth/session";
import { listNotificationsForUser } from "@/lib/notifications/service";
import { notificationFilterSchema } from "@/lib/notifications/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Notifications — Casefolio",
};

interface NotificationsPageProps {
  searchParams: Promise<{ filter?: string }>;
}

export default async function WorkspaceNotificationsPage({
  searchParams,
}: NotificationsPageProps) {
  const { user } = await requireSession("/notifications");
  const query = await searchParams;
  const parsedFilter = notificationFilterSchema.safeParse(query.filter);

  const data = await listNotificationsForUser(user.id, {
    filter: "all",
    limit: 60,
  });

  return (
    <NotificationsPageClient
      initialNotifications={data.notifications}
      initialUnreadCount={data.unreadCount}
      initialFilter={parsedFilter.success ? parsedFilter.data : "all"}
    />
  );
}
