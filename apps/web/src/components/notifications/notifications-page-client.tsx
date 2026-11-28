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
      className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-5"
    >
      <header className="relative flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-[0.5625rem] border border-[var(--cf-lp-card-border)] bg-[var(--cf-lp-card)] px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-1">
          <Eyebrow className="w-fit px-2.5 py-0.5 text-[0.6875rem]">
            Inbox
          </Eyebrow>
          <h1 className="v3-dashboard-title text-[var(--cf-text-primary)]">
            Notifications
          </h1>
          <p className="max-w-xl text-xs text-[var(--cf-text-secondary)] sm:text-sm">
            Real-time updates on completed exports, published case studies, and billing events.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
      </header>

      <div>
        <div
          role="group"
          aria-label="Filter notifications"
          data-testid="notifications-filter-bar"
          className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-[0.375rem] border border-[var(--cf-lp-card-border)] bg-[var(--cf-lp-tab-track)] p-1"
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
                  "shrink-0 rounded-full px-3.5 py-1.5 text-xs transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                  isActive
                    ? "bg-[var(--cf-lp-action)] font-medium text-[var(--cf-lp-on-action)]"
                    : "font-medium text-[var(--cf-text-secondary)] hover:text-[var(--cf-text-primary)]",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {visibleItems.length === 0 ? (
        <section
          data-testid="notifications-empty-state"
          className="v3-pattern-dots-light flex flex-col items-start gap-3.5 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-6 sm:p-10"
        >
          <div className="flex size-11 items-center justify-center rounded-xl bg-[var(--cf-royal)] text-[var(--cf-text-on-royal)]">
            <Check className="size-5" />
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="v3-dashboard-section-title text-[var(--cf-text-primary)]">
              You’re all caught up
            </h2>
            <p className="max-w-md text-xs leading-relaxed text-[var(--cf-text-secondary)] sm:text-sm">
              We’ll let you know when exports finish or pages go live.
            </p>
          </div>
        </section>
      ) : (
        <section
          data-testid="notifications-page-list"
          className="divide-y divide-[var(--cf-border-subtle)] overflow-hidden rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)]"
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
