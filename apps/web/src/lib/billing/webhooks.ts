import { desc, eq, or, type PlanTier } from "@casefolio/db";
import { z } from "zod";
import { env } from "@/env";
import { trackServerProductEvent } from "@/lib/analytics/posthog";
import {
  isSubscriptionGrantingAccess,
  type BillingInterval,
  type PaidPlanTier,
  type SubscriptionLifecycleStatus,
} from "@/lib/billing/plans";
import { resolvePlanFromServerPriceId } from "@/lib/billing/server-config";
import { verifyPaddleWebhookSignature } from "@/lib/billing/signature";
import { db, dbSchema } from "@/lib/db";

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
      subscriptionId: string | null;
      effectivePlan: PlanTier | null;
      lifecycleStatus: SubscriptionLifecycleStatus | null;
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
  plan: PaidPlanTier | null;
  interval: BillingInterval;
  seats: number | null;
  lifecycleStatus: SubscriptionLifecycleStatus;
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

function extractPaddleEventDetails(
  eventType: string,
  data: Record<string, unknown>,
): ExtractedPaddleData {
  const customData = asRecord(data.custom_data);
  const rawUserId =
    asNonEmptyString(customData?.userId) ?? asNonEmptyString(customData?.user_id);
  const rawOrgId =
    asNonEmptyString(customData?.orgId) ?? asNonEmptyString(customData?.org_id);

  const customUserId = rawUserId && UUID_REGEX.test(rawUserId) ? rawUserId : null;
  const customOrgId = rawOrgId && UUID_REGEX.test(rawOrgId) ? rawOrgId : null;

  const isSubscriptionEvent = eventType.startsWith("subscription.");
  const dataId = asNonEmptyString(data.id);
  const paddleSubscriptionId =
    asNonEmptyString(data.subscription_id) ??
    (isSubscriptionEvent || dataId?.startsWith("sub_") ? dataId : null);

  const paddleCustomerId = asNonEmptyString(data.customer_id);

  // Extract priceId + quantity + interval from items[0]
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

  // Fallback to custom_data plan/interval/seats if present
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

  // Extract period end
  const billingPeriod = asRecord(data.current_billing_period);
  const scheduledChange = asRecord(data.scheduled_change);
  const scheduledAction = asNonEmptyString(scheduledChange?.action)?.toLowerCase();

  const currentPeriodEnd =
    parseIsoDate(scheduledChange?.effective_at) ??
    parseIsoDate(billingPeriod?.ends_at) ??
    parseIsoDate(data.next_billed_at) ??
    parseIsoDate(data.canceled_at);

  // Determine lifecycle status
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
    rawStatus === "past_due"
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
    plan: resolvedPlan,
    interval: resolvedInterval,
    seats,
    lifecycleStatus,
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

export async function processValidatedPaddleWebhook(
  envelope: PaddleWebhookEnvelope,
  now: Date = new Date(),
): Promise<ProcessPaddleWebhookResult> {
  const details = extractPaddleEventDetails(envelope.event_type, envelope.data);

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
      };
    }

    // 2. Locate existing subscription record if present
    let existingSub: typeof dbSchema.subscriptions.$inferSelect | undefined;

    if (details.paddleSubscriptionId) {
      const [bySubId] = await tx
        .select()
        .from(dbSchema.subscriptions)
        .where(eq(dbSchema.subscriptions.paddleSubscriptionId, details.paddleSubscriptionId))
        .limit(1);
      existingSub = bySubId;
    }

    if (!existingSub && details.paddleCustomerId) {
      const [byCustomerId] = await tx
        .select()
        .from(dbSchema.subscriptions)
        .where(eq(dbSchema.subscriptions.paddleCustomerId, details.paddleCustomerId))
        .orderBy(desc(dbSchema.subscriptions.updatedAt))
        .limit(1);
      existingSub = byCustomerId;
    }

    const targetUserId = details.customUserId ?? existingSub?.userId ?? null;
    const targetOrgId = details.customOrgId ?? existingSub?.orgId ?? null;

    if (!existingSub && (targetUserId || targetOrgId)) {
      const conditions = [];
      if (targetUserId) {
        conditions.push(eq(dbSchema.subscriptions.userId, targetUserId));
      }
      if (targetOrgId) {
        conditions.push(eq(dbSchema.subscriptions.orgId, targetOrgId));
      }
      if (conditions.length > 0) {
        const [byOwner] = await tx
          .select()
          .from(dbSchema.subscriptions)
          .where(conditions.length === 1 ? conditions[0] : or(...conditions))
          .orderBy(desc(dbSchema.subscriptions.updatedAt))
          .limit(1);
        existingSub = byOwner;
      }
    }

    // If neither user/org nor subscription could be matched (e.g., unrelated product event), record event & exit cleanly
    if (!targetUserId && !targetOrgId && !existingSub) {
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
      };
    }

    // Verify userId actually exists before FK write
    let verifiedUserId: string | null = null;
    let previousUserPlan: PlanTier = "free";
    if (targetUserId) {
      const [u] = await tx
        .select({ id: dbSchema.users.id, plan: dbSchema.users.plan })
        .from(dbSchema.users)
        .where(eq(dbSchema.users.id, targetUserId))
        .limit(1);
      verifiedUserId = u?.id ?? null;
      previousUserPlan = u?.plan ?? "free";
    }

    let verifiedOrgId: string | null = null;
    if (targetOrgId) {
      const [o] = await tx
        .select({ id: dbSchema.organizations.id })
        .from(dbSchema.organizations)
        .where(eq(dbSchema.organizations.id, targetOrgId))
        .limit(1);
      verifiedOrgId = o?.id ?? null;
    }

    if (!verifiedUserId && !verifiedOrgId) {
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
      };
    }

    const storedPlan: PlanTier =
      details.plan ??
      (existingSub?.plan && existingSub.plan !== "free" ? existingSub.plan : "pro");

    const nextPeriodEnd =
      details.currentPeriodEnd ?? existingSub?.currentPeriodEnd ?? null;

    const nextPaddleSubId =
      details.paddleSubscriptionId ?? existingSub?.paddleSubscriptionId ?? null;
    const nextPaddleCustId =
      details.paddleCustomerId ?? existingSub?.paddleCustomerId ?? null;

    let savedSubscriptionId: string;

    if (existingSub) {
      const [updated] = await tx
        .update(dbSchema.subscriptions)
        .set({
          userId: verifiedUserId ?? existingSub.userId,
          orgId: verifiedOrgId ?? existingSub.orgId,
          paddleCustomerId: nextPaddleCustId,
          paddleSubscriptionId: nextPaddleSubId,
          plan: storedPlan,
          status: details.lifecycleStatus,
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
          userId: verifiedUserId,
          orgId: verifiedOrgId,
          paddleCustomerId: nextPaddleCustId,
          paddleSubscriptionId: nextPaddleSubId,
          plan: storedPlan,
          status: details.lifecycleStatus,
          currentPeriodEnd: nextPeriodEnd,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: dbSchema.subscriptions.id });
      savedSubscriptionId = inserted!.id;
    }

    const grantsAccess = isSubscriptionGrantingAccess(
      details.lifecycleStatus,
      nextPeriodEnd,
      now,
    );
    const effectivePlan: PlanTier = grantsAccess ? storedPlan : "free";

    if (verifiedUserId) {
      await tx
        .update(dbSchema.users)
        .set({
          plan: effectivePlan,
          updatedAt: now,
        })
        .where(eq(dbSchema.users.id, verifiedUserId));
    }

    if (verifiedOrgId) {
      const nextSeats =
        effectivePlan === "team"
          ? Math.max(3, details.seats ?? 3)
          : 1;
      await tx
        .update(dbSchema.organizations)
        .set({
          seats: nextSeats,
        })
        .where(eq(dbSchema.organizations.id, verifiedOrgId));
    }

    const previousEffectivePlan: PlanTier = existingSub ? existingSub.plan : previousUserPlan;
    const isUpgradeEvent =
      (effectivePlan === "pro" || effectivePlan === "team") &&
      (envelope.event_type === "subscription.activated" ||
        envelope.event_type === "subscription.created" ||
        previousEffectivePlan !== effectivePlan);

    return {
      result: {
        ok: true as const,
        eventId: envelope.event_id,
        eventType: envelope.event_type,
        deduplicated: false,
        subscriptionId: savedSubscriptionId,
        effectivePlan,
        lifecycleStatus: details.lifecycleStatus,
      },
      upgraded: isUpgradeEvent,
      distinctId: verifiedUserId ?? verifiedOrgId,
    };
  });

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

  return txOutcome.result;
}
