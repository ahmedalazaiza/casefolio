import { desc, eq } from "@casefolio/db";
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

  const [
    userRows,
    subscriptionRows,
    webhookRows,
    projectRows,
    exportRows,
    templateRows,
    versionRows,
    reportRows,
  ] = await Promise.all([
    db
      .select({
        id: dbSchema.users.id,
        createdAt: dbSchema.users.createdAt,
      })
      .from(dbSchema.users),
    db.select().from(dbSchema.subscriptions),
    db
      .select({ payload: dbSchema.webhookEvents.payload })
      .from(dbSchema.webhookEvents)
      .orderBy(desc(dbSchema.webhookEvents.processedAt))
      .limit(250),
    db
      .select({
        id: dbSchema.projects.id,
        templateVersionId: dbSchema.projects.templateVersionId,
        visibility: dbSchema.projects.visibility,
        publishedAt: dbSchema.projects.publishedAt,
      })
      .from(dbSchema.projects),
    db
      .select({
        id: dbSchema.exportsTable.id,
        status: dbSchema.exportsTable.status,
        createdAt: dbSchema.exportsTable.createdAt,
      })
      .from(dbSchema.exportsTable),
    db
      .select()
      .from(dbSchema.templates)
      .orderBy(desc(dbSchema.templates.updatedAt)),
    db.select().from(dbSchema.templateVersions),
    db
      .select({
        id: dbSchema.reports.id,
        projectId: dbSchema.reports.projectId,
        status: dbSchema.reports.status,
      })
      .from(dbSchema.reports),
  ]);

  const totalUsers = userRows.length;
  let newUsersInRange = 0;
  let newUsersPrevRange = 0;
  for (const u of userRows) {
    if (u.createdAt >= rangeStart && u.createdAt <= now) {
      newUsersInRange += 1;
    } else if (u.createdAt >= prevRangeStart && u.createdAt < rangeStart) {
      newUsersPrevRange += 1;
    }
  }

  const webhookIntervals = extractWebhookIntervalsBySubId(webhookRows);
  let activeSubscriptions = 0;
  let mrrUsd = 0;
  let pastDueSubscriptionsCount = 0;

  for (const sub of subscriptionRows) {
    if (sub.status.trim().toLowerCase() === "past_due") {
      pastDueSubscriptionsCount += 1;
    }
    if (sub.plan === "free") continue;
    if (!isSubscriptionGrantingAccess(sub.status, sub.currentPeriodEnd, now)) {
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
    mrrUsd += computeSubscriptionMrrUsd(sub.plan, interval);
  }

  let publishedCaseStudies = 0;
  let publishesInRange = 0;
  let publishesPrevRange = 0;
  const projectCountByVersionId = new Map<string, number>();

  for (const p of projectRows) {
    projectCountByVersionId.set(
      p.templateVersionId,
      (projectCountByVersionId.get(p.templateVersionId) ?? 0) + 1,
    );

    if (p.visibility === "public" && p.publishedAt) {
      publishedCaseStudies += 1;
    }
    if (p.publishedAt) {
      if (p.publishedAt >= rangeStart && p.publishedAt <= now) {
        publishesInRange += 1;
      } else if (p.publishedAt >= prevRangeStart && p.publishedAt < rangeStart) {
        publishesPrevRange += 1;
      }
    }
  }

  let completedExports = 0;
  let exportsInRange = 0;
  let exportsPrevRange = 0;
  for (const exp of exportRows) {
    if (exp.status !== "completed") continue;
    completedExports += 1;
    if (exp.createdAt >= rangeStart && exp.createdAt <= now) {
      exportsInRange += 1;
    } else if (exp.createdAt >= prevRangeStart && exp.createdAt < rangeStart) {
      exportsPrevRange += 1;
    }
  }

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

  // Distinct projects with open reports
  const openReportedProjects = new Set<string>();
  for (const rep of reportRows) {
    if (rep.status === "open") {
      openReportedProjects.add(rep.projectId);
    }
  }
  const openReportedCount = openReportedProjects.size;

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

  // Build 12 equal time buckets over [rangeStart, now]
  const bucketSpanMs = windowMs / BUCKET_COUNT;
  const buckets: AdminOverviewBucket[] = Array.from({ length: BUCKET_COUNT }, (_, idx) => {
    const startMs = rangeStart.getTime() + idx * bucketSpanMs;
    const endMs = idx === BUCKET_COUNT - 1 ? now.getTime() + 1 : startMs + bucketSpanMs;
    const startDate = new Date(startMs);
    const label = startDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    let signups = 0;
    for (const u of userRows) {
      const t = u.createdAt.getTime();
      if (t >= startMs && t < endMs) signups += 1;
    }

    let publishes = 0;
    for (const p of projectRows) {
      if (!p.publishedAt) continue;
      const t = p.publishedAt.getTime();
      if (t >= startMs && t < endMs) publishes += 1;
    }

    return {
      index: idx,
      label,
      startIso: startDate.toISOString(),
      endIso: new Date(endMs).toISOString(),
      signups,
      publishes,
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

  const [userRows, projectRows, templateRows, versionRows, viewRows, exportRows] =
    await Promise.all([
      db
        .select({
          id: dbSchema.users.id,
          name: dbSchema.users.name,
          plan: dbSchema.users.plan,
        })
        .from(dbSchema.users),
      db.select().from(dbSchema.projects),
      db.select().from(dbSchema.templates).orderBy(desc(dbSchema.templates.updatedAt)),
      db.select().from(dbSchema.templateVersions),
      db
        .select({
          projectId: dbSchema.pageViews.projectId,
          at: dbSchema.pageViews.at,
        })
        .from(dbSchema.pageViews),
      db
        .select({
          projectId: dbSchema.exportsTable.projectId,
          status: dbSchema.exportsTable.status,
          createdAt: dbSchema.exportsTable.createdAt,
        })
        .from(dbSchema.exportsTable)
        .where(eq(dbSchema.exportsTable.status, "completed")),
    ]);

  const totalUsers = userRows.length;
  const paidUsers = userRows.filter((u) => u.plan === "pro" || u.plan === "team").length;
  const freeToProRatePercent =
    totalUsers > 0 ? Math.round((paidUsers / totalUsers) * 1000) / 10 : 0;

  const userNameById = new Map(userRows.map((u) => [u.id, u.name]));
  const versionToTemplateId = new Map(versionRows.map((v) => [v.id, v.templateId]));
  const templateById = new Map(templateRows.map((t) => [t.id, t]));

  let publishedCaseStudies = 0;
  let publishesPrevPeriod = prevStart ? 0 : null;

  for (const p of projectRows) {
    if (!p.publishedAt || p.visibility !== "public") continue;
    if (!rangeStart || (p.publishedAt >= rangeStart && p.publishedAt <= now)) {
      publishedCaseStudies += 1;
    } else if (prevStart && p.publishedAt >= prevStart && p.publishedAt < rangeStart) {
      publishesPrevPeriod = (publishesPrevPeriod ?? 0) + 1;
    }
  }

  let publicViews = 0;
  let viewsPrevPeriod = prevStart ? 0 : null;
  const viewsByProject = new Map<string, number>();

  for (const v of viewRows) {
    if (!rangeStart || (v.at >= rangeStart && v.at <= now)) {
      publicViews += 1;
      viewsByProject.set(v.projectId, (viewsByProject.get(v.projectId) ?? 0) + 1);
    } else if (prevStart && v.at >= prevStart && v.at < rangeStart) {
      viewsPrevPeriod = (viewsPrevPeriod ?? 0) + 1;
    }
  }

  let completedExports = 0;
  let exportsPrevPeriod = prevStart ? 0 : null;
  const exportsByProject = new Map<string, number>();

  for (const exp of exportRows) {
    if (!rangeStart || (exp.createdAt >= rangeStart && exp.createdAt <= now)) {
      completedExports += 1;
      exportsByProject.set(exp.projectId, (exportsByProject.get(exp.projectId) ?? 0) + 1);
    } else if (prevStart && exp.createdAt >= prevStart && exp.createdAt < rangeStart) {
      exportsPrevPeriod = (exportsPrevPeriod ?? 0) + 1;
    }
  }

  // Template usage share across all projects (or projects active in range)
  const projectCountByTemplateId = new Map<string, number>();
  for (const p of projectRows) {
    const tplId = versionToTemplateId.get(p.templateVersionId);
    if (!tplId) continue;
    projectCountByTemplateId.set(tplId, (projectCountByTemplateId.get(tplId) ?? 0) + 1);
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

  // Weekly publishes chart (12 buckets)
  const chartDays = days ?? 84;
  const chartWindowMs = chartDays * 24 * 60 * 60 * 1000;
  const chartStartMs = now.getTime() - chartWindowMs;
  const bucketSpanMs = chartWindowMs / BUCKET_COUNT;

  const weeklyPublishes: AdminWeeklyPublishBucket[] = Array.from(
    { length: BUCKET_COUNT },
    (_, idx) => {
      const startMs = chartStartMs + idx * bucketSpanMs;
      const endMs = idx === BUCKET_COUNT - 1 ? now.getTime() + 1 : startMs + bucketSpanMs;
      const label = new Date(startMs).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      let publishes = 0;
      for (const p of projectRows) {
        if (!p.publishedAt) continue;
        const t = p.publishedAt.getTime();
        if (t >= startMs && t < endMs) publishes += 1;
      }
      return {
        index: idx,
        label,
        publishes,
      };
    },
  );

  // Top case studies sorted by views DESC, exports DESC
  const topCaseStudies: AdminTopCaseStudyRow[] = projectRows
    .filter((p) => p.visibility === "public" || (viewsByProject.get(p.id) ?? 0) > 0)
    .map((p) => {
      const tplId = versionToTemplateId.get(p.templateVersionId);
      const tpl = tplId ? templateById.get(tplId) : undefined;
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        authorName: userNameById.get(p.ownerId) ?? "Unknown author",
        templateName: tpl?.name ?? "Custom",
        views: viewsByProject.get(p.id) ?? 0,
        exports: exportsByProject.get(p.id) ?? 0,
      };
    })
    .sort((a, b) => b.views - a.views || b.exports - a.exports)
    .slice(0, 10);

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
