import { and, count, desc, eq, or, type PlanTier, type UserRole } from "@casefolio/db";
import { trackServerProductEvent } from "@/lib/analytics/posthog";
import { db, dbSchema } from "@/lib/db";
import { can, evaluateEntitlement } from "@/lib/entitlements";
import {
  deleteProjectInputSchema,
  duplicateProjectInputSchema,
  renameProjectInputSchema,
  type DashboardProjectItem,
  type DeleteProjectInput,
  type DeleteProjectResult,
  type DuplicateProjectInput,
  type DuplicateProjectResult,
  type RenameProjectInput,
  type RenameProjectResult,
} from "./dashboard-types";

async function canActorEditProject(
  project: { ownerId: string; orgId: string | null },
  actor: { id: string; role: UserRole },
): Promise<boolean> {
  if (project.ownerId === actor.id || actor.role === "admin" || actor.role === "superadmin") {
    return true;
  }

  if (project.orgId) {
    const [membership] = await db
      .select({ role: dbSchema.memberships.role })
      .from(dbSchema.memberships)
      .where(
        and(
          eq(dbSchema.memberships.orgId, project.orgId),
          eq(dbSchema.memberships.userId, actor.id),
        ),
      )
      .limit(1);

    if (membership && (membership.role === "owner" || membership.role === "editor")) {
      return true;
    }
  }

  return false;
}

async function canActorDeleteProject(
  project: { ownerId: string; orgId: string | null },
  actor: { id: string; role: UserRole },
): Promise<boolean> {
  if (project.ownerId === actor.id || actor.role === "admin" || actor.role === "superadmin") {
    return true;
  }

  if (project.orgId) {
    const [membership] = await db
      .select({ role: dbSchema.memberships.role })
      .from(dbSchema.memberships)
      .where(
        and(
          eq(dbSchema.memberships.orgId, project.orgId),
          eq(dbSchema.memberships.userId, actor.id),
        ),
      )
      .limit(1);

    if (membership && membership.role === "owner") {
      return true;
    }
  }

  return false;
}

export async function listDashboardProjectsForUser(
  userId: string,
  activeOrgId: string | null = null,
): Promise<DashboardProjectItem[]> {
  let includeOrg = false;
  if (activeOrgId) {
    const [membership] = await db
      .select({ id: dbSchema.memberships.id })
      .from(dbSchema.memberships)
      .where(
        and(eq(dbSchema.memberships.orgId, activeOrgId), eq(dbSchema.memberships.userId, userId)),
      )
      .limit(1);
    includeOrg = Boolean(membership);
  }

  const filterExpr =
    includeOrg && activeOrgId
      ? or(eq(dbSchema.projects.ownerId, userId), eq(dbSchema.projects.orgId, activeOrgId))
      : eq(dbSchema.projects.ownerId, userId);

  const rows = await db
    .select({
      project: dbSchema.projects,
      templateName: dbSchema.templates.name,
      templateTier: dbSchema.templates.tier,
    })
    .from(dbSchema.projects)
    .innerJoin(
      dbSchema.templateVersions,
      eq(dbSchema.projects.templateVersionId, dbSchema.templateVersions.id),
    )
    .innerJoin(dbSchema.templates, eq(dbSchema.templateVersions.templateId, dbSchema.templates.id))
    .where(filterExpr)
    .orderBy(desc(dbSchema.projects.updatedAt));

  return rows.map((row) => ({
    id: row.project.id,
    name: row.project.name,
    type: row.project.type,
    visibility: row.project.visibility,
    slug: row.project.slug,
    publishedAtIso: row.project.publishedAt ? row.project.publishedAt.toISOString() : null,
    createdAtIso: row.project.createdAt.toISOString(),
    updatedAtIso: row.project.updatedAt.toISOString(),
    templateName: row.templateName,
    templateTier: row.templateTier,
  }));
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
  const [existing] = await db
    .select()
    .from(dbSchema.projects)
    .where(eq(dbSchema.projects.id, projectId))
    .limit(1);

  if (!existing) {
    return { ok: false, code: "NOT_FOUND", error: "Project not found." };
  }

  const allowed = await canActorEditProject(existing, actor);
  if (!allowed) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "You do not have permission to rename this project.",
    };
  }

  const clonedPuck = structuredClone(existing.puckData ?? {});
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
  const [row] = await db
    .select({
      project: dbSchema.projects,
      templateName: dbSchema.templates.name,
      templateTier: dbSchema.templates.tier,
    })
    .from(dbSchema.projects)
    .innerJoin(
      dbSchema.templateVersions,
      eq(dbSchema.projects.templateVersionId, dbSchema.templateVersions.id),
    )
    .innerJoin(dbSchema.templates, eq(dbSchema.templateVersions.templateId, dbSchema.templates.id))
    .where(eq(dbSchema.projects.id, projectId))
    .limit(1);

  if (!row) {
    return { ok: false, code: "NOT_FOUND", error: "Project not found." };
  }

  const allowed = await canActorEditProject(row.project, actor);
  if (!allowed) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "You do not have permission to duplicate this project.",
    };
  }

  // Enforce canonical project quota via `can(userPlan, "create_project")`
  const [existingCount] = await db
    .select({ total: count() })
    .from(dbSchema.projects)
    .where(eq(dbSchema.projects.ownerId, actor.id));

  const currentTotal = Number(existingCount?.total ?? 0);
  if (!can(userPlan, "create_project", { projectsCount: currentTotal })) {
    const decision = evaluateEntitlement(userPlan, "create_project", {
      projectsCount: currentTotal,
    });
    return {
      ok: false,
      code: "PLAN_LIMIT_REACHED",
      error: decision.message,
    };
  }

  const copyName = `${row.project.name} (Copy)`.slice(0, 120);
  const clonedPuck = structuredClone(row.project.puckData ?? {});
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
      orgId: row.project.orgId,
      templateVersionId: row.project.templateVersionId,
      name: copyName,
      type: row.project.type,
      puckData: clonedPuck,
      theme: structuredClone(row.project.theme ?? {}),
      visibility: "private",
      slug: null,
      publishedAt: null,
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
      duplicatedFromProjectId: row.project.id,
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
      createdAtIso: created.createdAt.toISOString(),
      updatedAtIso: created.updatedAt.toISOString(),
      templateName: row.templateName,
      templateTier: row.templateTier,
    },
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
  const [existing] = await db
    .select()
    .from(dbSchema.projects)
    .where(eq(dbSchema.projects.id, projectId))
    .limit(1);

  if (!existing) {
    return { ok: false, code: "NOT_FOUND", error: "Project not found." };
  }

  const allowed = await canActorDeleteProject(existing, actor);
  if (!allowed) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "You do not have permission to delete this project.",
    };
  }

  if (confirmName.trim().toLowerCase() !== existing.name.trim().toLowerCase()) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: `Type “${existing.name}” accurately to confirm permanent deletion.`,
    };
  }

  await db.delete(dbSchema.projects).where(eq(dbSchema.projects.id, projectId));

  return {
    ok: true,
    deletedProjectId: projectId,
  };
}
