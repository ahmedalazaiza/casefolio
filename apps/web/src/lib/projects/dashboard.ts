import {
  and,
  desc,
  eq,
  inArray,
  isNull,
  or,
  type PlanTier,
  type UserRole,
} from "@casefolio/db";
import { trackServerProductEvent } from "@/lib/analytics/posthog";
import { db, dbSchema } from "@/lib/db";
import {
  ensurePersonalWorkspaceForUser,
  ensureTeamWorkspaceForOrganization,
} from "@/lib/entitlements/server";
import { resolveProjectOrTemplateThumbnailUrl } from "@/lib/template/cover-url";
import {
  authorizeProjectAccess,
  ensureProjectWorkspaceAndSpace,
} from "@/lib/workspaces/acl";
import { revokeUserWorkspaceLeases } from "@/lib/workspaces/leases";
import {
  getWorkspaceProjectCounts,
  listVisibleSpacesForWorkspace,
} from "@/lib/workspaces/service";
import {
  archiveProjectInputSchema,
  deleteProjectInputSchema,
  duplicateProjectInputSchema,
  renameProjectInputSchema,
  type ArchiveProjectInput,
  type ArchiveProjectResult,
  type DashboardProjectItem,
  type DeleteProjectInput,
  type DeleteProjectResult,
  type DuplicateProjectInput,
  type DuplicateProjectResult,
  type RenameProjectInput,
  type RenameProjectResult,
} from "./dashboard-types";

async function backfillUnassignedProjectsForContext(
  userId: string,
  activeOrgId: string | null,
): Promise<void> {
  const missingSpaceRows = await db
    .select()
    .from(dbSchema.projects)
    .where(
      and(
        isNull(dbSchema.projects.spaceId),
        activeOrgId
          ? or(
              eq(dbSchema.projects.ownerId, userId),
              eq(dbSchema.projects.orgId, activeOrgId),
            )
          : eq(dbSchema.projects.ownerId, userId),
      ),
    );

  for (const proj of missingSpaceRows) {
    await ensureProjectWorkspaceAndSpace(proj);
  }
}

/**
 * Lists dashboard projects strictly scoped to the caller's active workspace & visible spaces (`Spec §9 & §10.1`):
 * - Personal context (`activeOrgId === null`): ONLY caller's personal workspace spaces (`orgId IS NULL`).
 * - Team context (`activeOrgId` set): ONLY active `shared` spaces + caller's OWN `private` spaces in that team.
 *   NEVER returns teammates' `private` spaces or departed `frozen_member_departed` spaces.
 */
export async function listDashboardProjectsForUser(
  userId: string,
  activeOrgId: string | null = null,
  options?: {
    spaceId?: string | null;
    includeArchived?: boolean;
  },
): Promise<DashboardProjectItem[]> {
  await backfillUnassignedProjectsForContext(userId, activeOrgId);

  let targetWorkspaceId: string;
  let targetWorkspaceKind: "personal" | "team" = "personal";

  if (activeOrgId) {
    const [membership] = await db
      .select({ id: dbSchema.memberships.id })
      .from(dbSchema.memberships)
      .where(
        and(
          eq(dbSchema.memberships.orgId, activeOrgId),
          eq(dbSchema.memberships.userId, userId),
        ),
      )
      .limit(1);

    if (membership) {
      const teamEnsured = await ensureTeamWorkspaceForOrganization(activeOrgId, userId);
      targetWorkspaceId = teamEnsured.workspaceId;
      targetWorkspaceKind = "team";
    } else {
      const personal = await ensurePersonalWorkspaceForUser(userId);
      targetWorkspaceId = personal.workspaceId;
    }
  } else {
    const personal = await ensurePersonalWorkspaceForUser(userId);
    targetWorkspaceId = personal.workspaceId;
  }

  const visibleSpaces = await listVisibleSpacesForWorkspace(targetWorkspaceId, userId);
  if (visibleSpaces.length === 0) {
    return [];
  }

  const spaceMap = new Map(visibleSpaces.map((s) => [s.id, s]));
  const filteredSpaceIds =
    options?.spaceId && spaceMap.has(options.spaceId)
      ? [options.spaceId]
      : visibleSpaces.map((s) => s.id);

  if (filteredSpaceIds.length === 0) {
    return [];
  }

  const includeArchived = options?.includeArchived ?? true;

  const rows = await db
    .select({
      project: dbSchema.projects,
      templateName: dbSchema.templates.name,
      templateTier: dbSchema.templates.tier,
      templateSlug: dbSchema.templates.slug,
      templateCoverUrl: dbSchema.templates.coverUrl,
    })
    .from(dbSchema.projects)
    .innerJoin(
      dbSchema.templateVersions,
      eq(dbSchema.projects.templateVersionId, dbSchema.templateVersions.id),
    )
    .innerJoin(dbSchema.templates, eq(dbSchema.templateVersions.templateId, dbSchema.templates.id))
    .where(
      includeArchived
        ? inArray(dbSchema.projects.spaceId, filteredSpaceIds)
        : and(
            inArray(dbSchema.projects.spaceId, filteredSpaceIds),
            isNull(dbSchema.projects.archivedAt),
          ),
    )
    .orderBy(desc(dbSchema.projects.updatedAt));

  return rows.map((row) => {
    const sp = row.project.spaceId ? spaceMap.get(row.project.spaceId) : undefined;
    const creatorId = row.project.createdByUserId ?? row.project.ownerId;
    return {
      id: row.project.id,
      name: row.project.name,
      type: row.project.type,
      visibility: row.project.visibility,
      slug: row.project.slug,
      publishedAtIso: row.project.publishedAt ? row.project.publishedAt.toISOString() : null,
      archivedAtIso: row.project.archivedAt ? row.project.archivedAt.toISOString() : null,
      createdAtIso: row.project.createdAt.toISOString(),
      updatedAtIso: row.project.updatedAt.toISOString(),
      templateName: row.templateName,
      templateTier: row.templateTier,
      templateSlug: row.templateSlug,
      templateCoverUrl: row.templateCoverUrl,
      thumbnailUrl: resolveProjectOrTemplateThumbnailUrl(
        row.project.puckData,
        row.templateCoverUrl,
        row.templateSlug,
      ),
      workspaceId: row.project.workspaceId,
      workspaceKind: targetWorkspaceKind,
      spaceId: row.project.spaceId,
      spaceName: sp?.name,
      spaceVisibility: sp?.visibility,
      isCreator: creatorId === userId,
    };
  });
}

export async function renameProjectForUser(
  input: RenameProjectInput,
  actor: { id: string; role: UserRole },
): Promise<RenameProjectResult> {
  const parsed = renameProjectInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: parsed.error.issues[0]?.message ?? "Invalid project name.",
    };
  }

  const { projectId, name } = parsed.data;
  const auth = await authorizeProjectAccess(projectId, actor.id, "edit");
  if (!auth.ok) {
    return {
      ok: false,
      code: auth.status === 404 ? "NOT_FOUND" : "FORBIDDEN",
      error: auth.status === 404 ? "Project not found." : auth.error,
    };
  }

  const clonedPuck = structuredClone(auth.project.puckData ?? {});
  if (
    clonedPuck &&
    typeof clonedPuck === "object" &&
    "root" in clonedPuck &&
    clonedPuck.root &&
    typeof clonedPuck.root === "object"
  ) {
    const rootObj = clonedPuck.root as Record<string, unknown>;
    const existingProps =
      rootObj.props && typeof rootObj.props === "object"
        ? (rootObj.props as Record<string, unknown>)
        : {};
    rootObj.props = { ...existingProps, title: name };
  }

  const now = new Date();
  await db
    .update(dbSchema.projects)
    .set({
      name,
      puckData: clonedPuck,
      revision: auth.project.revision + 1,
      updatedAt: now,
    })
    .where(eq(dbSchema.projects.id, projectId));

  return {
    ok: true,
    projectId,
    name,
    updatedAtIso: now.toISOString(),
  };
}

export async function duplicateProjectForUser(
  input: DuplicateProjectInput,
  actor: { id: string; role: UserRole },
  userPlan: PlanTier,
): Promise<DuplicateProjectResult> {
  const parsed = duplicateProjectInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: parsed.error.issues[0]?.message ?? "Invalid project ID.",
    };
  }

  const { projectId } = parsed.data;
  const auth = await authorizeProjectAccess(projectId, actor.id, "read");
  if (!auth.ok) {
    return { ok: false, code: "NOT_FOUND", error: "Project not found." };
  }

  if (auth.entitlement.isFrozen || auth.space.recoveryState !== "active") {
    return {
      ok: false,
      code: "WORKSPACE_FROZEN",
      error: "Cannot duplicate projects in a read-only workspace. Use Copy to Personal Workspace instead.",
    };
  }

  const [row] = await db
    .select({
      templateName: dbSchema.templates.name,
      templateTier: dbSchema.templates.tier,
      templateSlug: dbSchema.templates.slug,
      templateCoverUrl: dbSchema.templates.coverUrl,
    })
    .from(dbSchema.templateVersions)
    .innerJoin(dbSchema.templates, eq(dbSchema.templateVersions.templateId, dbSchema.templates.id))
    .where(eq(dbSchema.templateVersions.id, auth.project.templateVersionId))
    .limit(1);

  if (!row) {
    return { ok: false, code: "NOT_FOUND", error: "Project not found." };
  }

  const effectiveMaxActive =
    auth.workspace.kind === "personal" && userPlan === "pro" && auth.entitlement.plan === "free"
      ? 20
      : auth.entitlement.quotas.activeProjectsLimit;
  const effectiveMaxRetained =
    auth.workspace.kind === "personal" && userPlan === "pro" && auth.entitlement.plan === "free"
      ? 100
      : auth.entitlement.quotas.retainedProjectsLimit;

  const counts = await getWorkspaceProjectCounts(auth.workspace.id);
  if (counts.activeProjects >= effectiveMaxActive) {
    return {
      ok: false,
      code: "PLAN_LIMIT_REACHED",
      error: `This workspace has reached its limit of ${effectiveMaxActive} active case studies. Archive an existing project or upgrade your plan.`,
    };
  }

  if (counts.retainedProjects >= effectiveMaxRetained) {
    return {
      ok: false,
      code: "PLAN_LIMIT_REACHED",
      error: `This workspace has reached its limit of ${effectiveMaxRetained} total retained projects.`,
    };
  }

  const copyName = `${auth.project.name} (Copy)`.slice(0, 120);
  const clonedPuck = structuredClone(auth.project.puckData ?? {});
  if (
    clonedPuck &&
    typeof clonedPuck === "object" &&
    "root" in clonedPuck &&
    clonedPuck.root &&
    typeof clonedPuck.root === "object"
  ) {
    const rootObj = clonedPuck.root as Record<string, unknown>;
    const existingProps =
      rootObj.props && typeof rootObj.props === "object"
        ? (rootObj.props as Record<string, unknown>)
        : {};
    rootObj.props = { ...existingProps, title: copyName };
  }

  const now = new Date();
  const [created] = await db
    .insert(dbSchema.projects)
    .values({
      ownerId: actor.id,
      orgId: auth.workspace.organizationId,
      workspaceId: auth.workspace.id,
      spaceId: auth.space.id,
      createdByUserId: actor.id,
      templateVersionId: auth.project.templateVersionId,
      name: copyName,
      type: auth.project.type,
      puckData: clonedPuck,
      theme: structuredClone(auth.project.theme ?? {}),
      revision: 1,
      visibility: "private",
      slug: null,
      brandingRemoved: false,
      publicAcknowledgedAt: null,
      publishedAt: null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!created) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: "Failed to duplicate project.",
    };
  }

  await trackServerProductEvent({
    event: "project_created",
    distinctId: actor.id,
    properties: {
      projectId: created.id,
      projectType: created.type,
      duplicatedFromProjectId: auth.project.id,
    },
  });

  return {
    ok: true,
    project: {
      id: created.id,
      name: created.name,
      type: created.type,
      visibility: created.visibility,
      slug: created.slug,
      publishedAtIso: null,
      archivedAtIso: null,
      createdAtIso: created.createdAt.toISOString(),
      updatedAtIso: created.updatedAt.toISOString(),
      templateName: row.templateName,
      templateTier: row.templateTier,
      templateSlug: row.templateSlug,
      templateCoverUrl: row.templateCoverUrl,
      thumbnailUrl: resolveProjectOrTemplateThumbnailUrl(
        created.puckData,
        row.templateCoverUrl,
        row.templateSlug,
      ),
      workspaceId: auth.workspace.id,
      workspaceKind: auth.workspace.kind,
      spaceId: auth.space.id,
      spaceName: auth.space.name,
      spaceVisibility: auth.space.visibility,
      isCreator: true,
    },
  };
}

export async function archiveProjectForUser(
  input: ArchiveProjectInput,
  actor: { id: string; role: UserRole },
): Promise<ArchiveProjectResult> {
  const parsed = archiveProjectInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: parsed.error.issues[0]?.message ?? "Invalid project ID.",
    };
  }

  const auth = await authorizeProjectAccess(parsed.data.projectId, actor.id, "archive");
  if (!auth.ok) {
    return {
      ok: false,
      code: auth.status === 404 ? "NOT_FOUND" : "FORBIDDEN",
      error: auth.status === 404 ? "Project not found." : auth.error,
    };
  }

  const now = new Date();
  await db
    .update(dbSchema.projects)
    .set({
      archivedAt: now,
      visibility: "private",
      publishedAt: null,
      updatedAt: now,
    })
    .where(eq(dbSchema.projects.id, auth.project.id));

  await db
    .delete(dbSchema.publishedSnapshots)
    .where(eq(dbSchema.publishedSnapshots.projectId, auth.project.id));

  await revokeUserWorkspaceLeases({
    workspaceId: auth.workspace.id,
    projectIds: [auth.project.id],
  });

  return {
    ok: true,
    projectId: auth.project.id,
    archivedAtIso: now.toISOString(),
  };
}

export async function unarchiveProjectForUser(
  input: ArchiveProjectInput,
  actor: { id: string; role: UserRole },
): Promise<ArchiveProjectResult> {
  const parsed = archiveProjectInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: parsed.error.issues[0]?.message ?? "Invalid project ID.",
    };
  }

  const auth = await authorizeProjectAccess(parsed.data.projectId, actor.id, "unarchive");
  if (!auth.ok) {
    return {
      ok: false,
      code: auth.status === 404 ? "NOT_FOUND" : "FORBIDDEN",
      error: auth.status === 404 ? "Project not found." : auth.error,
    };
  }

  if (auth.project.archivedAt !== null) {
    const counts = await getWorkspaceProjectCounts(auth.workspace.id);
    if (counts.activeProjects >= auth.entitlement.quotas.activeProjectsLimit) {
      return {
        ok: false,
        code: "PLAN_LIMIT_REACHED",
        error: `Cannot unarchive: this workspace already has ${counts.activeProjects}/${auth.entitlement.quotas.activeProjectsLimit} active case studies.`,
      };
    }
  }

  const now = new Date();
  await db
    .update(dbSchema.projects)
    .set({
      archivedAt: null,
      updatedAt: now,
    })
    .where(eq(dbSchema.projects.id, auth.project.id));

  return {
    ok: true,
    projectId: auth.project.id,
    archivedAtIso: null,
  };
}

export async function deleteProjectForUser(
  input: DeleteProjectInput,
  actor: { id: string; role: UserRole },
): Promise<DeleteProjectResult> {
  const parsed = deleteProjectInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: parsed.error.issues[0]?.message ?? "Invalid delete confirmation.",
    };
  }

  const { projectId, confirmName } = parsed.data;
  const auth = await authorizeProjectAccess(projectId, actor.id, "delete");
  if (!auth.ok) {
    return {
      ok: false,
      code: auth.status === 404 ? "NOT_FOUND" : "FORBIDDEN",
      error: auth.status === 404 ? "Project not found." : auth.error,
    };
  }

  if (confirmName.trim().toLowerCase() !== auth.project.name.trim().toLowerCase()) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: `Type “${auth.project.name}” accurately to confirm permanent deletion.`,
    };
  }

  await db.delete(dbSchema.projects).where(eq(dbSchema.projects.id, projectId));

  return {
    ok: true,
    deletedProjectId: projectId,
  };
}
