"use client";

import {
  AlertTriangle,
  Download,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import {
  formatRelativeNotificationTime,
  type NotificationItem,
  type NotificationKind,
} from "@/lib/notifications/types";
import { cn } from "@/lib/utils";

export function NotificationIconTile({ kind }: { kind: NotificationKind }) {
  switch (kind) {
    case "export_ready":
      return (
        <span className="bg-success-soft text-success inline-flex size-9 shrink-0 items-center justify-center rounded-xl">
          <Download className="size-4" />
        </span>
      );
    case "export_failed":
    case "payment_failed":
      return (
        <span className="bg-destructive-soft text-destructive inline-flex size-9 shrink-0 items-center justify-center rounded-xl">
          <AlertTriangle className="size-4" />
        </span>
      );
    case "published":
      return (
        <span className="bg-accent text-primary inline-flex size-9 shrink-0 items-center justify-center rounded-xl">
          <Send className="size-4" />
        </span>
      );
    case "team_invite":
      return (
        <span className="bg-accent text-primary inline-flex size-9 shrink-0 items-center justify-center rounded-xl">
          <Users className="size-4" />
        </span>
      );
    case "template_update":
      return (
        <span className="bg-warning-soft text-warning inline-flex size-9 shrink-0 items-center justify-center rounded-xl">
          <Sparkles className="size-4" />
        </span>
      );
  }
}

export interface NotificationRowProps {
  item: NotificationItem;
  onSelect?: (item: NotificationItem) => void;
  compact?: boolean;
}

export function NotificationRow({
  item,
  onSelect,
  compact = false,
}: NotificationRowProps) {
  return (
    <button
      type="button"
      data-testid="notification-row"
      data-notification-id={item.id}
      data-notification-kind={item.kind}
      data-unread={item.isRead ? "false" : "true"}
      onClick={() => onSelect?.(item)}
      className={cn(
        "hover:bg-surface/80 focus-visible:ring-ring/40 flex w-full items-start gap-3.5 text-left transition-colors outline-none focus-visible:ring-2",
        compact ? "rounded-xl px-2.5 py-3" : "px-5 py-4 sm:px-6",
      )}
    >
      <NotificationIconTile kind={item.kind} />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-foreground type-body-s-strong">{item.title}</span>
        <span
          className={cn(
            "text-muted-foreground type-caption",
            compact ? "line-clamp-2" : "line-clamp-2 sm:line-clamp-1",
          )}
        >
          {item.message}
        </span>
        <span className="text-tertiary type-caption pt-0.5">
          {formatRelativeNotificationTime(item.createdAtIso)}
        </span>
      </div>

      {!item.isRead && (
        <span
          aria-label="Unread notification"
          data-testid="notification-unread-dot"
          className="bg-primary mt-1.5 size-2 shrink-0 rounded-full"
        />
      )}
    </button>
  );
}
