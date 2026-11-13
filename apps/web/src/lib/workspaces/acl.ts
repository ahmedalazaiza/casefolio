import {
  and,
  desc,
  eq,
  isNull,
  normalizeMembershipRole,
  type CanonicalMembershipRole,
  type TemplateTier,
} from "@casefolio/db";
import { db, dbSchema } from "@/lib/db";
import {
  ensurePersonalWorkspaceForUser,
  ensureTeamWorkspaceForOrganization,
  resolveWorkspaceEntitlementState,
  type WorkspaceEntitlementState,
} from "@/lib/entitlements/server";

export type ProjectAccessAction =
  | "read"
  | "edit"
  | "upload_asset"
  | "publish"
  | "unpublish"
  | "archive"
  | "unarchive"
  | "delete"
  | "export_aesthetic"
  | "export_portability"
  | "copy_out";

export type SpaceAccessAction =
  | "read"
  | "create_project"
  | "transition_to_shared"
  | "transition_to_private"
  | "rename"
  | "delete";

export type AccessDeniedCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "WORKSPACE_FROZEN"
  | "PROJECT_ARCHIVED"
  | "PRO_TEMPLATE_READ_ONLY"
  | "FREE_TIER_EXTRA_PROJECT_LOCKED";

export interface AuthorizedSpaceContext {
  workspace: typeof dbSchema.workspaces.$inferSelect;
  space: typeof dbSchema.spaces.$inferSelect;
  entitlement: WorkspaceEntitlementState;
  membershipRole: CanonicalMembershipRole | null;
  isController: boolean;
}

export interface AuthorizedProjectContext extends AuthorizedSpaceContext {
  project: typeof dbSchema.projects.$inferSelect;
  templateTier: TemplateTier;
}

export type AuthorizeSpaceResult =
  | ({ ok: true } & AuthorizedSpaceContext)
  | {
      ok: false;
      status: 404 | 403;
      code: AccessDeniedCode;
      error: string;
    };

export type AuthorizeProjectResult =
  | ({ ok: true } & AuthorizedProjectContext)
  | {
      ok: false;
      status: 404 | 403;
      code: AccessDeniedCode;
      error: string;
    };

function notFoundSpace(): AuthorizeSpaceResult {
  return {
    ok: false,
    status: 404,
    code: "NOT_FOUND",
    error: "Resource not found.",
  };
}

function notFoundProject(): AuthorizeProjectResult {
  return {
    ok: false,
    status: 404,
    code: "NOT_FOUND",
    error: "Project not found.",
  };
}

/**
 * Ensures any legacy or direct-DB test project row has deterministic `workspaceId` and `spaceId`
 * populated (`Spec §13 Migration`). Personal projects (`orgId IS NULL`) ALWAYS bind to the owner's
 * personal private space and are never exposed to any team workspace.
 */
export async function ensureProjectWorkspaceAndSpace(
  projectRow: typeof dbSchema.projects.$inferSelect,
): Promise<{
  project: typeof dbSchema.projects.$inferSelect;
  workspace: typeof dbSchema.workspaces.$inferSelect;
  space: typeof dbSchema.spaces.$inferSelect;
}> {
  if (projectRow.workspaceId && projectRow.spaceId) {
    const [[workspace], [space]] = await Promise.all([
      db
        .select()
        .from(dbSchema.workspaces)
        .where(eq(dbSchema.workspaces.id, projectRow.workspaceId))
        .limit(1),
      db
        .select()
        .from(dbSchema.spaces)
        .where(eq(dbSchema.spaces.id, projectRow.spaceId))
        .limit(1),
    ]);

    if (workspace && space && space.workspaceId === workspace.id) {
      return { project: projectRow, workspace, space };
    }
  }

  let targetWorkspaceId: string;
  let targetSpaceId: string;

  if (projectRow.orgId) {
    const ensured = await ensureTeamWorkspaceForOrganization(projectRow.orgId, projectRow.ownerId);
    targetWorkspaceId = ensured.workspaceId;
    if (ensured.defaultSharedSpaceId) {
      targetSpaceId = ensured.defaultSharedSpaceId;
    } else {
      const [fallbackSpace] = await db
        .select({ id: dbSchema.spaces.id })
        .from(dbSchema.spaces)
        .where(eq(dbSchema.spaces.workspaceId, ensured.workspaceId))
        .limit(1);
      if (fallbackSpace) {
        targetSpaceId = fallbackSpace.id;
      } else {
        const [insertedSpace] = await db
          .insert(dbSchema.spaces)
          .values({
            workspaceId: ensured.workspaceId,
            name: "Shared Team Space",
            slug: "shared-studio",
            visibility: "shared",
            isDefault: true,
            controllerUserId: projectRow.ownerId,
          })
          .returning({ id: dbSchema.spaces.id });
        targetSpaceId = insertedSpace!.id;
      }
    }
  } else {
    const ensured = await ensurePersonalWorkspaceForUser(projectRow.ownerId);
    targetWorkspaceId = ensured.workspaceId;
    targetSpaceId = ensured.defaultSpaceId;
  }

  const createdByUserId = projectRow.createdByUserId ?? projectRow.ownerId;
  const [updatedProject] = await db
    .update(dbSchema.projects)
    .set({
      workspaceId: targetWorkspaceId,
      spaceId: targetSpaceId,
      createdByUserId,
    })
    .where(eq(dbSchema.projects.id, projectRow.id))
    .returning();

  const [[workspace], [space]] = await Promise.all([
    db
      .select()
      .from(dbSchema.workspaces)
      .where(eq(dbSchema.workspaces.id, targetWorkspaceId))
      .limit(1),
    db
      .select()
      .from(dbSchema.spaces)
      .where(eq(dbSchema.spaces.id, targetSpaceId))
      .limit(1),
  ]);

  return {
    project: updatedProject ?? {
      ...projectRow,
      workspaceId: targetWorkspaceId,
      spaceId: targetSpaceId,
      createdByUserId,
    },
    workspace: workspace!,
    space: space!,
  };
}

/**
 * Enforces Workspace + Space ACL (`Spec §9, §10.1, §11`).
 *
 * Core Privacy Invariants:
 * - Unauthorized IDs (cross-tenant OR Team Owner/Admin probing another member's `private` space
 *   or a departed member's `frozen_member_departed` space) ALWAYS return `404 NOT_FOUND` — never `403`.
 * - `403 FORBIDDEN` is returned ONLY when `actorUserId` legitimately has read visibility to the
 *   space (e.g. a shared team space) and lacks role permission or workspace active state.
 */
export async function authorizeSpaceAccess(
  spaceId: string,
  actorUserId: string,
  action: SpaceAccessAction,
  now: Date = new Date(),
): Promise<AuthorizeSpaceResult> {
  const [space] = await db
    .select()
    .from(dbSchema.spaces)
    .where(eq(dbSchema.spaces.id, spaceId))
    .limit(1);

  if (!space) {
    return notFoundSpace();
  }

  const [workspace] = await db
    .select()
    .from(dbSchema.workspaces)
    .where(eq(dbSchema.workspaces.id, space.workspaceId))
    .limit(1);

  if (!workspace) {
    return notFoundSpace();
  }

  const isController = space.controllerUserId === actorUserId;

  // 1. Departed member recovery space: strictly invisible (`404`) to everyone except `controllerUserId`
  if (space.recoveryState === "frozen_member_departed") {
    if (!isController) {
      return notFoundSpace();
    }

    const entitlement = await resolveWorkspaceEntitlementState(workspace.id, now);
    if (!entitlement) {
      return notFoundSpace();
    }

    if (action === "read") {
      return {
        ok: true,
        workspace,
        space,
        entitlement,
        membershipRole: null,
        isController: true,
      };
    }

    return {
      ok: false,
      status: 403,
      code: "WORKSPACE_FROZEN",
      error:
        "This space is in read-only recovery mode after leaving the team. Copy case studies to your personal workspace or export portability JSON.",
    };
  }

  // 2. Personal workspace: strictly visible only to `personalOwnerId`
  if (workspace.kind === "personal") {
    if (workspace.personalOwnerId !== actorUserId || !isController) {
      return notFoundSpace();
    }

    const entitlement = await resolveWorkspaceEntitlementState(workspace.id, now);
    if (!entitlement) {
      return notFoundSpace();
    }

    if (action === "read") {
      return {
        ok: true,
        workspace,
        space,
        entitlement,
        membershipRole: null,
        isController: true,
      };
    }

    if (action === "transition_to_shared") {
      return {
        ok: false,
        status: 403,
        code: "FORBIDDEN",
        error: "Shared spaces are only available inside a Casefolio Teams workspace.",
      };
    }

    if (action === "delete" && space.isDefault) {
      return {
        ok: false,
        status: 403,
        code: "FORBIDDEN",
        error: "Your default personal space cannot be deleted.",
      };
    }

    if (
      (entitlement.isFrozen || space.recoveryState !== "active") &&
      (action === "create_project" || action === "rename" || action === "delete")
    ) {
      return {
        ok: false,
        status: 403,
        code: "WORKSPACE_FROZEN",
        error: "This workspace is currently read-only due to billing status.",
      };
    }

    return {
      ok: true,
      workspace,
      space,
      entitlement,
      membershipRole: null,
      isController: true,
    };
  }

  // 3. Team workspace: requires active membership in `workspace.organizationId`
  if (!workspace.organizationId) {
    return notFoundSpace();
  }

  const [membership] = await db
    .select()
    .from(dbSchema.memberships)
    .where(
      and(
        eq(dbSchema.memberships.orgId, workspace.organizationId),
        eq(dbSchema.memberships.userId, actorUserId),
      ),
    )
    .limit(1);

  if (!membership) {
    return notFoundSpace();
  }

  const membershipRole = normalizeMembershipRole(membership.role);

  // Core privacy rule (`Spec §9 line 330`): Owner/Admin CANNOT see another member's private space -> `404`
  if (space.visibility === "private" && !isController) {
    return notFoundSpace();
  }

  const entitlement = await resolveWorkspaceEntitlementState(workspace.id, now);
  if (!entitlement) {
    return notFoundSpace();
  }

  if (action === "read") {
    return {
      ok: true,
      workspace,
      space,
      entitlement,
      membershipRole,
      isController,
    };
  }

  if (entitlement.isFrozen || space.recoveryState !== "active") {
    return {
      ok: false,
      status: 403,
      code: "WORKSPACE_FROZEN",
      error: "This team workspace is currently read-only due to subscription status.",
    };
  }

  if (space.visibility === "private") {
    if (action === "delete" && space.isDefault) {
      return {
        ok: false,
        status: 403,
        code: "FORBIDDEN",
        error: "Your default private space cannot be deleted.",
      };
    }

    return {
      ok: true,
      workspace,
      space,
      entitlement,
      membershipRole,
      isController: true,
    };
  }

  // Shared space permission checks (`Spec §9`)
  if (action === "transition_to_private") {
    if (space.isDefault) {
      return {
        ok: false,
        status: 403,
        code: "FORBIDDEN",
        error: "The default shared team space cannot be converted to a private space.",
      };
    }
    if (!isController) {
      return {
        ok: false,
        status: 403,
        code: "FORBIDDEN",
        error: "Only the space controller can convert this shared space to private.",
      };
    }
  }

  if (action === "delete") {
    if (space.isDefault) {
      return {
        ok: false,
        status: 403,
        code: "FORBIDDEN",
        error: "The default shared team space cannot be deleted.",
      };
    }
    if (membershipRole !== "owner") {
      return {
        ok: false,
        status: 403,
        code: "FORBIDDEN",
        error: "Only the workspace Owner can permanently delete shared spaces.",
      };
    }
  }

  if (action === "rename" && membershipRole === "member" && !isController) {
    return {
      ok: false,
      status: 403,
      code: "FORBIDDEN",
      error: "Only Owners, Admins, or the space controller can rename a shared space.",
    };
  }

  return {
    ok: true,
    workspace,
    space,
    entitlement,
    membershipRole,
    isController,
  };
}

/**
 * Enforces Project-level ACL across personal, private-team, shared-team, and recovery spaces (`Spec §9-11`).
 */
export async function authorizeProjectAccess(
  projectId: string,
  actorUserId: string,
  action: ProjectAccessAction,
  now: Date = new Date(),
): Promise<AuthorizeProjectResult> {
  const [rawProject] = await db
    .select()
    .from(dbSchema.projects)
    .where(eq(dbSchema.projects.id, projectId))
    .limit(1);

  if (!rawProject) {
    return notFoundProject();
  }

  const ensured = await ensureProjectWorkspaceAndSpace(rawProject);
  const project = ensured.project;

  // Step 1: Verify read visibility on the space. Any unauthorized caller receives `404 NOT_FOUND`.
  const spaceAuth = await authorizeSpaceAccess(ensured.space.id, actorUserId, "read", now);
  if (!spaceAuth.ok) {
    return notFoundProject();
  }

  const [tplRow] = await db
    .select({ tier: dbSchema.templates.tier })
    .from(dbSchema.templateVersions)
    .innerJoin(
      dbSchema.templates,
      eq(dbSchema.templateVersions.templateId, dbSchema.templates.id),
    )
    .where(eq(dbSchema.templateVersions.id, project.templateVersionId))
    .limit(1);

  const templateTier: TemplateTier = tplRow?.tier ?? "free";

  const baseCtx: AuthorizedProjectContext = {
    workspace: spaceAuth.workspace,
    space: spaceAuth.space,
    entitlement: spaceAuth.entitlement,
    membershipRole: spaceAuth.membershipRole,
    isController: spaceAuth.isController,
    project,
    templateTier,
  };

  if (action === "read" || action === "export_portability") {
    return { ok: true, ...baseCtx };
  }

  // Copy across workspaces (`Spec §10.6`): private controller OR Workspace Owner for shared content
  if (action === "copy_out") {
    if (
      spaceAuth.workspace.kind === "team" &&
      spaceAuth.space.visibility === "shared" &&
      spaceAuth.membershipRole !== "owner"
    ) {
      return {
        ok: false,
        status: 403,
        code: "FORBIDDEN",
        error: "Only the workspace Owner can copy shared team projects to another workspace.",
      };
    }
    return { ok: true, ...baseCtx };
  }

  // Departed recovery spaces are strictly read-only except portability export / copy_out / personal erasure
  if (spaceAuth.space.recoveryState === "frozen_member_departed") {
    if (action === "delete" && spaceAuth.isController) {
      return { ok: true, ...baseCtx };
    }
    return {
      ok: false,
      status: 403,
      code: "WORKSPACE_FROZEN",
      error:
        "Recovery projects are read-only. Copy this project to your personal workspace to continue editing.",
    };
  }

  // Archived projects (`Spec §5.1`): offline & read-only until unarchived
  if (
    project.archivedAt !== null &&
    (action === "edit" ||
      action === "upload_asset" ||
      action === "publish" ||
      action === "export_aesthetic")
  ) {
    return {
      ok: false,
      status: 403,
      code: "PROJECT_ARCHIVED",
      error: "Archived case studies are read-only. Unarchive this project to edit, publish, or export.",
    };
  }

  // Workspace freeze (`past_due > 7d`, canceled team subscription, or frozen workspace)
  if (
    (spaceAuth.entitlement.isFrozen || spaceAuth.space.recoveryState !== "active") &&
    (action === "edit" ||
      action === "upload_asset" ||
      action === "publish" ||
      action === "unarchive" ||
      action === "export_aesthetic")
  ) {
    return {
      ok: false,
      status: 403,
      code: "WORKSPACE_FROZEN",
      error: "This workspace is currently read-only due to billing status.",
    };
  }

  // Edge Case 3 (Downgrade Protection — Free Tier):
  // When a personal workspace on Free has >1 non-archived Case Studies, only the 1 selected
  // active Case Study stays editable/publishable; extra Case Studies are locked without deletion.
  if (
    spaceAuth.workspace.kind === "personal" &&
    spaceAuth.entitlement.plan === "free" &&
    (action === "edit" || action === "upload_asset" || action === "publish")
  ) {
    const nonArchivedProjects = await db
      .select({
        id: dbSchema.projects.id,
        visibility: dbSchema.projects.visibility,
      })
      .from(dbSchema.projects)
      .where(
        and(
          eq(dbSchema.projects.workspaceId, spaceAuth.workspace.id),
          isNull(dbSchema.projects.archivedAt),
        ),
      )
      .orderBy(desc(dbSchema.projects.updatedAt), desc(dbSchema.projects.createdAt));

    if (nonArchivedProjects.length > 1) {
      const keepId = spaceAuth.workspace.keepPublicProjectId;
      const activeProjectId =
        keepId && nonArchivedProjects.some((p) => p.id === keepId)
          ? keepId
          : (nonArchivedProjects.find((p) => p.visibility !== "private")?.id ??
              nonArchivedProjects[0]!.id);

      if (project.id !== activeProjectId) {
        return {
          ok: false,
          status: 403,
          code: "FREE_TIER_EXTRA_PROJECT_LOCKED",
          error:
            "Free accounts allow 1 active Case Study. Select this Case Study as your active project in Billing settings or upgrade to Pro to unlock all Case Studies.",
        };
      }
    }
  }

  // Team shared-space role checks (`Spec §9`)
  if (spaceAuth.workspace.kind === "team" && spaceAuth.space.visibility === "shared") {
    const role = spaceAuth.membershipRole;

    if (action === "publish" || action === "unpublish") {
      if (role !== "owner" && role !== "admin") {
        return {
          ok: false,
          status: 403,
          code: "FORBIDDEN",
          error: "Only workspace Owners and Admins can publish or unpublish shared case studies.",
        };
      }
    }

    if (action === "archive" || action === "unarchive") {
      const creatorId = project.createdByUserId ?? project.ownerId;
      if (role === "member" && creatorId !== actorUserId) {
        return {
          ok: false,
          status: 403,
          code: "FORBIDDEN",
          error: "Members can archive or restore only shared case studies they created.",
        };
      }
    }

    if (action === "delete") {
      if (role !== "owner") {
        return {
          ok: false,
          status: 403,
          code: "FORBIDDEN",
          error: "Only the workspace Owner can permanently delete shared case studies.",
        };
      }
    }
  }

  return { ok: true, ...baseCtx };
}

