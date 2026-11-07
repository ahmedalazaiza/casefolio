import { and, desc, eq, isNull, type PlanTier } from "@casefolio/db";
import {
  clampTeamsSeats,
  evaluateSubscriptionLifecycle,
  getWorkspaceQuotas,
  isSubscriptionGrantingAccess,
  type SubscriptionLifecycleEvaluation,
  type WorkspacePlanQuotas,
} from "@/lib/billing/plans";
import { db, dbSchema } from "@/lib/db";

export interface WorkspaceEntitlementState {
  workspaceId: string;
  kind: "personal" | "team";
  personalOwnerId: string | null;
  organizationId: string | null;
  plan: PlanTier;
  paidSeats: number;
  renewalQuantity: number | null;
  admissionCeiling: number;
  quotas: WorkspacePlanQuotas;
  lifecycle: SubscriptionLifecycleEvaluation;
  isFrozen: boolean;
  frozenReason: string | null;
  graceUsedAt: Date | null;
  graceExpiresAt: Date | null;
  keepPublicProjectId: string | null;
}

export async function ensurePersonalWorkspaceForUser(userId: string): Promise<{
  workspaceId: string;
  defaultSpaceId: string;
}> {
  const [existingWs] = await db
    .select({ id: dbSchema.workspaces.id })
    .from(dbSchema.workspaces)
    .where(eq(dbSchema.workspaces.personalOwnerId, userId))
    .limit(1);

  let workspaceId = existingWs?.id;

  if (!workspaceId) {
    const [userRow] = await db
      .select({ id: dbSchema.users.id, name: dbSchema.users.name })
      .from(dbSchema.users)
      .where(eq(dbSchema.users.id, userId))
      .limit(1);

    const wsName = `${userRow?.name?.trim() || "Personal"} · Personal`;
    await db
      .insert(dbSchema.workspaces)
      .values({
        kind: "personal",
        personalOwnerId: userId,
        organizationId: null,
        name: wsName,
        slug: `personal-${userId}`,
      })
      .onConflictDoNothing({ target: dbSchema.workspaces.personalOwnerId });

    const [createdWs] = await db
      .select({ id: dbSchema.workspaces.id })
      .from(dbSchema.workspaces)
      .where(eq(dbSchema.workspaces.personalOwnerId, userId))
      .limit(1);
    workspaceId = createdWs!.id;
  }

  const [existingSpace] = await db
    .select({ id: dbSchema.spaces.id })
    .from(dbSchema.spaces)
    .where(
      and(
        eq(dbSchema.spaces.workspaceId, workspaceId),
        eq(dbSchema.spaces.slug, "personal"),
      ),
    )
    .limit(1);

  if (existingSpace) {
    return { workspaceId, defaultSpaceId: existingSpace.id };
  }

  await db
    .insert(dbSchema.spaces)
    .values({
      workspaceId,
      name: "Personal Space",
      slug: "personal",
      visibility: "private",
      isDefault: true,
      controllerUserId: userId,
    })
    .onConflictDoNothing({
      target: [dbSchema.spaces.workspaceId, dbSchema.spaces.slug],
    });

  const [createdSpace] = await db
    .select({ id: dbSchema.spaces.id })
    .from(dbSchema.spaces)
    .where(
      and(
        eq(dbSchema.spaces.workspaceId, workspaceId),
        eq(dbSchema.spaces.slug, "personal"),
      ),
    )
    .limit(1);

  return { workspaceId, defaultSpaceId: createdSpace!.id };
}

export async function ensureTeamWorkspaceForOrganization(
  orgId: string,
  memberUserId?: string,
): Promise<{
  workspaceId: string;
  defaultSharedSpaceId: string | null;
  memberPrivateSpaceId: string | null;
}> {
  const [orgRow] = await db
    .select()
    .from(dbSchema.organizations)
    .where(eq(dbSchema.organizations.id, orgId))
    .limit(1);

  if (!orgRow) {
    throw new Error("Organization not found.");
  }

  await db
    .insert(dbSchema.workspaces)
    .values({
      kind: "team",
      personalOwnerId: null,
      organizationId: orgId,
      name: orgRow.name,
      slug: `team-${orgId}`,
    })
    .onConflictDoNothing({ target: dbSchema.workspaces.organizationId });

  const [ws] = await db
    .select({ id: dbSchema.workspaces.id })
    .from(dbSchema.workspaces)
    .where(eq(dbSchema.workspaces.organizationId, orgId))
    .limit(1);

  const workspaceId = ws!.id;

  const orgMembers = await db
    .select({ userId: dbSchema.memberships.userId, role: dbSchema.memberships.role })
    .from(dbSchema.memberships)
    .where(eq(dbSchema.memberships.orgId, orgId));

  const ownerMember = orgMembers.find((m) => m.role === "owner") ?? orgMembers[0];
  let defaultSharedSpaceId: string | null = null;

  if (ownerMember) {
    await db
      .insert(dbSchema.spaces)
      .values({
        workspaceId,
        name: `${orgRow.name} Shared`,
        slug: "shared-studio",
        visibility: "shared",
        isDefault: true,
        controllerUserId: ownerMember.userId,
      })
      .onConflictDoNothing({
        target: [dbSchema.spaces.workspaceId, dbSchema.spaces.slug],
      });

    const [sharedSpace] = await db
      .select({ id: dbSchema.spaces.id })
      .from(dbSchema.spaces)
      .where(
        and(
          eq(dbSchema.spaces.workspaceId, workspaceId),
          eq(dbSchema.spaces.slug, "shared-studio"),
        ),
      )
      .limit(1);
    defaultSharedSpaceId = sharedSpace?.id ?? null;
  }

  let memberPrivateSpaceId: string | null = null;
  if (memberUserId && orgMembers.some((m) => m.userId === memberUserId)) {
    const privateSlug = `private-${memberUserId}`;
    await db
      .insert(dbSchema.spaces)
      .values({
        workspaceId,
        name: "My Private Space",
        slug: privateSlug,
        visibility: "private",
        isDefault: true,
        controllerUserId: memberUserId,
      })
      .onConflictDoNothing({
        target: [dbSchema.spaces.workspaceId, dbSchema.spaces.slug],
      });

    const [privSpace] = await db
      .select({ id: dbSchema.spaces.id })
      .from(dbSchema.spaces)
      .where(
        and(
          eq(dbSchema.spaces.workspaceId, workspaceId),
          eq(dbSchema.spaces.slug, privateSlug),
        ),
      )
      .limit(1);
    memberPrivateSpaceId = privSpace?.id ?? null;
  }

  return {
    workspaceId,
    defaultSharedSpaceId,
    memberPrivateSpaceId,
  };
}

export async function resolveWorkspaceEntitlementState(
  workspaceId: string,
  now: Date = new Date(),
): Promise<WorkspaceEntitlementState | null> {
  const [ws] = await db
    .select()
    .from(dbSchema.workspaces)
    .where(eq(dbSchema.workspaces.id, workspaceId))
    .limit(1);

  if (!ws) {
    return null;
  }

  let subRow: typeof dbSchema.subscriptions.$inferSelect | undefined;

  if (ws.kind === "team" && ws.organizationId) {
    const [teamSub] = await db
      .select()
      .from(dbSchema.subscriptions)
      .where(eq(dbSchema.subscriptions.orgId, ws.organizationId))
      .orderBy(desc(dbSchema.subscriptions.updatedAt))
      .limit(1);
    subRow = teamSub;
  } else if (ws.kind === "personal" && ws.personalOwnerId) {
    const [personalSub] = await db
      .select()
      .from(dbSchema.subscriptions)
      .where(
        and(
          eq(dbSchema.subscriptions.userId, ws.personalOwnerId),
          isNull(dbSchema.subscriptions.orgId),
        ),
      )
      .orderBy(desc(dbSchema.subscriptions.updatedAt))
      .limit(1);
    subRow = personalSub;
  }

  let effectivePlan: PlanTier = "free";
  let paidSeats = 1;
  let renewalQuantity: number | null = null;
  let lifecycle = evaluateSubscriptionLifecycle({
    status: "canceled",
    now,
  });

  if (subRow) {
    lifecycle = evaluateSubscriptionLifecycle({
      status: subRow.status,
      currentPeriodEnd: subRow.currentPeriodEnd,
      pastDueSince: subRow.pastDueSince,
      scheduledChangeAction: subRow.scheduledChangeAction,
      now,
    });

    if (lifecycle.grantsPaidAccess) {
      effectivePlan =
        ws.kind === "team"
          ? subRow.plan === "team"
            ? "team"
            : "free"
          : subRow.plan === "pro"
            ? "pro"
            : "free";
    }

    if (effectivePlan === "team") {
      paidSeats = clampTeamsSeats(subRow.currentPaidCapacity);
      renewalQuantity =
        typeof subRow.renewalQuantity === "number"
          ? clampTeamsSeats(subRow.renewalQuantity)
          : null;
    }
  } else if (ws.kind === "personal" && ws.personalOwnerId) {
    // Support seeded/test accounts where `users.plan === "pro"` without a subscriptions row yet
    const [userRow] = await db
      .select({ plan: dbSchema.users.plan })
      .from(dbSchema.users)
      .where(eq(dbSchema.users.id, ws.personalOwnerId))
      .limit(1);

    if (userRow?.plan === "pro") {
      effectivePlan = "pro";
      lifecycle = evaluateSubscriptionLifecycle({ status: "active", now });
    }
  }

  const teamCanceledOrExpired = Boolean(
    ws.kind === "team" && subRow && !lifecycle.grantsPaidAccess && !lifecycle.isPastDueReadOnly,
  );
  const isFrozen =
    Boolean(ws.frozenAt) || lifecycle.isPastDueReadOnly || teamCanceledOrExpired;
  const frozenReason =
    ws.frozenReason ??
    (lifecycle.isPastDueReadOnly
      ? "past_due_expired"
      : teamCanceledOrExpired
        ? "subscription_ended"
        : null);

  const admissionCeiling =
    effectivePlan === "team"
      ? renewalQuantity !== null
        ? Math.min(paidSeats, renewalQuantity)
        : paidSeats
      : 1;

  return {
    workspaceId: ws.id,
    kind: ws.kind,
    personalOwnerId: ws.personalOwnerId,
    organizationId: ws.organizationId,
    plan: effectivePlan,
    paidSeats,
    renewalQuantity,
    admissionCeiling,
    quotas: getWorkspaceQuotas(effectivePlan, paidSeats),
    lifecycle,
    isFrozen,
    frozenReason,
    graceUsedAt: ws.graceUsedAt,
    graceExpiresAt: ws.graceExpiresAt,
    keepPublicProjectId: ws.keepPublicProjectId,
  };
}

/**
 * Resolves the authoritative server-side PERSONAL workspace plan for `userId`.
 * Spec §4, §7 & §12: Teams membership NEVER grants Pro in a personal workspace (zero user-global union).
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
    .where(
      and(
        eq(dbSchema.subscriptions.userId, userId),
        isNull(dbSchema.subscriptions.orgId),
      ),
    )
    .orderBy(desc(dbSchema.subscriptions.updatedAt))
    .limit(1);

  let resolvedPersonalPlan: PlanTier = userRow.plan === "pro" ? "pro" : "free";

  if (userSub) {
    const active = isSubscriptionGrantingAccess(
      userSub.status,
      userSub.currentPeriodEnd,
      now,
      userSub.pastDueSince,
    );
    resolvedPersonalPlan = active && userSub.plan === "pro" ? "pro" : "free";

    if (resolvedPersonalPlan !== userRow.plan) {
      await db
        .update(dbSchema.users)
        .set({ plan: resolvedPersonalPlan, updatedAt: now })
        .where(eq(dbSchema.users.id, userId));
    }
  } else if (userRow.plan === "team") {
    // Clean up any legacy unioned `team` value on `users.plan`
    resolvedPersonalPlan = "free";
    await db
      .update(dbSchema.users)
      .set({ plan: "free", updatedAt: now })
      .where(eq(dbSchema.users.id, userId));
  }

  return resolvedPersonalPlan;
}

/**
 * Resolves the authoritative server-side plan strictly for an ORGANIZATION's team workspace.
 * Never inherits or unions from the owner's personal Pro plan.
 */
export async function resolveEffectivePlanForOrganization(
  orgId: string,
  _fallbackActorUserId?: string,
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
    orgSub.plan === "team" &&
    isSubscriptionGrantingAccess(
      orgSub.status,
      orgSub.currentPeriodEnd,
      now,
      orgSub.pastDueSince,
    )
  ) {
    return "team";
  }

  return "free";
}

/**
 * Resolves the effective plan for whichever workspace context (`activeOrgId` vs personal) is active.
 */
export async function resolveActiveContextPlan(
  userId: string,
  activeOrgId: string | null | undefined,
  now: Date = new Date(),
): Promise<PlanTier> {
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
      return resolveEffectivePlanForOrganization(activeOrgId, undefined, now);
    }
  }

  return resolveEffectivePlanForUser(userId, now);
}
