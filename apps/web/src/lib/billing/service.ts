import { randomUUID } from "node:crypto";
import { and, desc, eq, type PlanTier } from "@casefolio/db";
import { env } from "@/env";
import {
  BILLING_PLAN_CATALOG,
  cancelSubscriptionInputSchema,
  checkoutRequestSchema,
  formatPlanHeadingLabel,
  getChargeAmountUsd,
  isSubscriptionGrantingAccess,
  type BillingInterval,
  type PaidPlanTier,
} from "@/lib/billing/plans";
import {
  getPaddleApiBaseUrl,
  isPaddleOverlayLiveReady,
  isRealPaddleApiKeyConfigured,
  resolvePlanFromServerPriceId,
  resolveServerPaddlePriceId,
} from "@/lib/billing/server-config";
import { signPaddleWebhookPayload } from "@/lib/billing/signature";
import { handleSignedPaddleWebhookRequest } from "@/lib/billing/webhooks";
import { db, dbSchema } from "@/lib/db";
import { consumeUploadRateLimit } from "@/lib/storage/rate-limit";

export interface BillingActor {
  id: string;
  email: string;
  name?: string | null;
}

export interface PreparedCheckoutSession {
  mode: "paddle" | "sandbox_simulated";
  environment: "sandbox" | "production";
  clientToken: string;
  priceId: string;
  plan: PaidPlanTier;
  interval: BillingInterval;
  seats: number;
  amountUsd: number;
  customerEmail: string;
  customData: {
    userId: string;
    orgId: string | null;
    plan: PaidPlanTier;
    interval: BillingInterval;
    seats: number;
  };
}

export type PrepareCheckoutResult =
  | {
      ok: true;
      session: PreparedCheckoutSession;
    }
  | {
      ok: false;
      code: "VALIDATION_ERROR" | "FORBIDDEN" | "RATE_LIMITED";
      error: string;
    };

export interface BillingInvoiceItem {
  id: string;
  invoiceNumber: string;
  occurredAtIso: string;
  planLabel: string;
  amountUsd: number;
  status: "paid" | "failed";
  receiptUrl: string;
}

export interface UserSubscriptionSummary {
  id: string;
  paddleCustomerId: string | null;
  paddleSubscriptionId: string | null;
  plan: PlanTier;
  interval: BillingInterval;
  status: string;
  currentPeriodEndIso: string | null;
  paymentBrand: string;
  paymentLast4: string;
  paymentExpiry: string;
}

export interface UserBillingOverview {
  effectivePlan: PlanTier;
  environment: "sandbox" | "production";
  hasLivePaddlePortal: boolean;
  subscription: UserSubscriptionSummary | null;
  invoices: BillingInvoiceItem[];
}

export async function prepareCheckoutSessionForUser(
  actor: BillingActor,
  rawInput: unknown,
): Promise<PrepareCheckoutResult> {
  const rate = consumeUploadRateLimit(`billing-checkout:${actor.id}`, 20, 60_000);
  if (!rate.allowed) {
    return {
      ok: false,
      code: "RATE_LIMITED",
      error: `Too many billing requests. Please retry in ${rate.retryAfterSeconds}s.`,
    };
  }

  const parsed = checkoutRequestSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: parsed.error.issues[0]?.message ?? "Invalid plan selection.",
    };
  }

  const valid = parsed.data;
  const orgId = valid.orgId ?? null;

  if (orgId) {
    const [membership] = await db
      .select({ role: dbSchema.memberships.role })
      .from(dbSchema.memberships)
      .where(
        and(
          eq(dbSchema.memberships.orgId, orgId),
          eq(dbSchema.memberships.userId, actor.id),
        ),
      )
      .limit(1);

    if (!membership || membership.role !== "owner") {
      return {
        ok: false,
        code: "FORBIDDEN",
        error: "Only the organization owner can manage team billing.",
      };
    }
  }

  const defaultSeats = BILLING_PLAN_CATALOG[valid.plan].defaultSeats;
  const seats =
    valid.plan === "team"
      ? Math.max(defaultSeats, valid.seats ?? defaultSeats)
      : 1;

  const priceId = resolveServerPaddlePriceId(valid.plan, valid.interval);
  const baseAmount = getChargeAmountUsd(valid.plan, valid.interval);
  const extraTeamSeats = valid.plan === "team" ? Math.max(0, seats - 3) : 0;
  const extraSeatUnit = valid.interval === "yearly" ? 72 : 8;
  const amountUsd = baseAmount + extraTeamSeats * extraSeatUnit;

  const mode = isPaddleOverlayLiveReady(priceId) ? "paddle" : "sandbox_simulated";

  return {
    ok: true,
    session: {
      mode,
      environment: env.PADDLE_ENV,
      clientToken: env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
      priceId,
      plan: valid.plan,
      interval: valid.interval,
      seats,
      amountUsd,
      customerEmail: actor.email,
      customData: {
        userId: actor.id,
        orgId,
        plan: valid.plan,
        interval: valid.interval,
        seats,
      },
    },
  };
}

export async function completeSandboxCheckoutForUser(
  actor: BillingActor,
  rawInput: unknown,
): Promise<
  | {
      ok: true;
      eventId: string;
      effectivePlan: PlanTier;
      subscriptionId: string | null;
    }
  | {
      ok: false;
      code: "SANDBOX_ONLY" | "VALIDATION_ERROR" | "FORBIDDEN" | "RATE_LIMITED" | "WEBHOOK_FAILED";
      error: string;
    }
> {
  if (env.PADDLE_ENV !== "sandbox") {
    return {
      ok: false,
      code: "SANDBOX_ONLY",
      error: "Simulated sandbox checkout is strictly disabled in production.",
    };
  }

  const prepared = await prepareCheckoutSessionForUser(actor, rawInput);
  if (!prepared.ok) {
    return prepared;
  }

  const { session } = prepared;
  const now = new Date();
  const periodDays = session.interval === "yearly" ? 365 : 30;
  const periodEnd = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000);

  const [existingSub] = await db
    .select()
    .from(dbSchema.subscriptions)
    .where(eq(dbSchema.subscriptions.userId, actor.id))
    .orderBy(desc(dbSchema.subscriptions.updatedAt))
    .limit(1);

  const shortUser = actor.id.replace(/-/g, "").slice(0, 12);
  const paddleCustomerId =
    existingSub?.paddleCustomerId ?? `ctm_sdbx_${shortUser}`;
  const paddleSubscriptionId =
    existingSub?.paddleSubscriptionId ??
    `sub_sdbx_${randomUUID().replace(/-/g, "").slice(0, 20)}`;

  const eventId = `evt_sdbx_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
  const invoiceNumber = `INV-${now.getUTCFullYear()}-${randomUUID().slice(0, 6).toUpperCase()}`;

  const webhookPayload = {
    event_id: eventId,
    event_type: "subscription.activated",
    occurred_at: now.toISOString(),
    data: {
      id: paddleSubscriptionId,
      customer_id: paddleCustomerId,
      status: "active",
      current_billing_period: {
        starts_at: now.toISOString(),
        ends_at: periodEnd.toISOString(),
      },
      next_billed_at: periodEnd.toISOString(),
      scheduled_change: null,
      items: [
        {
          quantity: session.seats,
          price: {
            id: session.priceId,
            billing_cycle: {
              interval: session.interval === "yearly" ? "year" : "month",
              frequency: 1,
            },
          },
        },
      ],
      custom_data: {
        userId: session.customData.userId,
        orgId: session.customData.orgId,
        plan: session.plan,
        interval: session.interval,
        seats: session.seats,
        amountUsd: session.amountUsd,
        invoiceNumber,
        paymentMethod: {
          brand: "VISA",
          last4: "4242",
          expiry: "08/29",
        },
      },
    },
  };

  const rawBody = JSON.stringify(webhookPayload);
  const signatureHeader = signPaddleWebhookPayload(
    rawBody,
    env.PADDLE_WEBHOOK_SECRET,
    Math.floor(now.getTime() / 1000),
  );

  const result = await handleSignedPaddleWebhookRequest({
    rawBody,
    signatureHeader,
    now,
  });

  if (!result.ok) {
    return {
      ok: false,
      code: "WEBHOOK_FAILED",
      error: result.error,
    };
  }

  return {
    ok: true,
    eventId: result.eventId,
    effectivePlan: result.effectivePlan ?? session.plan,
    subscriptionId: result.subscriptionId,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export async function getUserBillingOverview(
  userId: string,
  now: Date = new Date(),
): Promise<UserBillingOverview> {
  const [userRow] = await db
    .select({ plan: dbSchema.users.plan })
    .from(dbSchema.users)
    .where(eq(dbSchema.users.id, userId))
    .limit(1);

  const [subRow] = await db
    .select()
    .from(dbSchema.subscriptions)
    .where(eq(dbSchema.subscriptions.userId, userId))
    .orderBy(desc(dbSchema.subscriptions.updatedAt))
    .limit(1);

  let effectivePlan: PlanTier = userRow?.plan ?? "free";

  if (subRow) {
    const stillActive = isSubscriptionGrantingAccess(
      subRow.status,
      subRow.currentPeriodEnd,
      now,
    );
    const derivedPlan: PlanTier = stillActive ? subRow.plan : "free";
    if (derivedPlan !== effectivePlan) {
      effectivePlan = derivedPlan;
      await db
        .update(dbSchema.users)
        .set({ plan: derivedPlan, updatedAt: now })
        .where(eq(dbSchema.users.id, userId));
    }
  }

  // Inspect recent paddle webhook_events to extract interval, payment summary, and invoices
  const recentEvents = await db
    .select()
    .from(dbSchema.webhookEvents)
    .where(eq(dbSchema.webhookEvents.provider, "paddle"))
    .orderBy(desc(dbSchema.webhookEvents.processedAt))
    .limit(100);

  let detectedInterval: BillingInterval = "monthly";
  let paymentBrand = "VISA";
  let paymentLast4 = "4242";
  let paymentExpiry = "08/29";
  const invoices: BillingInvoiceItem[] = [];

  for (const evt of recentEvents) {
    const payload = asRecord(evt.payload);
    const data = asRecord(payload?.data);
    if (!data) continue;

    const customData = asRecord(data.custom_data);
    const evtUserId =
      typeof customData?.userId === "string"
        ? customData.userId
        : typeof customData?.user_id === "string"
          ? customData.user_id
          : null;
    const evtCustomerId =
      typeof data.customer_id === "string" ? data.customer_id : null;
    const evtSubId =
      typeof data.subscription_id === "string"
        ? data.subscription_id
        : typeof data.id === "string"
          ? data.id
          : null;

    const belongsToUser =
      evtUserId === userId ||
      (subRow?.paddleCustomerId && evtCustomerId === subRow.paddleCustomerId) ||
      (subRow?.paddleSubscriptionId && evtSubId === subRow.paddleSubscriptionId);

    if (!belongsToUser) continue;

    // Extract interval & card details from latest matching event
    const items = Array.isArray(data.items) ? data.items : [];
    const firstItem = asRecord(items[0]);
    const priceObj = asRecord(firstItem?.price);
    const mapped = resolvePlanFromServerPriceId(
      typeof priceObj?.id === "string" ? priceObj.id : undefined,
    );

    const itemInterval: BillingInterval =
      customData?.interval === "yearly" || mapped?.interval === "yearly"
        ? "yearly"
        : "monthly";

    if (invoices.length === 0) {
      detectedInterval = itemInterval;
    }

    const pm = asRecord(customData?.paymentMethod);
    if (pm) {
      if (typeof pm.brand === "string") paymentBrand = pm.brand;
      if (typeof pm.last4 === "string") paymentLast4 = pm.last4;
      if (typeof pm.expiry === "string") paymentExpiry = pm.expiry;
    }

    const isChargeEvent =
      evt.eventType === "subscription.activated" ||
      evt.eventType === "subscription.created" ||
      evt.eventType === "transaction.completed" ||
      evt.eventType === "transaction.payment_failed";

    if (isChargeEvent) {
      const eventPlan: PaidPlanTier =
        customData?.plan === "team" || mapped?.plan === "team" ? "team" : "pro";
      const amountUsd =
        typeof customData?.amountUsd === "number"
          ? customData.amountUsd
          : getChargeAmountUsd(eventPlan, itemInterval);
      const invoiceNumber =
        typeof customData?.invoiceNumber === "string"
          ? customData.invoiceNumber
          : `INV-${evt.eventId.slice(-8).toUpperCase()}`;
      const occurredAtIso =
        typeof payload?.occurred_at === "string"
          ? payload.occurred_at
          : evt.processedAt.toISOString();

      invoices.push({
        id: evt.eventId,
        invoiceNumber,
        occurredAtIso,
        planLabel: formatPlanHeadingLabel(eventPlan, itemInterval),
        amountUsd,
        status: evt.eventType === "transaction.payment_failed" ? "failed" : "paid",
        receiptUrl: `/api/paddle/invoices/${encodeURIComponent(evt.eventId)}`,
      });
    }
  }

  return {
    effectivePlan,
    environment: env.PADDLE_ENV,
    hasLivePaddlePortal: Boolean(
      subRow?.paddleCustomerId && isRealPaddleApiKeyConfigured(),
    ),
    subscription: subRow
      ? {
          id: subRow.id,
          paddleCustomerId: subRow.paddleCustomerId ?? null,
          paddleSubscriptionId: subRow.paddleSubscriptionId ?? null,
          plan: subRow.plan,
          interval: detectedInterval,
          status: subRow.status,
          currentPeriodEndIso: subRow.currentPeriodEnd
            ? subRow.currentPeriodEnd.toISOString()
            : null,
          paymentBrand,
          paymentLast4,
          paymentExpiry,
        }
      : null,
    invoices,
  };
}

export async function createPaddlePortalSessionForUser(
  userId: string,
): Promise<
  | { ok: true; mode: "paddle_portal"; url: string }
  | { ok: true; mode: "local_portal"; url: string }
  | { ok: false; error: string }
> {
  const [subRow] = await db
    .select()
    .from(dbSchema.subscriptions)
    .where(eq(dbSchema.subscriptions.userId, userId))
    .orderBy(desc(dbSchema.subscriptions.updatedAt))
    .limit(1);

  if (!subRow?.paddleCustomerId) {
    return {
      ok: false,
      error: "No active billing subscription found for this account.",
    };
  }

  if (isRealPaddleApiKeyConfigured()) {
    try {
      const response = await fetch(
        `${getPaddleApiBaseUrl()}/customers/${encodeURIComponent(subRow.paddleCustomerId)}/portal-sessions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.PADDLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            subscription_ids: subRow.paddleSubscriptionId
              ? [subRow.paddleSubscriptionId]
              : [],
          }),
        },
      );

      if (response.ok) {
        const json = (await response.json()) as {
          data?: { urls?: { general?: { overview?: string } } };
        };
        const overviewUrl = json.data?.urls?.general?.overview;
        if (overviewUrl) {
          return {
            ok: true,
            mode: "paddle_portal",
            url: overviewUrl,
          };
        }
      }
    } catch {
      // Fallback cleanly in local/sandbox environments
    }
  }

  return {
    ok: true,
    mode: "local_portal",
    url: "/account/billing?portal=cancel",
  };
}

export async function cancelUserSubscription(
  actor: BillingActor,
  rawInput: unknown,
): Promise<
  | {
      ok: true;
      status: "cancel_at_period_end" | "canceled";
      effectivePlan: PlanTier;
      currentPeriodEndIso: string | null;
    }
  | {
      ok: false;
      error: string;
    }
> {
  const parsed = cancelSubscriptionInputSchema.safeParse(rawInput ?? {});
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid cancellation request.",
    };
  }

  const [subRow] = await db
    .select()
    .from(dbSchema.subscriptions)
    .where(eq(dbSchema.subscriptions.userId, actor.id))
    .orderBy(desc(dbSchema.subscriptions.updatedAt))
    .limit(1);

  if (!subRow || subRow.plan === "free") {
    return {
      ok: false,
      error: "No active paid subscription to cancel.",
    };
  }

  const now = new Date();
  const effectiveEnd = parsed.data.immediate
    ? now
    : (subRow.currentPeriodEnd ?? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000));

  // If live Paddle API key is configured, call Paddle cancel API first
  if (subRow.paddleSubscriptionId && isRealPaddleApiKeyConfigured()) {
    const res = await fetch(
      `${getPaddleApiBaseUrl()}/subscriptions/${encodeURIComponent(subRow.paddleSubscriptionId)}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.PADDLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          effective_from: parsed.data.immediate
            ? "immediately"
            : "next_billing_period",
        }),
      },
    );
    if (!res.ok) {
      return {
        ok: false,
        error: "Paddle could not process cancellation right now. Please try again.",
      };
    }
  }

  const eventId = `evt_cancel_${randomUUID().replace(/-/g, "").slice(0, 22)}`;
  const webhookPayload = parsed.data.immediate
    ? {
        event_id: eventId,
        event_type: "subscription.canceled",
        occurred_at: now.toISOString(),
        data: {
          id: subRow.paddleSubscriptionId ?? `sub_local_${subRow.id}`,
          customer_id: subRow.paddleCustomerId ?? `ctm_local_${actor.id.slice(0, 8)}`,
          status: "canceled",
          canceled_at: now.toISOString(),
          custom_data: {
            userId: actor.id,
            plan: subRow.plan,
            cancelReason: parsed.data.reason ?? "other",
            cancelFeedback: parsed.data.feedback ?? "",
          },
        },
      }
    : {
        event_id: eventId,
        event_type: "subscription.updated",
        occurred_at: now.toISOString(),
        data: {
          id: subRow.paddleSubscriptionId ?? `sub_local_${subRow.id}`,
          customer_id: subRow.paddleCustomerId ?? `ctm_local_${actor.id.slice(0, 8)}`,
          status: "active",
          scheduled_change: {
            action: "cancel",
            effective_at: effectiveEnd.toISOString(),
          },
          current_billing_period: {
            ends_at: effectiveEnd.toISOString(),
          },
          custom_data: {
            userId: actor.id,
            plan: subRow.plan,
            cancelReason: parsed.data.reason ?? "other",
            cancelFeedback: parsed.data.feedback ?? "",
          },
        },
      };

  const rawBody = JSON.stringify(webhookPayload);
  const signatureHeader = signPaddleWebhookPayload(
    rawBody,
    env.PADDLE_WEBHOOK_SECRET,
    Math.floor(now.getTime() / 1000),
  );

  const processed = await handleSignedPaddleWebhookRequest({
    rawBody,
    signatureHeader,
    now,
  });

  if (!processed.ok) {
    return {
      ok: false,
      error: processed.error,
    };
  }

  return {
    ok: true,
    status: parsed.data.immediate ? "canceled" : "cancel_at_period_end",
    effectivePlan: processed.effectivePlan ?? "free",
    currentPeriodEndIso: effectiveEnd.toISOString(),
  };
}

export async function resumeUserSubscription(
  actor: BillingActor,
): Promise<{ ok: true; effectivePlan: PlanTier } | { ok: false; error: string }> {
  const [subRow] = await db
    .select()
    .from(dbSchema.subscriptions)
    .where(eq(dbSchema.subscriptions.userId, actor.id))
    .orderBy(desc(dbSchema.subscriptions.updatedAt))
    .limit(1);

  if (!subRow || subRow.status !== "cancel_at_period_end") {
    return {
      ok: false,
      error: "No scheduled cancellation to resume.",
    };
  }

  const now = new Date();
  const periodEnd =
    subRow.currentPeriodEnd ?? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const eventId = `evt_resume_${randomUUID().replace(/-/g, "").slice(0, 22)}`;

  const rawBody = JSON.stringify({
    event_id: eventId,
    event_type: "subscription.updated",
    occurred_at: now.toISOString(),
    data: {
      id: subRow.paddleSubscriptionId ?? `sub_local_${subRow.id}`,
      customer_id: subRow.paddleCustomerId ?? `ctm_local_${actor.id.slice(0, 8)}`,
      status: "active",
      scheduled_change: null,
      current_billing_period: {
        ends_at: periodEnd.toISOString(),
      },
      custom_data: {
        userId: actor.id,
        plan: subRow.plan,
      },
    },
  });

  const signatureHeader = signPaddleWebhookPayload(
    rawBody,
    env.PADDLE_WEBHOOK_SECRET,
    Math.floor(now.getTime() / 1000),
  );

  const processed = await handleSignedPaddleWebhookRequest({
    rawBody,
    signatureHeader,
    now,
  });

  if (!processed.ok) {
    return { ok: false, error: processed.error };
  }

  return {
    ok: true,
    effectivePlan: processed.effectivePlan ?? subRow.plan,
  };
}
