import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lt,
  notLike,
  normalizeMembershipRole,
} from "@casefolio/db";
import { env } from "@/env";
import {
  BILLING_FROZEN_REASONS,
  evaluateSubscriptionLifecycle,
  getPastDueDaysRemaining,
  PAST_DUE_GRACE_DAYS,
} from "@/lib/billing/plans";
import { getPaddleApiBaseUrl, isRealPaddleApiKeyConfigured } from "@/lib/billing/server-config";
import {
  applyPersonalDowngradePublicationRules,
  freezeTeamWorkspaceSnapshotsTx,
  processValidatedPaddleWebhook,
} from "@/lib/billing/webhooks";
import { db, dbSchema } from "@/lib/db";
import {
  ensurePersonalWorkspaceForUser,
  ensureTeamWorkspaceForOrganization,
} from "@/lib/entitlements/server";
import { notifyPaymentIssue } from "@/lib/notifications/service";
import { revalidatePublicProject } from "@/lib/projects/public-cache";

export type ReconcileOutcome =
  | { status: "synced"; paddleStatus: string }
  | { status: "skipped"; reason: "paddle_not_configured" | "simulated_subscription" | "no_subscription_id" }
  | { status: "error"; reason: string };

/**
 * Pulls the authoritative subscription state from Paddle and replays it through the exact same
 * pipeline as a webhook (`subscription.updated`). It repairs missed / dropped notifications: a
 * lost `subscription.canceled` would otherwise leave a customer on a paid plan forever, and a lost
 * `subscription.updated` could leave a paying customer on stale seat counts.
 *
 * The synthetic event id is hour-bucketed, so concurrent callers collapse to one application.
 */
export async function reconcileSubscriptionWithPaddle(
  paddleSubscriptionId: string | null | undefined,
  now: Date = new Date(),
  fetchImpl: typeof fetch = fetch,
): Promise<ReconcileOutcome> {
  if (!paddleSubscriptionId) return { status: "skipped", reason: "no_subscription_id" };
  if (paddleSubscriptionId.startsWith("sub_sdbx_")) {
    return { status: "skipped", reason: "simulated_subscription" };
  }
  if (!isRealPaddleApiKeyConfigured()) return { status: "skipped", reason: "paddle_not_configured" };

  let response: Response;
  try {
    response = await fetchImpl(
      `${getPaddleApiBaseUrl()}/subscriptions/${encodeURIComponent(paddleSubscriptionId)}`,
      {
        headers: { Authorization: `Bearer ${env.PADDLE_API_KEY}` },
        signal: AbortSignal.timeout(8_000),
      },
    );
  } catch {
    return { status: "error", reason: "paddle_unreachable" };
  }

  if (!response.ok) return { status: "error", reason: `paddle_http_${response.status}` };

  const json = (await response.json().catch(() => null)) as { data?: Record<string, unknown> } | null;
  const data = json?.data;
  if (!data || typeof data !== "object") return { status: "error", reason: "paddle_invalid_payload" };

  const paddleStatus = typeof data.status === "string" ? data.status : "unknown";
  const hourBucket = Math.floor(now.getTime() / 3_600_000);

  await processValidatedPaddleWebhook(
    {
      event_id: `reconcile_${paddleSubscriptionId}_${hourBucket}`,
      event_type: paddleStatus === "canceled" ? "subscription.canceled" : "subscription.updated",
      occurred_at: now.toISOString(),
      data,
    },
    now,
  );

  return { status: "synced", paddleStatus };
}

/** Live subscriptions whose paid-through date has passed without Paddle telling us what happened. */
export async function reconcileStaleSubscriptions(
  now: Date = new Date(),
  options: { limit?: number; staleAfterHours?: number } = {},
): Promise<{ checked: number; synced: number; errors: number }> {
  const staleBefore = new Date(now.getTime() - (options.staleAfterHours ?? 24) * 3_600_000);

  const candidates = await db
    .select({ paddleSubscriptionId: dbSchema.subscriptions.paddleSubscriptionId })
    .from(dbSchema.subscriptions)
    .where(
      and(
        isNotNull(dbSchema.subscriptions.paddleSubscriptionId),
        notLike(dbSchema.subscriptions.paddleSubscriptionId, "sub_sdbx_%"),
        inArray(dbSchema.subscriptions.status, ["active", "trialing", "past_due", "cancel_at_period_end"]),
        lt(dbSchema.subscriptions.currentPeriodEnd, staleBefore),
      ),
    )
    .orderBy(asc(dbSchema.subscriptions.currentPeriodEnd), desc(dbSchema.subscriptions.updatedAt))
    .limit(options.limit ?? 50);

  let synced = 0;
  let errors = 0;
  for (const candidate of candidates) {
    const outcome = await reconcileSubscriptionWithPaddle(candidate.paddleSubscriptionId, now);
    if (outcome.status === "synced") synced += 1;
    if (outcome.status === "error") errors += 1;
  }

  return { checked: candidates.length, synced, errors };
}

export async function getSubscriptionPaddleId(subscriptionId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: dbSchema.subscriptions.paddleSubscriptionId })
    .from(dbSchema.subscriptions)
    .where(eq(dbSchema.subscriptions.id, subscriptionId))
    .limit(1);
  return row?.id ?? null;
}

async function hasSentNoticeKey(key: string, now: Date): Promise<boolean> {
  const [existing] = await db
    .select({ id: dbSchema.verifications.id })
    .from(dbSchema.verifications)
    .where(
      and(
        eq(dbSchema.verifications.identifier, key),
        gt(dbSchema.verifications.expiresAt, now),
      ),
    )
    .limit(1);
  return Boolean(existing);
}

async function recordNoticeKey(key: string, now: Date, ttlDays = 20): Promise<void> {
  await db
    .delete(dbSchema.verifications)
    .where(eq(dbSchema.verifications.identifier, key))
    .catch(() => undefined);
  await db
    .insert(dbSchema.verifications)
    .values({
      identifier: key,
      value: "sent",
      expiresAt: new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    })
    .catch(() => undefined);
}

async function resolveSubscriptionOwners(sub: typeof dbSchema.subscriptions.$inferSelect): Promise<{
  ownerIds: string[];
  workspaceName: string | null;
  isTeam: boolean;
}> {
  if (sub.orgId) {
    const [[org], memberRows] = await Promise.all([
      db
        .select({ name: dbSchema.organizations.name })
        .from(dbSchema.organizations)
        .where(eq(dbSchema.organizations.id, sub.orgId))
        .limit(1),
      db
        .select({ userId: dbSchema.memberships.userId, role: dbSchema.memberships.role })
        .from(dbSchema.memberships)
        .where(eq(dbSchema.memberships.orgId, sub.orgId)),
    ]);
    return {
      ownerIds: memberRows
        .filter((m) => normalizeMembershipRole(m.role) === "owner")
        .map((m) => m.userId),
      workspaceName: org?.name ?? null,
      isTeam: true,
    };
  }
  return {
    ownerIds: sub.userId ? [sub.userId] : [],
    workspaceName: null,
    isTeam: false,
  };
}

async function enforceWorkspaceGraceOrCancelLock(args: {
  sub: typeof dbSchema.subscriptions.$inferSelect;
  isPastDueExpired: boolean;
  now: Date;
}): Promise<number> {
  const { sub, isPastDueExpired, now } = args;

  if (sub.orgId) {
    const ensured = await ensureTeamWorkspaceForOrganization(sub.orgId);
    const frozenSlugs = await db.transaction(async (tx) => {
      await tx
        .update(dbSchema.organizations)
        .set({ seats: 0 })
        .where(eq(dbSchema.organizations.id, sub.orgId!));

      await tx
        .update(dbSchema.workspaces)
        .set({
          maxSeats: 1,
          maxCaseStudies: 1,
          customDomainEnabled: false,
          watermarkEnabled: true,
          frozenAt: now,
          frozenReason: isPastDueExpired
            ? BILLING_FROZEN_REASONS.PAST_DUE_EXPIRED
            : BILLING_FROZEN_REASONS.TEAM_ENDED,
          updatedAt: now,
        })
        .where(eq(dbSchema.workspaces.id, ensured.workspaceId));

      return freezeTeamWorkspaceSnapshotsTx(tx, ensured.workspaceId, now);
    });

    for (const s of frozenSlugs) {
      revalidatePublicProject(s);
    }

    const [teamCountRow] = await db
      .select({ total: count() })
      .from(dbSchema.projects)
      .where(
        and(
          eq(dbSchema.projects.workspaceId, ensured.workspaceId),
          isNull(dbSchema.projects.archivedAt),
        ),
      );
    return Number(teamCountRow?.total ?? 0);
  }

  if (sub.userId) {
    await db
      .update(dbSchema.users)
      .set({ plan: "free", updatedAt: now })
      .where(eq(dbSchema.users.id, sub.userId));

    const ensured = await ensurePersonalWorkspaceForUser(sub.userId);
    await applyPersonalDowngradePublicationRules(
      ensured.workspaceId,
      now,
      isPastDueExpired ? "renewal_grace_expired" : "downgraded_pro_to_free_select_one",
    );

    const [countRow] = await db
      .select({ total: count() })
      .from(dbSchema.projects)
      .where(
        and(
          eq(dbSchema.projects.workspaceId, ensured.workspaceId),
          isNull(dbSchema.projects.archivedAt),
        ),
      );
    return Math.max(0, Number(countRow?.total ?? 0) - 1);
  }

  return 0;
}

/**
 * Evaluates 10-day `past_due` grace countdown notifications (`Day 0`, `Day 5`, `Day 9`),
 * downgrades + locks excess projects on `Day 10+`, and handles `cancel_at_period_end`
 * expiry warnings & transitions across both live and sandbox subscriptions.
 */
export async function processRenewalGraceAndExpirations(now: Date = new Date()): Promise<{
  pastDueChecked: number;
  warningsSent: number;
  expiredLocked: number;
  scheduledEnded: number;
}> {
  const subs = await db
    .select()
    .from(dbSchema.subscriptions)
    .where(inArray(dbSchema.subscriptions.status, ["past_due", "cancel_at_period_end"]))
    .limit(200);

  let warningsSent = 0;
  let expiredLocked = 0;
  let scheduledEnded = 0;

  for (const sub of subs) {
    if (sub.status === "past_due") {
      const anchor = sub.pastDueSince ?? sub.currentPeriodEnd ?? sub.updatedAt ?? now;
      const lifecycle = evaluateSubscriptionLifecycle({
        status: "past_due",
        currentPeriodEnd: sub.currentPeriodEnd,
        pastDueSince: anchor,
        now,
      });
      const anchorIso = anchor.toISOString();
      const { ownerIds, workspaceName } = await resolveSubscriptionOwners(sub);

      if (lifecycle.isPastDueReadOnly) {
        const lockKey = `renewal_notice:${sub.id}:${anchorIso}:day_10_locked`;
        if (!(await hasSentNoticeKey(lockKey, now))) {
          const lockedCount = await enforceWorkspaceGraceOrCancelLock({
            sub,
            isPastDueExpired: true,
            now,
          });
          for (const ownerId of ownerIds) {
            await notifyPaymentIssue({
              userId: ownerId,
              plan: sub.plan,
              daysRemaining: 0,
              graceEndsAtIso: lifecycle.pastDueEndsAt?.toISOString() ?? null,
              workspaceName,
              stage: "day_10_locked",
              lockedCount,
            }).catch(() => undefined);
          }
          await recordNoticeKey(lockKey, now, 30);
          expiredLocked += 1;
        }
        continue;
      }

      const daysRemaining = getPastDueDaysRemaining(lifecycle.pastDueEndsAt, now);
      const stage: "day_0_failed" | "day_5_midpoint" | "day_9_final" =
        daysRemaining <= 1
          ? "day_9_final"
          : daysRemaining <= 5
            ? "day_5_midpoint"
            : "day_0_failed";
      const noticeKey = `renewal_notice:${sub.id}:${anchorIso}:${stage}`;

      if (!(await hasSentNoticeKey(noticeKey, now))) {
        for (const ownerId of ownerIds) {
          await notifyPaymentIssue({
            userId: ownerId,
            plan: sub.plan,
            daysRemaining,
            graceEndsAtIso: lifecycle.pastDueEndsAt?.toISOString() ?? null,
            workspaceName,
            stage,
          }).catch(() => undefined);
        }
        await recordNoticeKey(noticeKey, now, 15);
        warningsSent += 1;
      }
      continue;
    }

    if (sub.status === "cancel_at_period_end" && sub.currentPeriodEnd) {
      const periodEnd = new Date(sub.currentPeriodEnd);
      const { ownerIds, workspaceName } = await resolveSubscriptionOwners(sub);

      if (periodEnd.getTime() <= now.getTime()) {
        const endKey = `cancel_ended_locked:${sub.id}:${periodEnd.toISOString()}`;
        await db
          .update(dbSchema.subscriptions)
          .set({
            status: "canceled",
            scheduledChangeAction: null,
            updatedAt: now,
          })
          .where(eq(dbSchema.subscriptions.id, sub.id));

        if (!(await hasSentNoticeKey(endKey, now))) {
          const lockedCount = await enforceWorkspaceGraceOrCancelLock({
            sub,
            isPastDueExpired: false,
            now,
          });
          for (const ownerId of ownerIds) {
            await notifyPaymentIssue({
              userId: ownerId,
              plan: sub.plan,
              daysRemaining: 0,
              graceEndsAtIso: periodEnd.toISOString(),
              workspaceName,
              stage: "day_10_locked",
              lockedCount,
            }).catch(() => undefined);
          }
          await recordNoticeKey(endKey, now, 30);
          scheduledEnded += 1;
        }
      } else if (
        periodEnd.getTime() - now.getTime() <=
        PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000
      ) {
        const daysRemaining = getPastDueDaysRemaining(periodEnd, now);
        const warnKey = `cancel_notice:${sub.id}:${periodEnd.toISOString()}:ending_10d`;
        if (!(await hasSentNoticeKey(warnKey, now))) {
          for (const ownerId of ownerIds) {
            await notifyPaymentIssue({
              userId: ownerId,
              plan: sub.plan,
              daysRemaining,
              graceEndsAtIso: periodEnd.toISOString(),
              workspaceName,
              stage: "ending_soon",
            }).catch(() => undefined);
          }
          await recordNoticeKey(warnKey, now, 15);
          warningsSent += 1;
        }
      }
    }
  }

  return {
    pastDueChecked: subs.length,
    warningsSent,
    expiredLocked,
    scheduledEnded,
  };
}
