// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotificationsBell } from "@/components/notifications/notifications-bell";
import { NotificationsPageClient } from "@/components/notifications/notifications-page-client";
import type { NotificationItem } from "@/lib/notifications/types";

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  pushMock.mockReset();
  refreshMock.mockReset();
});

const SAMPLE_ITEMS: NotificationItem[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    userId: "22222222-2222-4222-8222-222222222222",
    kind: "export_ready",
    title: "Export ready",
    message: "“Orbit Mobile Banking” PDF is ready to download.",
    href: "/projects/proj-1/exports",
    isRead: false,
    readAtIso: null,
    createdAtIso: new Date(Date.now() - 120_000).toISOString(),
    meta: {},
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    userId: "22222222-2222-4222-8222-222222222222",
    kind: "payment_failed",
    title: "Payment failed",
    message: "We couldn’t process your Pro subscription renewal.",
    href: "/account/billing",
    isRead: true,
    readAtIso: new Date().toISOString(),
    createdAtIso: new Date(Date.now() - 7_200_000).toISOString(),
    meta: {},
  },
];

describe("notifications UI — Bell dropdown & /notifications center (C-803)", () => {
  it("renders unread count badge on NotificationsBell and marks all as read via PATCH", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true, unreadCount: 0 }), { status: 200 }),
    );

    render(
      <NotificationsBell
        initialUnreadCount={1}
        initialNotifications={SAMPLE_ITEMS}
        enableLivePolling={false}
      />,
    );

    const badge = screen.getByTestId("notifications-unread-badge");
    expect(badge.textContent).toBe("1");

    const trigger = screen.getByTestId("notifications-bell-button");
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    fireEvent.click(trigger);

    const panel = await screen.findByTestId("notifications-dropdown-panel");
    expect(panel).toBeDefined();
    expect(screen.getByText("Export ready")).toBeDefined();

    const markAllBtn = screen.getByTestId("notifications-dropdown-mark-all");
    fireEvent.click(markAllBtn);

    await waitFor(() => {
      expect(screen.queryByTestId("notifications-unread-badge")).toBeNull();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/notifications",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("filters notifications across segments and displays the empty state when caught up", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true, unreadCount: 0 }), { status: 200 }),
    );

    render(
      <NotificationsPageClient
        initialNotifications={SAMPLE_ITEMS}
        initialUnreadCount={1}
      />,
    );

    expect(screen.getAllByTestId("notification-row")).toHaveLength(2);

    // Filter by Exports
    fireEvent.click(screen.getByTestId("notifications-filter-exports"));
    expect(screen.getAllByTestId("notification-row")).toHaveLength(1);
    expect(screen.getByText("Export ready")).toBeDefined();

    // Filter by Team -> none exist -> empty state
    fireEvent.click(screen.getByTestId("notifications-filter-team"));
    expect(screen.getByTestId("notifications-empty-state")).toBeDefined();
    expect(screen.getByText("You’re all caught up")).toBeDefined();

    // Switch to Unread -> 1 item -> Mark all as read -> empty state
    fireEvent.click(screen.getByTestId("notifications-filter-unread"));
    expect(screen.getAllByTestId("notification-row")).toHaveLength(1);

    fireEvent.click(screen.getByTestId("notifications-page-mark-all"));
    await waitFor(() => {
      expect(screen.getByTestId("notifications-empty-state")).toBeDefined();
    });
  });
});
