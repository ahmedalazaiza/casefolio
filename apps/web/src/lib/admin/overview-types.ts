import type { PlanTier, ProjectType, TemplateStatus } from "@casefolio/db";
import { z } from "zod";
import { BILLING_PLAN_CATALOG, type BillingInterval } from "@/lib/billing/plans";

export const ADMIN_OVERVIEW_RANGES = ["7d", "30d", "90d"] as const;
export type AdminOverviewRange = (typeof ADMIN_OVERVIEW_RANGES)[number];

export const adminOverviewRangeSchema = z.enum(ADMIN_OVERVIEW_RANGES).catch("30d");

export const ADMIN_ANALYTICS_RANGES = ["7d", "30d", "90d", "all"] as const;
export type AdminAnalyticsRange = (typeof ADMIN_ANALYTICS_RANGES)[number];

export const adminAnalyticsRangeSchema = z.enum(ADMIN_ANALYTICS_RANGES).catch("30d");

export function getRangeDays(range: AdminOverviewRange | AdminAnalyticsRange): number | null {
  if (range === "7d") return 7;
  if (range === "30d") return 30;
  if (range === "90d") return 90;
  return null;
}

export function formatProjectTypeLabel(type: ProjectType): string {
  if (type === "mobile") return "Mobile app";
  if (type === "web") return "Website";
  return "Mobile + Web";
}

export function formatTemplateStatusLabel(status: TemplateStatus): string {
  if (status === "published") return "Published";
  if (status === "archived") return "Archived";
  return "Draft";
}

export function computeSubscriptionMrrUsd(
  plan: PlanTier,
  interval: BillingInterval,
  seats = 1,
): number {
  const def = BILLING_PLAN_CATALOG[plan];
  if (!def || plan === "free") return 0;
  const unit = interval === "yearly" ? def.yearlyMonthlyEquivalentUsd : def.monthlyPriceUsd;
  const raw = def.perSeatPricing ? unit * Math.max(1, Math.floor(seats)) : unit;
  return Math.round(raw * 100) / 100;
}

export function detectSubscriptionInterval(args: {
  createdAt: Date;
  currentPeriodEnd: Date | null;
  webhookBillingInterval?: BillingInterval | null;
}): BillingInterval {
  if (args.webhookBillingInterval === "yearly" || args.webhookBillingInterval === "monthly") {
    return args.webhookBillingInterval;
  }
  if (args.currentPeriodEnd) {
    const diffDays =
      (args.currentPeriodEnd.getTime() - args.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays >= 60) {
      return "yearly";
    }
  }
  return "monthly";
}

export function formatDeltaBadge(current: number, previous: number, suffix = "vs last period"): string {
  if (previous === 0) {
    if (current === 0) return `0 ${suffix}`;
    return `+${current.toLocaleString("en-US")} new`;
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct}% ${suffix}`;
}

export function formatUsdWhole(amountUsd: number): string {
  return `$${Math.round(amountUsd).toLocaleString("en-US")}`;
}

export function formatCompactCount(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (value >= 10_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return value.toLocaleString("en-US");
}

export interface AdminOverviewBucket {
  index: number;
  label: string;
  startIso: string;
  endIso: string;
  signups: number;
  publishes: number;
}

export interface AdminNeedsAttentionItem {
  id: "reported_case_studies" | "draft_templates" | "failed_payments" | "empty_slot_templates";
  count: number;
  label: string;
  badgeLabel: string;
  tone: "danger" | "draft" | "neutral";
  href: string;
}

export interface AdminTopTemplateRow {
  id: string;
  slug: string;
  name: string;
  type: ProjectType;
  status: TemplateStatus;
  version: string | null;
  projectCount: number;
}

export interface AdminOverviewMetrics {
  range: AdminOverviewRange;
  rangeDays: number;
  totalUsers: number;
  newUsersInRange: number;
  newUsersPrevRange: number;
  activeSubscriptions: number;
  mrrUsd: number;
  publishedCaseStudies: number;
  publishesInRange: number;
  publishesPrevRange: number;
  completedExports: number;
  exportsInRange: number;
  exportsPrevRange: number;
  publishedTemplates: number;
  draftTemplates: number;
  archivedTemplates: number;
  buckets: AdminOverviewBucket[];
  needsAttention: AdminNeedsAttentionItem[];
  topTemplates: AdminTopTemplateRow[];
}

export interface AdminTemplateUsageShare {
  id: string;
  name: string;
  status: TemplateStatus;
  projectCount: number;
  sharePercent: number;
}

export interface AdminTopCaseStudyRow {
  id: string;
  name: string;
  slug: string | null;
  authorName: string;
  templateName: string;
  views: number;
  exports: number;
}

export interface AdminWeeklyPublishBucket {
  index: number;
  label: string;
  publishes: number;
}

export interface AdminPlatformAnalytics {
  range: AdminAnalyticsRange;
  publishedCaseStudies: number;
  publishesPrevPeriod: number | null;
  publicViews: number;
  viewsPrevPeriod: number | null;
  completedExports: number;
  exportsPrevPeriod: number | null;
  totalUsers: number;
  paidUsers: number;
  freeToProRatePercent: number;
  weeklyPublishes: AdminWeeklyPublishBucket[];
  templateUsage: AdminTemplateUsageShare[];
  topCaseStudies: AdminTopCaseStudyRow[];
}

function escapeCsvCell(value: string | number): string {
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function serializeAdminAnalyticsCsv(analytics: AdminPlatformAnalytics): string {
  const lines: string[] = [
    ["Case Study", "Slug", "Author", "Template", "Views", "Completed Exports"]
      .map(escapeCsvCell)
      .join(","),
  ];

  for (const row of analytics.topCaseStudies) {
    lines.push(
      [
        row.name,
        row.slug ?? "",
        row.authorName,
        row.templateName,
        row.views,
        row.exports,
      ]
        .map(escapeCsvCell)
        .join(","),
    );
  }

  return lines.join("\n");
}
