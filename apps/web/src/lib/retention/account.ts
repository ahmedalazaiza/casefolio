import {
  and,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
  normalizeMembershipRole,
} from "@casefolio/db";
import { cancelUserSubscription } from "@/lib/billing/service";
import { db, dbSchema } from "@/lib/db";
import {
  sendAccountDeletedEmail,
  sendAccountDeletionBlockedEmail,
  sendTeamWorkspaceDissolvedEmail,
} from "@/lib/email";
import { executeMemberDepartureSideEffects } from "@/lib/entitlements/team-invitations";
import { revalidatePublicProject } from "@/lib/projects/public-cache";
import { sanitizeErrorForLogging } from "@/lib/security/redact";
import { deleteStoredObject } from "@/lib/storage/r2";

export const ACCOUNT_DELETION_GRACE_DAYS = 7;
export const ACCOUNT_DELETION_GRACE_MS = ACCOUNT_DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000;
const BLOCKED_NOTICE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export interface SoleOwnedTeamInfo {
  organizationId: string;
  organizationName: string;
  otherMembersCount: number;
  hasLiveSubscription: boolean;
}

export type SoleOwnerBlockCheck =
  | {
      blocked: false;
      autoDissolvableTeams: SoleOwnedTeamInfo[];
    }
  | {
      blocked: true;
      organizationId: string;
      organizationName: string;
      blockedTeams: SoleOwnedTeamInfo[];
      autoDissolvableTeams: SoleOwnedTeamInfo[];
      error: string;
    };

export async function inspectUserOwnedTeamsForDeletion(userId: string): Promise<{
  blockedTeams: SoleOwnedTeamInfo[];
  autoDissolvableTeams: SoleOwnedTeamInfo[];
}> {
  const userMemberships = await db
    .select({
      orgId: dbSchema.memberships.orgId,
      role: dbSchema.memberships.role,
      orgName: dbSchema.organizations.name,
    })
    .from(dbSchema.memberships)
    .innerJoin(
      dbSchema.organizations,
      eq(dbSchema.memberships.orgId, dbSchema.organizations.id),
    )
    .where(eq(dbSchema.memberships.userId, userId));

  const blockedTeams: SoleOwnedTeamInfo[] = [];
  const autoDissolvableTeams: SoleOwnedTeamInfo[] = [];

  for (const membership of userMemberships) {
    if (normalizeMembershipRole(membership.role) !== "owner") {
      continue;
    }

    const orgMembers = await db
      .select({
        userId: dbSchema.memberships.userId,
        role: dbSchema.memberships.role,
      })
      .from(dbSchema.memberships)
      .where(eq(dbSchema.memberships.orgId, membership.orgId));

    const hasOtherOwner = orgMembers.some(
      (m) => m.userId !== userId && normalizeMembershipRole(m.role) === "owner",
    );
    if (hasOtherOwner) {
      continue;
    }

    const otherMembersCount = orgMembers.filter((m) => m.userId !== userId).length;

    const [liveTeamSub] = await db
      .select({ id: dbSchema.subscriptions.id })
      .from(dbSchema.subscriptions)
      .where(
        and(
          eq(dbSchema.subscriptions.orgId, membership.orgId),
          inArray(dbSchema.subscriptions.status, [
            "active",
            "trialing",
            "past_due",
            "paused",
            "cancel_at_period_end",
          ]),
        ),
      )
      .limit(1);

    const info: SoleOwnedTeamInfo = {
      organizationId: membership.orgId,
      organizationName: membership.orgName,
      otherMembersCount,
      hasLiveSubscription: Boolean(liveTeamSub),
    };

    if (otherMembersCount > 0) {
      blockedTeams.push(info);
    } else {
      autoDissolvableTeams.push(info);
    }
  }

  return { blockedTeams, autoDissolvableTeams };
}

export async function checkSoleOwnerDeletionBlock(
  userId: string,
): Promise<SoleOwnerBlockCheck> {
  const { blockedTeams, autoDissolvableTeams } =
    await inspectUserOwnedTeamsForDeletion(userId);

  if (blockedTeams.length > 0) {
    const primary = blockedTeams[0]!;
    return {
      blocked: true,
      organizationId: primary.organizationId,
      organizationName: primary.organizationName,
      blockedTeams,
      autoDissolvableTeams,
      error:
        "You are the sole Owner of an active Team workspace with other members. Transfer workspace ownership or confirm dissolving the Team workspace before deleting your account.",
    };
  }

  return { blocked: false, autoDissolvableTeams };
}

export type ExecuteAccountPurgeResult =
  | { ok: true; purgedUserId: string }
  | {
      ok: false;
      code: "NOT_FOUND" | "SOLE_TEAM_OWNER" | "BILLING_CANCEL_FAILED";
      error: string;
    };

async function cancelScopeSubscriptionBeforePurge(args: {
  actor: { id: string; email: string; name: string | null };
  orgId?: string | null;
  cancelSubscriptionFn: typeof cancelUserSubscription;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await args.cancelSubscriptionFn(
      args.actor,
      {
        orgId: args.orgId ?? null,
        reason: "other",
        feedback: args.orgId
          ? "Account deleted and Team workspace dissolved by Owner"
          : "Account permanently deleted by user",
        immediate: true,
      },
      { suppressEmail: true },
    );
    if (!res.ok) {
      return { ok: false, error: res.error };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: String(sanitizeErrorForLogging(error)).slice(0, 240),
    };
  }
}

export async function executeAccountPurge(
  userId: string,
  options?: {
    now?: Date;
    cancelSubscriptionFn?: typeof cancelUserSubscription;
    dissolveOwnedTeams?: boolean;
  },
): Promise<ExecuteAccountPurgeResult> {
  const now = options?.now ?? new Date();
  const cancelSubscriptionFn = options?.cancelSubscriptionFn ?? cancelUserSubscription;

  const [userRow] = await db
    .select()
    .from(dbSchema.users)
    .where(eq(dbSchema.users.id, userId))
    .limit(1);

  if (!userRow) {
    return {
      ok: false,
      code: "NOT_FOUND",
      error: "Account not found.",
    };
  }

  // 1. Inspect sole-owner teams: empty sole-owned teams auto-dissolve; teams with other members
  // require either transferring ownership or explicit `dissolveOwnedTeams: true`.
  const ownerCheck = await checkSoleOwnerDeletionBlock(userRow.id);
  if (ownerCheck.blocked && !options?.dissolveOwnedTeams) {
    const noticeIdentifier = `account_deletion_blocked_notice:${userRow.id}`;
    const [recentNotice] = await db
      .select({ id: dbSchema.verifications.id })
      .from(dbSchema.verifications)
      .where(
        and(
          eq(dbSchema.verifications.identifier, noticeIdentifier),
          gt(dbSchema.verifications.expiresAt, now),
        ),
      )
      .limit(1);

    if (!recentNotice) {
      await db
        .delete(dbSchema.verifications)
        .where(eq(dbSchema.verifications.identifier, noticeIdentifier));
      await db.insert(dbSchema.verifications).values({
        identifier: noticeIdentifier,
        value: ownerCheck.organizationId,
        expiresAt: new Date(now.getTime() + BLOCKED_NOTICE_COOLDOWN_MS),
        createdAt: now,
        updatedAt: now,
      });
      await sendAccountDeletionBlockedEmail({
        to: userRow.email,
        name: userRow.name,
        organizationName: ownerCheck.organizationName,
      }).catch(() => undefined);
    }

    return {
      ok: false,
      code: "SOLE_TEAM_OWNER",
      error: ownerCheck.error,
    };
  }

  const teamsToDissolve: SoleOwnedTeamInfo[] = ownerCheck.blocked
    ? [...ownerCheck.autoDissolvableTeams, ...ownerCheck.blockedTeams]
    : [...ownerCheck.autoDissolvableTeams];
  const dissolvedOrgIdSet = new Set(teamsToDissolve.map((t) => t.organizationId));

  // 2. Cancel active paid personal & dissolved Team subscriptions BEFORE deleting any DB rows (`B1`)
  const [paidPersonalSub] = await db
    .select({
      id: dbSchema.subscriptions.id,
      plan: dbSchema.subscriptions.plan,
      status: dbSchema.subscriptions.status,
    })
    .from(dbSchema.subscriptions)
    .where(
      and(
        eq(dbSchema.subscriptions.userId, userRow.id),
        isNull(dbSchema.subscriptions.orgId),
        ne(dbSchema.subscriptions.plan, "free"),
        inArray(dbSchema.subscriptions.status, [
          "active",
          "trialing",
          "past_due",
          "paused",
          "cancel_at_period_end",
        ]),
      ),
    )
    .limit(1);

  if (paidPersonalSub) {
    const personalCancel = await cancelScopeSubscriptionBeforePurge({
      actor: { id: userRow.id, email: userRow.email, name: userRow.name },
      orgId: null,
      cancelSubscriptionFn,
    });
    if (!personalCancel.ok) {
      await db
        .insert(dbSchema.auditLogs)
        .values({
          actorId: null,
          action: "account.purge.billing_cancel_failed",
          meta: {
            targetUserId: userRow.id,
            subscriptionId: paidPersonalSub.id,
            reason: personalCancel.error,
          },
          at: now,
        })
        .catch(() => undefined);

      return {
        ok: false,
        code: "BILLING_CANCEL_FAILED",
        error:
          personalCancel.error ||
          "Could not cancel your active subscription with the billing provider. Your account has NOT been deleted so you are never billed as a ghost account.",
      };
    }
  }

  for (const team of teamsToDissolve) {
    if (!team.hasLiveSubscription) continue;
    const teamCancel = await cancelScopeSubscriptionBeforePurge({
      actor: { id: userRow.id, email: userRow.email, name: userRow.name },
      orgId: team.organizationId,
      cancelSubscriptionFn,
    });
    if (!teamCancel.ok) {
      return {
        ok: false,
        code: "BILLING_CANCEL_FAILED",
        error: `Could not cancel Team billing for “${team.organizationName}”: ${teamCancel.error}. Account deletion aborted so you are never billed after closure.`,
      };
    }
  }

  // 3. Collect teammates to notify if dissolving active teams, and clean non-dissolved memberships
  const dissolvedTeammates: Array<{ email: string; name: string | null; organizationName: string }> =
    [];
  if (teamsToDissolve.length > 0) {
    for (const team of teamsToDissolve) {
      if (team.otherMembersCount === 0) continue;
      const teammates = await db
        .select({
          email: dbSchema.users.email,
          name: dbSchema.users.name,
          userId: dbSchema.users.id,
        })
        .from(dbSchema.memberships)
        .innerJoin(dbSchema.users, eq(dbSchema.memberships.userId, dbSchema.users.id))
        .where(eq(dbSchema.memberships.orgId, team.organizationId));
      for (const mate of teammates) {
        if (mate.userId !== userRow.id) {
          dissolvedTeammates.push({
            email: mate.email,
            name: mate.name,
            organizationName: team.organizationName,
          });
        }
      }
    }
  }

  const userMemberships = await db
    .select()
    .from(dbSchema.memberships)
    .where(eq(dbSchema.memberships.userId, userRow.id));

  for (const membership of userMemberships) {
    if (dissolvedOrgIdSet.has(membership.orgId)) {
      continue;
    }

    const orgMembers = await db
      .select({
        userId: dbSchema.memberships.userId,
        role: dbSchema.memberships.role,
      })
      .from(dbSchema.memberships)
      .where(eq(dbSchema.memberships.orgId, membership.orgId));

    const survivingOwner = orgMembers.find(
      (m) => m.userId !== userRow.id && normalizeMembershipRole(m.role) === "owner",
    );

    if (survivingOwner) {
      await executeMemberDepartureSideEffects({
        organizationId: membership.orgId,
        departedUserId: userRow.id,
        actorUserId: userRow.id,
        now,
      });

      // Preserve shared Team projects so cascade-deleting the departing user never destroys team work
      const [teamWs] = await db
        .select({ id: dbSchema.workspaces.id })
        .from(dbSchema.workspaces)
        .where(eq(dbSchema.workspaces.organizationId, membership.orgId))
        .limit(1);
      const sharedSpaces = teamWs
        ? await db
            .select({ id: dbSchema.spaces.id })
            .from(dbSchema.spaces)
            .where(
              and(
                eq(dbSchema.spaces.workspaceId, teamWs.id),
                eq(dbSchema.spaces.visibility, "shared"),
              ),
            )
        : [];
      if (sharedSpaces.length > 0) {
        const sharedSpaceIds = sharedSpaces.map((s) => s.id);
        await db
          .update(dbSchema.projects)
          .set({
            ownerId: survivingOwner.userId,
            createdByUserId: null,
            updatedAt: now,
          })
          .where(
            and(
              eq(dbSchema.projects.orgId, membership.orgId),
              eq(dbSchema.projects.ownerId, userRow.id),
              inArray(dbSchema.projects.spaceId, sharedSpaceIds),
            ),
          );
      }
    }
  }

  // 4. Snapshot all owned personal projects, owned private team projects, and dissolved team projects
  // so R2 objects and published `/p/[slug]` caches are cleaned completely after DB purge.
  const dissolvedOrgIds = Array.from(dissolvedOrgIdSet);
  const [userOwnedProjects, dissolvedTeamProjects] = await Promise.all([
    db
      .select({
        id: dbSchema.projects.id,
        slug: dbSchema.projects.slug,
      })
      .from(dbSchema.projects)
      .where(eq(dbSchema.projects.ownerId, userRow.id)),
    dissolvedOrgIds.length > 0
      ? db
          .select({
            id: dbSchema.projects.id,
            slug: dbSchema.projects.slug,
          })
          .from(dbSchema.projects)
          .where(inArray(dbSchema.projects.orgId, dissolvedOrgIds))
      : Promise.resolve([]),
  ]);

  const projectMap = new Map<string, string | null>();
  for (const p of [...userOwnedProjects, ...dissolvedTeamProjects]) {
    projectMap.set(p.id, p.slug);
  }
  const allPurgedProjectIds = Array.from(projectMap.keys());
  const publishedSlugs = Array.from(projectMap.values()).filter(
    (slug): slug is string => Boolean(slug),
  );

  let r2Keys: string[] = [];
  if (allPurgedProjectIds.length > 0) {
    const [allAssets, allExports] = await Promise.all([
      db
        .select({ r2Key: dbSchema.assets.r2Key })
        .from(dbSchema.assets)
        .where(inArray(dbSchema.assets.projectId, allPurgedProjectIds)),
      db
        .select({ r2Key: dbSchema.exportsTable.r2Key })
        .from(dbSchema.exportsTable)
        .where(inArray(dbSchema.exportsTable.projectId, allPurgedProjectIds)),
    ]);

    r2Keys = [
      ...allAssets.map((a) => a.r2Key),
      ...allExports.map((e) => e.r2Key).filter((k): k is string => Boolean(k)),
    ];
  }

  const deletedEmail = userRow.email;
  const deletedName = userRow.name;

  await db.transaction(async (tx) => {
    if (dissolvedOrgIds.length > 0) {
      await tx
        .delete(dbSchema.organizations)
        .where(inArray(dbSchema.organizations.id, dissolvedOrgIds));
    }
    await tx.delete(dbSchema.sessions).where(eq(dbSchema.sessions.userId, userRow.id));
    await tx.delete(dbSchema.users).where(eq(dbSchema.users.id, userRow.id));
    await tx.insert(dbSchema.auditLogs).values({
      actorId: null,
      action: "account.purged",
      meta: {
        purgedUserId: userRow.id,
        projectsDeleted: allPurgedProjectIds.length,
        dissolvedOrganizations: dissolvedOrgIds.length,
        r2ObjectsScheduled: r2Keys.length,
      },
      at: now,
    });
  });

  if (r2Keys.length > 0) {
    await Promise.all(r2Keys.map((key) => deleteStoredObject(key).catch(() => undefined)));
  }

  for (const slug of publishedSlugs) {
    revalidatePublicProject(slug);
  }

  await sendAccountDeletedEmail({
    to: deletedEmail,
    name: deletedName,
  }).catch(() => undefined);

  for (const mate of dissolvedTeammates) {
    await sendTeamWorkspaceDissolvedEmail({
      to: mate.email,
      memberName: mate.name,
      organizationName: mate.organizationName,
    }).catch(() => undefined);
  }

  return { ok: true, purgedUserId: userRow.id };
}

export async function processScheduledAccountDeletions(now: Date = new Date()): Promise<{
  processed: number;
  purged: number;
  blocked: number;
  failed: number;
}> {
  const dueUsers = await db
    .select({ id: dbSchema.users.id })
    .from(dbSchema.users)
    .where(
      and(
        isNotNull(dbSchema.users.deletionScheduledFor),
        lte(dbSchema.users.deletionScheduledFor, now),
      ),
    )
    .limit(50);

  let purged = 0;
  let blocked = 0;
  let failed = 0;

  for (const row of dueUsers) {
    const res = await executeAccountPurge(row.id, { now });
    if (res.ok) {
      purged += 1;
    } else if (res.code === "SOLE_TEAM_OWNER") {
      blocked += 1;
    } else {
      failed += 1;
    }
  }

  return {
    processed: dueUsers.length,
    purged,
    blocked,
    failed,
  };
}

