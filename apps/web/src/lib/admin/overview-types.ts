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
  const normalizedPlan: PlanTier = plan === "plus" ? "team" : plan;
  const def = BILLING_PLAN_CATALOG[normalizedPlan];
  if (!def || normalizedPlan === "free") return 0;
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

export interface AdminExportFormatTelemetry {
  format: string;
  total: number;
  completed: number;
  failed: number;
}

export interface AdminSubscriberTelemetry {
  freeUsers: number;
  proMonthly: number;
  proAnnual: number;
  teamWorkspaces: number;
  teamPaidSeats: number;
  pastDueSubscriptions: number;
  canceledInRange: number;
  mrrUsd: number;
  arrUsd: number;
}

export interface AdminViewsBucketTelemetry {
  index: number;
  label: string;
  views: number;
}

export interface AdminPlatformAnalyticsTelemetry {
  uniqueVisitors: number;
  failedExports: number;
  exportsByFormat: AdminExportFormatTelemetry[];
  subscribers: AdminSubscriberTelemetry;
  viewsByBucket: AdminViewsBucketTelemetry[];
  feedbackSummary: {
    totalResponses: number;
    averageRating: number | null;
  };
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
  telemetry?: AdminPlatformAnalyticsTelemetry;
}

function escapeCsvCell(value: string | number): string {
  const str = String(value);
  const sanitized = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  if (/[",\n\r]/.test(sanitized)) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}

export function serializeAdminAnalyticsCsv(analytics: AdminPlatformAnalytics): string {
  const lines: string[] = [
    ["Metric / Case Study", "Slug / Scope", "Author / Category", "Template / Status", "Views / Value", "Completed Exports / Extra"]
      .map(escapeCsvCell)
      .join(","),
    [
      "Platform Summary",
      analytics.range,
      `${analytics.totalUsers} users (${analytics.paidUsers} paid)`,
      `MRR $${analytics.telemetry?.subscribers.mrrUsd ?? 0}`,
      analytics.publicViews,
      analytics.completedExports,
    ]
      .map(escapeCsvCell)
      .join(","),
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

export function serializeSubscribersTelemetryCsv(analytics: AdminPlatformAnalytics): string {
  const sub = analytics.telemetry?.subscribers;
  const lines: string[] = [
    ["Segment", "Count", "Metric Note"].map(escapeCsvCell).join(","),
    ["Total Registered Users", analytics.totalUsers, "All accounts"].map(escapeCsvCell).join(","),
    ["Free Tier Users", sub?.freeUsers ?? Math.max(0, analytics.totalUsers - analytics.paidUsers), "Free lifetime 1 credit"].map(escapeCsvCell).join(","),
    ["Pro Monthly Active", sub?.proMonthly ?? 0, "$7.99/mo"].map(escapeCsvCell).join(","),
    ["Pro Annual Active", sub?.proAnnual ?? 0, "$79.90/yr (2 months free)"].map(escapeCsvCell).join(","),
    ["Teams Active Workspaces", sub?.teamWorkspaces ?? 0, `${sub?.teamPaidSeats ?? 0} paid seats`].map(escapeCsvCell).join(","),
    ["Past Due (10-day grace)", sub?.pastDueSubscriptions ?? 0, "Pending renewal payment"].map(escapeCsvCell).join(","),
    ["Canceled In Period", sub?.canceledInRange ?? 0, `Range ${analytics.range}`].map(escapeCsvCell).join(","),
    ["MRR (USD)", sub?.mrrUsd ?? 0, "Estimated monthly recurring"].map(escapeCsvCell).join(","),
    ["ARR (USD)", sub?.arrUsd ?? 0, "Annualized recurring (12x MRR)"].map(escapeCsvCell).join(","),
  ];
  return lines.join("\n");
}

export function serializeExportsTelemetryCsv(analytics: AdminPlatformAnalytics): string {
  const lines: string[] = [
    ["Export Format", "Total Jobs", "Completed", "Failed"].map(escapeCsvCell).join(","),
  ];
  for (const row of analytics.telemetry?.exportsByFormat ?? []) {
    lines.push([row.format, row.total, row.completed, row.failed].map(escapeCsvCell).join(","));
  }
  lines.push(["ALL FORMATS SUMMARY", analytics.completedExports + (analytics.telemetry?.failedExports ?? 0), analytics.completedExports, analytics.telemetry?.failedExports ?? 0].map(escapeCsvCell).join(","));
  return lines.join("\n");
}

export function serializeVisitsTelemetryCsv(analytics: AdminPlatformAnalytics): string {
  const lines: string[] = [
    ["Bucket Period", "Views", "Period Unique Visitors Total"].map(escapeCsvCell).join(","),
  ];
  for (const b of analytics.telemetry?.viewsByBucket ?? []) {
    lines.push([b.label, b.views, analytics.telemetry?.uniqueVisitors ?? 0].map(escapeCsvCell).join(","));
  }
  lines.push(["", "", ""].map(escapeCsvCell).join(","));
  lines.push(["Top Case Study", "Slug", "Views"].map(escapeCsvCell).join(","));
  for (const cs of analytics.topCaseStudies) {
    lines.push([cs.name, cs.slug ?? "", cs.views].map(escapeCsvCell).join(","));
  }
  return lines.join("\n");
}
