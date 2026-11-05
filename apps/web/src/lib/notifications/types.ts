import { z } from "zod";

export const NOTIFICATION_KINDS = [
  "export_ready",
  "export_failed",
  "published",
  "payment_failed",
  "team_invite",
  "template_update",
  "moderation_takedown",
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const notificationKindSchema = z.enum(NOTIFICATION_KINDS);

export const NOTIFICATION_FILTERS = [
  "all",
  "unread",
  "exports",
  "billing",
  "team",
] as const;

export type NotificationFilterKey = (typeof NOTIFICATION_FILTERS)[number];

export const notificationFilterSchema = z.enum(NOTIFICATION_FILTERS);

export interface NotificationItem {
  id: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  message: string;
  href: string | null;
  isRead: boolean;
  readAtIso: string | null;
  createdAtIso: string;
  meta: Record<string, unknown>;
}

export const markNotificationsInputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("mark_one"),
    notificationId: z.string().uuid("Invalid notification ID."),
  }),
  z.object({
    action: z.literal("mark_all"),
  }),
]);

export type MarkNotificationsInput = z.infer<typeof markNotificationsInputSchema>;

export function isKnownNotificationKind(value: string): value is NotificationKind {
  return (NOTIFICATION_KINDS as readonly string[]).includes(value);
}

export function matchesNotificationFilter(
  item: Pick<NotificationItem, "kind" | "isRead">,
  filter: NotificationFilterKey,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "unread":
      return !item.isRead;
    case "exports":
      return item.kind === "export_ready" || item.kind === "export_failed";
    case "billing":
      return item.kind === "payment_failed";
    case "team":
      return item.kind === "team_invite";
  }
}

export function formatRelativeNotificationTime(
  createdAtIso: string,
  now: Date = new Date(),
): string {
  const created = new Date(createdAtIso);
  if (Number.isNaN(created.getTime())) {
    return "";
  }

  const diffSeconds = Math.max(0, Math.floor((now.getTime() - created.getTime()) / 1000));
  if (diffSeconds < 60) {
    return "Just now";
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) {
    return "Yesterday";
  }
  if (diffDays < 7) {
    return created.toLocaleDateString("en-US", { weekday: "short" });
  }

  return created.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

export function formatExportFormatShortLabel(format: string): string {
  if (format === "pdf") return "PDF";
  if (format === "behance") return "Behance slices";
  return "PNG";
}
