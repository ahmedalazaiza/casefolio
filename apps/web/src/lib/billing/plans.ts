import type { PlanTier } from "@casefolio/db";
import { z } from "zod";

export const PLAN_CATALOG_VERSION = "2026-11-13.v2" as const;

export const DECIMAL_KB = 1_000;
export const DECIMAL_MB = 1_000_000;
export const DECIMAL_GB = 1_000_000_000;

export const TEAMS_MIN_SEATS = 2;
export const TEAMS_MAX_SELF_SERVE_SEATS = 10;
export const PLUS_INCLUDED_SEATS = 20;
export const TEAMS_CALCULATOR_DEFAULT_SEATS = 3;
export const TEAMS_CALCULATOR_QUICK_SEATS = [2, 3, 5, 8, 10] as const;

export const UNLIMITED_CASE_STUDIES = -1;
export const UNLIMITED_PROJECTS_LIMIT = 999_999;

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

export const PAID_PLAN_TIERS = ["pro", "team", "plus"] as const;
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
          message: `Team requires at least ${TEAMS_MIN_SEATS} seats (${TEAMS_MIN_SEATS}–${TEAMS_MAX_SELF_SERVE_SEATS} seats).`,
        });
      } else if (val.seats > TEAMS_MAX_SELF_SERVE_SEATS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["seats"],
          message: `Team supports ${TEAMS_MIN_SEATS}–${TEAMS_MAX_SELF_SERVE_SEATS} seats. Upgrade to Plus for up to ${PLUS_INCLUDED_SEATS} team seats.`,
        });
      }
    }
    if (
      val.plan === "plus" &&
      val.seats !== undefined &&
      (val.seats < 1 || val.seats > PLUS_INCLUDED_SEATS)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["seats"],
        message: `Plus is a flat-rate plan including up to ${PLUS_INCLUDED_SEATS} team seats.`,
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
  customDomainEnabled: boolean;
  watermarkEnabled: boolean;
  whiteLabelEnabled: boolean;
  highlighted?: boolean;
  features: readonly string[];
}

export const BILLING_PLAN_CATALOG: Record<PlanTier, BillingPlanDefinition> = {
  free: {
    tier: "free",
    name: "Free",
    tagline: "Explore the Casefolio builder and publish your first UI/UX case study for free.",
    scopeSummary: "Personal workspace · 1 user",
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
    maxCaseStudies: 1,
    customDomainEnabled: false,
    watermarkEnabled: true,
    whiteLabelEnabled: false,
    features: [
      "1 user (Personal workspace only)",
      "Maximum 1 active Case Study",
      "Standard templates & essential color and font styling",
      "PNG & PDF exports (includes subtle Casefolio watermark)",
      "Live Shareable Link on casefolio.app",
    ],
  },
  pro: {
    tier: "pro",
    name: "Pro",
    tagline: "Built for freelance designers and solo creators shipping unlimited case studies.",
    scopeSummary: "Solo designer plan · 1 seat",
    includesLabel: "Includes everything in Free, plus:",
    monthlyPriceCents: 999,
    yearlyTotalCents: 9_588,
    yearlyMonthlyEquivalentCents: 799,
    yearlySavingsCents: 2_400,
    monthlyPriceUsd: 9.99,
    yearlyTotalUsd: 95.88,
    yearlyMonthlyEquivalentUsd: 7.99,
    yearlySavingsPercent: 20,
    perSeatPricing: false,
    defaultSeats: 1,
    minSeats: 1,
    maxSeats: 1,
    maxCaseStudies: UNLIMITED_CASE_STUDIES,
    customDomainEnabled: false,
    watermarkEnabled: false,
    whiteLabelEnabled: false,
    features: [
      "1 seat (Personal workspace)",
      "Unlimited Case Studies",
      "Full access to all Pro & Premium templates",
      "Full styling control (custom fonts, palettes & custom sections)",
      "Watermark-free high-res PNG, PDF & Behance 1400px exports",
      "Live Shareable Link + basic 90-day view analytics",
    ],
  },
  team: {
    tier: "team",
    name: "Team",
    tagline: "Designed for product design teams and studios collaborating in one workspace.",
    scopeSummary: "Shared Team Workspace · 2–10 seats",
    includesLabel: "Includes everything in Pro, plus:",
    monthlyPriceCents: 699,
    yearlyTotalCents: 6_708,
    yearlyMonthlyEquivalentCents: 559,
    yearlySavingsCents: 1_680,
    monthlyPriceUsd: 6.99,
    yearlyTotalUsd: 67.08,
    yearlyMonthlyEquivalentUsd: 5.59,
    yearlySavingsPercent: 20,
    perSeatPricing: true,
    defaultSeats: TEAMS_CALCULATOR_DEFAULT_SEATS,
    minSeats: TEAMS_MIN_SEATS,
    maxSeats: TEAMS_MAX_SELF_SERVE_SEATS,
    maxCaseStudies: UNLIMITED_CASE_STUDIES,
    customDomainEnabled: false,
    watermarkEnabled: false,
    whiteLabelEnabled: false,
    highlighted: true,
    features: [
      "2–10 seats ($6.99/seat/mo or $5.59/seat/mo billed annually)",
      "Shared Team Workspace with Admin, Editor & Viewer permissions",
      "Unlimited shared Case Studies across your studio",
      "Shared Brand Kit (team logos, colors & reusable custom sections)",
      "Real-time commenting & review mode on Case Studies",
    ],
  },
  plus: {
    tier: "plus",
    name: "Plus",
    tagline: "Built for design agencies and larger teams needing white-labeled client delivery.",
    scopeSummary: "Agency plan · Up to 20 team seats included",
    includesLabel: "Includes everything in Team, plus:",
    monthlyPriceCents: 9_900,
    yearlyTotalCents: 94_800,
    yearlyMonthlyEquivalentCents: 7_900,
    yearlySavingsCents: 24_000,
    monthlyPriceUsd: 99,
    yearlyTotalUsd: 948,
    yearlyMonthlyEquivalentUsd: 79,
    yearlySavingsPercent: 20,
    perSeatPricing: false,
    defaultSeats: PLUS_INCLUDED_SEATS,
    minSeats: 1,
    maxSeats: PLUS_INCLUDED_SEATS,
    maxCaseStudies: UNLIMITED_CASE_STUDIES,
    customDomainEnabled: true,
    watermarkEnabled: false,
    whiteLabelEnabled: true,
    features: [
      "Up to 20 team seats included at one flat rate (no per-seat math)",
      "Connect custom domains for live links (e.g., work.youragency.com)",
      "Complete white-labeling across live pages, links & PDF metadata",
      "Unlimited shared Case Studies, Shared Brand Kit & 200 GB storage",
      "Priority 24/7 support & dedicated onboarding",
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
      code: "INVALID_SEATS" | "PLUS_UPGRADE_REQUIRED" | "CAPACITY_REVIEW_REQUIRED";
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
      message: `Team plan requires between ${TEAMS_MIN_SEATS} and ${TEAMS_MAX_SELF_SERVE_SEATS} seats.`,
    };
  }

  if (seats > TEAMS_MAX_SELF_SERVE_SEATS) {
    const fitsPlus = seats <= PLUS_INCLUDED_SEATS;
    return {
      ok: false,
      code: fitsPlus ? "PLUS_UPGRADE_REQUIRED" : "CAPACITY_REVIEW_REQUIRED",
      seats,
      maxSelfServeSeats: TEAMS_MAX_SELF_SERVE_SEATS,
      message: fitsPlus
        ? `Team supports ${TEAMS_MIN_SEATS}–${TEAMS_MAX_SELF_SERVE_SEATS} seats. Upgrade to Plus ($99/mo or $79/mo billed annually) for up to ${PLUS_INCLUDED_SEATS} team seats.`
        : `Team supports up to ${TEAMS_MAX_SELF_SERVE_SEATS} seats and Plus includes up to ${PLUS_INCLUDED_SEATS} seats. Contact us for 21+ enterprise seats.`,
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
  if (plan === "plus") {
    const S = PLUS_INCLUDED_SEATS;
    return {
      plan: "plus",
      paidSeats: S,
      maxCaseStudies: UNLIMITED_CASE_STUDIES,
      activeProjectsLimit: UNLIMITED_PROJECTS_LIMIT,
      publishedProjectsLimit: UNLIMITED_PROJECTS_LIMIT,
      retainedProjectsLimit: UNLIMITED_PROJECTS_LIMIT,
      storageBytesLimit: 10 * DECIMAL_GB * S,
      monthlyUploadsBytesLimit: 20 * DECIMAL_GB * S,
      monthlyBandwidthBytesLimit: 25 * DECIMAL_GB * S,
      maxFileBytes: 50 * DECIMAL_MB,
      monthlyExportsLimit: 2_000,
      maxPngWidthPx: 2_880,
      maxExportMegapixels: 120,
      maxPdfPages: 60,
      exportTimeoutSeconds: 120,
      privateSpacesPerMemberLimit: 10,
      sharedSpacesLimit: 10 * S,
      analyticsRetentionDays: 365,
      historyRetentionDays: 90,
      brandingRemovable: true,
      watermarkEnabled: false,
      customDomainEnabled: true,
      whiteLabelEnabled: true,
      collaborationEnabled: true,
    };
  }

  if (plan === "team") {
    const S = clampTeamsSeats(rawPaidSeats);
    return {
      plan: "team",
      paidSeats: S,
      maxCaseStudies: UNLIMITED_CASE_STUDIES,
      activeProjectsLimit: UNLIMITED_PROJECTS_LIMIT,
      publishedProjectsLimit: UNLIMITED_PROJECTS_LIMIT,
      retainedProjectsLimit: UNLIMITED_PROJECTS_LIMIT,
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
      maxCaseStudies: UNLIMITED_CASE_STUDIES,
      activeProjectsLimit: UNLIMITED_PROJECTS_LIMIT,
      publishedProjectsLimit: UNLIMITED_PROJECTS_LIMIT,
      retainedProjectsLimit: UNLIMITED_PROJECTS_LIMIT,
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
      watermarkEnabled: false,
      customDomainEnabled: false,
      whiteLabelEnabled: false,
      collaborationEnabled: false,
    };
  }

  return {
    plan: "free",
    paidSeats: 1,
    maxCaseStudies: 1,
    activeProjectsLimit: 1,
    publishedProjectsLimit: 1,
    retainedProjectsLimit: UNLIMITED_PROJECTS_LIMIT,
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
  if (plan === "plus") {
    return `Plus (up to ${PLUS_INCLUDED_SEATS} seats) · ${suffix}`;
  }
  if (plan === "team") {
    const count = typeof seats === "number" && seats >= 1 ? seats : TEAMS_MIN_SEATS;
    return `Team (${count} ${count === 1 ? "seat" : "seats"}) · ${suffix}`;
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
  if (plan === "team") {
    const calc = computeTeamsPrice(clampTeamsSeats(seats), interval);
    if (!calc.ok) {
      return interval === "yearly"
        ? "$5.59/seat/mo (billed annually)"
        : "$6.99/seat/mo";
    }
    if (interval === "yearly") {
      return `${formatUsdFromCents(calc.yearlyMonthlyEquivalentCents)}/mo (${formatUsdFromCents(calc.yearlyTotalCents)}/yr for ${calc.seats} seats)`;
    }
    return `${formatUsdFromCents(calc.monthlyTotalCents)}/mo (${calc.seats} seats)`;
  }
  if (interval === "yearly") {
    return `${formatUsdFromCents(def.yearlyMonthlyEquivalentCents)}/mo (billed ${formatUsdFromCents(def.yearlyTotalCents)}/yr)`;
  }
  return `${formatUsdFromCents(def.monthlyPriceCents)}/mo`;
}

export function getChargeAmountCents(
  plan: PaidPlanTier,
  intervalInput: BillingIntervalInput,
  seats = 1,
): number {
  const interval = normalizeBillingInterval(intervalInput);
  if (plan === "team") {
    const calc = computeTeamsPrice(clampTeamsSeats(seats), interval);
    return calc.ok ? calc.chargeCents : BILLING_PLAN_CATALOG.team.monthlyPriceCents * TEAMS_MIN_SEATS;
  }
  if (plan === "plus") {
    const def = BILLING_PLAN_CATALOG.plus;
    return interval === "yearly" ? def.yearlyTotalCents : def.monthlyPriceCents;
  }
  const def = BILLING_PLAN_CATALOG.pro;
  return interval === "yearly" ? def.yearlyTotalCents : def.monthlyPriceCents;
}

export function getChargeAmountUsd(
  plan: PaidPlanTier,
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
