import type { PlanTier } from "@casefolio/db";
import { z } from "zod";

export const PLAN_CATALOG_VERSION = "2026-11-07.v1" as const;

export const DECIMAL_KB = 1_000;
export const DECIMAL_MB = 1_000_000;
export const DECIMAL_GB = 1_000_000_000;

export const TEAMS_MIN_SEATS = 1;
export const TEAMS_MAX_SELF_SERVE_SEATS = 25;
export const TEAMS_CALCULATOR_DEFAULT_SEATS = 3;
export const TEAMS_CALCULATOR_QUICK_SEATS = [1, 2, 3, 5, 10] as const;

export const QUOTA_WARNING_RATIO = 0.8;
export const PAID_GRACE_MAX_RATIO = 1.2;
export const PAID_GRACE_DURATION_DAYS = 7;
export const PAID_GRACE_COOLDOWN_DAYS = 365;
export const PAST_DUE_GRACE_DAYS = 7;
/**
 * Fail-safe: an `active`/`trialing` subscription whose paid-through date is this many days in the
 * past stops granting paid access. A healthy subscription gets a fresh period end from Paddle on
 * every renewal, so a stale one means we missed the cancel/expiry webhook. Reconciliation
 * (`reconcileSubscriptionWithPaddle`) normally repairs it long before this triggers.
 */
export const STALE_ACTIVE_SUBSCRIPTION_DAYS = 14;
export const RENEWAL_LOCK_WINDOW_MINUTES = 30;
export const INVITATION_EXPIRY_DAYS = 7;
export const PRIVATE_RECOVERY_MIN_DAYS = 90;
export const EXPORT_ARTIFACT_RETENTION_DAYS = 7;

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

export const checkoutRequestSchema = z
  .object({
    plan: z.enum(PAID_PLAN_TIERS),
    interval: z.enum(BILLING_INTERVALS).default("monthly"),
    orgId: z.string().uuid().optional().nullable(),
    seats: z
      .number()
      .int()
      .min(TEAMS_MIN_SEATS, "Teams requires at least 1 paid seat.")
      .max(
        TEAMS_MAX_SELF_SERVE_SEATS,
        `Self-service Teams supports 1–${TEAMS_MAX_SELF_SERVE_SEATS} paid seats. Contact support for capacity review above ${TEAMS_MAX_SELF_SERVE_SEATS} seats.`,
      )
      .optional(),
  })
  .superRefine((val, ctx) => {
    if (val.plan === "pro" && val.seats !== undefined && val.seats !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["seats"],
        message: "Pro covers one personal workspace (1 person).",
      });
    }
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
  orgId: z.string().uuid().optional().nullable(),
  keepPublicProjectId: z.string().uuid().optional().nullable(),
});

export type CancelSubscriptionInput = z.input<typeof cancelSubscriptionInputSchema>;

export interface BillingPlanDefinition {
  tier: PlanTier;
  name: string;
  tagline: string;
  scopeSummary: string;
  monthlyPriceCents: number;
  yearlyTotalCents: number;
  yearlyMonthlyEquivalentCents: number;
  yearlySavingsCents: number;
  monthlyPriceUsd: number;
  yearlyTotalUsd: number;
  yearlyMonthlyEquivalentUsd: number;
  yearlySavingsPercent: number;
  perSeatPricing: boolean;
  defaultSeats: number;
  minSeats: number;
  maxSeats: number;
  highlighted?: boolean;
  features: readonly string[];
}

export const BILLING_PLAN_CATALOG: Record<PlanTier, BillingPlanDefinition> = {
  free: {
    tier: "free",
    name: "Free",
    tagline: "Design, preview, and publish your first case study at zero cost.",
    scopeSummary: "1 personal workspace · 1 person",
    monthlyPriceCents: 0,
    yearlyTotalCents: 0,
    yearlyMonthlyEquivalentCents: 0,
    yearlySavingsCents: 0,
    monthlyPriceUsd: 0,
    yearlyTotalUsd: 0,
    yearlyMonthlyEquivalentUsd: 0,
    yearlySavingsPercent: 0,
    perSeatPricing: false,
    defaultSeats: 1,
    minSeats: 1,
    maxSeats: 1,
    features: [
      "Up to 2 active projects (1 published, 10 total retained)",
      "3 approved Starter templates at launch",
      "Branded PNG 1x export (5/mo, up to 1,440 px)",
      "250 MB storage · 500 MB uploads/mo · 10 MB max file",
      "1 personal space · 7-day analytics & content history",
    ],
  },
  pro: {
    tier: "pro",
    name: "Pro",
    tagline: "Full presentation output, higher storage, and clean unbranded delivery.",
    scopeSummary: "1 personal workspace · 1 person",
    monthlyPriceCents: 1_200,
    yearlyTotalCents: 12_000,
    yearlyMonthlyEquivalentCents: 1_000,
    yearlySavingsCents: 2_400,
    monthlyPriceUsd: 12,
    yearlyTotalUsd: 120,
    yearlyMonthlyEquivalentUsd: 10,
    yearlySavingsPercent: 16.67,
    perSeatPricing: false,
    defaultSeats: 1,
    minSeats: 1,
    maxSeats: 1,
    highlighted: true,
    features: [
      "Up to 20 active projects (10 published, 100 total retained)",
      "All eligible published templates unlocked",
      "PNG 1x/2x (2,880 px), PDF & Behance pack — 60/mo",
      "Removable “Made with Casefolio” branding",
      "5 GB storage · up to 5 private spaces · 90-day analytics",
    ],
  },
  team: {
    tier: "team",
    name: "Teams",
    tagline: "Private member spaces plus shared team publishing under one subscription.",
    scopeSummary: "1 team workspace · S = 1–25 paid seats (including owner)",
    monthlyPriceCents: 1_800,
    yearlyTotalCents: 18_000,
    yearlyMonthlyEquivalentCents: 1_500,
    yearlySavingsCents: 3_600,
    monthlyPriceUsd: 18,
    yearlyTotalUsd: 180,
    yearlyMonthlyEquivalentUsd: 15,
    yearlySavingsPercent: 16.67,
    perSeatPricing: true,
    defaultSeats: 1,
    minSeats: TEAMS_MIN_SEATS,
    maxSeats: TEAMS_MAX_SELF_SERVE_SEATS,
    features: [
      "S = 1–25 paid seats (Owner, Admin & Member accounts)",
      "20 × S active & 10 × S published projects (pooled)",
      "5 private spaces/member (hidden from Owner/Admin) + 10 × S shared",
      "100 × S exports/mo · 10 GB × S storage · 25 MB max file",
      "365-day visitor analytics & 90-day recoverable history",
    ],
  },
};

export interface TeamsPriceCalculation {
  ok: true;
  seats: number;
  interval: BillingInterval;
  monthlyTotalCents: number;
  monthlyTotalUsd: number;
  yearlyTotalCents: number;
  yearlyTotalUsd: number;
  yearlyMonthlyEquivalentCents: number;
  yearlyMonthlyEquivalentUsd: number;
  annualSavingsCents: number;
  annualSavingsUsd: number;
  chargeCents: number;
  chargeUsd: number;
}

export type TeamsPriceResult =
  | TeamsPriceCalculation
  | {
      ok: false;
      code: "INVALID_SEATS" | "CAPACITY_REVIEW_REQUIRED";
      seats: number;
      maxSelfServeSeats: number;
      message: string;
    };

export function computeTeamsPrice(
  seats: number,
  interval: BillingInterval = "monthly",
): TeamsPriceResult {
  if (!Number.isInteger(seats) || seats < TEAMS_MIN_SEATS) {
    return {
      ok: false,
      code: "INVALID_SEATS",
      seats,
      maxSelfServeSeats: TEAMS_MAX_SELF_SERVE_SEATS,
      message: `Teams requires at least ${TEAMS_MIN_SEATS} paid seat (including the owner).`,
    };
  }

  if (seats > TEAMS_MAX_SELF_SERVE_SEATS) {
    return {
      ok: false,
      code: "CAPACITY_REVIEW_REQUIRED",
      seats,
      maxSelfServeSeats: TEAMS_MAX_SELF_SERVE_SEATS,
      message: `Self-service Teams supports 1–${TEAMS_MAX_SELF_SERVE_SEATS} paid seats. Above ${TEAMS_MAX_SELF_SERVE_SEATS} seats, stop self-service and request a capacity review.`,
    };
  }

  const monthlyTotalCents = BILLING_PLAN_CATALOG.team.monthlyPriceCents * seats;
  const yearlyTotalCents = BILLING_PLAN_CATALOG.team.yearlyTotalCents * seats;
  const yearlyMonthlyEquivalentCents =
    BILLING_PLAN_CATALOG.team.yearlyMonthlyEquivalentCents * seats;
  const annualSavingsCents = BILLING_PLAN_CATALOG.team.yearlySavingsCents * seats;
  const chargeCents = interval === "yearly" ? yearlyTotalCents : monthlyTotalCents;

  return {
    ok: true,
    seats,
    interval,
    monthlyTotalCents,
    monthlyTotalUsd: monthlyTotalCents / 100,
    yearlyTotalCents,
    yearlyTotalUsd: yearlyTotalCents / 100,
    yearlyMonthlyEquivalentCents,
    yearlyMonthlyEquivalentUsd: yearlyMonthlyEquivalentCents / 100,
    annualSavingsCents,
    annualSavingsUsd: annualSavingsCents / 100,
    chargeCents,
    chargeUsd: chargeCents / 100,
  };
}

export interface WorkspacePlanQuotas {
  plan: PlanTier;
  paidSeats: number;
  activeProjectsLimit: number;
  publishedProjectsLimit: number;
  retainedProjectsLimit: number;
  storageBytesLimit: number;
  monthlyUploadsBytesLimit: number;
  monthlyBandwidthBytesLimit: number;
  maxFileBytes: number;
  monthlyExportsLimit: number;
  maxPngWidthPx: number;
  maxExportMegapixels: number;
  maxPdfPages: number;
  exportTimeoutSeconds: number;
  privateSpacesPerMemberLimit: number;
  sharedSpacesLimit: number;
  analyticsRetentionDays: number;
  historyRetentionDays: number;
  brandingRemovable: boolean;
  collaborationEnabled: boolean;
}

export function clampTeamsSeats(rawSeats?: number | null): number {
  if (typeof rawSeats !== "number" || !Number.isFinite(rawSeats)) {
    return 1;
  }
  return Math.max(TEAMS_MIN_SEATS, Math.min(TEAMS_MAX_SELF_SERVE_SEATS, Math.floor(rawSeats)));
}

export function getWorkspaceQuotas(
  plan: PlanTier,
  rawPaidSeats = 1,
): WorkspacePlanQuotas {
  if (plan === "team") {
    const S = clampTeamsSeats(rawPaidSeats);
    return {
      plan: "team",
      paidSeats: S,
      activeProjectsLimit: 20 * S,
      publishedProjectsLimit: 10 * S,
      retainedProjectsLimit: 100 * S,
      storageBytesLimit: 10 * DECIMAL_GB * S,
      monthlyUploadsBytesLimit: 20 * DECIMAL_GB * S,
      monthlyBandwidthBytesLimit: 25 * DECIMAL_GB * S,
      maxFileBytes: 25 * DECIMAL_MB,
      monthlyExportsLimit: 100 * S,
      maxPngWidthPx: 2_880,
      maxExportMegapixels: 120,
      maxPdfPages: 60,
      exportTimeoutSeconds: 120,
      privateSpacesPerMemberLimit: 5,
      sharedSpacesLimit: 10 * S,
      analyticsRetentionDays: 365,
      historyRetentionDays: 90,
      brandingRemovable: true,
      collaborationEnabled: true,
    };
  }

  if (plan === "pro") {
    return {
      plan: "pro",
      paidSeats: 1,
      activeProjectsLimit: 20,
      publishedProjectsLimit: 10,
      retainedProjectsLimit: 100,
      storageBytesLimit: 5 * DECIMAL_GB,
      monthlyUploadsBytesLimit: 10 * DECIMAL_GB,
      monthlyBandwidthBytesLimit: 25 * DECIMAL_GB,
      maxFileBytes: 25 * DECIMAL_MB,
      monthlyExportsLimit: 60,
      maxPngWidthPx: 2_880,
      maxExportMegapixels: 120,
      maxPdfPages: 60,
      exportTimeoutSeconds: 120,
      privateSpacesPerMemberLimit: 5,
      sharedSpacesLimit: 0,
      analyticsRetentionDays: 90,
      historyRetentionDays: 30,
      brandingRemovable: true,
      collaborationEnabled: false,
    };
  }

  return {
    plan: "free",
    paidSeats: 1,
    activeProjectsLimit: 2,
    publishedProjectsLimit: 1,
    retainedProjectsLimit: 10,
    storageBytesLimit: 250 * DECIMAL_MB,
    monthlyUploadsBytesLimit: 500 * DECIMAL_MB,
    monthlyBandwidthBytesLimit: 1 * DECIMAL_GB,
    maxFileBytes: 10 * DECIMAL_MB,
    monthlyExportsLimit: 5,
    maxPngWidthPx: 1_440,
    maxExportMegapixels: 40,
    maxPdfPages: 0,
    exportTimeoutSeconds: 60,
    privateSpacesPerMemberLimit: 1,
    sharedSpacesLimit: 0,
    analyticsRetentionDays: 7,
    historyRetentionDays: 7,
    brandingRemovable: false,
    collaborationEnabled: false,
  };
}

export interface QuotaEvaluationInput {
  used: number;
  adding?: number;
  limit: number;
  isPaid: boolean;
  graceUsedAt?: Date | null;
  graceExpiresAt?: Date | null;
  now?: Date;
}

export interface QuotaEvaluationResult {
  allowed: boolean;
  status: "ok" | "warning" | "grace_active" | "blocked";
  ratio: number;
  percentUsed: number;
  remaining: number;
  canActivateGrace: boolean;
  effectiveCeiling: number;
}

export function evaluateQuotaUsage(input: QuotaEvaluationInput): QuotaEvaluationResult {
  const now = input.now ?? new Date();
  const adding = Math.max(0, input.adding ?? 0);
  const projected = input.used + adding;
  const limit = Math.max(0, input.limit);

  if (limit === 0) {
    return {
      allowed: false,
      status: "blocked",
      ratio: 1,
      percentUsed: 100,
      remaining: 0,
      canActivateGrace: false,
      effectiveCeiling: 0,
    };
  }

  const graceActive = Boolean(
    input.isPaid &&
      input.graceExpiresAt &&
      input.graceExpiresAt.getTime() > now.getTime(),
  );

  const cooldownMs = PAID_GRACE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  const graceCooldownElapsed =
    !input.graceUsedAt || now.getTime() - input.graceUsedAt.getTime() >= cooldownMs;
  const graceCeiling = Math.floor(limit * PAID_GRACE_MAX_RATIO);
  const canActivateGrace = Boolean(
    input.isPaid && !graceActive && graceCooldownElapsed && projected <= graceCeiling,
  );

  const effectiveCeiling = graceActive ? graceCeiling : limit;
  const ratio = input.used / limit;
  const percentUsed = Math.min(999, Math.round(ratio * 100));
  const remaining = Math.max(0, effectiveCeiling - input.used);

  if (projected > effectiveCeiling) {
    return {
      allowed: false,
      status: "blocked",
      ratio,
      percentUsed,
      remaining: 0,
      canActivateGrace,
      effectiveCeiling,
    };
  }

  if (graceActive && projected > limit) {
    return {
      allowed: true,
      status: "grace_active",
      ratio,
      percentUsed,
      remaining,
      canActivateGrace: false,
      effectiveCeiling,
    };
  }

  if (projected / limit >= QUOTA_WARNING_RATIO) {
    return {
      allowed: true,
      status: "warning",
      ratio,
      percentUsed,
      remaining,
      canActivateGrace: false,
      effectiveCeiling,
    };
  }

  return {
    allowed: true,
    status: "ok",
    ratio,
    percentUsed,
    remaining,
    canActivateGrace: false,
    effectiveCeiling,
  };
}

export function getUtcCalendarMonth(now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function getNextUtcMonthResetDate(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

export function formatResetDateIstanbul(now: Date = new Date()): string {
  const nextReset = getNextUtcMonthResetDate(now);
  return nextReset.toLocaleString("en-US", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function formatPlanHeadingLabel(
  plan: PlanTier,
  interval: BillingInterval = "monthly",
  seats?: number,
): string {
  if (plan === "free") {
    return "Free";
  }
  const base = plan === "team" ? "Teams" : "Pro";
  const suffix = interval === "yearly" ? "Yearly" : "Monthly";
  if (plan === "team" && typeof seats === "number" && seats >= 1) {
    return `${base} (${seats} ${seats === 1 ? "seat" : "seats"}) · ${suffix}`;
  }
  return `${base} · ${suffix}`;
}

export function formatPlanAmountSummary(
  plan: PlanTier,
  interval: BillingInterval = "monthly",
  seats = 1,
): string {
  const def = BILLING_PLAN_CATALOG[plan];
  if (plan === "free") {
    return "$0/mo";
  }
  if (plan === "team") {
    const calc = computeTeamsPrice(clampTeamsSeats(seats), interval);
    if (!calc.ok) {
      return interval === "yearly" ? "$15/seat/mo ($180/seat/yr)" : "$18/seat/mo";
    }
    if (interval === "yearly") {
      return `$${calc.yearlyMonthlyEquivalentUsd}/mo ($${calc.yearlyTotalUsd}/yr for ${calc.seats} ${calc.seats === 1 ? "seat" : "seats"})`;
    }
    return `$${calc.monthlyTotalUsd}/mo (${calc.seats} ${calc.seats === 1 ? "seat" : "seats"})`;
  }
  if (interval === "yearly") {
    return `$${def.yearlyMonthlyEquivalentUsd}/mo ($${def.yearlyTotalUsd}/yr)`;
  }
  return `$${def.monthlyPriceUsd}/mo`;
}

export function getChargeAmountCents(
  plan: PaidPlanTier,
  interval: BillingInterval,
  seats = 1,
): number {
  if (plan === "team") {
    const calc = computeTeamsPrice(clampTeamsSeats(seats), interval);
    return calc.ok ? calc.chargeCents : BILLING_PLAN_CATALOG.team.monthlyPriceCents;
  }
  const def = BILLING_PLAN_CATALOG.pro;
  return interval === "yearly" ? def.yearlyTotalCents : def.monthlyPriceCents;
}

export function getChargeAmountUsd(
  plan: PaidPlanTier,
  interval: BillingInterval,
  seats = 1,
): number {
  return getChargeAmountCents(plan, interval, seats) / 100;
}

export interface SubscriptionLifecycleEvaluation {
  grantsPaidAccess: boolean;
  isPastDueInGrace: boolean;
  isPastDueReadOnly: boolean;
  blocksSeatAndInviteMutations: boolean;
  pausePaidPublicDelivery: boolean;
  pauseAestheticExports: boolean;
  pastDueEndsAt: Date | null;
}

export function evaluateSubscriptionLifecycle(args: {
  status: string;
  currentPeriodEnd?: Date | null;
  pastDueSince?: Date | null;
  scheduledChangeAction?: string | null;
  now?: Date;
}): SubscriptionLifecycleEvaluation {
  const now = args.now ?? new Date();
  const normalized = args.status.trim().toLowerCase();

  const withinRenewalLock = Boolean(
    args.currentPeriodEnd &&
      args.currentPeriodEnd.getTime() - now.getTime() <=
        RENEWAL_LOCK_WINDOW_MINUTES * 60 * 1000 &&
      args.currentPeriodEnd.getTime() >= now.getTime(),
  );
  const hasScheduledChange = Boolean(
    args.scheduledChangeAction && args.scheduledChangeAction.trim().length > 0,
  );

  if (normalized === "active" || normalized === "trialing") {
    const isStale = Boolean(
      args.currentPeriodEnd &&
        now.getTime() - args.currentPeriodEnd.getTime() >
          STALE_ACTIVE_SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000,
    );
    return {
      grantsPaidAccess: !isStale,
      isPastDueInGrace: false,
      isPastDueReadOnly: false,
      blocksSeatAndInviteMutations: withinRenewalLock || hasScheduledChange,
      pausePaidPublicDelivery: false,
      pauseAestheticExports: false,
      pastDueEndsAt: null,
    };
  }

  if (normalized === "past_due") {
    const anchor = args.pastDueSince ?? args.currentPeriodEnd ?? now;
    const graceEndMs = anchor.getTime() + PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000;
    const pastDueEndsAt = new Date(graceEndMs);
    const inGrace = now.getTime() <= graceEndMs;

    return {
      grantsPaidAccess: inGrace,
      isPastDueInGrace: inGrace,
      isPastDueReadOnly: !inGrace,
      blocksSeatAndInviteMutations: true,
      pausePaidPublicDelivery: !inGrace,
      pauseAestheticExports: !inGrace,
      pastDueEndsAt,
    };
  }

  if (normalized === "cancel_at_period_end") {
    const activeUntilEnd = Boolean(
      args.currentPeriodEnd && args.currentPeriodEnd.getTime() > now.getTime(),
    );
    return {
      grantsPaidAccess: activeUntilEnd,
      isPastDueInGrace: false,
      isPastDueReadOnly: false,
      blocksSeatAndInviteMutations: true,
      pausePaidPublicDelivery: false,
      pauseAestheticExports: false,
      pastDueEndsAt: null,
    };
  }

  return {
    grantsPaidAccess: false,
    isPastDueInGrace: false,
    isPastDueReadOnly: false,
    blocksSeatAndInviteMutations: true,
    pausePaidPublicDelivery: false,
    pauseAestheticExports: false,
    pastDueEndsAt: null,
  };
}

/**
 * Determines whether a subscription row currently grants paid entitlements.
 * - `active`, `trialing`: grants access.
 * - `past_due`: grants existing usage during the 7-day grace window counted from `pastDueSince` (first failure).
 * - `cancel_at_period_end`: grants access until `currentPeriodEnd` (`paidThrough`).
 * - `paused`, `canceled`: revokes paid access once effective.
 */
export function isSubscriptionGrantingAccess(
  status: string,
  currentPeriodEnd: Date | null | undefined,
  now: Date = new Date(),
  pastDueSince?: Date | null,
): boolean {
  return evaluateSubscriptionLifecycle({
    status,
    currentPeriodEnd,
    pastDueSince,
    now,
  }).grantsPaidAccess;
}

export function isSubscriptionLockedForQuantityChange(args: {
  status: string;
  scheduledChangeAction?: string | null;
  currentPeriodEnd?: Date | null;
  now?: Date;
}): { locked: false; reason: null } | { locked: true; reason: string } {
  const now = args.now ?? new Date();
  const normalized = args.status.trim().toLowerCase();

  if (normalized === "past_due") {
    return {
      locked: true,
      reason: "Seat changes are locked while subscription payment is past due.",
    };
  }

  if (normalized === "paused" || normalized === "canceled" || normalized === "cancel_at_period_end") {
    return {
      locked: true,
      reason: "Seat changes are locked while the subscription is paused or scheduled to cancel.",
    };
  }

  if (args.scheduledChangeAction && args.scheduledChangeAction.trim().length > 0) {
    return {
      locked: true,
      reason: `Seat changes are locked while a scheduled subscription action (${args.scheduledChangeAction}) is pending.`,
    };
  }

  if (
    args.currentPeriodEnd &&
    args.currentPeriodEnd.getTime() - now.getTime() <= RENEWAL_LOCK_WINDOW_MINUTES * 60 * 1000 &&
    args.currentPeriodEnd.getTime() >= now.getTime()
  ) {
    return {
      locked: true,
      reason: `Seat changes are locked within ${RENEWAL_LOCK_WINDOW_MINUTES} minutes of renewal to prevent billing races.`,
    };
  }

  return { locked: false, reason: null };
}

