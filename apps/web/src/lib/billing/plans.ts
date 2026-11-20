import type { PlanTier } from "@casefolio/db";
import { z } from "zod";

export const PLAN_CATALOG_VERSION = "2026-11-19.v3" as const;

export const DECIMAL_KB = 1_000;
export const DECIMAL_MB = 1_000_000;
export const DECIMAL_GB = 1_000_000_000;

export const FREE_LIFETIME_PROJECT_LIMIT = 1;
export const PRO_MAX_PROJECTS = 10;

export const TEAMS_MIN_SEATS = 2;
export const TEAMS_MAX_SELF_SERVE_SEATS = 25;
export const TEAMS_CALCULATOR_DEFAULT_SEATS = 3;
export const TEAMS_CALCULATOR_QUICK_SEATS = [2, 3, 5, 10, 15, 25] as const;

/** @deprecated Legacy alias retained only for DB migration compatibility; Plus plan has been retired. */
export const PLUS_INCLUDED_SEATS = TEAMS_MAX_SELF_SERVE_SEATS;

export const ANNUAL_FREE_MONTHS = 2;

export const UNLIMITED_CASE_STUDIES = -1;
export const UNLIMITED_PROJECTS_LIMIT = 999_999;

export const QUOTA_WARNING_RATIO = 0.8;
export const PAID_GRACE_MAX_RATIO = 1.2;
export const PAID_GRACE_DURATION_DAYS = 7;
export const PAID_GRACE_COOLDOWN_DAYS = 365;
export const PAST_DUE_GRACE_DAYS = 10;

export const BILLING_FROZEN_REASONS = {
  PAST_DUE_EXPIRED: "past_due_over_10_days",
  LEGACY_PAST_DUE_7D: "past_due_over_7_days",
  TEAM_ENDED: "team_subscription_ended",
} as const;

export type RestorableBillingSuspensionBase =
  | "downgraded_pro_to_free_select_one"
  | "renewal_grace_expired"
  | "team_subscription_inactive";

const RESTORABLE_BILLING_BASES: readonly RestorableBillingSuspensionBase[] = [
  "downgraded_pro_to_free_select_one",
  "renewal_grace_expired",
  "team_subscription_inactive",
];

/**
 * Encodes pre-lock visibility (`public` | `unlisted`) in `published_snapshots.suspended_reason`
 * so public links paused on downgrade or 10-day renewal expiry restore to exact original visibility
 * upon repayment while keeping existing string values backwards-compatible.
 */
export function encodeBillingSuspendedReason(
  base: RestorableBillingSuspensionBase,
  visibility: "public" | "unlisted" | "private",
): string {
  return visibility === "unlisted" ? `${base}:unlisted` : base;
}

/**
 * Returns the original visibility to restore when a billing-suspended snapshot unlocks after
 * payment, or `null` if the suspension was non-billing (e.g. `moderation_takedown`).
 */
export function parseRestorableBillingSuspendedReason(
  reason: string | null | undefined,
): "public" | "unlisted" | null {
  if (!reason) return null;
  const trimmed = reason.trim();
  for (const base of RESTORABLE_BILLING_BASES) {
    if (trimmed === base || trimmed === `${base}:public`) {
      return "public";
    }
    if (trimmed === `${base}:unlisted`) {
      return "unlisted";
    }
  }
  return null;
}

export function isPastDueFrozenReason(reason: string | null | undefined): boolean {
  return (
    reason === BILLING_FROZEN_REASONS.PAST_DUE_EXPIRED ||
    reason === BILLING_FROZEN_REASONS.LEGACY_PAST_DUE_7D ||
    reason === "past_due_expired"
  );
}

export function getPastDueDaysRemaining(
  pastDueEndsAt: Date | null | undefined,
  now: Date = new Date(),
): number {
  if (!pastDueEndsAt) return 0;
  const diffMs = pastDueEndsAt.getTime() - now.getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}
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

export const BILLING_INTERVAL_INPUTS = ["monthly", "yearly", "annual"] as const;
export type BillingIntervalInput = (typeof BILLING_INTERVAL_INPUTS)[number];

export function normalizeBillingInterval(
  value: BillingIntervalInput | string | null | undefined,
): BillingInterval {
  if (value === "yearly" || value === "annual") {
    return "yearly";
  }
  return "monthly";
}

export const ACTIVE_PLAN_TIERS = ["free", "pro", "team"] as const;
export type ActivePlanTier = (typeof ACTIVE_PLAN_TIERS)[number];

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
    interval: z
      .enum(BILLING_INTERVAL_INPUTS)
      .default("monthly")
      .transform((val) => normalizeBillingInterval(val)),
    orgId: z.string().uuid().optional().nullable(),
    seats: z.number().int().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.plan === "pro" && val.seats !== undefined && val.seats !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["seats"],
        message: "Pro covers 1 seat in your personal workspace.",
      });
    }
    if (val.plan === "team" && val.seats !== undefined) {
      if (val.seats < TEAMS_MIN_SEATS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["seats"],
          message: `Teams requires at least ${TEAMS_MIN_SEATS} seats (${TEAMS_MIN_SEATS}–${TEAMS_MAX_SELF_SERVE_SEATS} seats).`,
        });
      } else if (val.seats > TEAMS_MAX_SELF_SERVE_SEATS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["seats"],
          message: `Self-serve Teams supports ${TEAMS_MIN_SEATS}–${TEAMS_MAX_SELF_SERVE_SEATS} seats. Contact support for 26+ enterprise seats.`,
        });
      }
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

export function centsToUsd(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

export function formatUsdFromCents(cents: number): string {
  if (cents % 100 === 0) {
    return `$${cents / 100}`;
  }
  return `$${(cents / 100).toFixed(2)}`;
}

export function isUnlimitedProjectsLimit(limit: number | null | undefined): boolean {
  if (limit === null || limit === undefined) return true;
  return limit < 0 || !Number.isFinite(limit) || limit === UNLIMITED_PROJECTS_LIMIT;
}

export interface BillingPlanDefinition {
  tier: PlanTier;
  name: string;
  tagline: string;
  scopeSummary: string;
  includesLabel?: string;
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
  maxCaseStudies: number;
  customSlugEnabled: boolean;
  customDomainEnabled: boolean;
  watermarkEnabled: boolean;
  whiteLabelEnabled: boolean;
  highlighted?: boolean;
  features: readonly string[];
}

const TEAMS_CATALOG_DEFINITION: BillingPlanDefinition = {
  tier: "team",
  name: "Teams",
  tagline: "Built for product design teams and studios collaborating with per-seat control.",
  scopeSummary: `Shared Team Workspace · ${TEAMS_MIN_SEATS}–${TEAMS_MAX_SELF_SERVE_SEATS} seats`,
  includesLabel: "Includes everything in Pro, plus:",
  monthlyPriceCents: 599,
  yearlyTotalCents: 5_990,
  yearlyMonthlyEquivalentCents: 499,
  yearlySavingsCents: 1_198,
  monthlyPriceUsd: 5.99,
  yearlyTotalUsd: 59.9,
  yearlyMonthlyEquivalentUsd: 4.99,
  yearlySavingsPercent: 17,
  perSeatPricing: true,
  defaultSeats: TEAMS_CALCULATOR_DEFAULT_SEATS,
  minSeats: TEAMS_MIN_SEATS,
  maxSeats: TEAMS_MAX_SELF_SERVE_SEATS,
  maxCaseStudies: UNLIMITED_CASE_STUDIES,
  customSlugEnabled: true,
  customDomainEnabled: false,
  watermarkEnabled: false,
  whiteLabelEnabled: false,
  features: [
    `${TEAMS_MIN_SEATS}–${TEAMS_MAX_SELF_SERVE_SEATS} seats ($5.99/seat/mo · 2 months free on annual)`,
    "Unlimited shared Case Studies across your studio",
    "Team Dashboard: invite by email, track invite status & manage roles",
    "Custom Case Study URLs (/p/your-custom-slug) on all live links",
    "Shared Brand Kit, 10 GB/seat pooled storage & 365-day analytics",
  ],
};

export const BILLING_PLAN_CATALOG: Record<PlanTier, BillingPlanDefinition> = {
  free: {
    tier: "free",
    name: "Free",
    tagline: "Build and publish 1 complete UI/UX Case Study from A to Z for free.",
    scopeSummary: "Personal workspace · 1 lifetime Case Study credit",
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
    maxCaseStudies: FREE_LIFETIME_PROJECT_LIMIT,
    customSlugEnabled: false,
    customDomainEnabled: false,
    watermarkEnabled: true,
    whiteLabelEnabled: false,
    features: [
      "1 user (Personal workspace)",
      "1 complete Case Study credit (one-time lifetime allowance)",
      "Full A-to-Z builder with starter templates, colors & typography",
      "1× PNG & PDF exports (includes subtle Casefolio watermark)",
      "Shareable auto-generated public link (custom URL requires Pro)",
    ],
  },
  pro: {
    tier: "pro",
    name: "Pro",
    tagline: "Built for freelance designers and solo creators rotating up to 10 active projects.",
    scopeSummary: `Solo designer plan · Up to ${PRO_MAX_PROJECTS} active projects`,
    includesLabel: "Includes everything in Free, plus:",
    monthlyPriceCents: 799,
    yearlyTotalCents: 7_990,
    yearlyMonthlyEquivalentCents: 666,
    yearlySavingsCents: 1_598,
    monthlyPriceUsd: 7.99,
    yearlyTotalUsd: 79.9,
    yearlyMonthlyEquivalentUsd: 6.66,
    yearlySavingsPercent: 17,
    perSeatPricing: false,
    defaultSeats: 1,
    minSeats: 1,
    maxSeats: 1,
    maxCaseStudies: PRO_MAX_PROJECTS,
    customSlugEnabled: true,
    customDomainEnabled: false,
    watermarkEnabled: false,
    whiteLabelEnabled: false,
    highlighted: true,
    features: [
      "1 seat (Personal workspace)",
      `Up to ${PRO_MAX_PROJECTS} active Case Studies (delete & replace anytime)`,
      "Custom Case Study URL (/p/your-custom-slug) for every live project",
      "Full access to all Pro & Premium templates and custom styling",
      "Watermark-free 2× Retina PNG, PDF & Behance 1400px exports",
      "90-day live portfolio view analytics",
    ],
  },
  team: TEAMS_CATALOG_DEFINITION,
  plus: {
    ...TEAMS_CATALOG_DEFINITION,
    tier: "plus",
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
  intervalInput: BillingIntervalInput = "monthly",
): TeamsPriceResult {
  const interval = normalizeBillingInterval(intervalInput);
  if (!Number.isInteger(seats) || seats < TEAMS_MIN_SEATS) {
    return {
      ok: false,
      code: "INVALID_SEATS",
      seats,
      maxSelfServeSeats: TEAMS_MAX_SELF_SERVE_SEATS,
      message: `Teams plan requires between ${TEAMS_MIN_SEATS} and ${TEAMS_MAX_SELF_SERVE_SEATS} seats.`,
    };
  }

  if (seats > TEAMS_MAX_SELF_SERVE_SEATS) {
    return {
      ok: false,
      code: "CAPACITY_REVIEW_REQUIRED",
      seats,
      maxSelfServeSeats: TEAMS_MAX_SELF_SERVE_SEATS,
      message: `Self-serve Teams supports ${TEAMS_MIN_SEATS}–${TEAMS_MAX_SELF_SERVE_SEATS} seats. Contact support for 26+ enterprise seats.`,
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
    monthlyTotalUsd: centsToUsd(monthlyTotalCents),
    yearlyTotalCents,
    yearlyTotalUsd: centsToUsd(yearlyTotalCents),
    yearlyMonthlyEquivalentCents,
    yearlyMonthlyEquivalentUsd: centsToUsd(yearlyMonthlyEquivalentCents),
    annualSavingsCents,
    annualSavingsUsd: centsToUsd(annualSavingsCents),
    chargeCents,
    chargeUsd: centsToUsd(chargeCents),
  };
}

export interface WorkspacePlanQuotas {
  plan: PlanTier;
  paidSeats: number;
  maxCaseStudies: number;
  activeProjectsLimit: number;
  publishedProjectsLimit: number;
  retainedProjectsLimit: number;
  lifetimeProjectsLimit: number | null;
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
  customSlugEnabled: boolean;
  brandingRemovable: boolean;
  watermarkEnabled: boolean;
  customDomainEnabled: boolean;
  whiteLabelEnabled: boolean;
  collaborationEnabled: boolean;
}

export function clampTeamsSeats(rawSeats?: number | null): number {
  if (typeof rawSeats !== "number" || !Number.isFinite(rawSeats)) {
    return TEAMS_MIN_SEATS;
  }
  return Math.max(TEAMS_MIN_SEATS, Math.min(TEAMS_MAX_SELF_SERVE_SEATS, Math.floor(rawSeats)));
}

export function getWorkspaceQuotas(
  plan: PlanTier,
  rawPaidSeats = 1,
): WorkspacePlanQuotas {
  if (plan === "team" || plan === "plus") {
    const S = clampTeamsSeats(rawPaidSeats);
    return {
      plan: "team",
      paidSeats: S,
      maxCaseStudies: UNLIMITED_CASE_STUDIES,
      activeProjectsLimit: UNLIMITED_PROJECTS_LIMIT,
      publishedProjectsLimit: UNLIMITED_PROJECTS_LIMIT,
      retainedProjectsLimit: UNLIMITED_PROJECTS_LIMIT,
      lifetimeProjectsLimit: null,
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
      customSlugEnabled: true,
      brandingRemovable: true,
      watermarkEnabled: false,
      customDomainEnabled: false,
      whiteLabelEnabled: false,
      collaborationEnabled: true,
    };
  }

  if (plan === "pro") {
    return {
      plan: "pro",
      paidSeats: 1,
      maxCaseStudies: PRO_MAX_PROJECTS,
      activeProjectsLimit: PRO_MAX_PROJECTS,
      publishedProjectsLimit: PRO_MAX_PROJECTS,
      retainedProjectsLimit: UNLIMITED_PROJECTS_LIMIT,
      lifetimeProjectsLimit: null,
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
      customSlugEnabled: true,
      brandingRemovable: true,
      watermarkEnabled: false,
      customDomainEnabled: false,
      whiteLabelEnabled: false,
      collaborationEnabled: false,
    };
  }

  return {
    plan: "free",
    paidSeats: 1,
    maxCaseStudies: FREE_LIFETIME_PROJECT_LIMIT,
    activeProjectsLimit: FREE_LIFETIME_PROJECT_LIMIT,
    publishedProjectsLimit: FREE_LIFETIME_PROJECT_LIMIT,
    retainedProjectsLimit: UNLIMITED_PROJECTS_LIMIT,
    lifetimeProjectsLimit: FREE_LIFETIME_PROJECT_LIMIT,
    storageBytesLimit: 250 * DECIMAL_MB,
    monthlyUploadsBytesLimit: 500 * DECIMAL_MB,
    monthlyBandwidthBytesLimit: 1 * DECIMAL_GB,
    maxFileBytes: 10 * DECIMAL_MB,
    monthlyExportsLimit: 5,
    maxPngWidthPx: 1_440,
    maxExportMegapixels: 40,
    maxPdfPages: 60,
    exportTimeoutSeconds: 60,
    privateSpacesPerMemberLimit: 1,
    sharedSpacesLimit: 0,
    analyticsRetentionDays: 7,
    historyRetentionDays: 7,
    customSlugEnabled: false,
    brandingRemovable: false,
    watermarkEnabled: true,
    customDomainEnabled: false,
    whiteLabelEnabled: false,
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
  if (isUnlimitedProjectsLimit(input.limit)) {
    return {
      allowed: true,
      status: "ok",
      ratio: 0,
      percentUsed: 0,
      remaining: UNLIMITED_PROJECTS_LIMIT,
      canActivateGrace: false,
      effectiveCeiling: UNLIMITED_PROJECTS_LIMIT,
    };
  }

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
  intervalInput: BillingIntervalInput = "monthly",
  seats?: number,
): string {
  if (plan === "free") {
    return "Free";
  }
  const interval = normalizeBillingInterval(intervalInput);
  const suffix = interval === "yearly" ? "Annual" : "Monthly";
  if (plan === "team" || plan === "plus") {
    const count = typeof seats === "number" && seats >= 1 ? seats : TEAMS_MIN_SEATS;
    return `Teams (${count} ${count === 1 ? "seat" : "seats"}) · ${suffix}`;
  }
  return `Pro · ${suffix}`;
}

export function formatPlanAmountSummary(
  plan: PlanTier,
  intervalInput: BillingIntervalInput = "monthly",
  seats = TEAMS_MIN_SEATS,
): string {
  const interval = normalizeBillingInterval(intervalInput);
  const def = BILLING_PLAN_CATALOG[plan];
  if (plan === "free") {
    return "$0 / forever";
  }
  if (plan === "team" || plan === "plus") {
    const calc = computeTeamsPrice(clampTeamsSeats(seats), interval);
    if (!calc.ok) {
      return interval === "yearly"
        ? "$4.99/seat/mo (billed annually · 2 months free)"
        : "$5.99/seat/mo";
    }
    if (interval === "yearly") {
      return `${formatUsdFromCents(calc.yearlyMonthlyEquivalentCents)}/mo (${formatUsdFromCents(calc.yearlyTotalCents)}/yr for ${calc.seats} seats · 2 months free)`;
    }
    return `${formatUsdFromCents(calc.monthlyTotalCents)}/mo (${calc.seats} seats)`;
  }
  if (interval === "yearly") {
    return `${formatUsdFromCents(def.yearlyMonthlyEquivalentCents)}/mo (billed ${formatUsdFromCents(def.yearlyTotalCents)}/yr · 2 months free)`;
  }
  return `${formatUsdFromCents(def.monthlyPriceCents)}/mo`;
}

export function getChargeAmountCents(
  plan: PaidPlanTier | PlanTier,
  intervalInput: BillingIntervalInput,
  seats = 1,
): number {
  const interval = normalizeBillingInterval(intervalInput);
  if (plan === "free") return 0;
  if (plan === "team" || plan === "plus") {
    const calc = computeTeamsPrice(clampTeamsSeats(seats), interval);
    return calc.ok ? calc.chargeCents : BILLING_PLAN_CATALOG.team.monthlyPriceCents * TEAMS_MIN_SEATS;
  }
  const def = BILLING_PLAN_CATALOG.pro;
  return interval === "yearly" ? def.yearlyTotalCents : def.monthlyPriceCents;
}

export function getChargeAmountUsd(
  plan: PaidPlanTier | PlanTier,
  intervalInput: BillingIntervalInput,
  seats = 1,
): number {
  return centsToUsd(getChargeAmountCents(plan, intervalInput, seats));
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
