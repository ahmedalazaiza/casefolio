import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  normalizeMembershipRole,
  or,
  sql,
  type CanonicalMembershipRole,
  type PlanTier,
  type SpaceVisibility,
} from "@casefolio/db";
import {
  evaluateQuotaUsage,
  formatResetDateIstanbul,
  FREE_LIFETIME_PROJECT_LIMIT,
  type WorkspacePlanQuotas,
} from "@/lib/billing/plans";
import { db, dbSchema } from "@/lib/db";
import { evaluateEntitlement } from "@/lib/entitlements";
import {
  ensurePersonalWorkspaceForUser,
  ensureTeamWorkspaceForOrganization,
  resolveWorkspaceEntitlementState,
} from "@/lib/entitlements/server";
import { revalidatePublicProject } from "@/lib/projects/public-cache";
import {
  deleteStoredObject,
  readStoredObjectBytes,
  writeStoredObject,
} from "@/lib/storage/r2";
import { getWorkspaceMonthlyMeterUsage } from "@/lib/usage/meter";
import { authorizeProjectAccess, authorizeSpaceAccess } from "@/lib/workspaces/acl";
import { revokeUserWorkspaceLeases } from "@/lib/workspaces/leases";

export interface SpaceSummaryItem {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  visibility: SpaceVisibility;
  isDefault: boolean;
  controllerUserId: string;
  isMine: boolean;
  aclVersion: number;
}

export interface WorkspaceSwitcherOption {
  workspaceId: string;
  kind: "personal" | "team";
  name: string;
  slug: string;
  organizationId: string | null;
  role: CanonicalMembershipRole | "personal_owner";
  plan: PlanTier;
  paidSeats: number;
}

export interface WorkspaceUsageSnapshot {
  activeProjects: number;
  publishedProjects: number;
  retainedProjects: number;
  lifetimeProjectsCreated: number;
  storageBytes: number;
  monthlyExportsUsed: number;
  monthlyUploadsBytesUsed: number;
  monthlyBandwidthBytesUsed: number;
  resetDateIstanbul: string;
}

export interface WorkspaceSwitcherState {
  activeWorkspace: WorkspaceSwitcherOption & {
    isFrozen: boolean;
    frozenReason: string | null;
    quotas: WorkspacePlanQuotas;
    usage: WorkspaceUsageSnapshot;
  };
  workspaces: WorkspaceSwitcherOption[];
  spaces: SpaceSummaryItem[];
  recoverySpacesCount: number;
}

function slugifySpaceName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
  return base || "space";
}

function remapAssetUrlsInPuckData(
  value: unknown,
  assetIdMap: Map<string, string>,
): unknown {
  if (typeof value === "string") {
    let next = value;
    for (const [oldId, newId] of assetIdMap.entries()) {
      if (next.includes(oldId)) {
        next = next.split(`/cdn/images/${oldId}`).join(`/cdn/images/${newId}`);
        next = next.split(oldId).join(newId);
      }
    }
    return next;
  }

  if (Array.isArray(value)) {
    return value.map((item) => remapAssetUrlsInPuckData(item, assetIdMap));
  }

  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = remapAssetUrlsInPuckData(v, assetIdMap);
    }
    return out;
  }

  return value;
}

/**
 * Computes workspace storage bytes (`assets.bytes + project_revisions.bytes`, excluding temporary exports; `Spec §5.2`).
 */
export async function getWorkspaceStorageUsageBytes(workspaceId: string): Promise<number> {
  const [[assetSum], [revSum]] = await Promise.all([
    db
      .select({
        totalBytes: sql<number>`coalesce(sum(${dbSchema.assets.bytes}), 0)::bigint`,
      })
      .from(dbSchema.assets)
      .innerJoin(dbSchema.projects, eq(dbSchema.assets.projectId, dbSchema.projects.id))
      .innerJoin(dbSchema.spaces, eq(dbSchema.projects.spaceId, dbSchema.spaces.id))
      .where(
        and(
          eq(dbSchema.projects.workspaceId, workspaceId),
          eq(dbSchema.spaces.recoveryState, "active"),
        ),
      ),
    db
      .select({
        totalBytes: sql<number>`coalesce(sum(${dbSchema.projectRevisions.bytes}), 0)::bigint`,
      })
      .from(dbSchema.projectRevisions)
      .innerJoin(
        dbSchema.projects,
        eq(dbSchema.projectRevisions.projectId, dbSchema.projects.id),
      )
      .innerJoin(dbSchema.spaces, eq(dbSchema.projects.spaceId, dbSchema.spaces.id))
      .where(
        and(
          eq(dbSchema.projects.workspaceId, workspaceId),
          eq(dbSchema.spaces.recoveryState, "active"),
        ),
      ),
  ]);

  return Number(assetSum?.totalBytes ?? 0) + Number(revSum?.totalBytes ?? 0);
}

/**
 * Computes active, simultaneously published, total retained (including archived), and lifetime created
 * project counts in active spaces of `workspaceId` (`Spec §4 & §5.1`).
 */
export async function getWorkspaceProjectCounts(workspaceId: string): Promise<{
  activeProjects: number;
  publishedProjects: number;
  retainedProjects: number;
  lifetimeProjectsCreated: number;
}> {
  const [[wsRow], rows] = await Promise.all([
    db
      .select({ lifetimeProjectsCreated: dbSchema.workspaces.lifetimeProjectsCreated })
      .from(dbSchema.workspaces)
      .where(eq(dbSchema.workspaces.id, workspaceId))
      .limit(1),
    db
      .select({
        visibility: dbSchema.projects.visibility,
        archivedAt: dbSchema.projects.archivedAt,
      })
      .from(dbSchema.projects)
      .innerJoin(dbSchema.spaces, eq(dbSchema.projects.spaceId, dbSchema.spaces.id))
      .where(
        and(
          eq(dbSchema.projects.workspaceId, workspaceId),
          eq(dbSchema.spaces.recoveryState, "active"),
        ),
      ),
  ]);

  let activeProjects = 0;
  let publishedProjects = 0;

  for (const row of rows) {
    if (row.archivedAt === null) {
      activeProjects += 1;
      if (row.visibility === "public" || row.visibility === "unlisted") {
        publishedProjects += 1;
      }
    }
  }

  const retainedProjects = rows.length;
  const lifetimeProjectsCreated = Math.max(
    wsRow?.lifetimeProjectsCreated ?? 0,
    retainedProjects,
  );

  return {
    activeProjects,
    publishedProjects,
    retainedProjects,
    lifetimeProjectsCreated,
  };
}

/**
 * Lists ONLY the spaces inside `workspaceId` that `actorUserId` is permitted to see:
 * - Caller's own `private` spaces (`controllerUserId === actorUserId` & `recoveryState === "active"`)
 * - Active `shared` spaces (`visibility === "shared"` & `recoveryState === "active"`)
 * Never exposes teammates' `private` spaces or `frozen_member_departed` spaces (`Spec §9 & §10.1`).
 */
export async function listVisibleSpacesForWorkspace(
  workspaceId: string,
  actorUserId: string,
): Promise<SpaceSummaryItem[]> {
  const [ws] = await db
    .select()
    .from(dbSchema.workspaces)
    .where(eq(dbSchema.workspaces.id, workspaceId))
    .limit(1);

  if (!ws) {
    return [];
  }

  if (ws.kind === "personal") {
    if (ws.personalOwnerId !== actorUserId) {
      return [];
    }

    const rows = await db
      .select()
      .from(dbSchema.spaces)
      .where(
        and(
          eq(dbSchema.spaces.workspaceId, workspaceId),
          eq(dbSchema.spaces.controllerUserId, actorUserId),
          eq(dbSchema.spaces.recoveryState, "active"),
        ),
      )
      .orderBy(desc(dbSchema.spaces.isDefault), asc(dbSchema.spaces.createdAt));

    return rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspaceId,
      name: row.name,
      slug: row.slug,
      visibility: row.visibility,
      isDefault: row.isDefault,
      controllerUserId: row.controllerUserId,
      isMine: true,
      aclVersion: row.aclVersion,
    }));
  }

  if (!ws.organizationId) {
    return [];
  }

  const [membership] = await db
    .select({ id: dbSchema.memberships.id })
    .from(dbSchema.memberships)
    .where(
      and(
        eq(dbSchema.memberships.orgId, ws.organizationId),
        eq(dbSchema.memberships.userId, actorUserId),
      ),
    )
    .limit(1);

  if (!membership) {
    return [];
  }

  const rows = await db
    .select()
    .from(dbSchema.spaces)
    .where(
      and(
        eq(dbSchema.spaces.workspaceId, workspaceId),
        eq(dbSchema.spaces.recoveryState, "active"),
        or(
          eq(dbSchema.spaces.visibility, "shared"),
          and(
            eq(dbSchema.spaces.visibility, "private"),
            eq(dbSchema.spaces.controllerUserId, actorUserId),
          ),
        ),
      ),
    )
    .orderBy(
      asc(dbSchema.spaces.visibility),
      desc(dbSchema.spaces.isDefault),
      asc(dbSchema.spaces.createdAt),
    );

  return rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    slug: row.slug,
    visibility: row.visibility,
    isDefault: row.isDefault,
    controllerUserId: row.controllerUserId,
    isMine: row.controllerUserId === actorUserId,
    aclVersion: row.aclVersion,
  }));
}

export async function getWorkspaceUsageSnapshot(
  workspaceId: string,
  now: Date = new Date(),
): Promise<WorkspaceUsageSnapshot> {
  const [counts, storageBytes, exportsMeter, uploadsMeter, bandwidthMeter] = await Promise.all([
    getWorkspaceProjectCounts(workspaceId),
    getWorkspaceStorageUsageBytes(workspaceId),
    getWorkspaceMonthlyMeterUsage(workspaceId, "exports", now),
    getWorkspaceMonthlyMeterUsage(workspaceId, "uploads_bytes", now),
    getWorkspaceMonthlyMeterUsage(workspaceId, "bandwidth_bytes", now),
  ]);

  return {
    activeProjects: counts.activeProjects,
    publishedProjects: counts.publishedProjects,
    retainedProjects: counts.retainedProjects,
    lifetimeProjectsCreated: counts.lifetimeProjectsCreated,
    storageBytes,
    monthlyExportsUsed: exportsMeter.total,
    monthlyUploadsBytesUsed: uploadsMeter.total,
    monthlyBandwidthBytesUsed: bandwidthMeter.total,
    resetDateIstanbul: formatResetDateIstanbul(now),
  };
}

export async function listWorkspaceSwitcherState(
  userId: string,
  activeOrganizationId?: string | null,
  now: Date = new Date(),
): Promise<WorkspaceSwitcherState> {
  const personal = await ensurePersonalWorkspaceForUser(userId);
  const [personalWs] = await db
    .select()
    .from(dbSchema.workspaces)
    .where(eq(dbSchema.workspaces.id, personal.workspaceId))
    .limit(1);

  const personalEntitlement = (await resolveWorkspaceEntitlementState(personal.workspaceId, now))!;

  const options: WorkspaceSwitcherOption[] = [
    {
      workspaceId: personal.workspaceId,
      kind: "personal",
      name: personalWs?.name ?? "Personal Workspace",
      slug: personalWs?.slug ?? `personal-${userId}`,
      organizationId: null,
      role: "personal_owner",
      plan: personalEntitlement.plan,
      paidSeats: 1,
    },
  ];

  const memberOrgs = await db
    .select({
      organization: dbSchema.organizations,
      membership: dbSchema.memberships,
    })
    .from(dbSchema.memberships)
    .innerJoin(
      dbSchema.organizations,
      eq(dbSchema.memberships.orgId, dbSchema.organizations.id),
    )
    .where(eq(dbSchema.memberships.userId, userId))
    .orderBy(asc(dbSchema.organizations.createdAt));

  // Resolve every team workspace concurrently (was a sequential await-per-org loop on EVERY page load).
  const entitlementByWorkspaceId = new Map<
    string,
    NonNullable<Awaited<ReturnType<typeof resolveWorkspaceEntitlementState>>>
  >([[personal.workspaceId, personalEntitlement]]);

  const teamResolved = await Promise.all(
    memberOrgs.map(async (row) => {
      const teamEnsured = await ensureTeamWorkspaceForOrganization(row.organization.id, userId);
      const teamEnt = await resolveWorkspaceEntitlementState(teamEnsured.workspaceId, now);
      return teamEnt ? { row, teamEnsured, teamEnt } : null;
    }),
  );

  for (const resolved of teamResolved) {
    if (!resolved) continue;
    const { row, teamEnsured, teamEnt } = resolved;
    entitlementByWorkspaceId.set(teamEnsured.workspaceId, teamEnt);

    options.push({
      workspaceId: teamEnsured.workspaceId,
      kind: "team",
      name: row.organization.name,
      slug: row.organization.slug,
      organizationId: row.organization.id,
      role: normalizeMembershipRole(row.membership.role),
      plan: teamEnt.plan,
      paidSeats: teamEnt.paidSeats,
    });
  }

  const activeOpt =
    (activeOrganizationId
      ? options.find((opt) => opt.organizationId === activeOrganizationId)
      : undefined) ?? options[0]!;

  const activeEnt =
    entitlementByWorkspaceId.get(activeOpt.workspaceId) ??
    (await resolveWorkspaceEntitlementState(activeOpt.workspaceId, now))!;
  const [spaces, usage, [recoveryCountRow]] = await Promise.all([
    listVisibleSpacesForWorkspace(activeOpt.workspaceId, userId),
    getWorkspaceUsageSnapshot(activeOpt.workspaceId, now),
    db
      .select({ total: count() })
      .from(dbSchema.spaces)
      .where(
        and(
          eq(dbSchema.spaces.controllerUserId, userId),
          eq(dbSchema.spaces.recoveryState, "frozen_member_departed"),
          or(isNull(dbSchema.spaces.recoveryUntil), gt(dbSchema.spaces.recoveryUntil, now)),
        ),
      ),
  ]);

  return {
    activeWorkspace: {
      ...activeOpt,
      isFrozen: activeEnt.isFrozen,
      frozenReason: activeEnt.frozenReason,
      quotas: activeEnt.quotas,
      usage,
    },
    workspaces: options,
    spaces,
    recoverySpacesCount: Number(recoveryCountRow?.total ?? 0),
  };
}

export async function createSpaceForUser(args: {
  actorUserId: string;
  workspaceId: string;
  name: string;
  visibility: SpaceVisibility;
  now?: Date;
}): Promise<
  | { ok: true; space: SpaceSummaryItem }
  | { ok: false; status: 400 | 403 | 404; code: string; error: string }
> {
  const now = args.now ?? new Date();
  const cleanName = args.name.trim();
  if (cleanName.length < 2 || cleanName.length > 60) {
    return {
      ok: false,
      status: 400,
      code: "VALIDATION_ERROR",
      error: "Space name must be between 2 and 60 characters.",
    };
  }

  const [ws] = await db
    .select()
    .from(dbSchema.workspaces)
    .where(eq(dbSchema.workspaces.id, args.workspaceId))
    .limit(1);

  if (!ws) {
    return { ok: false, status: 404, code: "NOT_FOUND", error: "Workspace not found." };
  }

  if (ws.kind === "personal") {
    if (ws.personalOwnerId !== args.actorUserId) {
      return { ok: false, status: 404, code: "NOT_FOUND", error: "Workspace not found." };
    }
    if (args.visibility === "shared") {
      return {
        ok: false,
        status: 403,
        code: "TEAM_PLAN_REQUIRED",
        error: "Shared spaces require a Casefolio Teams workspace.",
      };
    }
  } else {
    if (!ws.organizationId) {
      return { ok: false, status: 404, code: "NOT_FOUND", error: "Workspace not found." };
    }
    const [mem] = await db
      .select({ id: dbSchema.memberships.id })
      .from(dbSchema.memberships)
      .where(
        and(
          eq(dbSchema.memberships.orgId, ws.organizationId),
          eq(dbSchema.memberships.userId, args.actorUserId),
        ),
      )
      .limit(1);
    if (!mem) {
      return { ok: false, status: 404, code: "NOT_FOUND", error: "Workspace not found." };
    }
  }

  const ent = await resolveWorkspaceEntitlementState(ws.id, now);
  if (!ent) {
    return { ok: false, status: 404, code: "NOT_FOUND", error: "Workspace not found." };
  }

  if (ent.isFrozen) {
    return {
      ok: false,
      status: 403,
      code: "WORKSPACE_FROZEN",
      error: "Cannot create spaces while this workspace is read-only.",
    };
  }

  if (args.visibility === "private") {
    const [privCount] = await db
      .select({ total: count() })
      .from(dbSchema.spaces)
      .where(
        and(
          eq(dbSchema.spaces.workspaceId, ws.id),
          eq(dbSchema.spaces.visibility, "private"),
          eq(dbSchema.spaces.controllerUserId, args.actorUserId),
          eq(dbSchema.spaces.recoveryState, "active"),
        ),
      );

    if (Number(privCount?.total ?? 0) >= ent.quotas.privateSpacesPerMemberLimit) {
      return {
        ok: false,
        status: 403,
        code: "SPACE_LIMIT_REACHED",
        error: `You have reached the maximum of ${ent.quotas.privateSpacesPerMemberLimit} private space${ent.quotas.privateSpacesPerMemberLimit === 1 ? "" : "s"} for this workspace.`,
      };
    }
  } else {
    if (ent.plan !== "team" || ent.quotas.sharedSpacesLimit <= 0) {
      return {
        ok: false,
        status: 403,
        code: "TEAM_PLAN_REQUIRED",
        error: "An active Casefolio Teams subscription is required to create shared spaces.",
      };
    }

    const [sharedCount] = await db
      .select({ total: count() })
      .from(dbSchema.spaces)
      .where(
        and(
          eq(dbSchema.spaces.workspaceId, ws.id),
          eq(dbSchema.spaces.visibility, "shared"),
          eq(dbSchema.spaces.recoveryState, "active"),
        ),
      );

    if (Number(sharedCount?.total ?? 0) >= ent.quotas.sharedSpacesLimit) {
      return {
        ok: false,
        status: 403,
        code: "SPACE_LIMIT_REACHED",
        error: `This team workspace has reached its limit of ${ent.quotas.sharedSpacesLimit} shared spaces.`,
      };
    }
  }

  const slug = `${slugifySpaceName(cleanName)}-${randomUUID().slice(0, 6)}`;
  const [inserted] = await db
    .insert(dbSchema.spaces)
    .values({
      workspaceId: ws.id,
      name: cleanName,
      slug,
      visibility: args.visibility,
      isDefault: false,
      controllerUserId: args.actorUserId,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return {
    ok: true,
    space: {
      id: inserted!.id,
      workspaceId: inserted!.workspaceId,
      name: inserted!.name,
      slug: inserted!.slug,
      visibility: inserted!.visibility,
      isDefault: inserted!.isDefault,
      controllerUserId: inserted!.controllerUserId,
      isMine: true,
      aclVersion: inserted!.aclVersion,
    },
  };
}

/**
 * Transitions a space between `private` and `shared` (`Spec §9 & §10.4`).
 * - `Shared -> Private`: controller ONLY (never default shared space), requires explicit confirmation,
 *   unpublishes projects & removes `published_snapshots`, revokes others' edit leases, and increments `aclVersion`.
 */
export async function transitionSpaceVisibility(args: {
  actorUserId: string;
  spaceId: string;
  targetVisibility: SpaceVisibility;
  confirmed: boolean;
  now?: Date;
}): Promise<
  | { ok: true; space: SpaceSummaryItem; unpublishedCount: number }
  | { ok: false; status: 400 | 403 | 404; code: string; error: string }
> {
  const now = args.now ?? new Date();
  if (!args.confirmed) {
    return {
      ok: false,
      status: 400,
      code: "CONFIRMATION_REQUIRED",
      error: "Explicit confirmation is required before changing space visibility.",
    };
  }

  const action =
    args.targetVisibility === "shared" ? "transition_to_shared" : "transition_to_private";
  const auth = await authorizeSpaceAccess(args.spaceId, args.actorUserId, action, now);
  if (!auth.ok) {
    return auth;
  }

  if (auth.space.visibility === args.targetVisibility) {
    return {
      ok: true,
      space: {
        id: auth.space.id,
        workspaceId: auth.space.workspaceId,
        name: auth.space.name,
        slug: auth.space.slug,
        visibility: auth.space.visibility,
        isDefault: auth.space.isDefault,
        controllerUserId: auth.space.controllerUserId,
        isMine: auth.isController,
        aclVersion: auth.space.aclVersion,
      },
      unpublishedCount: 0,
    };
  }

  if (args.targetVisibility === "shared") {
    if (
      auth.entitlement.plan !== "team" ||
      auth.entitlement.quotas.sharedSpacesLimit <= 0
    ) {
      return {
        ok: false,
        status: 403,
        code: "TEAM_PLAN_REQUIRED",
        error: "An active Casefolio Teams subscription is required for shared spaces.",
      };
    }

    const [sharedCount] = await db
      .select({ total: count() })
      .from(dbSchema.spaces)
      .where(
        and(
          eq(dbSchema.spaces.workspaceId, auth.workspace.id),
          eq(dbSchema.spaces.visibility, "shared"),
          eq(dbSchema.spaces.recoveryState, "active"),
        ),
      );

    if (Number(sharedCount?.total ?? 0) >= auth.entitlement.quotas.sharedSpacesLimit) {
      return {
        ok: false,
        status: 403,
        code: "SPACE_LIMIT_REACHED",
        error: `Maximum of ${auth.entitlement.quotas.sharedSpacesLimit} shared spaces reached.`,
      };
    }

    const [updated] = await db
      .update(dbSchema.spaces)
      .set({
        visibility: "shared",
        aclVersion: auth.space.aclVersion + 1,
        updatedAt: now,
      })
      .where(eq(dbSchema.spaces.id, auth.space.id))
      .returning();

    await db.insert(dbSchema.auditLogs).values({
      actorId: args.actorUserId,
      action: "space.visibility.shared",
      meta: { workspaceId: auth.workspace.id, spaceId: auth.space.id },
      at: now,
    });

    return {
      ok: true,
      space: {
        id: updated!.id,
        workspaceId: updated!.workspaceId,
        name: updated!.name,
        slug: updated!.slug,
        visibility: updated!.visibility,
        isDefault: updated!.isDefault,
        controllerUserId: updated!.controllerUserId,
        isMine: true,
        aclVersion: updated!.aclVersion,
      },
      unpublishedCount: 0,
    };
  }

  // `shared -> private` (`Spec §10.4`)
  const [privCount] = await db
    .select({ total: count() })
    .from(dbSchema.spaces)
    .where(
      and(
        eq(dbSchema.spaces.workspaceId, auth.workspace.id),
        eq(dbSchema.spaces.visibility, "private"),
        eq(dbSchema.spaces.controllerUserId, args.actorUserId),
        eq(dbSchema.spaces.recoveryState, "active"),
      ),
    );

  if (Number(privCount?.total ?? 0) >= auth.entitlement.quotas.privateSpacesPerMemberLimit) {
    return {
      ok: false,
      status: 403,
      code: "SPACE_LIMIT_REACHED",
      error: `Maximum of ${auth.entitlement.quotas.privateSpacesPerMemberLimit} private spaces reached.`,
    };
  }

  const spaceProjects = await db
    .select({
      id: dbSchema.projects.id,
      slug: dbSchema.projects.slug,
      visibility: dbSchema.projects.visibility,
    })
    .from(dbSchema.projects)
    .where(eq(dbSchema.projects.spaceId, auth.space.id));

  const projectIds = spaceProjects.map((p) => p.id);
  const publishedProjects = spaceProjects.filter((p) => p.visibility !== "private");
  const publishedIds = publishedProjects.map((p) => p.id);

  const updated = await db.transaction(async (tx) => {
    if (projectIds.length > 0) {
      await tx
        .update(dbSchema.projects)
        .set({
          visibility: "private",
          publishedAt: null,
          updatedAt: now,
        })
        .where(inArray(dbSchema.projects.id, projectIds));

      await tx
        .delete(dbSchema.publishedSnapshots)
        .where(inArray(dbSchema.publishedSnapshots.projectId, projectIds));
    }

    const [updatedSpace] = await tx
      .update(dbSchema.spaces)
      .set({
        visibility: "private",
        aclVersion: auth.space.aclVersion + 1,
        updatedAt: now,
      })
      .where(eq(dbSchema.spaces.id, auth.space.id))
      .returning();

    await tx.insert(dbSchema.auditLogs).values({
      actorId: args.actorUserId,
      action: "space.visibility.private",
      meta: {
        workspaceId: auth.workspace.id,
        spaceId: auth.space.id,
        unpublishedCount: publishedIds.length,
      },
      at: now,
    });

    return updatedSpace!;
  });

  if (projectIds.length > 0) {
    await revokeUserWorkspaceLeases({
      workspaceId: auth.workspace.id,
      excludeUserId: args.actorUserId,
      projectIds,
    });
  }

  for (const proj of publishedProjects) {
    if (proj.slug) {
      revalidatePublicProject(proj.slug);
    }
  }

  return {
    ok: true,
    space: {
      id: updated.id,
      workspaceId: updated.workspaceId,
      name: updated.name,
      slug: updated.slug,
      visibility: updated.visibility,
      isDefault: updated.isDefault,
      controllerUserId: updated.controllerUserId,
      isMine: true,
      aclVersion: updated.aclVersion,
    },
    unpublishedCount: publishedIds.length,
  };
}

/**
 * Moves a project between spaces within the SAME workspace (`Spec §10.5` & `N13`).
 */
export async function moveProjectBetweenSpaces(args: {
  actorUserId: string;
  projectId: string;
  destinationSpaceId: string;
  confirmed?: boolean;
  now?: Date;
}): Promise<
  | { ok: true; projectId: string; destinationSpaceId: string }
  | { ok: false; status: 400 | 403 | 404; code: string; error: string }
> {
  const now = args.now ?? new Date();
  const sourceAuth = await authorizeProjectAccess(args.projectId, args.actorUserId, "edit", now);
  if (!sourceAuth.ok) {
    return sourceAuth;
  }

  const destAuth = await authorizeSpaceAccess(
    args.destinationSpaceId,
    args.actorUserId,
    "create_project",
    now,
  );
  if (!destAuth.ok) {
    return destAuth;
  }

  if (sourceAuth.workspace.id !== destAuth.workspace.id) {
    return {
      ok: false,
      status: 400,
      code: "CROSS_WORKSPACE_MOVE_FORBIDDEN",
      error: "Moving across workspaces is not permitted. Use Copy to Workspace instead.",
    };
  }

  // `shared -> private` requires Owner/Admin authority + destination owner (`Spec §10.5`)
  if (sourceAuth.space.visibility === "shared" && destAuth.space.visibility === "private") {
    if (sourceAuth.membershipRole !== "owner" && sourceAuth.membershipRole !== "admin") {
      return {
        ok: false,
        status: 403,
        code: "FORBIDDEN",
        error: "Moving a shared project into a private space requires Owner or Admin authority.",
      };
    }
    if (!destAuth.isController || !args.confirmed) {
      return {
        ok: false,
        status: 400,
        code: "CONFIRMATION_REQUIRED",
        error: "Moving a shared project into your private space requires explicit confirmation.",
      };
    }
  }

  if (sourceAuth.space.visibility === "private" && destAuth.space.visibility === "shared") {
    if (!sourceAuth.isController || !args.confirmed) {
      return {
        ok: false,
        status: 400,
        code: "CONFIRMATION_REQUIRED",
        error: "Sharing a private project with the team requires explicit confirmation.",
      };
    }
  }

  const unpublishOnMove =
    sourceAuth.space.visibility === "shared" && destAuth.space.visibility === "private";
  const wasPublishedSlug =
    unpublishOnMove && sourceAuth.project.visibility !== "private"
      ? sourceAuth.project.slug
      : null;

  await db.transaction(async (tx) => {
    await tx
      .update(dbSchema.projects)
      .set({
        spaceId: destAuth.space.id,
        ...(unpublishOnMove ? { visibility: "private" as const, publishedAt: null } : {}),
        updatedAt: now,
      })
      .where(eq(dbSchema.projects.id, args.projectId));

    if (unpublishOnMove) {
      await tx
        .delete(dbSchema.publishedSnapshots)
        .where(eq(dbSchema.publishedSnapshots.projectId, args.projectId));
    } else {
      await tx
        .update(dbSchema.publishedSnapshots)
        .set({ spaceId: destAuth.space.id, updatedAt: now })
        .where(eq(dbSchema.publishedSnapshots.projectId, args.projectId));
    }

    // Revoke active edit leases on move so collaborators' stale space/ACL tokens cannot keep editing (`N13`)
    await tx
      .delete(dbSchema.editLeases)
      .where(eq(dbSchema.editLeases.projectId, args.projectId));

    await tx
      .update(dbSchema.spaces)
      .set({ aclVersion: sourceAuth.space.aclVersion + 1, updatedAt: now })
      .where(eq(dbSchema.spaces.id, sourceAuth.space.id));

    if (destAuth.space.id !== sourceAuth.space.id) {
      await tx
        .update(dbSchema.spaces)
        .set({ aclVersion: destAuth.space.aclVersion + 1, updatedAt: now })
        .where(eq(dbSchema.spaces.id, destAuth.space.id));
    }

    await tx.insert(dbSchema.auditLogs).values({
      actorId: args.actorUserId,
      action: "project.moved_between_spaces",
      meta: {
        workspaceId: sourceAuth.workspace.id,
        projectId: args.projectId,
        sourceSpaceId: sourceAuth.space.id,
        destinationSpaceId: destAuth.space.id,
        unpublishedOnMove: unpublishOnMove,
      },
      at: now,
    });
  });

  if (wasPublishedSlug) {
    revalidatePublicProject(wasPublishedSlug);
  }

  return {
    ok: true,
    projectId: args.projectId,
    destinationSpaceId: destAuth.space.id,
  };
}

/**
 * Copies a project across workspaces (including copying out of a departed member's `frozen_member_departed`
 * recovery space to their personal workspace) with new IDs, cloned private assets, `visibility = 'private'`,
 * `slug = null`, and strict destination quota enforcement (`Spec §10.6 & §11.2`).
 */
export async function copyProjectAcrossWorkspaces(args: {
  actorUserId: string;
  projectId: string;
  destinationSpaceId?: string;
  now?: Date;
}): Promise<
  | { ok: true; copiedProjectId: string; destinationWorkspaceId: string; destinationSpaceId: string }
  | { ok: false; status: 400 | 403 | 404; code: string; error: string }
> {
  const now = args.now ?? new Date();
  const sourceAuth = await authorizeProjectAccess(
    args.projectId,
    args.actorUserId,
    "copy_out",
    now,
  );
  if (!sourceAuth.ok) {
    return sourceAuth;
  }

  let targetSpaceId = args.destinationSpaceId;
  if (!targetSpaceId) {
    const personal = await ensurePersonalWorkspaceForUser(args.actorUserId);
    targetSpaceId = personal.defaultSpaceId;
  }

  const destAuth = await authorizeSpaceAccess(
    targetSpaceId,
    args.actorUserId,
    "create_project",
    now,
  );
  if (!destAuth.ok) {
    return destAuth;
  }

  const [destCounts, destStorageBytes, sourceAssets] = await Promise.all([
    getWorkspaceProjectCounts(destAuth.workspace.id),
    getWorkspaceStorageUsageBytes(destAuth.workspace.id),
    db
      .select()
      .from(dbSchema.assets)
      .where(eq(dbSchema.assets.projectId, sourceAuth.project.id)),
  ]);

  if (
    destAuth.entitlement.plan === "free" &&
    Math.max(destCounts.lifetimeProjectsCreated, destCounts.retainedProjects) >=
      FREE_LIFETIME_PROJECT_LIMIT
  ) {
    const decision = evaluateEntitlement("free", "create_project", {
      projectsCount: destCounts.activeProjects,
      retainedProjectsCount: destCounts.retainedProjects,
      lifetimeProjectsCreated: destCounts.lifetimeProjectsCreated,
    });
    return {
      ok: false,
      status: 403,
      code: "PROJECT_LIMIT_REACHED",
      error: decision.message,
    };
  }

  if (destCounts.activeProjects >= destAuth.entitlement.quotas.activeProjectsLimit) {
    const decision = evaluateEntitlement(destAuth.entitlement.plan, "create_project", {
      projectsCount: destCounts.activeProjects,
      paidSeats: destAuth.entitlement.paidSeats,
    });
    return {
      ok: false,
      status: 403,
      code: "PROJECT_LIMIT_REACHED",
      error:
        decision.allowed === false
          ? decision.message
          : `Destination workspace has reached its limit of ${destAuth.entitlement.quotas.activeProjectsLimit} active projects.`,
    };
  }

  if (destCounts.retainedProjects >= destAuth.entitlement.quotas.retainedProjectsLimit) {
    return {
      ok: false,
      status: 403,
      code: "RETAINED_PROJECT_LIMIT_REACHED",
      error: `Destination workspace has reached its limit of ${destAuth.entitlement.quotas.retainedProjectsLimit} total retained projects.`,
    };
  }

  const copiedBytes = sourceAssets.reduce((sum, a) => sum + a.bytes, 0);
  const storageEval = evaluateQuotaUsage({
    used: destStorageBytes,
    adding: copiedBytes,
    limit: destAuth.entitlement.quotas.storageBytesLimit,
    isPaid: destAuth.entitlement.plan !== "free",
    graceUsedAt: destAuth.entitlement.graceUsedAt,
    graceExpiresAt: destAuth.entitlement.graceExpiresAt,
    now,
  });

  if (!storageEval.allowed) {
    return {
      ok: false,
      status: 403,
      code: "STORAGE_QUOTA_EXCEEDED",
      error: "Destination workspace does not have enough storage quota for this copy.",
    };
  }

  const newProjectId = randomUUID();
  const assetIdMap = new Map<string, string>();
  const clonedAssetRows: Array<typeof dbSchema.assets.$inferInsert> = [];
  const writtenR2Keys: string[] = [];

  try {
    for (const srcAsset of sourceAssets) {
      const newAssetId = randomUUID();
      assetIdMap.set(srcAsset.id, newAssetId);
      const ext =
        srcAsset.mimeType === "image/jpeg"
          ? "jpg"
          : srcAsset.mimeType === "image/webp"
            ? "webp"
            : "png";
      // `N12`: Always assign a distinct destination R2 key so deleting the copy can never
      // delete the source workspace's object.
      const newR2Key = `workspaces/${destAuth.workspace.id}/projects/${newProjectId}/assets/${newAssetId}.${ext}`;

      const rawBytes = await readStoredObjectBytes(srcAsset.r2Key);
      if (rawBytes) {
        await writeStoredObject(newR2Key, rawBytes, {
          contentType: srcAsset.mimeType ?? "image/png",
        });
        writtenR2Keys.push(newR2Key);
      }

      clonedAssetRows.push({
        id: newAssetId,
        projectId: newProjectId,
        workspaceId: destAuth.workspace.id,
        r2Key: newR2Key,
        slot: srcAsset.slot,
        crop: srcAsset.crop,
        width: srcAsset.width,
        height: srcAsset.height,
        bytes: srcAsset.bytes,
        mimeType: srcAsset.mimeType,
        sha256: srcAsset.sha256,
        createdAt: now,
      });
    }

    const remappedPuckData = remapAssetUrlsInPuckData(
      structuredClone(sourceAuth.project.puckData),
      assetIdMap,
    ) as Record<string, unknown>;

    const txResult = await db.transaction(async (tx) => {
      const wsLock = await tx.execute<{
        id: string;
        lifetime_projects_created: string | number;
      }>(sql`
        SELECT id, lifetime_projects_created
        FROM workspaces
        WHERE id = ${destAuth.workspace.id}
        FOR UPDATE
      `);

      const currentRows = await tx
        .select({
          archivedAt: dbSchema.projects.archivedAt,
        })
        .from(dbSchema.projects)
        .innerJoin(dbSchema.spaces, eq(dbSchema.projects.spaceId, dbSchema.spaces.id))
        .where(
          and(
            eq(dbSchema.projects.workspaceId, destAuth.workspace.id),
            eq(dbSchema.spaces.recoveryState, "active"),
          ),
        );

      const lockedActive = currentRows.filter((r) => r.archivedAt === null).length;
      const lockedRetained = currentRows.length;
      const lockedLifetime = Math.max(
        Number(wsLock.rows[0]?.lifetime_projects_created ?? 0),
        lockedRetained,
      );

      if (
        destAuth.entitlement.plan === "free" &&
        lockedLifetime >= FREE_LIFETIME_PROJECT_LIMIT
      ) {
        const decision = evaluateEntitlement("free", "create_project", {
          projectsCount: lockedActive,
          retainedProjectsCount: lockedRetained,
          lifetimeProjectsCreated: lockedLifetime,
        });
        return {
          ok: false as const,
          status: 403 as const,
          code: "PROJECT_LIMIT_REACHED",
          error: decision.message,
        };
      }

      if (lockedActive >= destAuth.entitlement.quotas.activeProjectsLimit) {
        const decision = evaluateEntitlement(destAuth.entitlement.plan, "create_project", {
          projectsCount: lockedActive,
          paidSeats: destAuth.entitlement.paidSeats,
        });
        return {
          ok: false as const,
          status: 403 as const,
          code: "PROJECT_LIMIT_REACHED",
          error:
            decision.allowed === false
              ? decision.message
              : `Destination workspace has reached its limit of ${destAuth.entitlement.quotas.activeProjectsLimit} active projects.`,
        };
      }

      if (lockedRetained >= destAuth.entitlement.quotas.retainedProjectsLimit) {
        return {
          ok: false as const,
          status: 403 as const,
          code: "RETAINED_PROJECT_LIMIT_REACHED",
          error: `Destination workspace has reached its limit of ${destAuth.entitlement.quotas.retainedProjectsLimit} total retained projects.`,
        };
      }

      const [[lockedAssetSum], [lockedRevSum]] = await Promise.all([
        tx
          .select({
            totalBytes: sql<number>`coalesce(sum(${dbSchema.assets.bytes}), 0)::bigint`,
          })
          .from(dbSchema.assets)
          .innerJoin(dbSchema.projects, eq(dbSchema.assets.projectId, dbSchema.projects.id))
          .innerJoin(dbSchema.spaces, eq(dbSchema.projects.spaceId, dbSchema.spaces.id))
          .where(
            and(
              eq(dbSchema.projects.workspaceId, destAuth.workspace.id),
              eq(dbSchema.spaces.recoveryState, "active"),
            ),
          ),
        tx
          .select({
            totalBytes: sql<number>`coalesce(sum(${dbSchema.projectRevisions.bytes}), 0)::bigint`,
          })
          .from(dbSchema.projectRevisions)
          .innerJoin(
            dbSchema.projects,
            eq(dbSchema.projectRevisions.projectId, dbSchema.projects.id),
          )
          .innerJoin(dbSchema.spaces, eq(dbSchema.projects.spaceId, dbSchema.spaces.id))
          .where(
            and(
              eq(dbSchema.projects.workspaceId, destAuth.workspace.id),
              eq(dbSchema.spaces.recoveryState, "active"),
            ),
          ),
      ]);

      const lockedStorageBytes =
        Number(lockedAssetSum?.totalBytes ?? 0) + Number(lockedRevSum?.totalBytes ?? 0);
      const lockedStorageEval = evaluateQuotaUsage({
        used: lockedStorageBytes,
        adding: copiedBytes,
        limit: destAuth.entitlement.quotas.storageBytesLimit,
        isPaid: destAuth.entitlement.plan !== "free",
        graceUsedAt: destAuth.entitlement.graceUsedAt,
        graceExpiresAt: destAuth.entitlement.graceExpiresAt,
        now,
      });

      if (!lockedStorageEval.allowed) {
        return {
          ok: false as const,
          status: 403 as const,
          code: "STORAGE_QUOTA_EXCEEDED",
          error: "Destination workspace does not have enough storage quota for this copy.",
        };
      }

      await tx.insert(dbSchema.projects).values({
        id: newProjectId,
        ownerId: args.actorUserId,
        orgId: destAuth.workspace.organizationId,
        workspaceId: destAuth.workspace.id,
        spaceId: destAuth.space.id,
        createdByUserId: args.actorUserId,
        templateVersionId: sourceAuth.project.templateVersionId,
        name: `${sourceAuth.project.name} (Copy)`.slice(0, 120),
        type: sourceAuth.project.type,
        puckData: remappedPuckData,
        theme: structuredClone(sourceAuth.project.theme),
        revision: 1,
        slug: null,
        visibility: "private",
        brandingRemoved: false,
        publicAcknowledgedAt: null,
        publishedAt: null,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      await tx
        .update(dbSchema.workspaces)
        .set({
          lifetimeProjectsCreated: sql`${dbSchema.workspaces.lifetimeProjectsCreated} + 1`,
          updatedAt: now,
        })
        .where(eq(dbSchema.workspaces.id, destAuth.workspace.id));

      if (clonedAssetRows.length > 0) {
        await tx.insert(dbSchema.assets).values(clonedAssetRows);
      }

      await tx.insert(dbSchema.auditLogs).values({
        actorId: args.actorUserId,
        action: "project.copied_across_workspaces",
        meta: {
          sourceWorkspaceId: sourceAuth.workspace.id,
          destinationWorkspaceId: destAuth.workspace.id,
          copiedProjectId: newProjectId,
        },
        at: now,
      });

      return { ok: true as const };
    });

    if (!txResult.ok) {
      if (writtenR2Keys.length > 0) {
        await Promise.all(writtenR2Keys.map((k) => deleteStoredObject(k).catch(() => undefined)));
      }
      return txResult;
    }
  } catch (error) {
    if (writtenR2Keys.length > 0) {
      await Promise.all(writtenR2Keys.map((k) => deleteStoredObject(k).catch(() => undefined)));
    }
    throw error;
  }

  return {
    ok: true,
    copiedProjectId: newProjectId,
    destinationWorkspaceId: destAuth.workspace.id,
    destinationSpaceId: destAuth.space.id,
  };
}

export interface RecoveryProjectItem {
  id: string;
  name: string;
  type: "mobile" | "web" | "both";
  updatedAtIso: string;
}

export interface RecoverySpaceBundle {
  spaceId: string;
  spaceName: string;
  formerTeamName: string;
  departedAtIso: string | null;
  recoveryUntilIso: string | null;
  projects: RecoveryProjectItem[];
}

/**
 * Lists the caller's departed-team private recovery spaces (`Spec §11.2 & §11.4`),
 * completely separate from team navigation and invisible to the former team.
 */
export async function listRecoverySpacesForUser(
  userId: string,
  now: Date = new Date(),
): Promise<RecoverySpaceBundle[]> {
  const recoverySpaces = await db
    .select({
      space: dbSchema.spaces,
      workspaceName: dbSchema.workspaces.name,
    })
    .from(dbSchema.spaces)
    .innerJoin(dbSchema.workspaces, eq(dbSchema.spaces.workspaceId, dbSchema.workspaces.id))
    .where(
      and(
        eq(dbSchema.spaces.controllerUserId, userId),
        eq(dbSchema.spaces.recoveryState, "frozen_member_departed"),
        or(isNull(dbSchema.spaces.recoveryUntil), gt(dbSchema.spaces.recoveryUntil, now)),
      ),
    )
    .orderBy(desc(dbSchema.spaces.departedAt));

  if (recoverySpaces.length === 0) {
    return [];
  }

  const spaceIds = recoverySpaces.map((r) => r.space.id);
  const projRows = await db
    .select({
      id: dbSchema.projects.id,
      spaceId: dbSchema.projects.spaceId,
      name: dbSchema.projects.name,
      type: dbSchema.projects.type,
      updatedAt: dbSchema.projects.updatedAt,
    })
    .from(dbSchema.projects)
    .where(inArray(dbSchema.projects.spaceId, spaceIds))
    .orderBy(desc(dbSchema.projects.updatedAt));

  return recoverySpaces.map((item) => ({
    spaceId: item.space.id,
    spaceName: item.space.name,
    formerTeamName: item.workspaceName,
    departedAtIso: item.space.departedAt?.toISOString() ?? null,
    recoveryUntilIso: item.space.recoveryUntil?.toISOString() ?? null,
    projects: projRows
      .filter((p) => p.spaceId === item.space.id)
      .map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        updatedAtIso: p.updatedAt.toISOString(),
      })),
  }));
}

/**
 * Exports a read-only data-portability JSON bundle for a project (`Spec §5.8 & §11.2`).
 * Separate from aesthetic export quotas and returns `404` for unauthorized callers.
 */
export async function exportProjectPortabilityJson(args: {
  actorUserId: string;
  projectId: string;
  now?: Date;
}): Promise<
  | { ok: true; filename: string; payload: Record<string, unknown> }
  | { ok: false; status: 403 | 404; code: string; error: string }
> {
  const auth = await authorizeProjectAccess(
    args.projectId,
    args.actorUserId,
    "export_portability",
    args.now,
  );
  if (!auth.ok) {
    return auth;
  }

  const assetRows = await db
    .select({
      id: dbSchema.assets.id,
      slot: dbSchema.assets.slot,
      width: dbSchema.assets.width,
      height: dbSchema.assets.height,
      bytes: dbSchema.assets.bytes,
      mimeType: dbSchema.assets.mimeType,
      crop: dbSchema.assets.crop,
      createdAt: dbSchema.assets.createdAt,
    })
    .from(dbSchema.assets)
    .where(eq(dbSchema.assets.projectId, auth.project.id));

  const safeSlug = auth.project.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  return {
    ok: true,
    filename: `${safeSlug || "casefolio-project"}-portability.json`,
    payload: {
      schemaVersion: "casefolio.portability.v1",
      exportedAtIso: (args.now ?? new Date()).toISOString(),
      project: {
        id: auth.project.id,
        name: auth.project.name,
        type: auth.project.type,
        revision: auth.project.revision,
        templateVersionId: auth.project.templateVersionId,
        puckData: auth.project.puckData,
        theme: auth.project.theme,
        createdAtIso: auth.project.createdAt.toISOString(),
        updatedAtIso: auth.project.updatedAt.toISOString(),
      },
      assets: assetRows.map((a) => ({
        ...a,
        createdAtIso: a.createdAt.toISOString(),
      })),
    },
  };
}
