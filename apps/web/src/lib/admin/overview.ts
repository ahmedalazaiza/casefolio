import { and, count, desc, eq, gte, isNotNull, lte, ne, or, sql } from "@casefolio/db";
import { unstable_cache } from "next/cache";
import {
  computeSubscriptionMrrUsd,
  detectSubscriptionInterval,
  getRangeDays,
  type AdminAnalyticsRange,
  type AdminNeedsAttentionItem,
  type AdminOverviewBucket,
  type AdminOverviewMetrics,
  type AdminOverviewRange,
  type AdminPlatformAnalytics,
  type AdminTemplateUsageShare,
  type AdminTopCaseStudyRow,
  type AdminTopTemplateRow,
  type AdminWeeklyPublishBucket,
} from "@/lib/admin/overview-types";
import { isSubscriptionGrantingAccess, type BillingInterval } from "@/lib/billing/plans";
import { db, dbSchema } from "@/lib/db";

const BUCKET_COUNT = 12;

function extractWebhookIntervalsBySubId(
  events: Array<{ payload: Record<string, unknown> | null }>,
): Map<string, BillingInterval> {
  const map = new Map<string, BillingInterval>();
  for (const evt of events) {
    const payload = evt.payload;
    if (!payload || typeof payload !== "object") continue;
    const data = (payload.data ?? payload) as Record<string, unknown>;
    const subId =
      typeof data.id === "string"
        ? data.id
        : typeof data.subscription_id === "string"
          ? data.subscription_id
          : null;
    if (!subId || map.has(subId)) continue;

    const customData =
      data.custom_data && typeof data.custom_data === "object"
        ? (data.custom_data as Record<string, unknown>)
        : null;
    if (customData?.interval === "yearly" || customData?.interval === "monthly") {
      map.set(subId, customData.interval);
      continue;
    }

    const billingCycle =
      data.billing_cycle && typeof data.billing_cycle === "object"
        ? (data.billing_cycle as Record<string, unknown>)
        : null;
    if (billingCycle?.interval === "year") {
      map.set(subId, "yearly");
    } else if (billingCycle?.interval === "month") {
      map.set(subId, "monthly");
    }
  }
  return map;
}

function countSlotsInVersionData(data: Record<string, unknown> | null | undefined): number {
  if (!data || typeof data !== "object") return 0;
  const tpl = data.template as { slots?: Record<string, unknown> } | undefined;
  if (!tpl?.slots || typeof tpl.slots !== "object") return 0;
  return Object.keys(tpl.slots).length;
}

export async function getAdminOverviewMetrics(
  range: AdminOverviewRange = "30d",
  now: Date = new Date(),
): Promise<AdminOverviewMetrics> {
  const rangeDays = getRangeDays(range) ?? 30;
  const windowMs = rangeDays * 24 * 60 * 60 * 1000;
  const rangeStart = new Date(now.getTime() - windowMs);
  const prevRangeStart = new Date(rangeStart.getTime() - windowMs);

  const nowIso = now.toISOString();
  const rangeStartIso = rangeStart.toISOString();
  const prevRangeStartIso = prevRangeStart.toISOString();

  const bucketSpanMs = windowMs / BUCKET_COUNT;
  const rangeStartMs = rangeStart.getTime();

  const signupBucketIdxExpr = sql<number>`least(${BUCKET_COUNT - 1}, greatest(0, floor((extract(epoch from ${dbSchema.users.createdAt}) * 1000 - ${rangeStartMs}) / ${bucketSpanMs})::int))`;
  const publishBucketIdxExpr = sql<number>`least(${BUCKET_COUNT - 1}, greatest(0, floor((extract(epoch from ${dbSchema.projects.publishedAt}) * 1000 - ${rangeStartMs}) / ${bucketSpanMs})::int))`;

  const [
    userAggRows,
    subscriptionRows,
    webhookRows,
    projectAggRows,
    projectCountsByVerRows,
    exportAggRows,
    templateRows,
    versionRows,
    openReportsAggRows,
    signupBucketRows,
    publishBucketRows,
  ] = await Promise.all([
    db
      .select({
        totalUsers: count(),
        newUsersInRange: sql<number>`count(*) filter (where ${dbSchema.users.createdAt} >= ${rangeStartIso}::timestamptz and ${dbSchema.users.createdAt} <= ${nowIso}::timestamptz)::int`,
        newUsersPrevRange: sql<number>`count(*) filter (where ${dbSchema.users.createdAt} >= ${prevRangeStartIso}::timestamptz and ${dbSchema.users.createdAt} < ${rangeStartIso}::timestamptz)::int`,
      })
      .from(dbSchema.users),
    db
      .select()
      .from(dbSchema.subscriptions)
      .where(
        or(
          ne(dbSchema.subscriptions.plan, "free"),
          eq(dbSchema.subscriptions.status, "past_due"),
        ),
      ),
    db
      .select({ payload: dbSchema.webhookEvents.payload })
      .from(dbSchema.webhookEvents)
      .orderBy(desc(dbSchema.webhookEvents.processedAt))
      .limit(250),
    db
      .select({
        publishedCaseStudies: sql<number>`count(*) filter (where ${dbSchema.projects.visibility} = 'public' and ${dbSchema.projects.publishedAt} is not null)::int`,
        publishesInRange: sql<number>`count(*) filter (where ${dbSchema.projects.publishedAt} >= ${rangeStartIso}::timestamptz and ${dbSchema.projects.publishedAt} <= ${nowIso}::timestamptz)::int`,
        publishesPrevRange: sql<number>`count(*) filter (where ${dbSchema.projects.publishedAt} >= ${prevRangeStartIso}::timestamptz and ${dbSchema.projects.publishedAt} < ${rangeStartIso}::timestamptz)::int`,
      })
      .from(dbSchema.projects),
    db
      .select({
        templateVersionId: dbSchema.projects.templateVersionId,
        total: count(),
      })
      .from(dbSchema.projects)
      .groupBy(dbSchema.projects.templateVersionId),
    db
      .select({
        completedExports: count(),
        exportsInRange: sql<number>`count(*) filter (where ${dbSchema.exportsTable.createdAt} >= ${rangeStartIso}::timestamptz and ${dbSchema.exportsTable.createdAt} <= ${nowIso}::timestamptz)::int`,
        exportsPrevRange: sql<number>`count(*) filter (where ${dbSchema.exportsTable.createdAt} >= ${prevRangeStartIso}::timestamptz and ${dbSchema.exportsTable.createdAt} < ${rangeStartIso}::timestamptz)::int`,
      })
      .from(dbSchema.exportsTable)
      .where(eq(dbSchema.exportsTable.status, "completed")),
    db
      .select()
      .from(dbSchema.templates)
      .orderBy(desc(dbSchema.templates.updatedAt)),
    db.select().from(dbSchema.templateVersions),
    db
      .select({
        openReportedCount: sql<number>`count(distinct ${dbSchema.reports.projectId})::int`,
      })
      .from(dbSchema.reports)
      .where(eq(dbSchema.reports.status, "open")),
    db
      .select({
        bucketIdx: signupBucketIdxExpr,
        total: count(),
      })
      .from(dbSchema.users)
      .where(and(gte(dbSchema.users.createdAt, rangeStart), lte(dbSchema.users.createdAt, now)))
      .groupBy(sql`1`),
    db
      .select({
        bucketIdx: publishBucketIdxExpr,
        total: count(),
      })
      .from(dbSchema.projects)
      .where(
        and(
          isNotNull(dbSchema.projects.publishedAt),
          gte(dbSchema.projects.publishedAt, rangeStart),
          lte(dbSchema.projects.publishedAt, now),
        ),
      )
      .groupBy(sql`1`),
  ]);

  const totalUsers = userAggRows[0]?.totalUsers ?? 0;
  const newUsersInRange = userAggRows[0]?.newUsersInRange ?? 0;
  const newUsersPrevRange = userAggRows[0]?.newUsersPrevRange ?? 0;

  const webhookIntervals = extractWebhookIntervalsBySubId(webhookRows);
  let activeSubscriptions = 0;
  let mrrUsd = 0;
  let pastDueSubscriptionsCount = 0;

  for (const sub of subscriptionRows) {
    if (sub.status.trim().toLowerCase() === "past_due") {
      pastDueSubscriptionsCount += 1;
    }
    if (sub.plan === "free") continue;
    if (!isSubscriptionGrantingAccess(sub.status, sub.currentPeriodEnd, now, sub.pastDueSince)) {
      continue;
    }
    activeSubscriptions += 1;
    const interval = detectSubscriptionInterval({
      createdAt: sub.createdAt,
      currentPeriodEnd: sub.currentPeriodEnd,
      webhookBillingInterval: sub.paddleSubscriptionId
        ? (webhookIntervals.get(sub.paddleSubscriptionId) ?? null)
        : null,
    });
    const normalizedPlan = sub.plan === "plus" ? "team" : sub.plan;
    mrrUsd += computeSubscriptionMrrUsd(normalizedPlan, interval, sub.currentPaidCapacity ?? 1);
  }

  const publishedCaseStudies = projectAggRows[0]?.publishedCaseStudies ?? 0;
  const publishesInRange = projectAggRows[0]?.publishesInRange ?? 0;
  const publishesPrevRange = projectAggRows[0]?.publishesPrevRange ?? 0;

  const projectCountByVersionId = new Map<string, number>();
  for (const row of projectCountsByVerRows) {
    projectCountByVersionId.set(row.templateVersionId, row.total);
  }

  const completedExports = exportAggRows[0]?.completedExports ?? 0;
  const exportsInRange = exportAggRows[0]?.exportsInRange ?? 0;
  const exportsPrevRange = exportAggRows[0]?.exportsPrevRange ?? 0;

  const versionById = new Map(versionRows.map((v) => [v.id, v]));
  const versionIdsByTemplateId = new Map<string, string[]>();
  for (const v of versionRows) {
    const list = versionIdsByTemplateId.get(v.templateId) ?? [];
    list.push(v.id);
    versionIdsByTemplateId.set(v.templateId, list);
  }

  let publishedTemplates = 0;
  let draftTemplates = 0;
  let archivedTemplates = 0;
  let emptySlotTemplatesCount = 0;

  const topTemplatesUnsorted: Array<AdminTopTemplateRow & { updatedAtMs: number }> = [];

  for (const tpl of templateRows) {
    if (tpl.status === "published") publishedTemplates += 1;
    else if (tpl.status === "draft") draftTemplates += 1;
    else archivedTemplates += 1;

    const currentVer = tpl.currentVersionId
      ? versionById.get(tpl.currentVersionId)
      : versionRows.find((v) => v.templateId === tpl.id);

    if (tpl.status !== "archived" && countSlotsInVersionData(currentVer?.data) === 0) {
      emptySlotTemplatesCount += 1;
    }

    const verIds = versionIdsByTemplateId.get(tpl.id) ?? [];
    const projectCount = verIds.reduce(
      (sum, vid) => sum + (projectCountByVersionId.get(vid) ?? 0),
      0,
    );

    topTemplatesUnsorted.push({
      id: tpl.id,
      slug: tpl.slug,
      name: tpl.name,
      type: tpl.type,
      status: tpl.status,
      version: currentVer?.version ?? null,
      projectCount,
      updatedAtMs: tpl.updatedAt.getTime(),
    });
  }

  const topTemplates: AdminTopTemplateRow[] = topTemplatesUnsorted
    .sort((a, b) => b.projectCount - a.projectCount || b.updatedAtMs - a.updatedAtMs)
    .slice(0, 8)
    .map(({ updatedAtMs: _unused, ...rest }) => rest);

  const openReportedCount = openReportsAggRows[0]?.openReportedCount ?? 0;

  const needsAttention: AdminNeedsAttentionItem[] = [
    {
      id: "reported_case_studies",
      count: openReportedCount,
      label:
        openReportedCount === 1
          ? "1 case study reported"
          : `${openReportedCount} case studies reported`,
      badgeLabel: openReportedCount > 0 ? "Review" : "Clear",
      tone: openReportedCount > 0 ? "danger" : "neutral",
      href: "/admin/moderation",
    },
    {
      id: "draft_templates",
      count: draftTemplates,
      label:
        draftTemplates === 1 ? "1 template in draft" : `${draftTemplates} templates in draft`,
      badgeLabel: draftTemplates > 0 ? "Draft" : "Clear",
      tone: draftTemplates > 0 ? "draft" : "neutral",
      href: "/admin/templates",
    },
    {
      id: "failed_payments",
      count: pastDueSubscriptionsCount,
      label:
        pastDueSubscriptionsCount === 1
          ? "1 failed payment"
          : `${pastDueSubscriptionsCount} failed payments`,
      badgeLabel: pastDueSubscriptionsCount > 0 ? "Action" : "Clear",
      tone: pastDueSubscriptionsCount > 0 ? "danger" : "neutral",
      href: "/admin/subscriptions",
    },
    {
      id: "empty_slot_templates",
      count: emptySlotTemplatesCount,
      label:
        emptySlotTemplatesCount === 1
          ? "1 template has empty slot definitions"
          : `${emptySlotTemplatesCount} templates have empty slot definitions`,
      badgeLabel: emptySlotTemplatesCount > 0 ? "Inspect" : "Clear",
      tone: emptySlotTemplatesCount > 0 ? "draft" : "neutral",
      href: "/admin/templates",
    },
  ];

  const signupsByBucket = new Map<number, number>();
  for (const b of signupBucketRows) {
    signupsByBucket.set(Number(b.bucketIdx), b.total);
  }
  const publishesByBucket = new Map<number, number>();
  for (const b of publishBucketRows) {
    publishesByBucket.set(Number(b.bucketIdx), b.total);
  }

  const buckets: AdminOverviewBucket[] = Array.from({ length: BUCKET_COUNT }, (_, idx) => {
    const startMs = rangeStartMs + idx * bucketSpanMs;
    const endMs = idx === BUCKET_COUNT - 1 ? now.getTime() + 1 : startMs + bucketSpanMs;
    const startDate = new Date(startMs);
    const label = startDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    return {
      index: idx,
      label,
      startIso: startDate.toISOString(),
      endIso: new Date(endMs).toISOString(),
      signups: signupsByBucket.get(idx) ?? 0,
      publishes: publishesByBucket.get(idx) ?? 0,
    };
  });

  return {
    range,
    rangeDays,
    totalUsers,
    newUsersInRange,
    newUsersPrevRange,
    activeSubscriptions,
    mrrUsd,
    publishedCaseStudies,
    publishesInRange,
    publishesPrevRange,
    completedExports,
    exportsInRange,
    exportsPrevRange,
    publishedTemplates,
    draftTemplates,
    archivedTemplates,
    buckets,
    needsAttention,
    topTemplates,
  };
}

export async function getAdminPlatformAnalytics(
  range: AdminAnalyticsRange = "30d",
  now: Date = new Date(),
): Promise<AdminPlatformAnalytics> {
  const days = getRangeDays(range);
  const rangeStart = days !== null ? new Date(now.getTime() - days * 24 * 60 * 60 * 1000) : null;
  const prevStart =
    days !== null && rangeStart !== null
      ? new Date(rangeStart.getTime() - days * 24 * 60 * 60 * 1000)
      : null;

  const nowIso = now.toISOString();
  const rangeStartIso = rangeStart ? rangeStart.toISOString() : null;
  const prevStartIso = prevStart ? prevStart.toISOString() : null;

  const chartDays = days ?? 84;
  const chartWindowMs = chartDays * 24 * 60 * 60 * 1000;
  const chartStartMs = now.getTime() - chartWindowMs;
  const chartStart = new Date(chartStartMs);
  const bucketSpanMs = chartWindowMs / BUCKET_COUNT;

  const weeklyPublishBucketExpr = sql<number>`least(${BUCKET_COUNT - 1}, greatest(0, floor((extract(epoch from ${dbSchema.projects.publishedAt}) * 1000 - ${chartStartMs}) / ${bucketSpanMs})::int))`;

  const viewRangeFilterSql = rangeStartIso
    ? sql`WHERE pv.at >= ${rangeStartIso}::timestamptz AND pv.at <= ${nowIso}::timestamptz`
    : sql``;
  const exportRangeFilterSql = rangeStartIso
    ? sql`AND ex.created_at >= ${rangeStartIso}::timestamptz AND ex.created_at <= ${nowIso}::timestamptz`
    : sql``;

  const [
    userAggRows,
    publishAggRows,
    viewAggRows,
    exportAggRows,
    templateRows,
    versionRows,
    projectCountsByVerRows,
    weeklyPublishBucketRows,
    topCaseStudiesRes,
  ] = await Promise.all([
    db
      .select({
        totalUsers: count(),
        paidUsers: sql<number>`count(*) filter (where ${dbSchema.users.plan} in ('pro', 'team', 'plus'))::int`,
      })
      .from(dbSchema.users),
    rangeStartIso && prevStartIso
      ? db
          .select({
            publishedCaseStudies: sql<number>`count(*) filter (where ${dbSchema.projects.visibility} = 'public' and ${dbSchema.projects.publishedAt} >= ${rangeStartIso}::timestamptz and ${dbSchema.projects.publishedAt} <= ${nowIso}::timestamptz)::int`,
            publishesPrevPeriod: sql<number>`count(*) filter (where ${dbSchema.projects.visibility} = 'public' and ${dbSchema.projects.publishedAt} >= ${prevStartIso}::timestamptz and ${dbSchema.projects.publishedAt} < ${rangeStartIso}::timestamptz)::int`,
          })
          .from(dbSchema.projects)
      : db
          .select({
            publishedCaseStudies: sql<number>`count(*) filter (where ${dbSchema.projects.visibility} = 'public' and ${dbSchema.projects.publishedAt} is not null)::int`,
            publishesPrevPeriod: sql<number | null>`null::int`,
          })
          .from(dbSchema.projects),
    rangeStartIso && prevStartIso
      ? db
          .select({
            publicViews: sql<number>`count(*) filter (where ${dbSchema.pageViews.at} >= ${rangeStartIso}::timestamptz and ${dbSchema.pageViews.at} <= ${nowIso}::timestamptz)::int`,
            viewsPrevPeriod: sql<number>`count(*) filter (where ${dbSchema.pageViews.at} >= ${prevStartIso}::timestamptz and ${dbSchema.pageViews.at} < ${rangeStartIso}::timestamptz)::int`,
          })
          .from(dbSchema.pageViews)
      : db
          .select({
            publicViews: count(),
            viewsPrevPeriod: sql<number | null>`null::int`,
          })
          .from(dbSchema.pageViews),
    rangeStartIso && prevStartIso
      ? db
          .select({
            completedExports: sql<number>`count(*) filter (where ${dbSchema.exportsTable.createdAt} >= ${rangeStartIso}::timestamptz and ${dbSchema.exportsTable.createdAt} <= ${nowIso}::timestamptz)::int`,
            exportsPrevPeriod: sql<number>`count(*) filter (where ${dbSchema.exportsTable.createdAt} >= ${prevStartIso}::timestamptz and ${dbSchema.exportsTable.createdAt} < ${rangeStartIso}::timestamptz)::int`,
          })
          .from(dbSchema.exportsTable)
          .where(eq(dbSchema.exportsTable.status, "completed"))
      : db
          .select({
            completedExports: count(),
            exportsPrevPeriod: sql<number | null>`null::int`,
          })
          .from(dbSchema.exportsTable)
          .where(eq(dbSchema.exportsTable.status, "completed")),
    db.select().from(dbSchema.templates).orderBy(desc(dbSchema.templates.updatedAt)),
    db
      .select({
        id: dbSchema.templateVersions.id,
        templateId: dbSchema.templateVersions.templateId,
      })
      .from(dbSchema.templateVersions),
    db
      .select({
        templateVersionId: dbSchema.projects.templateVersionId,
        total: count(),
      })
      .from(dbSchema.projects)
      .groupBy(dbSchema.projects.templateVersionId),
    db
      .select({
        bucketIdx: weeklyPublishBucketExpr,
        total: count(),
      })
      .from(dbSchema.projects)
      .where(
        and(
          isNotNull(dbSchema.projects.publishedAt),
          gte(dbSchema.projects.publishedAt, chartStart),
          lte(dbSchema.projects.publishedAt, now),
        ),
      )
      .groupBy(sql`1`),
    db.execute<{
      id: string;
      name: string;
      slug: string | null;
      author_name: string | null;
      template_name: string | null;
      views: number;
      exports: number;
    }>(sql`
      WITH view_counts AS (
        SELECT pv.project_id, count(*)::int AS views
        FROM page_views pv
        ${viewRangeFilterSql}
        GROUP BY pv.project_id
      ),
      export_counts AS (
        SELECT ex.project_id, count(*)::int AS exports
        FROM exports ex
        WHERE ex.status = 'completed'
        ${exportRangeFilterSql}
        GROUP BY ex.project_id
      )
      SELECT
        p.id,
        p.name,
        p.slug,
        u.name AS author_name,
        t.name AS template_name,
        coalesce(vc.views, 0)::int AS views,
        coalesce(ec.exports, 0)::int AS exports
      FROM projects p
      LEFT JOIN users u ON u.id = p.owner_id
      LEFT JOIN template_versions tv ON tv.id = p.template_version_id
      LEFT JOIN templates t ON t.id = tv.template_id
      LEFT JOIN view_counts vc ON vc.project_id = p.id
      LEFT JOIN export_counts ec ON ec.project_id = p.id
      WHERE p.visibility = 'public'
      ORDER BY coalesce(vc.views, 0) DESC, coalesce(ec.exports, 0) DESC, p.updated_at DESC
      LIMIT 10
    `),
  ]);

  const totalUsers = userAggRows[0]?.totalUsers ?? 0;
  const paidUsers = userAggRows[0]?.paidUsers ?? 0;
  const freeToProRatePercent =
    totalUsers > 0 ? Math.round((paidUsers / totalUsers) * 1000) / 10 : 0;

  const publishedCaseStudies = publishAggRows[0]?.publishedCaseStudies ?? 0;
  const publishesPrevPeriod =
    prevStart !== null ? (publishAggRows[0]?.publishesPrevPeriod ?? 0) : null;

  const publicViews = viewAggRows[0]?.publicViews ?? 0;
  const viewsPrevPeriod = prevStart !== null ? (viewAggRows[0]?.viewsPrevPeriod ?? 0) : null;

  const completedExports = exportAggRows[0]?.completedExports ?? 0;
  const exportsPrevPeriod = prevStart !== null ? (exportAggRows[0]?.exportsPrevPeriod ?? 0) : null;

  const versionToTemplateId = new Map(versionRows.map((v) => [v.id, v.templateId]));
  const projectCountByTemplateId = new Map<string, number>();
  for (const row of projectCountsByVerRows) {
    const tplId = versionToTemplateId.get(row.templateVersionId);
    if (!tplId) continue;
    projectCountByTemplateId.set(tplId, (projectCountByTemplateId.get(tplId) ?? 0) + row.total);
  }

  const totalProjectsWithTemplate = Array.from(projectCountByTemplateId.values()).reduce(
    (s, n) => s + n,
    0,
  );

  const templateUsage: AdminTemplateUsageShare[] = templateRows
    .map((tpl) => {
      const projectCount = projectCountByTemplateId.get(tpl.id) ?? 0;
      const sharePercent =
        totalProjectsWithTemplate > 0
          ? Math.round((projectCount / totalProjectsWithTemplate) * 100)
          : 0;
      return {
        id: tpl.id,
        name: tpl.name,
        status: tpl.status,
        projectCount,
        sharePercent,
      };
    })
    .sort((a, b) => b.projectCount - a.projectCount)
    .slice(0, 6);

  const weeklyByBucket = new Map<number, number>();
  for (const b of weeklyPublishBucketRows) {
    weeklyByBucket.set(Number(b.bucketIdx), b.total);
  }

  const weeklyPublishes: AdminWeeklyPublishBucket[] = Array.from(
    { length: BUCKET_COUNT },
    (_, idx) => {
      const startMs = chartStartMs + idx * bucketSpanMs;
      const label = new Date(startMs).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      return {
        index: idx,
        label,
        publishes: weeklyByBucket.get(idx) ?? 0,
      };
    },
  );

  const topCaseStudies: AdminTopCaseStudyRow[] = topCaseStudiesRes.rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    authorName: row.author_name ?? "Unknown author",
    templateName: row.template_name ?? "Custom",
    views: Number(row.views ?? 0),
    exports: Number(row.exports ?? 0),
  }));

  return {
    range,
    publishedCaseStudies,
    publishesPrevPeriod,
    publicViews,
    viewsPrevPeriod,
    completedExports,
    exportsPrevPeriod,
    totalUsers,
    paidUsers,
    freeToProRatePercent,
    weeklyPublishes,
    templateUsage,
    topCaseStudies,
  };
}

export const getCachedAdminOverviewMetrics = unstable_cache(
  async (range: AdminOverviewRange) => getAdminOverviewMetrics(range),
  ["admin-overview-metrics-v1"],
  { revalidate: 60 },
);

export const getCachedAdminPlatformAnalytics = unstable_cache(
  async (range: AdminAnalyticsRange) => getAdminPlatformAnalytics(range),
  ["admin-platform-analytics-v1"],
  { revalidate: 60 },
);
