"use client";

import { Check, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { NotificationRow } from "@/components/notifications/notification-row";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import {
  matchesNotificationFilter,
  type NotificationFilterKey,
  type NotificationItem,
} from "@/lib/notifications/types";
import { cn } from "@/lib/utils";

const FILTER_TABS: ReadonlyArray<{
  key: NotificationFilterKey;
  label: string;
}> = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "exports", label: "Exports" },
  { key: "billing", label: "Billing" },
  { key: "team", label: "Team" },
];

export interface NotificationsPageClientProps {
  initialNotifications: NotificationItem[];
  initialUnreadCount: number;
  initialFilter?: NotificationFilterKey;
}

export function NotificationsPageClient({
  initialNotifications,
  initialUnreadCount,
  initialFilter = "all",
}: NotificationsPageClientProps) {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [activeFilter, setActiveFilter] = useState<NotificationFilterKey>(initialFilter);

  const visibleItems = useMemo(
    () => items.filter((item) => matchesNotificationFilter(item, activeFilter)),
    [items, activeFilter],
  );

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;

    setUnreadCount(0);
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));

    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all" }),
      });
      router.refresh();
    } catch {
      // Keep optimistic read state
    }
  };

  const handleSelectItem = async (item: NotificationItem) => {
    if (!item.isRead) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
      setItems((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)),
      );
      try {
        await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "mark_one", notificationId: item.id }),
        });
      } catch {
        // Ignore
      }
    }

    if (item.href) {
      router.push(item.href);
    }
  };

  return (
    <div
      data-testid="notifications-page"
      className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-2 py-4 sm:px-6 sm:py-6 lg:px-8"
    >
      {/* Page header (Matches Figma 2:9726) */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Eyebrow className="w-fit">Inbox</Eyebrow>
          <h1 className="text-foreground type-display-m">Notifications</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {items.length > 0 && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={unreadCount === 0}
              data-testid="notifications-page-mark-all"
              onClick={handleMarkAllRead}
            >
              Mark all as read
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href="/account">
              <Settings className="size-3.5" />
              <span>Settings</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Filter segments (Matches Figma 2:9742) */}
      <div>
        <div
          role="group"
          aria-label="Filter notifications"
          data-testid="notifications-filter-bar"
          className="border-border/70 bg-sunken/80 inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full border p-1"
        >
          {FILTER_TABS.map((tab) => {
            const isActive = activeFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                data-testid={`notifications-filter-${tab.key}`}
                aria-pressed={isActive}
                onClick={() => setActiveFilter(tab.key)}
                className={cn(
                  "focus-visible:ring-ring/40 shrink-0 rounded-full px-3.5 py-1.5 transition-all outline-none focus-visible:ring-2 sm:px-4",
                  isActive
                    ? "bg-elevated text-foreground shadow-card type-body-s-strong"
                    : "text-muted-foreground hover:text-foreground type-body-s",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* List or Empty state (Matches Figma 2:9753 & 2:9892) */}
      {visibleItems.length === 0 ? (
        <section
          data-testid="notifications-empty-state"
          className="border-border/80 bg-elevated shadow-card flex flex-col items-start gap-4 rounded-3xl border p-8 sm:p-14"
        >
          <div className="bg-success-soft text-success flex size-14 items-center justify-center rounded-2xl">
            <Check className="size-6" />
          </div>
          <div className="flex flex-col gap-1.5">
            <h2 className="text-foreground type-heading-l">You’re all caught up</h2>
            <p className="text-muted-foreground type-body-m max-w-md">
              We’ll let you know when exports finish or pages go live.
            </p>
          </div>
        </section>
      ) : (
        <section
          data-testid="notifications-page-list"
          className="border-border/80 bg-elevated shadow-card divide-border/70 divide-y overflow-hidden rounded-3xl border"
        >
          {visibleItems.map((item) => (
            <NotificationRow
              key={item.id}
              item={item}
              onSelect={handleSelectItem}
            />
          ))}
        </section>
      )}
    </div>
  );
}
