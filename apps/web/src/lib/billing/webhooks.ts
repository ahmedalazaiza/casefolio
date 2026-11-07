import { and, desc, eq, inArray, isNull, ne, type PlanTier } from "@casefolio/db";
import { z } from "zod";
import { env } from "@/env";
import { trackServerProductEvent } from "@/lib/analytics/posthog";
import {
  evaluateSubscriptionLifecycle,
  PLAN_CATALOG_VERSION,
  TEAMS_MAX_SELF_SERVE_SEATS,
  TEAMS_MIN_SEATS,
  type BillingInterval,
  type PaidPlanTier,
  type SubscriptionLifecycleStatus,
} from "@/lib/billing/plans";
import { resolvePlanFromServerPriceId } from "@/lib/billing/server-config";
import { verifyPaddleWebhookSignature } from "@/lib/billing/signature";
import { db, dbSchema } from "@/lib/db";
import {
  ensurePersonalWorkspaceForUser,
  ensureTeamWorkspaceForOrganization,
} from "@/lib/entitlements/server";
import { notifyPaymentIssue } from "@/lib/notifications/service";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const paddleWebhookEnvelopeSchema = z.object({
  event_id: z.string().min(3).max(200),
  event_type: z.string().min(3).max(120),
  occurred_at: z.string().optional(),
  data: z.record(z.unknown()),
});

export type PaddleWebhookEnvelope = z.infer<typeof paddleWebhookEnvelopeSchema>;

export type ProcessPaddleWebhookResult =
  | {
      ok: true;
      eventId: string;
      eventType: string;
      deduplicated: boolean;
      outOfOrderIgnored?: boolean;
      subscriptionId: string | null;
      effectivePlan: PlanTier | null;
      lifecycleStatus: SubscriptionLifecycleStatus | null;
      currentPaidCapacity?: number;
      renewalQuantity?: number | null;
    }
  | {
      ok: false;
      httpStatus: 400 | 401;
      code:
        | "MISSING_SIGNATURE"
        | "MALFORMED_SIGNATURE"
        | "TIMESTAMP_EXPIRED"
        | "INVALID_SIGNATURE"
        | "INVALID_JSON"
        | "VALIDATION_ERROR";
      error: string;
    };

interface ExtractedPaddleData {
  paddleSubscriptionId: string | null;
  paddleCustomerId: string | null;
  customUserId: string | null;
  customOrgId: string | null;
  customOperationId: string | null;
  prorationBillingMode: string | null;
  plan: PaidPlanTier | null;
  interval: BillingInterval;
  seats: number | null;
  lifecycleStatus: SubscriptionLifecycleStatus;
  scheduledChangeAction: string | null;
  currentPeriodEnd: Date | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function parseIsoDate(value: unknown): Date | null {
  const str = asNonEmptyString(value);
  if (!str) return null;
  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function clampTeamSeats(rawSeats: number | null | undefined): number {
  if (typeof rawSeats !== "number" || !Number.isFinite(rawSeats)) {
    return TEAMS_MIN_SEATS;
  }
  return Math.max(
    TEAMS_MIN_SEATS,
    Math.min(TEAMS_MAX_SELF_SERVE_SEATS, Math.floor(rawSeats)),
  );
}

function extractPaddleEventDetails(
  eventType: string,
  data: Record<string, unknown>,
): ExtractedPaddleData {
  const customData = asRecord(data.custom_data);
  const rawUserId =
    asNonEmptyString(customData?.userId) ?? asNonEmptyString(customData?.user_id);
  const rawOrgId =
    asNonEmptyString(customData?.orgId) ?? asNonEmptyString(customData?.org_id);
  const rawOperationId =
    asNonEmptyString(customData?.operationId) ?? asNonEmptyString(customData?.operation_id);

  const customUserId = rawUserId && UUID_REGEX.test(rawUserId) ? rawUserId : null;
  const customOrgId = rawOrgId && UUID_REGEX.test(rawOrgId) ? rawOrgId : null;
  const customOperationId =
    rawOperationId && UUID_REGEX.test(rawOperationId) ? rawOperationId : null;

  const prorationBillingMode =
    asNonEmptyString(customData?.prorationBillingMode) ??
    asNonEmptyString(data.proration_billing_mode);

  const isSubscriptionEvent = eventType.startsWith("subscription.");
  const dataId = asNonEmptyString(data.id);
  const paddleSubscriptionId =
    asNonEmptyString(data.subscription_id) ??
    (isSubscriptionEvent || dataId?.startsWith("sub_") ? dataId : null);

  const paddleCustomerId = asNonEmptyString(data.customer_id);

  let resolvedPlan: PaidPlanTier | null = null;
  let resolvedInterval: BillingInterval = "monthly";
  let seats: number | null = null;

  const items = Array.isArray(data.items) ? data.items : [];
  const firstItem = asRecord(items[0]);
  if (firstItem) {
    const qty = firstItem.quantity;
    if (typeof qty === "number" && Number.isInteger(qty) && qty >= 1) {
      seats = qty;
    }
    const priceObj = asRecord(firstItem.price);
    const priceId =
      asNonEmptyString(priceObj?.id) ?? asNonEmptyString(firstItem.price_id);
    const mapped = resolvePlanFromServerPriceId(priceId);
    if (mapped) {
      resolvedPlan = mapped.plan;
      resolvedInterval = mapped.interval;
    }
    const billingCycle = asRecord(priceObj?.billing_cycle);
    const cycleInterval = asNonEmptyString(billingCycle?.interval);
    if (cycleInterval === "year") {
      resolvedInterval = "yearly";
    } else if (cycleInterval === "month") {
      resolvedInterval = "monthly";
    }
  }

  const customPlan = asNonEmptyString(customData?.plan);
  if (!resolvedPlan && (customPlan === "pro" || customPlan === "team")) {
    resolvedPlan = customPlan;
  }
  const customInterval = asNonEmptyString(customData?.interval);
  if (customInterval === "yearly" || customInterval === "monthly") {
    resolvedInterval = customInterval;
  }
  if (seats === null && typeof customData?.seats === "number" && customData.seats >= 1) {
    seats = Math.floor(customData.seats);
  }

  const billingPeriod = asRecord(data.current_billing_period);
  const scheduledChange = asRecord(data.scheduled_change);
  const scheduledAction = asNonEmptyString(scheduledChange?.action)?.toLowerCase() ?? null;

  const currentPeriodEnd =
    parseIsoDate(scheduledChange?.effective_at) ??
    parseIsoDate(billingPeriod?.ends_at) ??
    parseIsoDate(data.next_billed_at) ??
    parseIsoDate(data.canceled_at);

  const rawStatus = asNonEmptyString(data.status)?.toLowerCase() ?? "";
  let lifecycleStatus: SubscriptionLifecycleStatus;

  if (
    eventType === "subscription.canceled" ||
    rawStatus === "canceled" ||
    rawStatus === "cancelled"
  ) {
    lifecycleStatus = "canceled";
  } else if (
    eventType === "subscription.past_due" ||
    eventType === "transaction.payment_failed" ||
    rawStatus === "past_due" ||
    rawStatus === "payment_failed"
  ) {
    lifecycleStatus = "past_due";
  } else if (eventType === "subscription.paused" || rawStatus === "paused") {
    lifecycleStatus = "paused";
  } else if (eventType === "subscription.trialing" || rawStatus === "trialing") {
    lifecycleStatus = "trialing";
  } else if (scheduledAction === "cancel") {
    lifecycleStatus = "cancel_at_period_end";
  } else {
    lifecycleStatus = "active";
  }

  return {
    paddleSubscriptionId,
    paddleCustomerId,
    customUserId,
    customOrgId,
    customOperationId,
    prorationBillingMode,
    plan: resolvedPlan,
    interval: resolvedInterval,
    seats,
    lifecycleStatus,
    scheduledChangeAction: scheduledAction,
    currentPeriodEnd,
  };
}

export async function handleSignedPaddleWebhookRequest(args: {
  rawBody: string;
  signatureHeader: string | null | undefined;
  secret?: string;
  now?: Date;
}): Promise<ProcessPaddleWebhookResult> {
  const secret = args.secret ?? env.PADDLE_WEBHOOK_SECRET;
  const now = args.now ?? new Date();

  const sigCheck = verifyPaddleWebhookSignature({
    rawBody: args.rawBody,
    signatureHeader: args.signatureHeader,
    secret,
    nowMs: now.getTime(),
  });

  if (!sigCheck.ok) {
    return {
      ok: false,
      httpStatus: 401,
      code: sigCheck.code,
      error: sigCheck.error,
    };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(args.rawBody);
  } catch {
    return {
      ok: false,
      httpStatus: 400,
      code: "INVALID_JSON",
      error: "Webhook request body must be valid JSON.",
    };
  }

  const envelopeParsed = paddleWebhookEnvelopeSchema.safeParse(parsedJson);
  if (!envelopeParsed.success) {
    return {
      ok: false,
      httpStatus: 400,
      code: "VALIDATION_ERROR",
      error: envelopeParsed.error.issues[0]?.message ?? "Invalid Paddle webhook payload.",
    };
  }

  return processValidatedPaddleWebhook(envelopeParsed.data, now);
}

export async function applyPersonalDowngradePublicationRules(
  workspaceId: string,
  now: Date = new Date(),
): Promise<void> {
  const [ws] = await db
    .select()
    .from(dbSchema.workspaces)
    .where(eq(dbSchema.workspaces.id, workspaceId))
    .limit(1);

  if (!ws) return;

  const publishedProjects = await db
    .select({ id: dbSchema.projects.id })
    .from(dbSchema.projects)
    .where(
      and(
        eq(dbSchema.projects.workspaceId, workspaceId),
        ne(dbSchema.projects.visibility, "private"),
      ),
    );

  // Free plan requires branding (`Spec §11.7`)
  await db
    .update(dbSchema.projects)
    .set({ brandingRemoved: false, updatedAt: now })
    .where(eq(dbSchema.projects.workspaceId, workspaceId));

  await db
    .update(dbSchema.publishedSnapshots)
    .set({ brandingRemoved: false, updatedAt: now })
    .where(eq(dbSchema.publishedSnapshots.workspaceId, workspaceId));

  if (publishedProjects.length <= 1) {
    // At most 1 published project -> keep it live with Free branding
    await db
      .update(dbSchema.publishedSnapshots)
      .set({ suspendedReason: null, updatedAt: now })
      .where(eq(dbSchema.publishedSnapshots.workspaceId, workspaceId));
    return;
  }

  const validKeepId =
    ws.keepPublicProjectId && publishedProjects.some((p) => p.id === ws.keepPublicProjectId)
      ? ws.keepPublicProjectId
      : null;

  if (!validKeepId) {
    // `Spec §11.7`: If > 1 published and user hasn't chosen one, suspend all paid publications rather than guessing
    await db
      .update(dbSchema.publishedSnapshots)
      .set({
        suspendedReason: "downgraded_pro_to_free_select_one",
        updatedAt: now,
      })
      .where(eq(dbSchema.publishedSnapshots.workspaceId, workspaceId));
    return;
  }

  const suspendIds = publishedProjects.filter((p) => p.id !== validKeepId).map((p) => p.id);
  await db
    .update(dbSchema.publishedSnapshots)
    .set({ suspendedReason: null, updatedAt: now })
    .where(eq(dbSchema.publishedSnapshots.projectId, validKeepId));

  if (suspendIds.length > 0) {
    await db
      .update(dbSchema.publishedSnapshots)
      .set({
        suspendedReason: "downgraded_pro_to_free_select_one",
        updatedAt: now,
      })
      .where(inArray(dbSchema.publishedSnapshots.projectId, suspendIds));
  }
}

export async function processValidatedPaddleWebhook(
  envelope: PaddleWebhookEnvelope,
  now: Date = new Date(),
): Promise<ProcessPaddleWebhookResult> {
  const details = extractPaddleEventDetails(envelope.event_type, envelope.data);
  const occurredAt = parseIsoDate(envelope.occurred_at) ?? now;

  // Pre-verify & ensure workspace outside inner tx if needed
  let verifiedUserId: string | null = null;
  let previousUserPlan: PlanTier = "free";
  if (details.customUserId) {
    const [u] = await db
      .select({ id: dbSchema.users.id, plan: dbSchema.users.plan })
      .from(dbSchema.users)
      .where(eq(dbSchema.users.id, details.customUserId))
      .limit(1);
    verifiedUserId = u?.id ?? null;
    previousUserPlan = u?.plan ?? "free";
  }

  let verifiedOrgId: string | null = null;
  if (details.customOrgId) {
    const [o] = await db
      .select({ id: dbSchema.organizations.id })
      .from(dbSchema.organizations)
      .where(eq(dbSchema.organizations.id, details.customOrgId))
      .limit(1);
    verifiedOrgId = o?.id ?? null;
  }

  const txOutcome = await db.transaction(async (tx) => {
    // 1. Idempotency guard via webhook_events PK (event_id)
    const insertedEvents = await tx
      .insert(dbSchema.webhookEvents)
      .values({
        eventId: envelope.event_id,
        provider: "paddle",
        eventType: envelope.event_type,
        payload: envelope as unknown as Record<string, unknown>,
        processedAt: now,
      })
      .onConflictDoNothing({ target: dbSchema.webhookEvents.eventId })
      .returning({ eventId: dbSchema.webhookEvents.eventId });

    if (insertedEvents.length === 0) {
      return {
        result: {
          ok: true as const,
          eventId: envelope.event_id,
          eventType: envelope.event_type,
          deduplicated: true,
          subscriptionId: details.paddleSubscriptionId,
          effectivePlan: null,
          lifecycleStatus: null,
        },
        upgraded: false,
        distinctId: null as string | null,
        postDowngradePersonalWorkspaceId: null as string | null,
      };
    }

    // 2. Locate existing subscription record scoped cleanly (Personal vs Team)
    let existingSub: typeof dbSchema.subscriptions.$inferSelect | undefined;

    if (details.paddleSubscriptionId) {
      const [bySubId] = await tx
        .select()
        .from(dbSchema.subscriptions)
        .where(eq(dbSchema.subscriptions.paddleSubscriptionId, details.paddleSubscriptionId))
        .limit(1);
      existingSub = bySubId;
    }

    const isTeamEvent =
      details.plan === "team" ||
      Boolean(verifiedOrgId) ||
      Boolean(existingSub?.orgId);

    if (!existingSub && isTeamEvent && verifiedOrgId) {
      const [byOrg] = await tx
        .select()
        .from(dbSchema.subscriptions)
        .where(eq(dbSchema.subscriptions.orgId, verifiedOrgId))
        .orderBy(desc(dbSchema.subscriptions.updatedAt))
        .limit(1);
      existingSub = byOrg;
    }

    if (!existingSub && !isTeamEvent && details.paddleCustomerId) {
      const [byCustomerId] = await tx
        .select()
        .from(dbSchema.subscriptions)
        .where(
          and(
            eq(dbSchema.subscriptions.paddleCustomerId, details.paddleCustomerId),
            isNull(dbSchema.subscriptions.orgId),
          ),
        )
        .orderBy(desc(dbSchema.subscriptions.updatedAt))
        .limit(1);
      existingSub = byCustomerId;
    }

    if (!existingSub && !isTeamEvent && verifiedUserId) {
      const [byUser] = await tx
        .select()
        .from(dbSchema.subscriptions)
        .where(
          and(
            eq(dbSchema.subscriptions.userId, verifiedUserId),
            isNull(dbSchema.subscriptions.orgId),
          ),
        )
        .orderBy(desc(dbSchema.subscriptions.updatedAt))
        .limit(1);
      existingSub = byUser;
    }

    const resolvedOrgId = verifiedOrgId ?? existingSub?.orgId ?? null;
    const resolvedUserId = resolvedOrgId
      ? null
      : (verifiedUserId ?? existingSub?.userId ?? null);

    if (!resolvedUserId && !resolvedOrgId && !existingSub) {
      return {
        result: {
          ok: true as const,
          eventId: envelope.event_id,
          eventType: envelope.event_type,
          deduplicated: false,
          subscriptionId: null,
          effectivePlan: null,
          lifecycleStatus: null,
        },
        upgraded: false,
        distinctId: null as string | null,
        postDowngradePersonalWorkspaceId: null as string | null,
      };
    }

    // 3. Per-entity `occurred_at` ordering (`Spec §12 line 388`)
    if (
      existingSub?.lastEventOccurredAt &&
      occurredAt.getTime() < existingSub.lastEventOccurredAt.getTime()
    ) {
      const currentEval = evaluateSubscriptionLifecycle({
        status: existingSub.status,
        currentPeriodEnd: existingSub.currentPeriodEnd,
        pastDueSince: existingSub.pastDueSince,
        now,
      });
      return {
        result: {
          ok: true as const,
          eventId: envelope.event_id,
          eventType: envelope.event_type,
          deduplicated: false,
          outOfOrderIgnored: true,
          subscriptionId: existingSub.id,
          effectivePlan: currentEval.grantsPaidAccess ? existingSub.plan : "free",
          lifecycleStatus: existingSub.status as SubscriptionLifecycleStatus,
          currentPaidCapacity: existingSub.currentPaidCapacity,
          renewalQuantity: existingSub.renewalQuantity,
        },
        upgraded: false,
        distinctId: null as string | null,
        postDowngradePersonalWorkspaceId: null as string | null,
      };
    }

    // 4. Failed initial payment grants NOTHING (`Spec §12 & §15`)
    if (!existingSub && details.lifecycleStatus === "past_due") {
      if (details.customOperationId) {
        await tx
          .update(dbSchema.billingOperations)
          .set({ status: "failed", updatedAt: now })
          .where(eq(dbSchema.billingOperations.id, details.customOperationId));
      }
      return {
        result: {
          ok: true as const,
          eventId: envelope.event_id,
          eventType: envelope.event_type,
          deduplicated: false,
          subscriptionId: null,
          effectivePlan: "free" as const,
          lifecycleStatus: "past_due" as const,
          currentPaidCapacity: 0,
          renewalQuantity: null,
        },
        upgraded: false,
        distinctId: verifiedUserId ?? resolvedOrgId,
        paymentFailedUserId: verifiedUserId,
        storedPlan: (details.plan ?? "pro") as PlanTier,
        postDowngradePersonalWorkspaceId: null as string | null,
      };
    }

    const storedPlan: PlanTier = resolvedOrgId
      ? "team"
      : (details.plan ??
          (existingSub?.plan && existingSub.plan !== "free" ? existingSub.plan : "pro"));

    const nextInterval: BillingInterval = details.interval ?? existingSub?.interval ?? "monthly";
    const nextPeriodEnd = details.currentPeriodEnd ?? existingSub?.currentPeriodEnd ?? null;
    const nextPaddleSubId =
      details.paddleSubscriptionId ?? existingSub?.paddleSubscriptionId ?? null;
    const nextPaddleCustId =
      details.paddleCustomerId ?? existingSub?.paddleCustomerId ?? null;

    // 5. Anchor `pastDueSince` on FIRST failure without resetting on repeat webhooks (`Spec §12 line 374`)
    let nextPastDueSince: Date | null = existingSub?.pastDueSince ?? null;
    if (details.lifecycleStatus === "past_due") {
      nextPastDueSince = existingSub?.pastDueSince ?? occurredAt;
    } else if (
      details.lifecycleStatus === "active" &&
      envelope.event_type !== "transaction.payment_failed"
    ) {
      nextPastDueSince = null;
    }

    // 6. Seat capacity & renewal decrease rules (`Spec §8 lines 269-273`)
    let nextPaidCapacity = 1;
    let nextRenewalQuantity: number | null = null;
    let nextPendingOpId: string | null = existingSub?.pendingOperationId ?? null;

    if (storedPlan === "team") {
      const requestedSeats = details.seats !== null ? clampTeamSeats(details.seats) : null;
      const isFailedPayment =
        details.lifecycleStatus === "past_due" ||
        envelope.event_type === "transaction.payment_failed";

      if (isFailedPayment) {
        // Failed payment on a seat increase or renewal NEVER grants additional seats
        nextPaidCapacity = existingSub?.currentPaidCapacity ?? 1;
        nextRenewalQuantity = existingSub?.renewalQuantity ?? null;
        if (details.customOperationId) {
          await tx
            .update(dbSchema.billingOperations)
            .set({ status: "failed", updatedAt: now })
            .where(eq(dbSchema.billingOperations.id, details.customOperationId));
        }
      } else if (!existingSub) {
        nextPaidCapacity = requestedSeats ?? TEAMS_MIN_SEATS;
        nextRenewalQuantity = null;
        nextPendingOpId = null;
      } else {
        const periodAdvanced = Boolean(
          nextPeriodEnd &&
            existingSub.currentPeriodEnd &&
            nextPeriodEnd.getTime() > existingSub.currentPeriodEnd.getTime() + 60_000,
        );
        const isGenuineRenewal =
          details.lifecycleStatus === "active" &&
          details.prorationBillingMode !== "do_not_bill" &&
          (periodAdvanced ||
            (envelope.event_type === "transaction.completed" &&
              existingSub.renewalQuantity !== null &&
              existingSub.currentPeriodEnd !== null &&
              occurredAt.getTime() >= existingSub.currentPeriodEnd.getTime() - 60_000));

        if (details.prorationBillingMode === "do_not_bill" && requestedSeats !== null) {
          if (requestedSeats < existingSub.currentPaidCapacity) {
            nextPaidCapacity = existingSub.currentPaidCapacity;
            nextRenewalQuantity = requestedSeats;
            nextPendingOpId = details.customOperationId ?? existingSub.pendingOperationId;
          } else if (requestedSeats === existingSub.currentPaidCapacity) {
            // Canceled pending decrease
            nextPaidCapacity = existingSub.currentPaidCapacity;
            nextRenewalQuantity = null;
            nextPendingOpId = null;
          } else {
            nextPaidCapacity = existingSub.currentPaidCapacity;
            nextRenewalQuantity = existingSub.renewalQuantity;
          }
        } else if (isGenuineRenewal) {
          nextPaidCapacity =
            requestedSeats ?? existingSub.renewalQuantity ?? existingSub.currentPaidCapacity;
          nextRenewalQuantity = null;
          if (existingSub.pendingOperationId) {
            await tx
              .update(dbSchema.billingOperations)
              .set({ status: "completed", updatedAt: now })
              .where(eq(dbSchema.billingOperations.id, existingSub.pendingOperationId));
          }
          nextPendingOpId = null;
        } else if (
          requestedSeats !== null &&
          requestedSeats < existingSub.currentPaidCapacity
        ) {
          // Never shrink `currentPaidCapacity` mid-period based on webhook item quantity (`Spec §8 line 270`)
          nextPaidCapacity = existingSub.currentPaidCapacity;
          nextRenewalQuantity = requestedSeats;
        } else if (
          requestedSeats !== null &&
          requestedSeats > existingSub.currentPaidCapacity &&
          details.lifecycleStatus === "active"
        ) {
          // Funded prorated seat increase expands capacity immediately without resetting usage
          nextPaidCapacity = requestedSeats;
          nextRenewalQuantity = null;
          if (details.customOperationId) {
            await tx
              .update(dbSchema.billingOperations)
              .set({ status: "completed", updatedAt: now })
              .where(eq(dbSchema.billingOperations.id, details.customOperationId));
          }
          nextPendingOpId = null;
        } else {
          nextPaidCapacity = existingSub.currentPaidCapacity;
          nextRenewalQuantity = existingSub.renewalQuantity;
        }
      }
    }

    // Resolve `workspaceId`
    let targetWorkspaceId: string | null = existingSub?.workspaceId ?? null;
    if (!targetWorkspaceId) {
      if (resolvedOrgId) {
        const [ws] = await tx
          .select({ id: dbSchema.workspaces.id })
          .from(dbSchema.workspaces)
          .where(eq(dbSchema.workspaces.organizationId, resolvedOrgId))
          .limit(1);
        targetWorkspaceId = ws?.id ?? null;
      } else if (resolvedUserId) {
        const [ws] = await tx
          .select({ id: dbSchema.workspaces.id })
          .from(dbSchema.workspaces)
          .where(eq(dbSchema.workspaces.personalOwnerId, resolvedUserId))
          .limit(1);
        targetWorkspaceId = ws?.id ?? null;
      }
    }

    const nextScheduledAction =
      details.lifecycleStatus === "cancel_at_period_end"
        ? "cancel"
        : details.lifecycleStatus === "active"
          ? null
          : (details.scheduledChangeAction ?? null);

    let savedSubscriptionId: string;

    if (existingSub) {
      const [updated] = await tx
        .update(dbSchema.subscriptions)
        .set({
          userId: resolvedOrgId ? null : (resolvedUserId ?? existingSub.userId),
          orgId: resolvedOrgId ?? existingSub.orgId,
          workspaceId: targetWorkspaceId ?? existingSub.workspaceId,
          paddleCustomerId: nextPaddleCustId,
          paddleSubscriptionId: nextPaddleSubId,
          plan: storedPlan,
          planVersion: PLAN_CATALOG_VERSION,
          interval: nextInterval,
          status: details.lifecycleStatus,
          currentPaidCapacity: nextPaidCapacity,
          renewalQuantity: nextRenewalQuantity,
          pastDueSince: nextPastDueSince,
          lastEventOccurredAt: occurredAt,
          scheduledChangeAction: nextScheduledAction,
          pendingOperationId: nextPendingOpId,
          currentPeriodEnd: nextPeriodEnd,
          updatedAt: now,
        })
        .where(eq(dbSchema.subscriptions.id, existingSub.id))
        .returning({ id: dbSchema.subscriptions.id });
      savedSubscriptionId = updated!.id;
    } else {
      const [inserted] = await tx
        .insert(dbSchema.subscriptions)
        .values({
          userId: resolvedOrgId ? null : resolvedUserId,
          orgId: resolvedOrgId,
          workspaceId: targetWorkspaceId,
          paddleCustomerId: nextPaddleCustId,
          paddleSubscriptionId: nextPaddleSubId,
          plan: storedPlan,
          planVersion: PLAN_CATALOG_VERSION,
          interval: nextInterval,
          status: details.lifecycleStatus,
          currentPaidCapacity: nextPaidCapacity,
          renewalQuantity: nextRenewalQuantity,
          pastDueSince: nextPastDueSince,
          lastEventOccurredAt: occurredAt,
          scheduledChangeAction: nextScheduledAction,
          pendingOperationId: nextPendingOpId,
          currentPeriodEnd: nextPeriodEnd,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: dbSchema.subscriptions.id });
      savedSubscriptionId = inserted!.id;
    }

    const lifecycle = evaluateSubscriptionLifecycle({
      status: details.lifecycleStatus,
      currentPeriodEnd: nextPeriodEnd,
      pastDueSince: nextPastDueSince,
      now,
    });
    const effectivePlan: PlanTier = lifecycle.grantsPaidAccess ? storedPlan : "free";

    // Personal workspace updates `users.plan`; Team workspace NEVER grants personal Pro (`Spec §4 line 177`)
    if (!resolvedOrgId && resolvedUserId) {
      await tx
        .update(dbSchema.users)
        .set({
          plan: effectivePlan,
          updatedAt: now,
        })
        .where(eq(dbSchema.users.id, resolvedUserId));
    }

    if (resolvedOrgId) {
      await tx
        .update(dbSchema.organizations)
        .set({
          seats: effectivePlan === "team" ? nextPaidCapacity : 0,
        })
        .where(eq(dbSchema.organizations.id, resolvedOrgId));

      if (targetWorkspaceId) {
        if (!lifecycle.grantsPaidAccess || lifecycle.isPastDueReadOnly) {
          await tx
            .update(dbSchema.workspaces)
            .set({
              frozenAt: now,
              frozenReason:
                details.lifecycleStatus === "past_due"
                  ? "past_due_over_7_days"
                  : "team_subscription_ended",
              updatedAt: now,
            })
            .where(eq(dbSchema.workspaces.id, targetWorkspaceId));

          await tx
            .update(dbSchema.publishedSnapshots)
            .set({
              suspendedReason: "team_subscription_inactive",
              updatedAt: now,
            })
            .where(eq(dbSchema.publishedSnapshots.workspaceId, targetWorkspaceId));
        } else {
          await tx
            .update(dbSchema.workspaces)
            .set({
              frozenAt: null,
              frozenReason: null,
              updatedAt: now,
            })
            .where(eq(dbSchema.workspaces.id, targetWorkspaceId));

          await tx
            .update(dbSchema.publishedSnapshots)
            .set({
              suspendedReason: null,
              updatedAt: now,
            })
            .where(eq(dbSchema.publishedSnapshots.workspaceId, targetWorkspaceId));
        }
      }
    } else if (targetWorkspaceId && lifecycle.grantsPaidAccess && !lifecycle.isPastDueReadOnly) {
      await tx
        .update(dbSchema.workspaces)
        .set({
          frozenAt: null,
          frozenReason: null,
          updatedAt: now,
        })
        .where(eq(dbSchema.workspaces.id, targetWorkspaceId));

      await tx
        .update(dbSchema.publishedSnapshots)
        .set({
          suspendedReason: null,
          updatedAt: now,
        })
        .where(eq(dbSchema.publishedSnapshots.workspaceId, targetWorkspaceId));
    }

    const previousEffectivePlan: PlanTier = existingSub ? existingSub.plan : previousUserPlan;
    const isUpgradeEvent =
      (effectivePlan === "pro" || effectivePlan === "team") &&
      (envelope.event_type === "subscription.activated" ||
        envelope.event_type === "subscription.created" ||
        previousEffectivePlan !== effectivePlan);

    if (isUpgradeEvent && targetWorkspaceId) {
      await tx
        .update(dbSchema.projects)
        .set({ brandingRemoved: true, updatedAt: now })
        .where(eq(dbSchema.projects.workspaceId, targetWorkspaceId));

      await tx
        .update(dbSchema.publishedSnapshots)
        .set({ brandingRemoved: true, updatedAt: now })
        .where(eq(dbSchema.publishedSnapshots.workspaceId, targetWorkspaceId));
    }

    return {
      result: {
        ok: true as const,
        eventId: envelope.event_id,
        eventType: envelope.event_type,
        deduplicated: false,
        subscriptionId: savedSubscriptionId,
        effectivePlan,
        lifecycleStatus: details.lifecycleStatus,
        currentPaidCapacity: nextPaidCapacity,
        renewalQuantity: nextRenewalQuantity,
      },
      upgraded: isUpgradeEvent,
      distinctId: verifiedUserId ?? resolvedUserId ?? resolvedOrgId,
      paymentFailedUserId:
        details.lifecycleStatus === "past_due" ? (verifiedUserId ?? resolvedUserId) : null,
      storedPlan,
      resolvedOrgId,
      resolvedUserId,
      hasWorkspaceId: Boolean(targetWorkspaceId),
      postDowngradePersonalWorkspaceId:
        !resolvedOrgId && (!lifecycle.grantsPaidAccess || lifecycle.isPastDueReadOnly)
          ? targetWorkspaceId
          : null,
    };
  });

  // Ensure workspace exists and link `subscriptions.workspaceId` if subscription arrived before lazy workspace creation
  if (
    !txOutcome.result.deduplicated &&
    txOutcome.result.subscriptionId &&
    "hasWorkspaceId" in txOutcome &&
    !txOutcome.hasWorkspaceId
  ) {
    if (txOutcome.resolvedOrgId) {
      const ensured = await ensureTeamWorkspaceForOrganization(
        txOutcome.resolvedOrgId,
        verifiedUserId ?? undefined,
      );
      await db
        .update(dbSchema.subscriptions)
        .set({ workspaceId: ensured.workspaceId, updatedAt: now })
        .where(eq(dbSchema.subscriptions.id, txOutcome.result.subscriptionId));
    } else if (txOutcome.resolvedUserId) {
      const ensured = await ensurePersonalWorkspaceForUser(txOutcome.resolvedUserId);
      await db
        .update(dbSchema.subscriptions)
        .set({ workspaceId: ensured.workspaceId, updatedAt: now })
        .where(eq(dbSchema.subscriptions.id, txOutcome.result.subscriptionId));
      if (txOutcome.result.effectivePlan === "free") {
        await applyPersonalDowngradePublicationRules(ensured.workspaceId, now);
      }
    }
  }

  if (
    "postDowngradePersonalWorkspaceId" in txOutcome &&
    txOutcome.postDowngradePersonalWorkspaceId
  ) {
    await applyPersonalDowngradePublicationRules(txOutcome.postDowngradePersonalWorkspaceId, now);
  }

  if (txOutcome.upgraded && txOutcome.result.effectivePlan) {
    await trackServerProductEvent({
      event: "upgrade",
      distinctId: txOutcome.distinctId,
      properties: {
        plan: txOutcome.result.effectivePlan,
        interval: details.interval,
        eventType: envelope.event_type,
      },
    });
  }

  if (
    !txOutcome.result.deduplicated &&
    "paymentFailedUserId" in txOutcome &&
    txOutcome.paymentFailedUserId
  ) {
    await notifyPaymentIssue({
      userId: txOutcome.paymentFailedUserId,
      plan: txOutcome.storedPlan,
      eventId: envelope.event_id,
    }).catch(() => undefined);
  }

  return txOutcome.result;
}
