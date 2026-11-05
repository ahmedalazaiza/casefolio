import { and, desc, eq, inArray, type PlanTier } from "@casefolio/db";
import { isSubscriptionGrantingAccess } from "@/lib/billing/plans";
import { db, dbSchema } from "@/lib/db";

const PLAN_RANK: Record<PlanTier, number> = {
  free: 0,
  pro: 1,
  team: 2,
};

/**
 * Resolves the authoritative server-side plan for `userId` from PostgreSQL,
 * reconciling `subscriptions` lifecycle status + `currentPeriodEnd` against `now`.
 * Never trusts client-supplied plan flags (`02-RULES.md §5`).
 */
export async function resolveEffectivePlanForUser(
  userId: string,
  now: Date = new Date(),
): Promise<PlanTier> {
  const [userRow] = await db
    .select({ id: dbSchema.users.id, plan: dbSchema.users.plan })
    .from(dbSchema.users)
    .where(eq(dbSchema.users.id, userId))
    .limit(1);

  if (!userRow) {
    return "free";
  }

  const [userSub] = await db
    .select()
    .from(dbSchema.subscriptions)
    .where(eq(dbSchema.subscriptions.userId, userId))
    .orderBy(desc(dbSchema.subscriptions.updatedAt))
    .limit(1);

  let resolvedUserPlan: PlanTier = userRow.plan;

  if (userSub) {
    const active = isSubscriptionGrantingAccess(
      userSub.status,
      userSub.currentPeriodEnd,
      now,
    );
    resolvedUserPlan = active ? userSub.plan : "free";

    if (resolvedUserPlan !== userRow.plan) {
      await db
        .update(dbSchema.users)
        .set({ plan: resolvedUserPlan, updatedAt: now })
        .where(eq(dbSchema.users.id, userId));
    }
  }

  // Also check if the user belongs to an organization with an active Team subscription
  const orgMemberships = await db
    .select({ orgId: dbSchema.memberships.orgId })
    .from(dbSchema.memberships)
    .where(eq(dbSchema.memberships.userId, userId));

  if (orgMemberships.length > 0) {
    const orgIds = orgMemberships.map((m) => m.orgId);
    const orgSubs = await db
      .select()
      .from(dbSchema.subscriptions)
      .where(inArray(dbSchema.subscriptions.orgId, orgIds))
      .orderBy(desc(dbSchema.subscriptions.updatedAt));

    for (const orgSub of orgSubs) {
      if (
        isSubscriptionGrantingAccess(orgSub.status, orgSub.currentPeriodEnd, now) &&
        PLAN_RANK[orgSub.plan] > PLAN_RANK[resolvedUserPlan]
      ) {
        resolvedUserPlan = orgSub.plan;
      }
    }
  }

  return resolvedUserPlan;
}

export async function resolveEffectivePlanForOrganization(
  orgId: string,
  fallbackActorUserId?: string,
  now: Date = new Date(),
): Promise<PlanTier> {
  const [orgSub] = await db
    .select()
    .from(dbSchema.subscriptions)
    .where(eq(dbSchema.subscriptions.orgId, orgId))
    .orderBy(desc(dbSchema.subscriptions.updatedAt))
    .limit(1);

  if (
    orgSub &&
    isSubscriptionGrantingAccess(orgSub.status, orgSub.currentPeriodEnd, now)
  ) {
    return orgSub.plan;
  }

  // Check organization owner's plan as studio billing owner
  const [ownerMembership] = await db
    .select({ userId: dbSchema.memberships.userId })
    .from(dbSchema.memberships)
    .where(
      and(
        eq(dbSchema.memberships.orgId, orgId),
        eq(dbSchema.memberships.role, "owner"),
      ),
    )
    .limit(1);

  if (ownerMembership) {
    return resolveEffectivePlanForUser(ownerMembership.userId, now);
  }

  if (fallbackActorUserId) {
    return resolveEffectivePlanForUser(fallbackActorUserId, now);
  }

  return "free";
}
