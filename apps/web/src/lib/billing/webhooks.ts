import { and, desc, eq, inArray, isNull, type PlanTier } from "@casefolio/db";
import { z } from "zod";
import { env } from "@/env";
import { trackServerProductEvent } from "@/lib/analytics/posthog";
import {
  evaluateSubscriptionLifecycle,
  PLAN_CATALOG_VERSION,
  PLUS_INCLUDED_SEATS,
  TEAMS_MAX_SELF_SERVE_SEATS,
  TEAMS_MIN_SEATS,
  UNLIMITED_CASE_STUDIES,
  type BillingInterval,
  type PaidPlanTier,
  type SubscriptionLifecycleStatus,
} from "@/lib/billing/plans";
import {
  getPaddleApiBaseUrl,
  isRealPaddleApiKeyConfigured,
  resolvePlanFromServerPriceId,
} from "@/lib/billing/server-config";
import { verifyPaddleWebhookSignature } from "@/lib/billing/signature";
import { db, dbSchema } from "@/lib/db";
import {
  ensurePersonalWorkspaceForUser,
  ensureTeamWorkspaceForOrganization,
} from "@/lib/entitlements/server";
import { captureServerException } from "@/lib/monitoring/sentry";
import { notifyPaymentIssue } from "@/lib/notifications/service";

/**
 * Only these Paddle events are allowed to change entitlements.
 *
 * Everything else (`transaction.created|updated|ready|billed|paid`, `customer.*`, `adjustment.*`,
 * `subscription.imported`, …) is stored for audit/idempotency and acknowledged with HTTP 200 but
 * never mutates a subscription. In particular a draft/ready/billed transaction must never be
 * interpreted as an active subscription: that would grant a paid plan before money has moved.
 */
const SUBSCRIPTION_LIFECYCLE_EVENTS = new Set([
  "subscription.created",
  "subscription.activated",
  "subscription.updated",
  "subscription.resumed",
  "subscription.trialing",
  "subscription.past_due",
  "subscription.paused",
  "subscription.canceled",
]);

/** A checkout intent (`billing_operations.kind = "checkout"`) is single-purchase and short-lived. */
const CHECKOUT_INTENT_TTL_MS = 48 * 60 * 60 * 1000;

/** Subscription statuses that represent a live Paddle subscription which may still bill. */
const LIVE_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "paused",
  "cancel_at_period_end",
]);

export type IgnoredWebhookReason =
  | "event_not_actionable"
  | "transaction_not_completed"
  | "transaction_without_known_subscription"
  | "unknown_price"
  | "unresolved_identity"
  | "invalid_checkout_intent"
  | "plan_scope_mismatch"
  | "duplicate_subscription";

function isActionableEvent(
  eventType: string,
  data: Record<string, unknown>,
): { actionable: true } | { actionable: false; reason: IgnoredWebhookReason } {
  if (SUBSCRIPTION_LIFECYCLE_EVENTS.has(eventType)) {
    return { actionable: true };
  }
  if (eventType === "transaction.payment_failed" || eventType === "transaction.past_due") {
    return { actionable: true };
  }
  if (eventType === "transaction.completed") {
    const status = typeof data.status === "string" ? data.status.trim().toLowerCase() : "";
    return status === "completed"
      ? { actionable: true }
      : { actionable: false, reason: "transaction_not_completed" };
  }
  return { actionable: false, reason: "event_not_actionable" };
}

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
      /** Set when the event was acknowledged but intentionally did not change any entitlement. */
      ignored?: IgnoredWebhookReason;
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
  /**
   * Untrusted, browser-supplied hints. They are NEVER used to decide who owns a subscription —
   * identity comes from an existing subscription row or a server-created checkout intent.
   */
  customOperationId: string | null;
  prorationBillingMode: string | null;
  /** Plan derived from the exact configured Paddle price id only (never from `custom_data`). */
  plan: PaidPlanTier | null;
  /** `true` when an item price id was present but is not one of our four configured prices. */
  hasUnknownPrice: boolean;
  /** `null` when the event carries no pricing info — callers must fall back to the stored interval. */
  interval: BillingInterval | null;
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
  const rawOperationId =
    asNonEmptyString(customData?.operationId) ?? asNonEmptyString(customData?.operation_id);

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
  let resolvedInterval: BillingInterval | null = null;
  let seats: number | null = null;
  let hasUnknownPrice = false;

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
    if (priceId) {
      const mapped = resolvePlanFromServerPriceId(priceId);
      if (mapped) {
        resolvedPlan = mapped.plan;
        resolvedInterval = mapped.interval;
      } else {
        hasUnknownPrice = true;
      }
    }
    if (!resolvedInterval) {
      const billingCycle = asRecord(priceObj?.billing_cycle);
      const cycleInterval = asNonEmptyString(billingCycle?.interval);
      if (cycleInterval === "year") {
        resolvedInterval = "yearly";
      } else if (cycleInterval === "month") {
        resolvedInterval = "monthly";
      }
    }
  }

  // `custom_data` is browser-controlled: it may only fill gaps that real Paddle payloads never
  // leave (items always carry quantity + price), it can never override the paid price.
  if (!resolvedInterval) {
    const customInterval = asNonEmptyString(customData?.interval);
    resolvedInterval =
      customInterval === "yearly" || customInterval === "annual"
        ? "yearly"
        : customInterval === "monthly"
          ? "monthly"
          : null;
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
    eventType === "transaction.past_due" ||
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
    customOperationId,
    prorationBillingMode,
    plan: resolvedPlan,
    hasUnknownPrice,
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

  const nonArchivedProjects = await db
    .select({
      id: dbSchema.projects.id,
      visibility: dbSchema.projects.visibility,
      updatedAt: dbSchema.projects.updatedAt,
    })
    .from(dbSchema.projects)
    .where(
      and(
        eq(dbSchema.projects.workspaceId, workspaceId),
        isNull(dbSchema.projects.archivedAt),
      ),
    )
    .orderBy(desc(dbSchema.projects.updatedAt), desc(dbSchema.projects.createdAt));

  // Free plan requires Casefolio branding/watermark (`watermark_enabled = true`)
  await db
    .update(dbSchema.projects)
    .set({ brandingRemoved: false, updatedAt: now })
    .where(eq(dbSchema.projects.workspaceId, workspaceId));

  await db
    .update(dbSchema.publishedSnapshots)
    .set({ brandingRemoved: false, updatedAt: now })
    .where(eq(dbSchema.publishedSnapshots.workspaceId, workspaceId));

  if (nonArchivedProjects.length <= 1) {
    const singleId = nonArchivedProjects[0]?.id ?? null;
    await db
      .update(dbSchema.workspaces)
      .set({
        maxSeats: 1,
        maxCaseStudies: 1,
        customDomainEnabled: false,
        watermarkEnabled: true,
        keepPublicProjectId:
          ws.keepPublicProjectId && ws.keepPublicProjectId === singleId
            ? ws.keepPublicProjectId
            : singleId,
        updatedAt: now,
      })
      .where(eq(dbSchema.workspaces.id, workspaceId));

    await db
      .update(dbSchema.publishedSnapshots)
      .set({ suspendedReason: null, updatedAt: now })
      .where(eq(dbSchema.publishedSnapshots.workspaceId, workspaceId));
    return;
  }

  // Edge Case 3 (Downgrade Protection): never delete existing Case Studies.
  // Keep 1 selected active Case Study live/editable and lock + unpublish extra Case Studies.
  const activeId =
    ws.keepPublicProjectId && nonArchivedProjects.some((p) => p.id === ws.keepPublicProjectId)
      ? ws.keepPublicProjectId
      : (nonArchivedProjects.find((p) => p.visibility !== "private")?.id ??
          nonArchivedProjects[0]!.id);

  await db
    .update(dbSchema.workspaces)
    .set({
      maxSeats: 1,
      maxCaseStudies: 1,
      customDomainEnabled: false,
      watermarkEnabled: true,
      keepPublicProjectId: activeId,
      updatedAt: now,
    })
    .where(eq(dbSchema.workspaces.id, workspaceId));

  const extraIds = nonArchivedProjects.filter((p) => p.id !== activeId).map((p) => p.id);

  const [activeSnap] = await db
    .select({
      projectId: dbSchema.publishedSnapshots.projectId,
      suspendedReason: dbSchema.publishedSnapshots.suspendedReason,
      publishedAt: dbSchema.publishedSnapshots.publishedAt,
    })
    .from(dbSchema.publishedSnapshots)
    .where(eq(dbSchema.publishedSnapshots.projectId, activeId))
    .limit(1);

  if (activeSnap) {
    await db
      .update(dbSchema.publishedSnapshots)
      .set({ suspendedReason: null, updatedAt: now })
      .where(eq(dbSchema.publishedSnapshots.projectId, activeSnap.projectId));

    if (activeSnap.suspendedReason === "downgraded_pro_to_free_select_one") {
      await db
        .update(dbSchema.projects)
        .set({
          visibility: "public",
          publishedAt: activeSnap.publishedAt ?? now,
          updatedAt: now,
        })
        .where(eq(dbSchema.projects.id, activeId));
    }
  }

  if (extraIds.length > 0) {
    await db
      .update(dbSchema.projects)
      .set({
        visibility: "private",
        publishedAt: null,
        updatedAt: now,
      })
      .where(inArray(dbSchema.projects.id, extraIds));

    await db
      .update(dbSchema.publishedSnapshots)
      .set({
        suspendedReason: "downgraded_pro_to_free_select_one",
        updatedAt: now,
      })
      .where(inArray(dbSchema.publishedSnapshots.projectId, extraIds));
  }
}

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

interface CheckoutIntent {
  operationId: string;
  actorUserId: string;
  orgId: string | null;
  plan: PaidPlanTier | null;
}

interface WebhookTxOutcome {
  result: Extract<ProcessPaddleWebhookResult, { ok: true }>;
  upgraded: boolean;
  distinctId: string | null;
  postDowngradePersonalWorkspaceId: string | null;
  paymentFailedUserId?: string | null;
  storedPlan?: PlanTier;
  resolvedOrgId?: string | null;
  resolvedUserId?: string | null;
  actorUserId?: string | null;
  hasWorkspaceId?: boolean;
  /** Operational problem worth paging a human about (forged identity, duplicate purchase, …). */
  alert?: { message: string; context: Record<string, string | null> } | null;
  /** A second Paddle subscription that must stop billing (customer paid twice for one scope). */
  duplicateSubscriptionToCancel?: string | null;
  duplicateNotifyUserId?: string | null;
}

function ignoredOutcome(args: {
  envelope: PaddleWebhookEnvelope;
  reason: IgnoredWebhookReason;
  subscriptionId?: string | null;
  alert?: WebhookTxOutcome["alert"];
}): WebhookTxOutcome {
  return {
    result: {
      ok: true,
      eventId: args.envelope.event_id,
      eventType: args.envelope.event_type,
      deduplicated: false,
      ignored: args.reason,
      subscriptionId: args.subscriptionId ?? null,
      effectivePlan: null,
      lifecycleStatus: null,
    },
    upgraded: false,
    distinctId: null,
    postDowngradePersonalWorkspaceId: null,
    alert: args.alert ?? null,
  };
}

/**
 * Loads the server-created checkout intent referenced by the (browser-supplied) operation id.
 * The intent — not `custom_data.userId/orgId` — is what binds a brand-new Paddle subscription
 * to a Casefolio user/organization. Rows are only ever created for the authenticated actor in
 * `prepareCheckoutSessionForUser`, and the id is an unguessable UUID.
 */
async function loadCheckoutIntent(
  tx: DbTx,
  operationId: string | null,
  now: Date,
): Promise<CheckoutIntent | null> {
  if (!operationId) return null;

  const [op] = await tx
    .select()
    .from(dbSchema.billingOperations)
    .where(
      and(
        eq(dbSchema.billingOperations.id, operationId),
        eq(dbSchema.billingOperations.kind, "checkout"),
      ),
    )
    .limit(1)
    .for("update");

  if (!op?.actorUserId) return null;
  // `failed` stays usable: Paddle lets the customer retry a declined card inside the same checkout.
  if (op.status !== "pending" && op.status !== "failed") return null;
  if (now.getTime() - op.createdAt.getTime() > CHECKOUT_INTENT_TTL_MS) return null;

  const meta = asRecord(op.meta);
  const orgId = asNonEmptyString(meta?.orgId);
  const plan =
    meta?.plan === "pro" || meta?.plan === "team" || meta?.plan === "plus" ? meta.plan : null;

  return {
    operationId: op.id,
    actorUserId: op.actorUserId,
    orgId: orgId && UUID_REGEX.test(orgId) ? orgId : null,
    plan,
  };
}

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    if ((current as { code?: unknown }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * Best effort: stop a duplicate Paddle subscription from billing again. We use
 * `next_billing_period` (not `immediately`) so support can still review/refund the charge.
 */
async function cancelDuplicatePaddleSubscription(paddleSubscriptionId: string): Promise<boolean> {
  if (!isRealPaddleApiKeyConfigured()) return false;
  try {
    const response = await fetch(
      `${getPaddleApiBaseUrl()}/subscriptions/${encodeURIComponent(paddleSubscriptionId)}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.PADDLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ effective_from: "next_billing_period" }),
        signal: AbortSignal.timeout(8_000),
      },
    );
    return response.ok;
  } catch {
    return false;
  }
}

export async function processValidatedPaddleWebhook(
  envelope: PaddleWebhookEnvelope,
  now: Date = new Date(),
): Promise<ProcessPaddleWebhookResult> {
  try {
    return await processValidatedPaddleWebhookOnce(envelope, now);
  } catch (error) {
    // Two first events for one purchase (`subscription.created` + `transaction.completed`) can race
    // on the unique `paddle_subscription_id`. The loser rolled back completely (including its
    // idempotency row), so replaying it once is safe and converges on the winner's row.
    if (isUniqueViolation(error)) {
      return processValidatedPaddleWebhookOnce(envelope, now);
    }
    throw error;
  }
}

async function processValidatedPaddleWebhookOnce(
  envelope: PaddleWebhookEnvelope,
  now: Date,
): Promise<ProcessPaddleWebhookResult> {
  const details = extractPaddleEventDetails(envelope.event_type, envelope.data);
  const occurredAt = parseIsoDate(envelope.occurred_at) ?? now;
  const gate = isActionableEvent(envelope.event_type, envelope.data);

  const txOutcome: WebhookTxOutcome = await db.transaction(async (tx): Promise<WebhookTxOutcome> => {
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
          ok: true,
          eventId: envelope.event_id,
          eventType: envelope.event_type,
          deduplicated: true,
          subscriptionId: details.paddleSubscriptionId,
          effectivePlan: null,
          lifecycleStatus: null,
        },
        upgraded: false,
        distinctId: null,
        postDowngradePersonalWorkspaceId: null,
      };
    }

    // 1b. Event allow-list: only real subscription lifecycle / settled-payment events may mutate state.
    if (!gate.actionable) {
      return ignoredOutcome({ envelope, reason: gate.reason });
    }

    // 2. Locate the existing subscription by the Paddle-assigned subscription id (trusted).
    let existingSub: typeof dbSchema.subscriptions.$inferSelect | undefined;

    if (details.paddleSubscriptionId) {
      const [bySubId] = await tx
        .select()
        .from(dbSchema.subscriptions)
        .where(eq(dbSchema.subscriptions.paddleSubscriptionId, details.paddleSubscriptionId))
        .limit(1);
      existingSub = bySubId;
    }

    // A settled transaction only confirms money moved; the subscription.* events create rows.
    if (!existingSub && envelope.event_type === "transaction.completed") {
      return ignoredOutcome({ envelope, reason: "transaction_without_known_subscription" });
    }

    let intent: CheckoutIntent | null = null;

    if (!existingSub) {
      // 2b. Brand-new subscription: ownership comes ONLY from a server-created checkout intent.
      // `custom_data.userId/orgId` are browser-controlled and are deliberately ignored.
      if (!details.paddleSubscriptionId && details.lifecycleStatus === "past_due") {
        // A declined FIRST payment has no subscription yet (Paddle only creates it once paid).
        // Record the failure against the buyer's checkout intent and grant nothing; the same
        // checkout can still be retried successfully with another card.
        const failedIntent = await loadCheckoutIntent(tx, details.customOperationId, now);
        if (failedIntent) {
          await tx
            .update(dbSchema.billingOperations)
            .set({ status: "failed", updatedAt: now })
            .where(eq(dbSchema.billingOperations.id, failedIntent.operationId));
          return {
            result: {
              ok: true,
              eventId: envelope.event_id,
              eventType: envelope.event_type,
              deduplicated: false,
              subscriptionId: null,
              effectivePlan: "free",
              lifecycleStatus: "past_due",
              currentPaidCapacity: 0,
              renewalQuantity: null,
            },
            upgraded: false,
            distinctId: failedIntent.actorUserId,
            postDowngradePersonalWorkspaceId: null,
            actorUserId: failedIntent.actorUserId,
            paymentFailedUserId: failedIntent.actorUserId,
            storedPlan: (details.plan ?? failedIntent.plan ?? "pro") as PlanTier,
          };
        }
      }

      if (!details.paddleSubscriptionId) {
        return ignoredOutcome({
          envelope,
          reason: "unresolved_identity",
          alert: {
            message: "Paddle event without a subscription id and without a known subscription.",
            context: { eventId: envelope.event_id, eventType: envelope.event_type },
          },
        });
      }

      intent = await loadCheckoutIntent(tx, details.customOperationId, now);
      if (!intent) {
        return ignoredOutcome({
          envelope,
          reason: details.customOperationId ? "invalid_checkout_intent" : "unresolved_identity",
          alert: {
            message:
              "Paddle subscription event could not be tied to a valid server checkout intent; no entitlement granted.",
            context: {
              eventId: envelope.event_id,
              eventType: envelope.event_type,
              paddleSubscriptionId: details.paddleSubscriptionId,
              operationId: details.customOperationId,
            },
          },
        });
      }

      if (!details.plan) {
        await tx
          .update(dbSchema.billingOperations)
          .set({ status: "failed", updatedAt: now })
          .where(eq(dbSchema.billingOperations.id, intent.operationId));
        return ignoredOutcome({
          envelope,
          reason: "unknown_price",
          alert: {
            message: "Paddle subscription uses a price id that is not one of the configured PADDLE_PRICE_* ids.",
            context: {
              eventId: envelope.event_id,
              paddleSubscriptionId: details.paddleSubscriptionId,
            },
          },
        });
      }

      if (intent.orgId) {
        const [ownerMembership] = await tx
          .select({ role: dbSchema.memberships.role })
          .from(dbSchema.memberships)
          .where(
            and(
              eq(dbSchema.memberships.orgId, intent.orgId),
              eq(dbSchema.memberships.userId, intent.actorUserId),
              eq(dbSchema.memberships.role, "owner"),
            ),
          )
          .limit(1);
        if (!ownerMembership) {
          return ignoredOutcome({
            envelope,
            reason: "invalid_checkout_intent",
            alert: {
              message: "Checkout intent actor is no longer the owner of the target organization.",
              context: { eventId: envelope.event_id, orgId: intent.orgId },
            },
          });
        }
      }
    }

    // 2c. Scope/plan consistency: Pro belongs to a personal workspace; Team and Plus belong to an organization.
    const scopeIsOrg = existingSub ? Boolean(existingSub.orgId) : Boolean(intent?.orgId);
    const scopeMatches = details.plan
      ? scopeIsOrg
        ? details.plan === "team" || details.plan === "plus"
        : details.plan === "pro"
      : true;
    if (!scopeMatches) {
      if (intent) {
        await tx
          .update(dbSchema.billingOperations)
          .set({ status: "failed", updatedAt: now })
          .where(eq(dbSchema.billingOperations.id, intent.operationId));
      }
      return ignoredOutcome({
        envelope,
        reason: "plan_scope_mismatch",
        subscriptionId: existingSub?.id ?? null,
        alert: {
          message: `Paddle price maps to "${details.plan}" which does not match the ${scopeIsOrg ? "organization" : "personal"} scope.`,
          context: {
            eventId: envelope.event_id,
            paddleSubscriptionId: details.paddleSubscriptionId,
          },
        },
      });
    }

    // 2d. One live subscription per scope. A second purchase must never overwrite (and thereby
    // orphan) the first, EXCEPT an explicit organization upgrade from Team -> Plus.
    let replacedPaddleSubToCancel: string | null = null;
    if (!existingSub && intent) {
      const [scopeRow] = intent.orgId
        ? await tx
            .select()
            .from(dbSchema.subscriptions)
            .where(eq(dbSchema.subscriptions.orgId, intent.orgId))
            .orderBy(desc(dbSchema.subscriptions.updatedAt))
            .limit(1)
        : await tx
            .select()
            .from(dbSchema.subscriptions)
            .where(
              and(
                eq(dbSchema.subscriptions.userId, intent.actorUserId),
                isNull(dbSchema.subscriptions.orgId),
              ),
            )
            .orderBy(desc(dbSchema.subscriptions.updatedAt))
            .limit(1);

      const isOrgTierUpgrade =
        Boolean(intent.orgId) &&
        scopeRow?.plan === "team" &&
        (details.plan === "plus" || intent.plan === "plus");

      if (
        scopeRow &&
        scopeRow.paddleSubscriptionId &&
        scopeRow.paddleSubscriptionId !== details.paddleSubscriptionId &&
        LIVE_SUBSCRIPTION_STATUSES.has(scopeRow.status) &&
        !isOrgTierUpgrade
      ) {
        await tx
          .update(dbSchema.billingOperations)
          .set({
            status: "failed",
            updatedAt: now,
            meta: {
              reason: "duplicate_subscription",
              duplicatePaddleSubscriptionId: details.paddleSubscriptionId,
              keptPaddleSubscriptionId: scopeRow.paddleSubscriptionId,
            },
          })
          .where(eq(dbSchema.billingOperations.id, intent.operationId));
        return {
          ...ignoredOutcome({
            envelope,
            reason: "duplicate_subscription",
            subscriptionId: scopeRow.id,
            alert: {
              message:
                "Customer completed a second checkout for a scope that already has a live subscription.",
              context: {
                eventId: envelope.event_id,
                keptPaddleSubscriptionId: scopeRow.paddleSubscriptionId,
                duplicatePaddleSubscriptionId: details.paddleSubscriptionId,
              },
            },
          }),
          duplicateSubscriptionToCancel: details.paddleSubscriptionId,
          duplicateNotifyUserId: intent.actorUserId,
        };
      }

      if (
        isOrgTierUpgrade &&
        scopeRow?.paddleSubscriptionId &&
        scopeRow.paddleSubscriptionId !== details.paddleSubscriptionId &&
        LIVE_SUBSCRIPTION_STATUSES.has(scopeRow.status)
      ) {
        replacedPaddleSubToCancel = scopeRow.paddleSubscriptionId;
      }

      // Ended / never-paid / upgraded rows are safely reused for the new subscription.
      existingSub = scopeRow;
    }

    const resolvedOrgId = existingSub?.orgId ?? intent?.orgId ?? null;
    const resolvedUserId = resolvedOrgId
      ? null
      : (existingSub?.userId ?? intent?.actorUserId ?? null);
    const actorUserId = intent?.actorUserId ?? resolvedUserId;
    const verifiedUserId = actorUserId;

    let previousUserPlan: PlanTier = "free";
    if (resolvedUserId) {
      const [u] = await tx
        .select({ plan: dbSchema.users.plan })
        .from(dbSchema.users)
        .where(eq(dbSchema.users.id, resolvedUserId))
        .limit(1);
      previousUserPlan = u?.plan ?? "free";
    }

    if (!resolvedUserId && !resolvedOrgId && !existingSub) {
      return ignoredOutcome({ envelope, reason: "unresolved_identity" });
    }

    // A settled transaction confirms payment but must never resurrect an ended/paused subscription.
    if (envelope.event_type === "transaction.completed" && existingSub) {
      details.lifecycleStatus =
        existingSub.status === "past_due"
          ? "active"
          : (existingSub.status as SubscriptionLifecycleStatus);
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
    if ((!existingSub || intent) && details.lifecycleStatus === "past_due") {
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
        actorUserId,
        paymentFailedUserId: verifiedUserId,
        storedPlan: (details.plan ?? "pro") as PlanTier,
        postDowngradePersonalWorkspaceId: null as string | null,
      };
    }

    const storedPlan: PlanTier = resolvedOrgId
      ? details.plan === "plus" || details.plan === "team"
        ? details.plan
        : existingSub?.plan === "plus"
          ? "plus"
          : "team"
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

    if (storedPlan === "plus") {
      const isFailedPayment =
        details.lifecycleStatus === "past_due" ||
        envelope.event_type === "transaction.payment_failed";
      nextPaidCapacity = isFailedPayment
        ? (existingSub?.currentPaidCapacity ?? PLUS_INCLUDED_SEATS)
        : PLUS_INCLUDED_SEATS;
      nextRenewalQuantity = null;
      nextPendingOpId = null;
    } else if (storedPlan === "team") {
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

    const subMaxSeats =
      storedPlan === "plus"
        ? PLUS_INCLUDED_SEATS
        : storedPlan === "team"
          ? nextPaidCapacity
          : 1;

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
          maxSeats: subMaxSeats,
          maxCaseStudies: UNLIMITED_CASE_STUDIES,
          customDomainEnabled: storedPlan === "plus",
          watermarkEnabled: false,
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
          maxSeats: subMaxSeats,
          maxCaseStudies: UNLIMITED_CASE_STUDIES,
          customDomainEnabled: storedPlan === "plus",
          watermarkEnabled: false,
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

    if (intent) {
      // The intent is single-purchase: bind it to this Paddle subscription so it can never be replayed.
      await tx
        .update(dbSchema.billingOperations)
        .set({
          status: "completed",
          subscriptionId: savedSubscriptionId,
          workspaceId: targetWorkspaceId,
          updatedAt: now,
          meta: {
            paddleSubscriptionId: details.paddleSubscriptionId,
            plan: storedPlan,
            completedAt: now.toISOString(),
          },
        })
        .where(eq(dbSchema.billingOperations.id, intent.operationId));
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

    const wsMaxSeats =
      effectivePlan === "plus"
        ? PLUS_INCLUDED_SEATS
        : effectivePlan === "team"
          ? nextPaidCapacity
          : 1;
    const wsMaxCaseStudies = effectivePlan === "free" ? 1 : UNLIMITED_CASE_STUDIES;
    const wsCustomDomainEnabled = effectivePlan === "plus";
    const wsWatermarkEnabled = effectivePlan === "free";

    if (resolvedOrgId) {
      await tx
        .update(dbSchema.organizations)
        .set({
          seats:
            effectivePlan === "team" || effectivePlan === "plus" ? nextPaidCapacity : 0,
        })
        .where(eq(dbSchema.organizations.id, resolvedOrgId));

      if (targetWorkspaceId) {
        if (!lifecycle.grantsPaidAccess || lifecycle.isPastDueReadOnly) {
          await tx
            .update(dbSchema.workspaces)
            .set({
              maxSeats: wsMaxSeats,
              maxCaseStudies: wsMaxCaseStudies,
              customDomainEnabled: wsCustomDomainEnabled,
              watermarkEnabled: wsWatermarkEnabled,
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
              maxSeats: wsMaxSeats,
              maxCaseStudies: wsMaxCaseStudies,
              customDomainEnabled: wsCustomDomainEnabled,
              watermarkEnabled: wsWatermarkEnabled,
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
          maxSeats: wsMaxSeats,
          maxCaseStudies: wsMaxCaseStudies,
          customDomainEnabled: wsCustomDomainEnabled,
          watermarkEnabled: wsWatermarkEnabled,
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
      (effectivePlan === "pro" || effectivePlan === "team" || effectivePlan === "plus") &&
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
      actorUserId,
      paymentFailedUserId:
        details.lifecycleStatus === "past_due" ? (verifiedUserId ?? resolvedUserId) : null,
      storedPlan,
      resolvedOrgId,
      resolvedUserId,
      hasWorkspaceId: Boolean(targetWorkspaceId),
      duplicateSubscriptionToCancel: replacedPaddleSubToCancel,
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
        txOutcome.actorUserId ?? undefined,
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

  if (txOutcome.alert) {
    await captureServerException(new Error(txOutcome.alert.message), {
      tags: { area: "billing", webhookEvent: envelope.event_type },
      extra: txOutcome.alert.context,
    }).catch(() => undefined);
  }

  if (txOutcome.duplicateSubscriptionToCancel) {
    const canceled = await cancelDuplicatePaddleSubscription(
      txOutcome.duplicateSubscriptionToCancel,
    );
    await captureServerException(
      new Error(
        canceled
          ? "Duplicate Paddle subscription scheduled to cancel; customer needs a refund review."
          : "Duplicate Paddle subscription could NOT be canceled automatically; cancel + refund manually.",
      ),
      {
        tags: { area: "billing", webhookEvent: envelope.event_type },
        extra: { paddleSubscriptionId: txOutcome.duplicateSubscriptionToCancel },
      },
    ).catch(() => undefined);
  }

  if (txOutcome.upgraded && txOutcome.result.effectivePlan) {
    await trackServerProductEvent({
      event: "upgrade",
      distinctId: txOutcome.distinctId,
      properties: {
        plan: txOutcome.result.effectivePlan,
        interval: details.interval ?? "monthly",
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
