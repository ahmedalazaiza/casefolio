import type { PlanTier, UserRole } from "@casefolio/db";
import { z } from "zod";
import type { BillingInterval } from "@/lib/billing/plans";

export const ADMIN_USER_PLAN_FILTERS = ["all", "free", "pro", "team", "suspended"] as const;
export type AdminUserPlanFilter = (typeof ADMIN_USER_PLAN_FILTERS)[number];

export const suspendUserInputSchema = z.object({
  action: z.literal("set_suspension"),
  userId: z.string().uuid("Invalid user ID."),
  suspended: z.boolean(),
});

export const syncUserSubscriptionInputSchema = z.object({
  action: z.literal("sync_subscription"),
  userId: z.string().uuid("Invalid user ID."),
});

export const adminUsersPatchSchema = z.discriminatedUnion("action", [
  suspendUserInputSchema,
  syncUserSubscriptionInputSchema,
]);

export interface AdminUserListItem {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  plan: PlanTier;
  suspended: boolean;
  billingInterval: BillingInterval | null;
  subscriptionStatus: string | null;
  projectCount: number;
  lastActiveIso: string;
  createdAtIso: string;
}

export interface AdminUserProjectRow {
  id: string;
  name: string;
  slug: string | null;
  templateName: string;
  visibility: "private" | "unlisted" | "public";
  updatedAtIso: string;
}

export interface AdminPaddleSubscriptionSnapshot {
  source: "paddle_api" | "database_mirror";
  paddleSubscriptionId: string | null;
  paddleCustomerId: string | null;
  plan: PlanTier;
  status: string;
  interval: BillingInterval | null;
  amountUsd: number;
  renewsAtIso: string | null;
  paymentSummary: string;
}

export interface AdminUserDetail {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  plan: PlanTier;
  suspended: boolean;
  jobTitle: string | null;
  workspaceName: string | null;
  signInProvider: string;
  joinedAtIso: string;
  lastActiveIso: string;
  totalProjects: number;
  publishedProjects: number;
  views30d: number;
  completedExports: number;
  lastExportAtIso: string | null;
  projects: AdminUserProjectRow[];
  subscription: AdminPaddleSubscriptionSnapshot;
}

export interface AdminSubscriptionRow {
  id: string;
  userId: string | null;
  customerName: string;
  customerEmail: string;
  paddleSubscriptionId: string | null;
  plan: PlanTier;
  interval: BillingInterval;
  amountUsd: number;
  status: string;
  updatedAtIso: string;
}

export interface AdminSubscriptionsOverview {
  mrrUsd: number;
  payingUsersCount: number;
  churn30dPercent: number;
  trialsActiveCount: number;
  recentSubscriptions: AdminSubscriptionRow[];
}

export function filterAdminUsers(
  users: readonly AdminUserListItem[],
  args: { searchQuery: string; filter: AdminUserPlanFilter },
): AdminUserListItem[] {
  const q = args.searchQuery.trim().toLowerCase();
  return users.filter((u) => {
    if (args.filter === "suspended") {
      if (!u.suspended) return false;
    } else if (args.filter !== "all") {
      if (u.plan !== args.filter) return false;
    }
    if (q) {
      const hay = `${u.name} ${u.email}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function formatRelativeActivity(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return "Today";
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function escapeCsvCell(value: string | number | boolean): string {
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function serializeAdminUsersCsv(users: readonly AdminUserListItem[]): string {
  const lines = [
    ["Name", "Email", "Role", "Plan", "Billing", "Suspended", "Projects", "Joined"]
      .map(escapeCsvCell)
      .join(","),
  ];

  for (const u of users) {
    lines.push(
      [
        u.name,
        u.email,
        u.role,
        u.plan,
        u.billingInterval ?? "none",
        u.suspended ? "yes" : "no",
        u.projectCount,
        u.createdAtIso,
      ]
        .map(escapeCsvCell)
        .join(","),
    );
  }
  return lines.join("\n");
}
