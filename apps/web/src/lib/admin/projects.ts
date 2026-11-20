import { count, desc, eq, inArray, type UserRole } from "@casefolio/db";
import { revalidatePath } from "next/cache";
import type {
  AdminProjectListItem,
  AdminProjectsOverview,
} from "@/lib/admin/projects-types";
import { db, dbSchema } from "@/lib/db";
import { createUserNotification } from "@/lib/notifications/service";
import { revalidatePublicProject } from "@/lib/projects/public-cache";
import { deleteStoredObject } from "@/lib/storage/r2";
import { recordAdminAuditLog } from "@/lib/template/service";

export async function listAdminProjectsOverview(options?: {
  limit?: number;
  ownerId?: string;
}): Promise<AdminProjectsOverview> {
  const safeLimit = Math.max(1, Math.min(1500, Math.trunc(options?.limit ?? 1000)));

  const baseQuery = db
    .select({
      project: dbSchema.projects,
      ownerName: dbSchema.users.name,
      ownerEmail: dbSchema.users.email,
      ownerPlan: dbSchema.users.plan,
      orgName: dbSchema.organizations.name,
      templateName: dbSchema.templates.name,
      templateCoverUrl: dbSchema.templates.coverUrl,
      suspendedReason: dbSchema.publishedSnapshots.suspendedReason,
      workspaceKind: dbSchema.workspaces.kind,
    })
    .from(dbSchema.projects)
    .innerJoin(dbSchema.users, eq(dbSchema.projects.ownerId, dbSchema.users.id))
    .leftJoin(dbSchema.organizations, eq(dbSchema.projects.orgId, dbSchema.organizations.id))
    .leftJoin(dbSchema.workspaces, eq(dbSchema.projects.workspaceId, dbSchema.workspaces.id))
    .innerJoin(
      dbSchema.templateVersions,
      eq(dbSchema.projects.templateVersionId, dbSchema.templateVersions.id),
    )
    .innerJoin(
      dbSchema.templates,
      eq(dbSchema.templateVersions.templateId, dbSchema.templates.id),
    )
    .leftJoin(
      dbSchema.publishedSnapshots,
      eq(dbSchema.projects.id, dbSchema.publishedSnapshots.projectId),
    )
    .where(options?.ownerId ? eq(dbSchema.projects.ownerId, options.ownerId) : undefined)
    .orderBy(desc(dbSchema.projects.updatedAt))
    .limit(safeLimit);

  const rows = await baseQuery;
  if (rows.length === 0) {
    return {
      summary: {
        total: 0,
        published: 0,
        unlisted: 0,
        draft: 0,
        archived: 0,
        takedownOrSuspended: 0,
        team: 0,
      },
      projects: [],
    };
  }

  const projectIds = rows.map((r) => r.project.id);

  const [viewCounts, exportCounts] = await Promise.all([
    db
      .select({ projectId: dbSchema.pageViews.projectId, total: count() })
      .from(dbSchema.pageViews)
      .where(inArray(dbSchema.pageViews.projectId, projectIds))
      .groupBy(dbSchema.pageViews.projectId),
    db
      .select({ projectId: dbSchema.exportsTable.projectId, total: count() })
      .from(dbSchema.exportsTable)
      .where(inArray(dbSchema.exportsTable.projectId, projectIds))
      .groupBy(dbSchema.exportsTable.projectId),
  ]);

  const viewsByProj = new Map(viewCounts.map((v) => [v.projectId, v.total]));
  const exportsByProj = new Map(exportCounts.map((e) => [e.projectId, e.total]));

  let published = 0;
  let unlisted = 0;
  let draft = 0;
  let archived = 0;
  let takedownOrSuspended = 0;
  let team = 0;

  const projects: AdminProjectListItem[] = rows.map((r) => {
    const p = r.project;
    const isTeam = r.workspaceKind === "team" || Boolean(p.orgId);
    if (p.visibility === "public") published += 1;
    else if (p.visibility === "unlisted") unlisted += 1;
    else draft += 1;
    if (p.archivedAt) archived += 1;
    if (r.suspendedReason) takedownOrSuspended += 1;
    if (isTeam) team += 1;

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      type: p.type,
      visibility: p.visibility,
      archivedAtIso: p.archivedAt ? p.archivedAt.toISOString() : null,
      suspendedReason: r.suspendedReason ?? null,
      ownerId: p.ownerId,
      ownerName: r.ownerName,
      ownerEmail: r.ownerEmail,
      ownerPlan: r.ownerPlan === "plus" ? "team" : r.ownerPlan,
      workspaceKind: isTeam ? "team" : "personal",
      orgName: r.orgName ?? null,
      templateName: r.templateName,
      templateCoverUrl: r.templateCoverUrl ?? null,
      views: viewsByProj.get(p.id) ?? 0,
      exports: exportsByProj.get(p.id) ?? 0,
      publishedAtIso: p.publishedAt ? p.publishedAt.toISOString() : null,
      updatedAtIso: p.updatedAt.toISOString(),
    };
  });

  return {
    summary: {
      total: projects.length,
      published,
      unlisted,
      draft,
      archived,
      takedownOrSuspended,
      team,
    },
    projects,
  };
}

export async function performAdminProjectAction(args: {
  actorId: string;
  actorRole: UserRole;
  projectId: string;
  action: "unpublish" | "takedown" | "restore" | "archive" | "unarchive" | "delete";
  reason?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const [project] = await db
    .select()
    .from(dbSchema.projects)
    .where(eq(dbSchema.projects.id, args.projectId))
    .limit(1);

  if (!project) {
    return { ok: false, error: "Project not found." };
  }

  const now = new Date();

  if (args.action === "delete") {
    if (args.actorRole !== "superadmin" && args.actorRole !== "admin") {
      return { ok: false, error: "Admin access required." };
    }

    const [assetRows, exportRows] = await Promise.all([
      db
        .select({ r2Key: dbSchema.assets.r2Key })
        .from(dbSchema.assets)
        .where(eq(dbSchema.assets.projectId, project.id)),
      db
        .select({ r2Key: dbSchema.exportsTable.r2Key })
        .from(dbSchema.exportsTable)
        .where(eq(dbSchema.exportsTable.projectId, project.id)),
    ]);

    const keys = [
      ...assetRows.map((a) => a.r2Key),
      ...exportRows.map((e) => e.r2Key).filter((k): k is string => Boolean(k)),
    ];

    await Promise.all(keys.map((key) => deleteStoredObject(key).catch(() => undefined)));
    await db.delete(dbSchema.projects).where(eq(dbSchema.projects.id, project.id));

    await recordAdminAuditLog(args.actorId, "admin.project.deleted", {
      projectId: project.id,
      projectName: project.name,
      ownerId: project.ownerId,
      slug: project.slug,
    });
  } else if (args.action === "unpublish") {
    await db.transaction(async (tx) => {
      await tx
        .update(dbSchema.projects)
        .set({ visibility: "private", publishedAt: null, updatedAt: now })
        .where(eq(dbSchema.projects.id, project.id));
      await tx
        .delete(dbSchema.publishedSnapshots)
        .where(eq(dbSchema.publishedSnapshots.projectId, project.id));
    });

    await recordAdminAuditLog(args.actorId, "admin.project.unpublished", {
      projectId: project.id,
      ownerId: project.ownerId,
      slug: project.slug,
    });
  } else if (args.action === "takedown") {
    const reasonText = args.reason?.trim() || "Removed by administrator moderation review";
    await db.transaction(async (tx) => {
      await tx
        .update(dbSchema.projects)
        .set({ visibility: "private", updatedAt: now })
        .where(eq(dbSchema.projects.id, project.id));
      await tx
        .update(dbSchema.publishedSnapshots)
        .set({ suspendedReason: `moderation_takedown:${reasonText}`, updatedAt: now })
        .where(eq(dbSchema.publishedSnapshots.projectId, project.id));
    });

    await createUserNotification({
      userId: project.ownerId,
      kind: "moderation_takedown",
      title: `Case study taken offline: ${project.name}`,
      message: reasonText,
      href: `/editor/${project.id}`,
    }).catch(() => undefined);

    await recordAdminAuditLog(args.actorId, "admin.project.takedown", {
      projectId: project.id,
      ownerId: project.ownerId,
      reason: reasonText,
    });
  } else if (args.action === "restore") {
    await db
      .update(dbSchema.publishedSnapshots)
      .set({ suspendedReason: null, updatedAt: now })
      .where(eq(dbSchema.publishedSnapshots.projectId, project.id));

    await recordAdminAuditLog(args.actorId, "admin.project.restored", {
      projectId: project.id,
      ownerId: project.ownerId,
    });
  } else if (args.action === "archive" || args.action === "unarchive") {
    await db
      .update(dbSchema.projects)
      .set({
        archivedAt: args.action === "archive" ? now : null,
        updatedAt: now,
      })
      .where(eq(dbSchema.projects.id, project.id));

    await recordAdminAuditLog(args.actorId, `admin.project.${args.action}d`, {
      projectId: project.id,
      ownerId: project.ownerId,
    });
  }

  revalidatePublicProject(project.slug);
  try {
    revalidatePath("/admin/projects");
    revalidatePath(`/admin/users/${project.ownerId}`);
    revalidatePath("/admin");
  } catch {
    // Ignore outside Next runtime
  }

  return { ok: true };
}
