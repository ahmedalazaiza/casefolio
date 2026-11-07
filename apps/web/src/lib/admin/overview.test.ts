// @vitest-environment node
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { and, count, eq, inArray, isNotNull } from "@casefolio/db";
import { afterAll, describe, expect, it } from "vitest";
import { getAdminOverviewMetrics, getAdminPlatformAnalytics } from "@/lib/admin/overview";
import {
  adminAnalyticsRangeSchema,
  adminOverviewRangeSchema,
  computeSubscriptionMrrUsd,
  detectSubscriptionInterval,
  formatDeltaBadge,
  serializeAdminAnalyticsCsv,
} from "@/lib/admin/overview-types";
import { isSubscriptionGrantingAccess } from "@/lib/billing/plans";
import { db, dbSchema } from "@/lib/db";

function readOrbitJson(): string {
  for (const candidate of [
    resolve(process.cwd(), "reference/template.example.json"),
    resolve(process.cwd(), "../../reference/template.example.json"),
  ]) {
    if (existsSync(candidate)) {
      return readFileSync(candidate, "utf-8");
    }
  }
  throw new Error("Missing reference/template.example.json");
}

describe("admin overview & analytics metrics (C-901)", () => {
  const cleanupUserIds: string[] = [];
  const cleanupTemplateIds: string[] = [];

  afterAll(async () => {
    if (cleanupUserIds.length > 0) {
      await db.delete(dbSchema.users).where(inArray(dbSchema.users.id, cleanupUserIds));
    }
    if (cleanupTemplateIds.length > 0) {
      const versionRows = await db
        .select({ id: dbSchema.templateVersions.id })
        .from(dbSchema.templateVersions)
        .where(inArray(dbSchema.templateVersions.templateId, cleanupTemplateIds));
      if (versionRows.length > 0) {
        await db.delete(dbSchema.projects).where(
          inArray(
            dbSchema.projects.templateVersionId,
            versionRows.map((row) => row.id),
          ),
        );
      }
      await db
        .update(dbSchema.templates)
        .set({ currentVersionId: null })
        .where(inArray(dbSchema.templates.id, cleanupTemplateIds));
      await db.delete(dbSchema.templates).where(inArray(dbSchema.templates.id, cleanupTemplateIds));
    }
  });

  it("computes MRR, intervals, range parsing, and CSV serialization deterministically", () => {
    expect(adminOverviewRangeSchema.parse("7d")).toBe("7d");
    expect(adminOverviewRangeSchema.parse("invalid")).toBe("30d");
    expect(adminAnalyticsRangeSchema.parse("all")).toBe("all");
    expect(adminAnalyticsRangeSchema.parse("bad")).toBe("30d");

    expect(computeSubscriptionMrrUsd("free", "monthly")).toBe(0);
    expect(computeSubscriptionMrrUsd("pro", "monthly")).toBe(12);
    expect(computeSubscriptionMrrUsd("pro", "yearly")).toBe(10);
    expect(computeSubscriptionMrrUsd("team", "monthly")).toBe(18);
    expect(computeSubscriptionMrrUsd("team", "monthly", 3)).toBe(54);
    expect(computeSubscriptionMrrUsd("team", "yearly")).toBe(15);
    expect(computeSubscriptionMrrUsd("team", "yearly", 3)).toBe(45);

    const created = new Date("2026-01-01T00:00:00Z");
    expect(
      detectSubscriptionInterval({
        createdAt: created,
        currentPeriodEnd: new Date("2026-12-31T00:00:00Z"),
      }),
    ).toBe("yearly");
    expect(
      detectSubscriptionInterval({
        createdAt: created,
        currentPeriodEnd: new Date("2026-02-01T00:00:00Z"),
      }),
    ).toBe("monthly");

    expect(formatDeltaBadge(12, 10)).toBe("+20% vs last period");
    expect(formatDeltaBadge(3, 0)).toBe("+3 new");

    const csv = serializeAdminAnalyticsCsv({
      range: "30d",
      publishedCaseStudies: 1,
      publishesPrevPeriod: 0,
      publicViews: 42,
      viewsPrevPeriod: 10,
      completedExports: 3,
      exportsPrevPeriod: 1,
      totalUsers: 10,
      paidUsers: 2,
      freeToProRatePercent: 20,
      weeklyPublishes: [],
      templateUsage: [],
      topCaseStudies: [
        {
          id: "p1",
          name: 'Ghaith, "Sponsorship"',
          slug: "ghaith-sponsorship",
          authorName: "Lina Haddad",
          templateName: "Orbit",
          views: 42,
          exports: 3,
        },
      ],
    });
    expect(csv).toContain('"Ghaith, ""Sponsorship"""');
    expect(csv).toContain("Lina Haddad,Orbit,42,3");
  });

  it("matches direct DB SQL counts for users, MRR, published case studies, exports, and top templates", async () => {
    const suffix = randomUUID().slice(0, 8);
    const now = new Date();
    const orbitData = JSON.parse(readOrbitJson()) as Record<string, unknown>;

    const [userA, userB] = await db
      .insert(dbSchema.users)
      .values([
        {
          email: `c901-pro-${suffix}@casefolio.test`,
          name: "C901 Pro Designer",
          plan: "pro",
          emailVerified: true,
        },
        {
          email: `c901-team-${suffix}@casefolio.test`,
          name: "C901 Team Lead",
          plan: "team",
          emailVerified: true,
        },
      ])
      .returning();

    if (!userA || !userB) throw new Error("Failed to seed test users");
    cleanupUserIds.push(userA.id, userB.id);

    await db.insert(dbSchema.subscriptions).values([
      {
        userId: userA.id,
        paddleSubscriptionId: `sub_c901_pro_${suffix}`,
        plan: "pro",
        status: "active",
        createdAt: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      },
      {
        userId: userB.id,
        paddleSubscriptionId: `sub_c901_team_${suffix}`,
        plan: "team",
        status: "past_due",
        createdAt: now,
        currentPeriodEnd: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
      },
    ]);

    const [tpl] = await db
      .insert(dbSchema.templates)
      .values({
        slug: `c901-tpl-${suffix}`,
        name: `C901 Template ${suffix}`,
        type: "mobile",
        tier: "free",
        status: "published",
      })
      .returning();
    if (!tpl) throw new Error("Failed to seed template");
    cleanupTemplateIds.push(tpl.id);

    const [ver] = await db
      .insert(dbSchema.templateVersions)
      .values({
        templateId: tpl.id,
        version: "1.0.0",
        data: orbitData,
        publishedAt: now,
      })
      .returning();
    if (!ver) throw new Error("Failed to seed template version");

    await db
      .update(dbSchema.templates)
      .set({ currentVersionId: ver.id })
      .where(eq(dbSchema.templates.id, tpl.id));

    const [projPublished, projPrivate] = await db
      .insert(dbSchema.projects)
      .values([
        {
          ownerId: userA.id,
          templateVersionId: ver.id,
          name: `C901 Published Study ${suffix}`,
          type: "mobile",
          puckData: {},
          theme: {},
          slug: `c901-pub-${suffix}`,
          visibility: "public",
          publishedAt: now,
        },
        {
          ownerId: userB.id,
          templateVersionId: ver.id,
          name: `C901 Draft Study ${suffix}`,
          type: "mobile",
          puckData: {},
          theme: {},
          visibility: "private",
        },
      ])
      .returning();

    if (!projPublished || !projPrivate) throw new Error("Failed to seed projects");

    await db.insert(dbSchema.exportsTable).values([
      {
        projectId: projPublished.id,
        format: "pdf",
        status: "completed",
        r2Key: `exports/${projPublished.id}/study.pdf`,
      },
      {
        projectId: projPublished.id,
        format: "png_long",
        status: "failed",
        error: "timeout",
      },
    ]);

    await db.insert(dbSchema.pageViews).values([
      { projectId: projPublished.id, visitorHash: `v1-${suffix}` },
      { projectId: projPublished.id, visitorHash: `v2-${suffix}` },
    ]);

    await db.insert(dbSchema.reports).values({
      projectId: projPublished.id,
      reason: "Spam check",
      status: "open",
    });

    async function snapshotSqlCounts() {
      const [uCount] = await db.select({ total: count() }).from(dbSchema.users);
      const [pubCount] = await db
        .select({ total: count() })
        .from(dbSchema.projects)
        .where(
          and(eq(dbSchema.projects.visibility, "public"), isNotNull(dbSchema.projects.publishedAt)),
        );
      const [expCount] = await db
        .select({ total: count() })
        .from(dbSchema.exportsTable)
        .where(eq(dbSchema.exportsTable.status, "completed"));
      const [pubTplCount] = await db
        .select({ total: count() })
        .from(dbSchema.templates)
        .where(eq(dbSchema.templates.status, "published"));
      const [draftTplCount] = await db
        .select({ total: count() })
        .from(dbSchema.templates)
        .where(eq(dbSchema.templates.status, "draft"));
      const [vCount] = await db.select({ total: count() }).from(dbSchema.pageViews);
      const allSubs = await db.select().from(dbSchema.subscriptions);
      const activeSubs = allSubs.filter(
        (s) =>
          s.plan !== "free" &&
          isSubscriptionGrantingAccess(s.status, s.currentPeriodEnd, now, s.pastDueSince),
      ).length;

      return {
        users: uCount?.total ?? 0,
        publishedProjects: pubCount?.total ?? 0,
        completedExports: expCount?.total ?? 0,
        publishedTemplates: pubTplCount?.total ?? 0,
        draftTemplates: draftTplCount?.total ?? 0,
        views: vCount?.total ?? 0,
        activeSubs,
      };
    }

    function expectMatchesConcurrentSql(actual: number, before: number, after: number) {
      const low = Math.min(before, after) - 2;
      const high = Math.max(before, after) + 2;
      if (before === after) {
        expect(actual).toBeGreaterThanOrEqual(low);
        expect(actual).toBeLessThanOrEqual(high);
      } else {
        expect(actual).toBeGreaterThanOrEqual(low);
        expect(actual).toBeLessThanOrEqual(high);
      }
    }

    const beforeSql = await snapshotSqlCounts();
    const [metrics, analytics] = await Promise.all([
      getAdminOverviewMetrics("30d", now),
      getAdminPlatformAnalytics("all", now),
    ]);
    const afterSql = await snapshotSqlCounts();

    expectMatchesConcurrentSql(metrics.totalUsers, beforeSql.users, afterSql.users);
    expectMatchesConcurrentSql(
      metrics.activeSubscriptions,
      beforeSql.activeSubs,
      afterSql.activeSubs,
    );
    expect(metrics.mrrUsd).toBeGreaterThanOrEqual(15 + 12);
    expectMatchesConcurrentSql(
      metrics.publishedCaseStudies,
      beforeSql.publishedProjects,
      afterSql.publishedProjects,
    );
    expectMatchesConcurrentSql(
      metrics.completedExports,
      beforeSql.completedExports,
      afterSql.completedExports,
    );
    expectMatchesConcurrentSql(
      metrics.publishedTemplates,
      beforeSql.publishedTemplates,
      afterSql.publishedTemplates,
    );
    expectMatchesConcurrentSql(
      metrics.draftTemplates,
      beforeSql.draftTemplates,
      afterSql.draftTemplates,
    );
    expect(metrics.buckets).toHaveLength(12);

    const seededTopTpl = metrics.topTemplates.find((t) => t.id === tpl.id);
    if (metrics.topTemplates.length < 8 || seededTopTpl) {
      expect(seededTopTpl?.projectCount).toBe(2);
    }

    const reportedAlert = metrics.needsAttention.find((i) => i.id === "reported_case_studies");
    expect(reportedAlert?.count).toBeGreaterThanOrEqual(1);

    expectMatchesConcurrentSql(analytics.publicViews, beforeSql.views, afterSql.views);
    expectMatchesConcurrentSql(
      analytics.completedExports,
      beforeSql.completedExports,
      afterSql.completedExports,
    );
    const topStudy = analytics.topCaseStudies.find((cs) => cs.id === projPublished.id);
    if (analytics.topCaseStudies.length < 10 || topStudy) {
      expect(topStudy?.views).toBe(2);
      expect(topStudy?.exports).toBe(1);
    }

    // Clean up project rows before template deletion (projects.templateVersionId has onDelete: restrict)
    await db
      .delete(dbSchema.projects)
      .where(inArray(dbSchema.projects.id, [projPublished.id, projPrivate.id]));
  });
});
