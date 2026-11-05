import { and, desc, eq, inArray } from "@casefolio/db";
import {
  extractPrimaryReasonLabel,
  type AdminModerationCaseItem,
  type AdminModerationOverview,
  type CreateCaseStudyReportInput,
  type ModerationQueueFilter,
} from "@/lib/admin/moderation-types";
import { db, dbSchema } from "@/lib/db";
import { createUserNotification } from "@/lib/notifications/service";
import { recordAdminAuditLog } from "@/lib/template/service";

export async function submitPublicProjectReport(args: {
  input: CreateCaseStudyReportInput;
  reporterId?: string | null;
}): Promise<{ ok: true; reportId: string } | { ok: false; status: number; error: string }> {
  const [project] = await db
    .select()
    .from(dbSchema.projects)
    .where(eq(dbSchema.projects.id, args.input.projectId))
    .limit(1);

  if (
    !project ||
    project.publishedAt === null ||
    (project.visibility !== "public" && project.visibility !== "unlisted")
  ) {
    return {
      ok: false,
      status: 404,
      error: "Published case study not found.",
    };
  }

  const trimmedDetails = args.input.details?.trim() ?? "";
  const formattedReason = trimmedDetails
    ? `${args.input.category}: ${trimmedDetails}`
    : args.input.category;

  const [created] = await db
    .insert(dbSchema.reports)
    .values({
      projectId: project.id,
      reporterId: args.reporterId ?? null,
      reason: formattedReason,
      status: "open",
    })
    .returning();

  if (!created) {
    return {
      ok: false,
      status: 500,
      error: "Failed to submit report.",
    };
  }

  return { ok: true, reportId: created.id };
}

function mapReportStatusToBucket(status: string): ModerationQueueFilter {
  if (status === "takedown") return "takedown";
  if (status === "dismissed" || status === "reviewed") return "dismissed";
  return "open";
}

export async function listAdminModerationQueue(): Promise<AdminModerationOverview> {
  const rows = await db
    .select({
      report: dbSchema.reports,
      project: dbSchema.projects,
      author: {
        id: dbSchema.users.id,
        name: dbSchema.users.name,
        email: dbSchema.users.email,
      },
    })
    .from(dbSchema.reports)
    .innerJoin(dbSchema.projects, eq(dbSchema.reports.projectId, dbSchema.projects.id))
    .innerJoin(dbSchema.users, eq(dbSchema.projects.ownerId, dbSchema.users.id))
    .orderBy(desc(dbSchema.reports.createdAt));

  const grouped = new Map<string, AdminModerationCaseItem>();

  for (const row of rows) {
    const bucket = mapReportStatusToBucket(row.report.status);
    const groupKey = `${row.project.id}:${bucket}`;
    const existing = grouped.get(groupKey);

    if (!existing) {
      grouped.set(groupKey, {
        id: groupKey,
        projectId: row.project.id,
        projectName: row.project.name,
        projectSlug: row.project.slug,
        projectVisibility: row.project.visibility,
        publishedAtIso: row.project.publishedAt
          ? row.project.publishedAt.toISOString()
          : row.project.updatedAt.toISOString(),
        authorId: row.author.id,
        authorName: row.author.name,
        authorEmail: row.author.email,
        queueBucket: bucket,
        primaryReason: extractPrimaryReasonLabel(row.report.reason),
        reportNotes: [row.report.reason],
        reportCount: 1,
        latestReportedAtIso: row.report.createdAt.toISOString(),
      });
    } else {
      existing.reportCount += 1;
      if (
        existing.reportNotes.length < 5 &&
        !existing.reportNotes.includes(row.report.reason)
      ) {
        existing.reportNotes.push(row.report.reason);
      }
    }
  }

  const items = Array.from(grouped.values());
  const openCount = items.filter((i) => i.queueBucket === "open").length;
  const dismissedCount = items.filter((i) => i.queueBucket === "dismissed").length;
  const takedownCount = items.filter((i) => i.queueBucket === "takedown").length;

  return {
    openCount,
    dismissedCount,
    takedownCount,
    items,
  };
}

export async function resolveModerationForProject(args: {
  actorId: string;
  projectId: string;
  decision: "dismiss" | "takedown";
}): Promise<
  | { ok: true; slug: string | null; decision: "dismiss" | "takedown" }
  | { ok: false; error: string }
> {
  const [project] = await db
    .select()
    .from(dbSchema.projects)
    .where(eq(dbSchema.projects.id, args.projectId))
    .limit(1);

  if (!project) {
    return { ok: false, error: "Project not found." };
  }

  const matchingReports = await db
    .select()
    .from(dbSchema.reports)
    .where(
      and(
        eq(dbSchema.reports.projectId, project.id),
        inArray(dbSchema.reports.status, ["open", "reviewed"]),
      ),
    );

  if (args.decision === "dismiss") {
    if (matchingReports.length > 0) {
      await db
        .update(dbSchema.reports)
        .set({ status: "dismissed" })
        .where(
          inArray(
            dbSchema.reports.id,
            matchingReports.map((r) => r.id),
          ),
        );
    }

    await recordAdminAuditLog(args.actorId, "admin.moderation.dismissed", {
      projectId: project.id,
      projectName: project.name,
      slug: project.slug,
      reportCount: matchingReports.length,
    });

    return { ok: true, slug: project.slug, decision: "dismiss" };
  }

  // Takedown: unpublish project immediately so /p/[slug] returns 404, keep owner draft, mark reports "takedown", notify owner & audit log
  const now = new Date();
  await db
    .update(dbSchema.projects)
    .set({
      visibility: "private",
      publishedAt: null,
      updatedAt: now,
    })
    .where(eq(dbSchema.projects.id, project.id));

  if (matchingReports.length > 0) {
    await db
      .update(dbSchema.reports)
      .set({ status: "takedown" })
      .where(
        inArray(
          dbSchema.reports.id,
          matchingReports.map((r) => r.id),
        ),
      );
  } else {
    // Even if taken down directly without an open report row, ensure a takedown record exists
    await db.insert(dbSchema.reports).values({
      projectId: project.id,
      reporterId: args.actorId,
      reason: "Admin policy takedown",
      status: "takedown",
    });
  }

  await createUserNotification({
    userId: project.ownerId,
    kind: "moderation_takedown",
    title: `"${project.name}" was unpublished`,
    message:
      "Our moderation team unpublished your public link following a policy review. Your draft remains safe in your editor.",
    href: `/projects/${project.id}/edit`,
    meta: {
      projectId: project.id,
      slug: project.slug,
    },
    sendEmail: true,
    emailSubject: `Case study "${project.name}" unpublished — Casefolio`,
    emailCtaLabel: "Review draft in Editor",
  }).catch(() => undefined);

  await recordAdminAuditLog(args.actorId, "admin.moderation.takedown", {
    projectId: project.id,
    projectName: project.name,
    slug: project.slug,
    ownerId: project.ownerId,
    reportCount: matchingReports.length,
  });

  return { ok: true, slug: project.slug, decision: "takedown" };
}

export async function dismissAllOpenModerationReports(args: {
  actorId: string;
}): Promise<{ ok: true; dismissedCount: number }> {
  const openRows = await db
    .select({ id: dbSchema.reports.id })
    .from(dbSchema.reports)
    .where(eq(dbSchema.reports.status, "open"));

  if (openRows.length > 0) {
    await db
      .update(dbSchema.reports)
      .set({ status: "dismissed" })
      .where(
        inArray(
          dbSchema.reports.id,
          openRows.map((r) => r.id),
        ),
      );
  }

  await recordAdminAuditLog(args.actorId, "admin.moderation.bulk_dismissed", {
    dismissedReportCount: openRows.length,
  });

  return { ok: true, dismissedCount: openRows.length };
}
