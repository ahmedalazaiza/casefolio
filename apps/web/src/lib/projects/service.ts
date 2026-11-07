import { and, eq, type PlanTier, type UserRole } from "@casefolio/db";
import { trackServerProductEvent } from "@/lib/analytics/posthog";
import { evaluateQuotaUsage, getWorkspaceQuotas } from "@/lib/billing/plans";
import { db, dbSchema } from "@/lib/db";
import { can, evaluateEntitlement } from "@/lib/entitlements";
import {
  ensurePersonalWorkspaceForUser,
  ensureTeamWorkspaceForOrganization,
  resolveWorkspaceEntitlementState,
} from "@/lib/entitlements/server";
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
import { authorizeProjectAccess, authorizeSpaceAccess } from "@/lib/workspaces/acl";
import { acquireOrRefreshEditLease, inspectProjectEditLease } from "@/lib/workspaces/leases";
import {
  getWorkspaceProjectCounts,
  getWorkspaceStorageUsageBytes,
} from "@/lib/workspaces/service";

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

  let targetWorkspaceId: string;
  let targetSpaceId: string;
  let targetOrgId: string | null;
  let effectivePlan: PlanTier;
  let maxActiveProjects: number;
  let maxRetainedProjects: number;

  if (valid.spaceId) {
    const spaceAuth = await authorizeSpaceAccess(valid.spaceId, userId, "create_project");
    if (!spaceAuth.ok) {
      return {
        ok: false,
        code: spaceAuth.status === 404 ? "NOT_FOUND" : "FORBIDDEN",
        error: spaceAuth.error,
      };
    }
    targetWorkspaceId = spaceAuth.workspace.id;
    targetSpaceId = spaceAuth.space.id;
    targetOrgId = spaceAuth.workspace.organizationId;
    effectivePlan = spaceAuth.entitlement.plan;
    maxActiveProjects = spaceAuth.entitlement.quotas.activeProjectsLimit;
    maxRetainedProjects = spaceAuth.entitlement.quotas.retainedProjectsLimit;
  } else if (orgId) {
    const [membership] = await db
      .select({ id: dbSchema.memberships.id })
      .from(dbSchema.memberships)
      .where(
        and(
          eq(dbSchema.memberships.orgId, orgId),
          eq(dbSchema.memberships.userId, userId),
        ),
      )
      .limit(1);

    if (!membership) {
      return {
        ok: false,
        code: "NOT_FOUND",
        error: "Team workspace not found.",
      };
    }

    const ensured = await ensureTeamWorkspaceForOrganization(orgId, userId);
    const selectedSpaceId = ensured.memberPrivateSpaceId ?? ensured.defaultSharedSpaceId;
    if (!selectedSpaceId) {
      return {
        ok: false,
        code: "NOT_FOUND",
        error: "Workspace space not found.",
      };
    }

    const spaceAuth = await authorizeSpaceAccess(selectedSpaceId, userId, "create_project");
    if (!spaceAuth.ok) {
      return {
        ok: false,
        code: spaceAuth.status === 404 ? "NOT_FOUND" : "FORBIDDEN",
        error: spaceAuth.error,
      };
    }

    targetWorkspaceId = ensured.workspaceId;
    targetSpaceId = selectedSpaceId;
    targetOrgId = orgId;
    effectivePlan = spaceAuth.entitlement.plan;
    maxActiveProjects = spaceAuth.entitlement.quotas.activeProjectsLimit;
    maxRetainedProjects = spaceAuth.entitlement.quotas.retainedProjectsLimit;
  } else {
    const personal = await ensurePersonalWorkspaceForUser(userId);
    const ent = await resolveWorkspaceEntitlementState(personal.workspaceId);
    if (ent?.isFrozen) {
      return {
        ok: false,
        code: "FORBIDDEN",
        error: "This workspace is currently read-only due to billing status.",
      };
    }

    targetWorkspaceId = personal.workspaceId;
    targetSpaceId = personal.defaultSpaceId;
    targetOrgId = null;
    effectivePlan =
      ent && ent.plan !== "free" ? ent.plan : userPlan === "pro" ? "pro" : "free";
    const personalQuotas = getWorkspaceQuotas(effectivePlan, 1);
    maxActiveProjects = personalQuotas.activeProjectsLimit;
    maxRetainedProjects = personalQuotas.retainedProjectsLimit;
  }

  const counts = await getWorkspaceProjectCounts(targetWorkspaceId);
  if (counts.activeProjects >= maxActiveProjects) {
    const decision = evaluateEntitlement(effectivePlan, "create_project", {
      projectsCount: counts.activeProjects,
      paidSeats: targetOrgId ? Math.max(1, Math.round(maxActiveProjects / 20)) : 1,
    });
    return {
      ok: false,
      code: "PLAN_LIMIT_REACHED",
      error:
        decision.allowed === false
          ? decision.message
          : `You have reached the limit of ${maxActiveProjects} active case studies in this workspace.`,
    };
  }

  if (counts.retainedProjects >= maxRetainedProjects) {
    return {
      ok: false,
      code: "PLAN_LIMIT_REACHED",
      error: `This workspace has reached its limit of ${maxRetainedProjects} total retained projects (including archives).`,
    };
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

  if (tplRow.template.tier === "pro" && !can(effectivePlan, "pro_templates")) {
    const proDecision = evaluateEntitlement(effectivePlan, "pro_templates");
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
      orgId: targetOrgId,
      workspaceId: targetWorkspaceId,
      spaceId: targetSpaceId,
      createdByUserId: userId,
      templateVersionId: tplRow.version.id,
      name: valid.name,
      type: valid.type,
      puckData: initialPuckData as unknown as Record<string, unknown>,
      theme: initialTheme as unknown as Record<string, unknown>,
      revision: 1,
      visibility: "private",
      brandingRemoved: false,
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
      hasOrg: Boolean(targetOrgId),
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

  // Verify read visibility first (`404` for cross-tenant OR Owner/Admin probing teammate's private project!)
  const readAuth = await authorizeProjectAccess(projectId, user.id, "read");
  if (!readAuth.ok) {
    return { status: "not_found" };
  }

  const [row] = await db
    .select({
      version: dbSchema.templateVersions,
      template: dbSchema.templates,
    })
    .from(dbSchema.templateVersions)
    .innerJoin(dbSchema.templates, eq(dbSchema.templateVersions.templateId, dbSchema.templates.id))
    .where(eq(dbSchema.templateVersions.id, readAuth.project.templateVersionId))
    .limit(1);

  if (!row) {
    return { status: "not_found" };
  }

  const tplDocCheck = validateTemplateDocument(row.version.data);
  if (!tplDocCheck.ok) {
    return { status: "not_found" };
  }

  const editAuth = await authorizeProjectAccess(projectId, user.id, "edit");
  let leaseState = await inspectProjectEditLease(projectId, user.id);

  // If editable and in a shared space, proactively acquire/refresh caller's 120s lease if free
  if (editAuth.ok && readAuth.space.visibility === "shared") {
    const acquired = await acquireOrRefreshEditLease({
      projectId,
      actorUserId: user.id,
    });
    if (acquired.ok) {
      leaseState = acquired.lease;
    } else if (acquired.lease) {
      leaseState = acquired.lease;
    }
  }

  const isReadOnly =
    !editAuth.ok || Boolean(leaseState && !leaseState.isHeldByCurrentUser);
  const readOnlyReason = !editAuth.ok
    ? editAuth.error
    : leaseState && !leaseState.isHeldByCurrentUser
      ? `${leaseState.holderName || "Another teammate"} is currently editing this case study.`
      : null;

  const tplDoc = tplDocCheck.data;
  const puckCheck = puckDocumentSchema.safeParse(readAuth.project.puckData);
  const themeCheck = templateThemeSchema.safeParse(readAuth.project.theme);

  const resolvedPuck = puckCheck.success ? puckCheck.data : structuredClone(tplDoc.puck);
  const resolvedTheme = themeCheck.success
    ? themeCheck.data
    : structuredClone(tplDoc.template.theme);

  return {
    status: "ok",
    payload: {
      project: {
        id: readAuth.project.id,
        name: readAuth.project.name,
        type: readAuth.project.type,
        puckData: resolvedPuck,
        theme: resolvedTheme,
        visibility: readAuth.project.visibility,
        slug: readAuth.project.slug,
        revision: readAuth.project.revision,
        brandingRemoved: readAuth.project.brandingRemoved,
        archivedAtIso: readAuth.project.archivedAt
          ? readAuth.project.archivedAt.toISOString()
          : null,
        updatedAtIso: readAuth.project.updatedAt.toISOString(),
        workspaceId: readAuth.workspace.id,
        spaceId: readAuth.space.id,
        spaceVisibility: readAuth.space.visibility,
      },
      template: {
        id: row.template.id,
        name: row.template.name,
        slug: row.template.slug,
        version: row.version.version,
        slots: tplDoc.template.slots,
        defaultTheme: tplDoc.template.theme,
        defaultPuck: tplDoc.puck,
        allowSectionMutations: tplDoc.template.canvas.allowSectionMutations,
      },
      lease: leaseState,
      isReadOnly,
      readOnlyReason,
    },
  };
}

/**
 * Saves editor changes with `expectedRevision` / `expectedUpdatedAtIso` compare-and-swap (`409 CONFLICT`),
 * single-writer 120s server lease enforcement (`LEASE_HELD`), and storage-capped recoverable content
 * history (`Spec §5.8 & §13`).
 */
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
  const now = new Date();

  const auth = await authorizeProjectAccess(valid.projectId, user.id, "edit", now);
  if (!auth.ok) {
    return {
      ok: false,
      code: auth.status === 404 ? "NOT_FOUND" : "FORBIDDEN",
      error: auth.status === 404 ? "Project not found." : auth.error,
    };
  }

  const existing = auth.project;

  // Enforce 120s single-writer server lease (`Spec §13`)
  const activeLease = await inspectProjectEditLease(existing.id, user.id, now);
  if (activeLease && !activeLease.isHeldByCurrentUser) {
    return {
      ok: false,
      code: "LEASE_HELD",
      error: `${activeLease.holderName || "Another teammate"} holds the active editing lease on this project.`,
      lease: activeLease,
    };
  }

  if (auth.space.visibility === "shared" || valid.leaseToken) {
    const leaseRes = await acquireOrRefreshEditLease({
      projectId: existing.id,
      actorUserId: user.id,
      leaseToken: valid.leaseToken,
      now,
    });
    if (!leaseRes.ok && leaseRes.code === "LEASE_HELD") {
      return {
        ok: false,
        code: "LEASE_HELD",
        error: leaseRes.error,
        lease: leaseRes.lease,
      };
    }
  }

  // Compare-and-swap on `expectedRevision` (if supplied) AND `expectedUpdatedAtIso` (if supplied)
  const expectedMs = valid.expectedUpdatedAtIso
    ? new Date(valid.expectedUpdatedAtIso).getTime()
    : null;
  if (
    (typeof valid.expectedRevision === "number" &&
      existing.revision !== valid.expectedRevision) ||
    (expectedMs !== null && existing.updatedAt.getTime() !== expectedMs)
  ) {
    return {
      ok: false,
      code: "CONFLICT",
      error: "This project was updated in another tab or session. Reload to get the latest version.",
      serverUpdatedAtIso: existing.updatedAt.toISOString(),
      serverRevision: existing.revision,
    };
  }

  // Enforce storage cap on recoverable content history WITHOUT silently deleting older versions (`Spec §5.8`)
  const serializedHistoryBytes = Buffer.byteLength(
    JSON.stringify({ puckData: valid.puckData, theme: valid.theme }),
    "utf8",
  );
  const currentStorageBytes = await getWorkspaceStorageUsageBytes(auth.workspace.id);
  const storageEval = evaluateQuotaUsage({
    used: currentStorageBytes,
    adding: serializedHistoryBytes,
    limit: auth.entitlement.quotas.storageBytesLimit,
    isPaid: auth.entitlement.plan !== "free",
    graceUsedAt: auth.entitlement.graceUsedAt,
    graceExpiresAt: auth.entitlement.graceExpiresAt,
    now,
  });

  if (!storageEval.allowed) {
    return {
      ok: false,
      code: "STORAGE_QUOTA_EXCEEDED",
      error:
        "Workspace storage quota is full, so a new recoverable version cannot be saved. Remove unused assets or upgrade your plan (existing history is preserved).",
    };
  }

  const nextMs = Math.max(now.getTime(), existing.updatedAt.getTime() + 1);
  const nextUpdatedAt = new Date(nextMs);
  const nextRevision = existing.revision + 1;
  const nextTitle = valid.puckData.root.props.title.trim() || existing.name;

  const [updated] = await db
    .update(dbSchema.projects)
    .set({
      name: nextTitle,
      puckData: valid.puckData as unknown as Record<string, unknown>,
      theme: valid.theme as unknown as Record<string, unknown>,
      revision: nextRevision,
      updatedAt: nextUpdatedAt,
    })
    .where(
      and(
        eq(dbSchema.projects.id, valid.projectId),
        eq(dbSchema.projects.revision, existing.revision),
        eq(dbSchema.projects.updatedAt, existing.updatedAt),
      ),
    )
    .returning({
      updatedAt: dbSchema.projects.updatedAt,
      revision: dbSchema.projects.revision,
    });

  if (!updated) {
    const [latest] = await db
      .select({
        updatedAt: dbSchema.projects.updatedAt,
        revision: dbSchema.projects.revision,
      })
      .from(dbSchema.projects)
      .where(eq(dbSchema.projects.id, valid.projectId))
      .limit(1);

    return {
      ok: false,
      code: "CONFLICT",
      error: "This project was updated in another tab or session. Reload to get the latest version.",
      serverUpdatedAtIso: latest?.updatedAt.toISOString(),
      serverRevision: latest?.revision,
    };
  }

  await db
    .insert(dbSchema.projectRevisions)
    .values({
      projectId: existing.id,
      workspaceId: auth.workspace.id,
      revision: updated.revision,
      puckData: valid.puckData as unknown as Record<string, unknown>,
      theme: valid.theme as unknown as Record<string, unknown>,
      bytes: serializedHistoryBytes,
      createdByUserId: user.id,
      createdAt: nextUpdatedAt,
    })
    .onConflictDoNothing({
      target: [dbSchema.projectRevisions.projectId, dbSchema.projectRevisions.revision],
    });

  return {
    ok: true,
    updatedAtIso: updated.updatedAt.toISOString(),
    revision: updated.revision,
  };
}
