import type { PlanTier } from "@casefolio/db";
import { z } from "zod";

export const BILLING_INTERVALS = ["monthly", "yearly"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export const PAID_PLAN_TIERS = ["pro", "team"] as const;
export type PaidPlanTier = (typeof PAID_PLAN_TIERS)[number];

export const SUBSCRIPTION_LIFECYCLE_STATUSES = [
  "active",
  "trialing",
  "past_due",
  "cancel_at_period_end",
  "paused",
  "canceled",
] as const;
export type SubscriptionLifecycleStatus = (typeof SUBSCRIPTION_LIFECYCLE_STATUSES)[number];

export const checkoutRequestSchema = z.object({
  plan: z.enum(PAID_PLAN_TIERS),
  interval: z.enum(BILLING_INTERVALS).default("monthly"),
  orgId: z.string().uuid().optional().nullable(),
  seats: z.number().int().min(1).max(100).optional(),
});

export type CheckoutRequestInput = z.input<typeof checkoutRequestSchema>;

export const cancelSubscriptionInputSchema = z.object({
  reason: z
    .enum([
      "too_expensive",
      "finished_portfolio",
      "missing_feature",
      "switching_tool",
      "other",
    ])
    .optional(),
  feedback: z.string().max(500).optional(),
  immediate: z.boolean().default(false),
});

export type CancelSubscriptionInput = z.input<typeof cancelSubscriptionInputSchema>;

export interface BillingPlanDefinition {
  tier: PlanTier;
  name: string;
  tagline: string;
  monthlyPriceUsd: number;
  yearlyTotalUsd: number;
  yearlyMonthlyEquivalentUsd: number;
  yearlySavingsPercent: number;
  defaultSeats: number;
  highlighted?: boolean;
  features: readonly string[];
}

export const BILLING_PLAN_CATALOG: Record<PlanTier, BillingPlanDefinition> = {
  free: {
    tier: "free",
    name: "Free",
    tagline: "Build and share your first two case studies.",
    monthlyPriceUsd: 0,
    yearlyTotalUsd: 0,
    yearlyMonthlyEquivalentUsd: 0,
    yearlySavingsPercent: 0,
    defaultSeats: 1,
    features: [
      "Up to 2 projects",
      "Free Casefolio templates",
      "PNG long export (watermarked, 5/mo)",
      "Basic case-study view counts",
      "1 designer seat",
    ],
  },
  pro: {
    tier: "pro",
    name: "Pro",
    tagline: "Everything an independent product designer needs.",
    monthlyPriceUsd: 12,
    yearlyTotalUsd: 120,
    yearlyMonthlyEquivalentUsd: 10,
    yearlySavingsPercent: 17,
    defaultSeats: 1,
    highlighted: true,
    features: [
      "Unlimited projects",
      "All Free & Pro templates unlocked",
      "PNG, PDF & Behance exports — no watermark",
      "No “Made with Casefolio” badge on public pages",
      "Full view, visitor & referrer analytics",
    ],
  },
  team: {
    tier: "team",
    name: "Team",
    tagline: "Shared case-study studio for design teams & agencies.",
    monthlyPriceUsd: 29,
    yearlyTotalUsd: 288,
    yearlyMonthlyEquivalentUsd: 24,
    yearlySavingsPercent: 17,
    defaultSeats: 3,
    features: [
      "Everything in Pro",
      "3+ collaborative team seats (Owner, Editor, Viewer)",
      "Shared brand kit & studio presets",
      "Higher upload quotas (25 MB/file · 10 GB total)",
      "Centralized team billing & invoices",
    ],
  },
};

export function formatPlanHeadingLabel(
  plan: PlanTier,
  interval: BillingInterval = "monthly",
): string {
  if (plan === "free") {
    return "Free";
  }
  const base = plan === "team" ? "Team" : "Pro";
  const suffix = interval === "yearly" ? "Yearly" : "Monthly";
  return `${base} · ${suffix}`;
}

export function formatPlanAmountSummary(
  plan: PlanTier,
  interval: BillingInterval = "monthly",
): string {
  const def = BILLING_PLAN_CATALOG[plan];
  if (plan === "free") {
    return "$0/mo";
  }
  if (interval === "yearly") {
    return `$${def.yearlyMonthlyEquivalentUsd}/mo ($${def.yearlyTotalUsd}/yr)`;
  }
  return `$${def.monthlyPriceUsd}/mo`;
}

export function getChargeAmountUsd(plan: PaidPlanTier, interval: BillingInterval): number {
  const def = BILLING_PLAN_CATALOG[plan];
  return interval === "yearly" ? def.yearlyTotalUsd : def.monthlyPriceUsd;
}

/**
 * Determines whether a subscription row currently grants paid entitlements.
 * - `active`, `trialing`, `past_due`: grants access (while inside grace window if period end is set).
 * - `cancel_at_period_end`: grants access until `currentPeriodEnd`.
 * - `paused`, `canceled`: revokes paid access once effective.
 */
export function isSubscriptionGrantingAccess(
  status: string,
  currentPeriodEnd: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  const normalized = status.trim().toLowerCase();

  if (normalized === "active" || normalized === "trialing") {
    return true;
  }

  if (normalized === "past_due") {
    if (!currentPeriodEnd) return true;
    // Allow 7-day grace window past period end if Paddle hasn't transitioned to canceled yet
    const graceEndMs = currentPeriodEnd.getTime() + 7 * 24 * 60 * 60 * 1000;
    return now.getTime() <= graceEndMs;
  }

  if (normalized === "cancel_at_period_end") {
    if (!currentPeriodEnd) return false;
    return currentPeriodEnd.getTime() > now.getTime();
  }

  return false;
}
