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
} from "@/lib/email";
import { executeMemberDepartureSideEffects } from "@/lib/entitlements/team-invitations";
import { revalidatePublicProject } from "@/lib/projects/public-cache";
import { sanitizeErrorForLogging } from "@/lib/security/redact";
import { deleteStoredObject } from "@/lib/storage/r2";

export const ACCOUNT_DELETION_GRACE_DAYS = 7;
export const ACCOUNT_DELETION_GRACE_MS = ACCOUNT_DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000;
const BLOCKED_NOTICE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export type SoleOwnerBlockCheck =
  | { blocked: false }
  | {
      blocked: true;
      organizationId: string;
      organizationName: string;
      error: string;
    };

export async function checkSoleOwnerDeletionBlock(
  userId: string,
): Promise<SoleOwnerBlockCheck> {
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
    const hasOtherMembers = orgMembers.some((m) => m.userId !== userId);

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

    if (!hasOtherOwner && (hasOtherMembers || Boolean(liveTeamSub))) {
      return {
        blocked: true,
        organizationId: membership.orgId,
        organizationName: membership.orgName,
        error:
          "You are the sole Owner of an active Team workspace. Transfer workspace ownership or cancel and dissolve the Team workspace before deleting your account.",
      };
    }
  }

  return { blocked: false };
}

export type ExecuteAccountPurgeResult =
  | { ok: true; purgedUserId: string }
  | {
      ok: false;
      code: "NOT_FOUND" | "SOLE_TEAM_OWNER" | "BILLING_CANCEL_FAILED";
      error: string;
    };

export async function executeAccountPurge(
  userId: string,
  options?: {
    now?: Date;
    cancelSubscriptionFn?: typeof cancelUserSubscription;
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

  // 1. Re-verify sole Team Owner invariant before mutating anything
  const ownerBlock = await checkSoleOwnerDeletionBlock(userRow.id);
  if (ownerBlock.blocked) {
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
        value: ownerBlock.organizationId,
        expiresAt: new Date(now.getTime() + BLOCKED_NOTICE_COOLDOWN_MS),
        createdAt: now,
        updatedAt: now,
      });
      await sendAccountDeletionBlockedEmail({
        to: userRow.email,
        name: userRow.name,
        organizationName: ownerBlock.organizationName,
      }).catch(() => undefined);
    }

    return {
      ok: false,
      code: "SOLE_TEAM_OWNER",
      error: ownerBlock.error,
    };
  }

  // 2. Cancel active paid personal subscription BEFORE touching any projects, storage, or user rows (`B1`)
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
    let cancelRes: Awaited<ReturnType<typeof cancelUserSubscription>>;
    try {
      cancelRes = await cancelSubscriptionFn(
        { id: userRow.id, email: userRow.email, name: userRow.name },
        { reason: "other", feedback: "Account deleted by user", immediate: true },
        { suppressEmail: true },
      );
    } catch (error) {
      await db
        .insert(dbSchema.auditLogs)
        .values({
          actorId: null,
          action: "account.purge.billing_cancel_failed",
          meta: {
            targetUserId: userRow.id,
            subscriptionId: paidPersonalSub.id,
            reason: String(sanitizeErrorForLogging(error)).slice(0, 240),
          },
          at: now,
        })
        .catch(() => undefined);

      return {
        ok: false,
        code: "BILLING_CANCEL_FAILED",
        error:
          "Could not cancel your active subscription with the billing provider. Your account has NOT been deleted so you are never billed as a ghost account.",
      };
    }

    if (!cancelRes.ok) {
      await db
        .insert(dbSchema.auditLogs)
        .values({
          actorId: null,
          action: "account.purge.billing_cancel_failed",
          meta: {
            targetUserId: userRow.id,
            subscriptionId: paidPersonalSub.id,
            reason: cancelRes.error,
          },
          at: now,
        })
        .catch(() => undefined);

      return {
        ok: false,
        code: "BILLING_CANCEL_FAILED",
        error:
          cancelRes.error ||
          "Could not cancel your active subscription with the billing provider. Account deletion aborted.",
      };
    }
  }

  // 3. Clean departure side effects for multi-owner / member team memberships
  const userMemberships = await db
    .select()
    .from(dbSchema.memberships)
    .where(eq(dbSchema.memberships.userId, userRow.id));

  for (const membership of userMemberships) {
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

      await db
        .update(dbSchema.projects)
        .set({ ownerId: survivingOwner.userId, updatedAt: now })
        .where(
          and(
            eq(dbSchema.projects.orgId, membership.orgId),
            eq(dbSchema.projects.ownerId, userRow.id),
          ),
        );
    }
  }

  // 4. Snapshot personal R2 keys and published slugs prior to transactional cascade delete
  const personalProjects = await db
    .select({
      id: dbSchema.projects.id,
      slug: dbSchema.projects.slug,
    })
    .from(dbSchema.projects)
    .where(and(eq(dbSchema.projects.ownerId, userRow.id), isNull(dbSchema.projects.orgId)));

  const publishedSlugs = personalProjects
    .map((p) => p.slug)
    .filter((slug): slug is string => Boolean(slug));

  let r2Keys: string[] = [];
  if (personalProjects.length > 0) {
    const personalIds = personalProjects.map((p) => p.id);
    const [personalAssets, personalExports] = await Promise.all([
      db
        .select({ r2Key: dbSchema.assets.r2Key })
        .from(dbSchema.assets)
        .where(inArray(dbSchema.assets.projectId, personalIds)),
      db
        .select({ r2Key: dbSchema.exportsTable.r2Key })
        .from(dbSchema.exportsTable)
        .where(inArray(dbSchema.exportsTable.projectId, personalIds)),
    ]);

    r2Keys = [
      ...personalAssets.map((a) => a.r2Key),
      ...personalExports.map((e) => e.r2Key).filter((k): k is string => Boolean(k)),
    ];
  }

  const deletedEmail = userRow.email;
  const deletedName = userRow.name;

  await db.transaction(async (tx) => {
    await tx.delete(dbSchema.users).where(eq(dbSchema.users.id, userRow.id));
    await tx.insert(dbSchema.auditLogs).values({
      actorId: null,
      action: "account.purged",
      meta: {
        purgedUserId: userRow.id,
        personalProjectsDeleted: personalProjects.length,
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
