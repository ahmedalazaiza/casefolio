// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminSubscriptionsPanel } from "@/components/admin/admin-subscriptions-panel";
import { AdminUserDetailPanel } from "@/components/admin/admin-user-detail-panel";
import { AdminUsersList } from "@/components/admin/admin-users-list";
import type {
  AdminSubscriptionsOverview,
  AdminUserDetail,
  AdminUserListItem,
} from "@/lib/admin/users-types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
});

const sampleUsers: AdminUserListItem[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Mina Park",
    email: "mina@casefolio.design",
    role: "user",
    plan: "pro",
    suspended: false,
    billingInterval: "monthly",
    subscriptionStatus: "active",
    projectCount: 7,
    lastActiveIso: new Date().toISOString(),
    createdAtIso: new Date().toISOString(),
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Devon Cole",
    email: "devon@blocked.design",
    role: "user",
    plan: "free",
    suspended: true,
    billingInterval: null,
    subscriptionStatus: null,
    projectCount: 1,
    lastActiveIso: new Date().toISOString(),
    createdAtIso: new Date().toISOString(),
  },
];

const sampleDetail: AdminUserDetail = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Mina Park",
  email: "mina@casefolio.design",
  role: "user",
  plan: "pro",
  suspended: false,
  jobTitle: "Staff Product Designer",
  workspaceName: "Mina Studio",
  signInProvider: "Google",
  joinedAtIso: "2026-01-10T00:00:00.000Z",
  lastActiveIso: new Date().toISOString(),
  totalProjects: 7,
  publishedProjects: 4,
  views30d: 1420,
  completedExports: 9,
  lastExportAtIso: new Date().toISOString(),
  projects: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      name: "Nova Wallet Redesign",
      slug: "nova-wallet",
      templateName: "Mono Mobile",
      visibility: "public",
      updatedAtIso: new Date().toISOString(),
    },
  ],
  subscription: {
    source: "paddle_api",
    paddleSubscriptionId: "sub_01j8test",
    paddleCustomerId: "ctm_01j8test",
    plan: "pro",
    status: "active",
    interval: "monthly",
    amountUsd: 16,
    renewsAtIso: "2026-12-10T00:00:00.000Z",
    paymentSummary: "Card on file (Paddle)",
  },
};

const sampleSubscriptionsOverview: AdminSubscriptionsOverview = {
  mrrUsd: 1640,
  payingUsersCount: 84,
  churn30dPercent: 1.8,
  trialsActiveCount: 6,
  recentSubscriptions: [
    {
      id: "44444444-4444-4444-8444-444444444444",
      userId: "11111111-1111-4111-8111-111111111111",
      customerName: "Mina Park",
      customerEmail: "mina@casefolio.design",
      paddleSubscriptionId: "sub_01j8test",
      plan: "pro",
      interval: "monthly",
      amountUsd: 16,
      status: "active",
      updatedAtIso: new Date().toISOString(),
    },
  ],
};

describe("Admin users & subscriptions UI (C-904)", () => {
  it("renders Users directory and filters by plan and suspended status (Figma 32:8993)", () => {
    render(
      <AdminUsersList
        initialUsers={sampleUsers}
        currentAdminId="99999999-9999-4999-8999-999999999999"
      />,
    );

    expect(screen.getByRole("heading", { name: "Users" })).toBeDefined();
    expect(screen.getByText("Mina Park")).toBeDefined();
    expect(screen.getByText("Devon Cole")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Suspended" }));
    expect(screen.queryByText("Mina Park")).toBeNull();
    expect(screen.getByText("Devon Cole")).toBeDefined();
  });

  it("renders User detail with live Paddle subscription snapshot and projects (Figma 32:9241)", () => {
    render(
      <AdminUserDetailPanel
        detail={sampleDetail}
        currentAdminId="99999999-9999-4999-8999-999999999999"
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Mina Park" })).toBeDefined();
    expect(screen.getByText("Nova Wallet Redesign")).toBeDefined();
    expect(screen.getByText(/Live via Paddle API/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /Sync Paddle/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Suspend user/i })).toBeDefined();
  });

  it("renders Subscriptions & plans overview with MRR and Paddle catalog (Figma 32:9489)", () => {
    render(<AdminSubscriptionsPanel overview={sampleSubscriptionsOverview} />);

    expect(screen.getByRole("heading", { name: "Subscriptions & plans" })).toBeDefined();
    expect(screen.getByText("$1,640")).toBeDefined();
    expect(screen.getByText("Recent subscriptions")).toBeDefined();
    expect(screen.getByText("Mina Park")).toBeDefined();
  });
});
