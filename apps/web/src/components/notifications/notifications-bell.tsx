"use client";

import { Bell, Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { NotificationRow } from "@/components/notifications/notification-row";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NotificationItem } from "@/lib/notifications/types";

export interface NotificationsBellProps {
  initialUnreadCount?: number;
  initialNotifications?: NotificationItem[];
  enableLivePolling?: boolean;
}

export function NotificationsBell({
  initialUnreadCount = 0,
  initialNotifications = [],
  enableLivePolling = true,
}: NotificationsBellProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [items, setItems] = useState<NotificationItem[]>(initialNotifications);

  useEffect(() => {
    setUnreadCount(initialUnreadCount);
  }, [initialUnreadCount]);

  useEffect(() => {
    setItems(initialNotifications);
  }, [initialNotifications]);

  const refreshNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=6", {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) return;
      const body = (await res.json()) as {
        ok?: boolean;
        unreadCount?: number;
        notifications?: NotificationItem[];
      };
      if (body.ok) {
        setUnreadCount(body.unreadCount ?? 0);
        setItems(body.notifications ?? []);
      }
    } catch {
      // Ignore transient network errors
    }
  }, []);

  useEffect(() => {
    if (!enableLivePolling || process.env.VITEST) {
      return;
    }

    const handleFocus = () => {
      void refreshNotifications();
    };

    window.addEventListener("focus", handleFocus);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshNotifications();
      }
    }, 4_000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      clearInterval(interval);
    };
  }, [enableLivePolling, refreshNotifications]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen && !process.env.VITEST) {
      void refreshNotifications();
    }
  };

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
    } catch {
      // Optimistic state kept
    }
  };

  const handleSelectItem = async (item: NotificationItem) => {
    if (!item.isRead) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)));
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

    setOpen(false);
    if (item.href) {
      router.push(item.href);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="notifications-bell-button"
          className="border-border bg-elevated text-foreground hover:bg-surface focus-visible:ring-ring/40 relative inline-flex size-9 items-center justify-center rounded-full border transition-colors outline-none focus-visible:ring-2"
        >
          <span className="sr-only">
            {unreadCount > 0 ? "Notifications, unread: " : "Notifications"}
          </span>
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span
              data-testid="notifications-unread-badge"
              className="bg-primary text-primary-foreground type-caption absolute -top-1 -right-1 inline-flex min-w-4.5 items-center justify-center rounded-full px-1 leading-none"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        data-testid="notifications-dropdown-panel"
        className="border-border bg-popover text-popover-foreground shadow-overlay w-96 max-w-[calc(100vw-2rem)] rounded-2xl border p-4"
      >
        <div className="flex items-center justify-between gap-2 px-1.5 pb-3">
          <span className="text-foreground type-heading-s">Notifications</span>
          {unreadCount > 0 && (
            <button
              type="button"
              data-testid="notifications-dropdown-mark-all"
              onClick={handleMarkAllRead}
              className="text-primary hover:underline type-caption cursor-pointer"
            >
              Mark all as read
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <span className="bg-success-soft text-success inline-flex size-10 items-center justify-center rounded-xl">
              <Check className="size-4" />
            </span>
            <p className="text-foreground type-body-s-strong">You’re all caught up</p>
            <p className="text-muted-foreground type-caption max-w-64">
              We’ll let you know when exports finish or pages go live.
            </p>
          </div>
        ) : (
          <div className="divide-border/60 flex max-h-96 flex-col divide-y overflow-y-auto">
            {items.slice(0, 5).map((item) => (
              <NotificationRow key={item.id} item={item} compact onSelect={handleSelectItem} />
            ))}
          </div>
        )}

        <div className="border-border mt-2 border-t pt-2.5 text-center">
          <Link
            href="/notifications"
            data-testid="notifications-dropdown-view-all"
            onClick={() => setOpen(false)}
            className="text-muted-foreground hover:text-foreground type-caption inline-flex items-center justify-center py-1 transition-colors"
          >
            View all →
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
