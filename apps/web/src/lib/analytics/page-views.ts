import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  type UserRole,
} from "@casefolio/db";
import {
  analyticsRangeSchema,
  computePrivacySafeVisitorHash,
  extractClientIpFromHeaders,
  extractCountryFromHeaders,
  isBotUserAgent,
  isPrefetchRequest,
  normalizeReferrerSource,
  type AnalyticsDailyBucket,
  type AnalyticsRangeKey,
  type AnalyticsSourceItem,
  type ProjectAnalyticsPayload,
} from "@/lib/analytics/page-views-utils";
import { db, dbSchema } from "@/lib/db";
import { can } from "@/lib/entitlements";
import { listDashboardProjectsForUser } from "@/lib/projects/dashboard";
import { authorizeProjectAccess } from "@/lib/workspaces/acl";

export * from "@/lib/analytics/page-views-utils";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TRACK_WINDOW_MS = 60_000;
const TRACK_MAX_PER_WINDOW = 30;

interface RateBucket {
  count: number;
  resetAt: number;
}

const globalRateStore = globalThis as unknown as {
  __casefolioTrackRateBuckets?: Map<string, RateBucket>;
};

function getTrackRateBuckets(): Map<string, RateBucket> {
  if (!globalRateStore.__casefolioTrackRateBuckets) {
    globalRateStore.__casefolioTrackRateBuckets = new Map();
  }
  return globalRateStore.__casefolioTrackRateBuckets;
}

export function resetTrackingRateLimitsForTests(): void {
  getTrackRateBuckets().clear();
}

function consumeTrackingRateLimit(
  visitorHash: string,
  projectId: string,
  nowMs: number,
): boolean {
  const key = `${projectId}:${visitorHash}`;
  const buckets = getTrackRateBuckets();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= nowMs) {
    buckets.set(key, { count: 1, resetAt: nowMs + TRACK_WINDOW_MS });
    return true;
  }

  if (existing.count >= TRACK_MAX_PER_WINDOW) {
    return false;
  }

  existing.count += 1;
  return true;
}

export type RecordPageViewResult =
  | { recorded: true; visitorHash: string; referrer: string; country: string | null }
  | {
      recorded: false;
      reason: "bot" | "prefetch" | "invalid_project" | "not_published" | "rate_limited";
    };

export async function recordPublishedProjectView(args: {
  projectId: string;
  headers: Headers;
  explicitReferrer?: string | null;
  now?: Date;
}): Promise<RecordPageViewResult> {
  if (!UUID_REGEX.test(args.projectId)) {
    return { recorded: false, reason: "invalid_project" };
  }

  if (isPrefetchRequest(args.headers)) {
    return { recorded: false, reason: "prefetch" };
  }

  const userAgent = args.headers.get("user-agent");
  if (isBotUserAgent(userAgent)) {
    return { recorded: false, reason: "bot" };
  }

  const [project] = await db
    .select({
      id: dbSchema.projects.id,
      visibility: dbSchema.projects.visibility,
      publishedAt: dbSchema.projects.publishedAt,
      archivedAt: dbSchema.projects.archivedAt,
      slug: dbSchema.projects.slug,
    })
    .from(dbSchema.projects)
    .where(eq(dbSchema.projects.id, args.projectId))
    .limit(1);

  if (
    !project ||
    project.archivedAt !== null ||
    (project.visibility !== "public" && project.visibility !== "unlisted") ||
    !project.publishedAt ||
    !project.slug
  ) {
    return { recorded: false, reason: "not_published" };
  }

  const now = args.now ?? new Date();
  const clientIp = extractClientIpFromHeaders(args.headers);
  const visitorHash = computePrivacySafeVisitorHash({
    projectId: project.id,
    clientIp,
    userAgent: userAgent!,
    now,
  });

  if (!consumeTrackingRateLimit(visitorHash, project.id, now.getTime())) {
    return { recorded: false, reason: "rate_limited" };
  }

  const appHost = args.headers.get("host") ?? process.env.NEXT_PUBLIC_APP_URL ?? null;
  const rawReferrer = args.explicitReferrer ?? args.headers.get("referer");
  const normalizedReferrer = normalizeReferrerSource(rawReferrer, appHost);
  const country = extractCountryFromHeaders(args.headers);

  await db.insert(dbSchema.pageViews).values({
    projectId: project.id,
    visitorHash,
    referrer: normalizedReferrer,
    country,
    at: now,
  });

  return {
    recorded: true,
    visitorHash,
    referrer: normalizedReferrer,
    country,
  };
}

export type ProjectAnalyticsAccessResult =
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "ok"; analytics: ProjectAnalyticsPayload };

function computeDeltaPercent(current: number, previous: number): number | null {
  if (previous === 0) {
    return current > 0 ? 100 : null;
  }
  return Math.round(((current - previous) / previous) * 100);
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function formatShortDayLabel(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const CANONICAL_SOURCE_LABELS = [
  "Direct / link",
  "LinkedIn",
  "Dribbble",
  "Google",
  "Other",
] as const;

export async function getProjectAnalyticsForActor(args: {
  projectId: string;
  actor: { id: string; role: UserRole };
  requestedRange?: string | null;
  now?: Date;
}): Promise<ProjectAnalyticsAccessResult> {
  if (!UUID_REGEX.test(args.projectId)) {
    return { status: "not_found" };
  }

  const now = args.now ?? new Date();
  const auth = await authorizeProjectAccess(args.projectId, args.actor.id, "read", now);
  if (!auth.ok) {
    return { status: "not_found" };
  }

  const [tplRow] = await db
    .select({ templateName: dbSchema.templates.name })
    .from(dbSchema.templateVersions)
    .innerJoin(
      dbSchema.templates,
      eq(dbSchema.templateVersions.templateId, dbSchema.templates.id),
    )
    .where(eq(dbSchema.templateVersions.id, auth.project.templateVersionId))
    .limit(1);

  if (!tplRow) {
    return { status: "not_found" };
  }

  const workspacePlan = auth.entitlement.plan;
  const maxAnalyticsDays = auth.entitlement.quotas.analyticsRetentionDays; // 7d Free, 90d Pro, 365d Teams (`Spec §4`)
  const hasFullAnalytics = can(workspacePlan, "full_analytics");

  const parsedRange = analyticsRangeSchema.safeParse(args.requestedRange);
  let effectiveRange: AnalyticsRangeKey = parsedRange.success
    ? parsedRange.data
    : maxAnalyticsDays <= 7
      ? "7d"
      : "30d";

  if (maxAnalyticsDays <= 7) {
    effectiveRange = "7d";
  } else if (maxAnalyticsDays <= 90 && effectiveRange === "all") {
    effectiveRange = "90d";
  }

  const todayUtc = startOfUtcDay(now);

  const rangeDays =
    effectiveRange === "7d"
      ? 7
      : effectiveRange === "30d"
        ? 30
        : effectiveRange === "90d"
          ? 90
          : maxAnalyticsDays; // Teams "all" caps at 365 days (`Spec §4`)

  const periodStart = addUtcDays(todayUtc, -(rangeDays - 1));
  const prevPeriodStart = addUtcDays(periodStart, -rangeDays);

  const allProjectViews = await db
    .select({
      visitorHash: dbSchema.pageViews.visitorHash,
      referrer: dbSchema.pageViews.referrer,
      country: dbSchema.pageViews.country,
      at: dbSchema.pageViews.at,
    })
    .from(dbSchema.pageViews)
    .where(eq(dbSchema.pageViews.projectId, auth.project.id))
    .orderBy(desc(dbSchema.pageViews.at));

  const [exportsRow] = await db
    .select({ total: count() })
    .from(dbSchema.exportsTable)
    .where(
      and(
        eq(dbSchema.exportsTable.projectId, auth.project.id),
        eq(dbSchema.exportsTable.status, "completed"),
      ),
    );

  const currentViews = allProjectViews.filter((v) => v.at >= periodStart);
  const previousViews = allProjectViews.filter(
    (v) => v.at >= prevPeriodStart && v.at < periodStart,
  );

  const viewsCount = currentViews.length;
  const prevViewsCount = previousViews.length;
  const uniqueVisitorsSet = new Set(currentViews.map((v) => v.visitorHash));
  const prevVisitorsSet = new Set(previousViews.map((v) => v.visitorHash));

  const uniqueVisitorsCount = uniqueVisitorsSet.size;
  const prevVisitorsCount = prevVisitorsSet.size;

  const countryCounts = new Map<string, number>();
  for (const view of currentViews) {
    if (view.country) {
      countryCounts.set(view.country, (countryCounts.get(view.country) ?? 0) + 1);
    }
  }
  let topCountry: string | null = null;
  let topCountryMax = 0;
  for (const [code, cnt] of countryCounts.entries()) {
    if (cnt > topCountryMax) {
      topCountry = code;
      topCountryMax = cnt;
    }
  }

  const chartDaysCount = effectiveRange === "7d" ? 7 : 14;
  const bucketSpanDays =
    effectiveRange === "7d"
      ? 1
      : effectiveRange === "30d"
        ? 2
        : effectiveRange === "90d"
          ? 6
          : 7;

  const chartBuckets: AnalyticsDailyBucket[] = [];
  for (let i = chartDaysCount - 1; i >= 0; i -= 1) {
    const bucketEndExclusive = addUtcDays(todayUtc, 1 - i * bucketSpanDays);
    const bucketStart = addUtcDays(bucketEndExclusive, -bucketSpanDays);
    const slice = allProjectViews.filter(
      (v) => v.at >= bucketStart && v.at < bucketEndExclusive,
    );
    const visitorsInSlice = new Set(slice.map((v) => v.visitorHash));
    const displayDate = addUtcDays(bucketEndExclusive, -1);

    chartBuckets.push({
      dateKey: displayDate.toISOString().slice(0, 10),
      label: formatShortDayLabel(displayDate),
      views: slice.length,
      uniqueVisitors: visitorsInSlice.size,
    });
  }

  const sourceCounts = new Map<string, number>();
  for (const label of CANONICAL_SOURCE_LABELS) {
    sourceCounts.set(label, 0);
  }
  for (const view of currentViews) {
    const key = view.referrer?.trim() || "Direct / link";
    sourceCounts.set(key, (sourceCounts.get(key) ?? 0) + 1);
  }

  const topSources: AnalyticsSourceItem[] = Array.from(sourceCounts.entries())
    .map(([source, views]) => ({
      source,
      views,
      percentage: viewsCount > 0 ? Math.round((views / viewsCount) * 100) : 0,
    }))
    .sort((a, b) => {
      if (b.views !== a.views) return b.views - a.views;
      return a.source.localeCompare(b.source);
    })
    .slice(0, 5);

  const isPublished =
    (auth.project.visibility === "public" || auth.project.visibility === "unlisted") &&
    auth.project.publishedAt !== null &&
    Boolean(auth.project.slug);

  return {
    status: "ok",
    analytics: {
      projectId: auth.project.id,
      projectName: auth.project.name,
      templateName: tplRow.templateName,
      slug: auth.project.slug,
      visibility: auth.project.visibility,
      isPublished,
      publishedAtIso: auth.project.publishedAt
        ? auth.project.publishedAt.toISOString()
        : null,
      ownerPlan: workspacePlan,
      hasFullAnalyticsEntitlement: hasFullAnalytics,
      range: effectiveRange,
      kpis: {
        views: viewsCount,
        viewsDeltaPercent: computeDeltaPercent(viewsCount, prevViewsCount),
        uniqueVisitors: uniqueVisitorsCount,
        visitorsDeltaPercent: computeDeltaPercent(uniqueVisitorsCount, prevVisitorsCount),
        viewsPerVisitor:
          viewsCount > 0 ? (viewsCount / Math.max(1, uniqueVisitorsCount)).toFixed(1) : "0.0",
        topCountry,
        completedExports: exportsRow?.total ?? 0,
        allTimeViews: allProjectViews.length,
      },
      chartBuckets,
      topSources,
    },
  };
}

export interface WorkspaceAnalyticsProjectRow {
  projectId: string;
  projectName: string;
  slug: string | null;
  visibility: "private" | "unlisted" | "public";
  isPublished: boolean;
  publishedAtIso: string | null;
  views30d: number;
  visitors30d: number;
}

export interface WorkspaceAnalyticsOverview {
  totalViews30d: number;
  publishedCount: number;
  totalProjectsCount: number;
  topPage: {
    projectId: string;
    projectName: string;
    views30d: number;
  } | null;
  projects: WorkspaceAnalyticsProjectRow[];
}

export async function getWorkspaceAnalyticsOverview(
  userId: string,
  now: Date = new Date(),
  activeOrgId: string | null = null,
): Promise<WorkspaceAnalyticsOverview> {
  // Strictly scoped to visible spaces in the active workspace (`Spec §9 & §10.1`)
  const visibleProjects = await listDashboardProjectsForUser(userId, activeOrgId, {
    includeArchived: false,
  });

  if (visibleProjects.length === 0) {
    return {
      totalViews30d: 0,
      publishedCount: 0,
      totalProjectsCount: 0,
      topPage: null,
      projects: [],
    };
  }

  const projectIds = visibleProjects.map((p) => p.id);
  const cutoff30d = addUtcDays(startOfUtcDay(now), -29);

  const viewsRows = await db
    .select({
      projectId: dbSchema.pageViews.projectId,
      visitorHash: dbSchema.pageViews.visitorHash,
    })
    .from(dbSchema.pageViews)
    .where(
      and(
        inArray(dbSchema.pageViews.projectId, projectIds),
        gte(dbSchema.pageViews.at, cutoff30d),
      ),
    );

  const statsByProject = new Map<string, { views: number; visitors: Set<string> }>();
  for (const v of viewsRows) {
    let entry = statsByProject.get(v.projectId);
    if (!entry) {
      entry = { views: 0, visitors: new Set() };
      statsByProject.set(v.projectId, entry);
    }
    entry.views += 1;
    entry.visitors.add(v.visitorHash);
  }

  let totalViews30d = 0;
  let publishedCount = 0;

  const projectRows: WorkspaceAnalyticsProjectRow[] = visibleProjects.map((project) => {
    const isPublished =
      (project.visibility === "public" || project.visibility === "unlisted") &&
      project.publishedAtIso !== null &&
      Boolean(project.slug);
    if (isPublished) {
      publishedCount += 1;
    }

    const stat = statsByProject.get(project.id);
    const views30d = stat?.views ?? 0;
    const visitors30d = stat?.visitors.size ?? 0;
    totalViews30d += views30d;

    return {
      projectId: project.id,
      projectName: project.name,
      slug: project.slug,
      visibility: project.visibility,
      isPublished,
      publishedAtIso: project.publishedAtIso,
      views30d,
      visitors30d,
    };
  });

  projectRows.sort((a, b) => {
    if (b.views30d !== a.views30d) return b.views30d - a.views30d;
    if (a.isPublished !== b.isPublished) return a.isPublished ? -1 : 1;
    return a.projectName.localeCompare(b.projectName);
  });

  const topCandidate = projectRows.find((r) => r.isPublished) ?? projectRows[0] ?? null;

  return {
    totalViews30d,
    publishedCount,
    totalProjectsCount: visibleProjects.length,
    topPage: topCandidate
      ? {
          projectId: topCandidate.projectId,
          projectName: topCandidate.projectName,
          views30d: topCandidate.views30d,
        }
      : null,
    projects: projectRows,
  };
}
