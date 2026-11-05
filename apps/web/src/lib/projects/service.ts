import { and, count, eq, type PlanTier, type UserRole } from "@casefolio/db";
import { trackServerProductEvent } from "@/lib/analytics/posthog";
import { db, dbSchema } from "@/lib/db";
import { can, evaluateEntitlement } from "@/lib/entitlements";
import {
  buildInitialProjectPuckData,
  createProjectInputSchema,
  saveProjectEditorInputSchema,
  type CreateProjectInput,
  type CreateProjectResult,
  type ProjectEditorPayload,
  type SaveProjectEditorInput,
  type SaveProjectEditorResult,
} from "@/lib/projects/types";
import {
  puckDocumentSchema,
  templateThemeSchema,
  validateTemplateDocument,
} from "@/lib/template/schema";

export interface CreateProjectServiceArgs {
  userId: string;
  userPlan: PlanTier;
  orgId?: string | null;
  input: CreateProjectInput;
}

export async function createProjectFromTemplate({
  userId,
  userPlan,
  orgId = null,
  input,
}: CreateProjectServiceArgs): Promise<CreateProjectResult> {
  const parsed = createProjectInputSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] ? String(issue.path[0]) : "root";
      if (!fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: parsed.error.issues[0]?.message ?? "Please review the project details.",
      fieldErrors,
    };
  }

  const valid = parsed.data;

  if (!can(userPlan, "create_project", { projectsCount: 0 })) {
    const decision = evaluateEntitlement(userPlan, "create_project", { projectsCount: 0 });
    return {
      ok: false,
      code: "PLAN_LIMIT_REACHED",
      error: decision.message,
    };
  }

  if (userPlan === "free") {
    const [existingCount] = await db
      .select({ total: count() })
      .from(dbSchema.projects)
      .where(eq(dbSchema.projects.ownerId, userId));

    const projectEntitlement = evaluateEntitlement(userPlan, "create_project", {
      projectsCount: existingCount?.total ?? 0,
    });
    if (!projectEntitlement.allowed) {
      return {
        ok: false,
        code: "PLAN_LIMIT_REACHED",
        error: projectEntitlement.message,
      };
    }
  }

  const [tplRow] = await db
    .select({
      template: dbSchema.templates,
      version: dbSchema.templateVersions,
    })
    .from(dbSchema.templates)
    .innerJoin(
      dbSchema.templateVersions,
      eq(dbSchema.templates.currentVersionId, dbSchema.templateVersions.id),
    )
    .where(
      and(
        eq(dbSchema.templates.id, valid.templateId),
        eq(dbSchema.templates.status, "published"),
      ),
    )
    .limit(1);

  if (!tplRow) {
    return {
      ok: false,
      code: "TEMPLATE_NOT_FOUND",
      error: "Selected template is unavailable or has been unpublished.",
    };
  }

  if (tplRow.template.tier === "pro" && !can(userPlan, "pro_templates")) {
    const proDecision = evaluateEntitlement(userPlan, "pro_templates");
    return {
      ok: false,
      code: "PRO_TEMPLATE_LOCKED",
      error: proDecision.message,
    };
  }

  const docCheck = validateTemplateDocument(tplRow.version.data);
  if (!docCheck.ok) {
    return {
      ok: false,
      code: "TEMPLATE_NOT_FOUND",
      error: "Template version data could not be loaded.",
    };
  }

  const initialPuckData = buildInitialProjectPuckData(docCheck.data.puck, valid);
  const initialTheme = structuredClone(docCheck.data.template.theme);
  const now = new Date();

  const [created] = await db
    .insert(dbSchema.projects)
    .values({
      ownerId: userId,
      orgId: orgId ?? null,
      templateVersionId: tplRow.version.id,
      name: valid.name,
      type: valid.type,
      puckData: initialPuckData as unknown as Record<string, unknown>,
      theme: initialTheme as unknown as Record<string, unknown>,
      visibility: "private",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!created) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: "Failed to create project record.",
    };
  }

  await trackServerProductEvent({
    event: "project_created",
    distinctId: userId,
    properties: {
      projectId: created.id,
      projectType: valid.type,
      templateSlug: tplRow.template.slug,
      templateTier: tplRow.template.tier,
      hasOrg: Boolean(orgId),
    },
  });

  return {
    ok: true,
    projectId: created.id,
    templateVersionId: tplRow.version.id,
  };
}

export type ProjectEditorAccessResult =
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "ok"; payload: ProjectEditorPayload };

export async function getProjectEditorAccess(
  projectId: string,
  user: { id: string; role: UserRole },
): Promise<ProjectEditorAccessResult> {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(projectId)) {
    return { status: "not_found" };
  }

  const [row] = await db
    .select({
      project: dbSchema.projects,
      version: dbSchema.templateVersions,
      template: dbSchema.templates,
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
    return { status: "not_found" };
  }

  const isPlatformAdmin = user.role === "admin" || user.role === "superadmin";
  let canEdit = row.project.ownerId === user.id || isPlatformAdmin;

  if (!canEdit && row.project.orgId) {
    const [membership] = await db
      .select({ role: dbSchema.memberships.role })
      .from(dbSchema.memberships)
      .where(
        and(
          eq(dbSchema.memberships.orgId, row.project.orgId),
          eq(dbSchema.memberships.userId, user.id),
        ),
      )
      .limit(1);

    if (membership && (membership.role === "owner" || membership.role === "editor")) {
      canEdit = true;
    }
  }

  if (!canEdit) {
    return { status: "forbidden" };
  }

  const tplDocCheck = validateTemplateDocument(row.version.data);
  if (!tplDocCheck.ok) {
    return { status: "not_found" };
  }

  const tplDoc = tplDocCheck.data;
  const puckCheck = puckDocumentSchema.safeParse(row.project.puckData);
  const themeCheck = templateThemeSchema.safeParse(row.project.theme);

  const resolvedPuck = puckCheck.success ? puckCheck.data : structuredClone(tplDoc.puck);
  const resolvedTheme = themeCheck.success
    ? themeCheck.data
    : structuredClone(tplDoc.template.theme);

  return {
    status: "ok",
    payload: {
      project: {
        id: row.project.id,
        name: row.project.name,
        type: row.project.type,
        puckData: resolvedPuck,
        theme: resolvedTheme,
        visibility: row.project.visibility,
        slug: row.project.slug,
        updatedAtIso: row.project.updatedAt.toISOString(),
      },
      template: {
        id: row.template.id,
        name: row.template.name,
        slug: row.template.slug,
        version: row.version.version,
        slots: tplDoc.template.slots,
        defaultTheme: tplDoc.template.theme,
        defaultPuck: tplDoc.puck,
      },
    },
  };
}

async function canUserEditProjectRow(
  project: { ownerId: string; orgId: string | null },
  user: { id: string; role: UserRole },
): Promise<boolean> {
  if (project.ownerId === user.id || user.role === "admin" || user.role === "superadmin") {
    return true;
  }

  if (project.orgId) {
    const [membership] = await db
      .select({ role: dbSchema.memberships.role })
      .from(dbSchema.memberships)
      .where(
        and(
          eq(dbSchema.memberships.orgId, project.orgId),
          eq(dbSchema.memberships.userId, user.id),
        ),
      )
      .limit(1);

    if (membership && (membership.role === "owner" || membership.role === "editor")) {
      return true;
    }
  }

  return false;
}

export async function saveProjectEditorState(
  input: SaveProjectEditorInput,
  user: { id: string; role: UserRole },
): Promise<SaveProjectEditorResult> {
  const parsed = saveProjectEditorInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: parsed.error.issues[0]?.message ?? "Invalid project data.",
    };
  }

  const valid = parsed.data;
  const expectedMs = new Date(valid.expectedUpdatedAtIso).getTime();

  const [existing] = await db
    .select()
    .from(dbSchema.projects)
    .where(eq(dbSchema.projects.id, valid.projectId))
    .limit(1);

  if (!existing) {
    return {
      ok: false,
      code: "NOT_FOUND",
      error: "Project not found.",
    };
  }

  const allowed = await canUserEditProjectRow(existing, user);
  if (!allowed) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "You do not have permission to edit this project.",
    };
  }

  if (existing.updatedAt.getTime() !== expectedMs) {
    return {
      ok: false,
      code: "CONFLICT",
      error: "This project was updated in another tab or session.",
      serverUpdatedAtIso: existing.updatedAt.toISOString(),
    };
  }

  const nextMs = Math.max(Date.now(), existing.updatedAt.getTime() + 1);
  const nextUpdatedAt = new Date(nextMs);
  const nextTitle = valid.puckData.root.props.title.trim() || existing.name;

  const [updated] = await db
    .update(dbSchema.projects)
    .set({
      name: nextTitle,
      puckData: valid.puckData as unknown as Record<string, unknown>,
      theme: valid.theme as unknown as Record<string, unknown>,
      updatedAt: nextUpdatedAt,
    })
    .where(
      and(
        eq(dbSchema.projects.id, valid.projectId),
        eq(dbSchema.projects.updatedAt, existing.updatedAt),
      ),
    )
    .returning({ updatedAt: dbSchema.projects.updatedAt });

  if (!updated) {
    const [latest] = await db
      .select({ updatedAt: dbSchema.projects.updatedAt })
      .from(dbSchema.projects)
      .where(eq(dbSchema.projects.id, valid.projectId))
      .limit(1);

    return {
      ok: false,
      code: "CONFLICT",
      error: "This project was updated in another tab or session.",
      serverUpdatedAtIso: latest?.updatedAt.toISOString(),
    };
  }

  return {
    ok: true,
    updatedAtIso: updated.updatedAt.toISOString(),
  };
}
