// @vitest-environment node
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "@casefolio/db";
import { afterAll, describe, expect, it } from "vitest";
import { env } from "@/env";
import {
  completeSandboxCheckoutForUser,
  getUserBillingOverview,
  prepareCheckoutSessionForUser,
} from "@/lib/billing/service";
import { resolvePlanFromServerPriceId } from "@/lib/billing/server-config";
import { signPaddleWebhookPayload } from "@/lib/billing/signature";
import { handleSignedPaddleWebhookRequest } from "@/lib/billing/webhooks";
import { db, dbSchema } from "@/lib/db";

/**
 * Regression suite for the payment / plan-integrity defects found in the production-readiness audit.
 * Payloads mirror real Paddle Billing notifications (real-looking ids, `transaction.*` lifecycle,
 * browser-controlled `custom_data`).
 */

const createdUserIds: string[] = [];
const createdOrgIds: string[] = [];
const createdEventIds: string[] = [];
const createdOperationIds: string[] = [];

function id(prefix: string): string {
  return `${prefix}_01${randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

async function createUser(label: string) {
  const email = `hardening-${label}-${randomUUID().slice(0, 8)}@casefolio.test`;
  const [user] = await db
    .insert(dbSchema.users)
    .values({ email, emailVerified: true, name: `Hardening ${label}`, plan: "free", role: "user" })
    .returning();
  createdUserIds.push(user!.id);
  return { id: user!.id, email, name: user!.name };
}

async function post(
  eventType: string,
  data: Record<string, unknown>,
  options: { eventId?: string; occurredAt?: Date } = {},
) {
  const occurredAt = options.occurredAt ?? new Date();
  const eventId = options.eventId ?? id("evt");
  createdEventIds.push(eventId);
  const rawBody = JSON.stringify({
    event_id: eventId,
    event_type: eventType,
    occurred_at: occurredAt.toISOString(),
    data,
  });
  const result = await handleSignedPaddleWebhookRequest({
    rawBody,
    signatureHeader: signPaddleWebhookPayload(
      rawBody,
      env.PADDLE_WEBHOOK_SECRET,
      Math.floor(occurredAt.getTime() / 1000),
    ),
    now: occurredAt,
  });
  if (!result.ok) throw new Error(`webhook rejected: ${result.code}`);
  return result;
}

function subscriptionData(args: {
  subId?: string;
  customerId?: string;
  priceId: string;
  quantity?: number;
  status?: string;
  interval?: "month" | "year";
  customData?: Record<string, unknown>;
}) {
  const now = new Date();
  const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return {
    id: args.subId ?? id("sub"),
    customer_id: args.customerId ?? id("ctm"),
    status: args.status ?? "active",
    items: [
      {
        quantity: args.quantity ?? 1,
        price: { id: args.priceId, billing_cycle: { interval: args.interval ?? "month", frequency: 1 } },
      },
    ],
    current_billing_period: { starts_at: now.toISOString(), ends_at: end.toISOString() },
    next_billed_at: end.toISOString(),
    scheduled_change: null,
    custom_data: args.customData ?? {},
  };
}

async function planOf(userId: string) {
  const [row] = await db
    .select({ plan: dbSchema.users.plan })
    .from(dbSchema.users)
    .where(eq(dbSchema.users.id, userId));
  return row?.plan;
}

async function subscriptionsOf(userId: string) {
  return db
    .select()
    .from(dbSchema.subscriptions)
    .where(eq(dbSchema.subscriptions.userId, userId));
}

/** Runs the real `prepare` and returns the checkout intent id the browser would forward to Paddle. */
async function openCheckout(
  actor: { id: string; email: string; name: string },
  input: Record<string, unknown>,
) {
  const prep = await prepareCheckoutSessionForUser(actor, input);
  if (!prep.ok) throw new Error(`prepare failed: ${prep.code}`);
  createdOperationIds.push(prep.session.customData.operationId);
  if (prep.session.orgId) createdOrgIds.push(prep.session.orgId);
  return prep.session;
}

afterAll(async () => {
  if (createdEventIds.length) {
    await db.delete(dbSchema.webhookEvents).where(inArray(dbSchema.webhookEvents.eventId, createdEventIds));
  }
  if (createdOperationIds.length) {
    await db
      .delete(dbSchema.billingOperations)
      .where(inArray(dbSchema.billingOperations.id, createdOperationIds));
  }
  if (createdUserIds.length) {
    await db
      .delete(dbSchema.billingOperations)
      .where(inArray(dbSchema.billingOperations.actorUserId, createdUserIds));
    await db.delete(dbSchema.users).where(inArray(dbSchema.users.id, createdUserIds));
  }
  if (createdOrgIds.length) {
    await db.delete(dbSchema.organizations).where(inArray(dbSchema.organizations.id, createdOrgIds));
  }
});

describe("Paddle price → plan mapping is exact (P0-3)", () => {
  it("maps only the six configured price ids (Pro, Team, Plus × Monthly/Yearly) and never guesses from substrings", () => {
    expect(resolvePlanFromServerPriceId(env.PADDLE_PRICE_PRO_MONTHLY)).toEqual({ plan: "pro", interval: "monthly" });
    expect(resolvePlanFromServerPriceId(env.PADDLE_PRICE_PRO_YEARLY)).toEqual({ plan: "pro", interval: "yearly" });
    expect(resolvePlanFromServerPriceId(env.PADDLE_PRICE_TEAM_MONTHLY)).toEqual({ plan: "team", interval: "monthly" });
    expect(resolvePlanFromServerPriceId(env.PADDLE_PRICE_TEAM_YEARLY)).toEqual({ plan: "team", interval: "yearly" });
    expect(resolvePlanFromServerPriceId(env.PADDLE_PRICE_PLUS_MONTHLY)).toEqual({ plan: "plus", interval: "monthly" });
    expect(resolvePlanFromServerPriceId(env.PADDLE_PRICE_PLUS_YEARLY)).toEqual({ plan: "plus", interval: "yearly" });

    for (const unknown of [
      "pri_01proxxxxxxxxxxxxxxxxxxxx",
      "pri_01teamyearlyxxxxxxxxxxxx",
      "pri_01plusyearlyxxxxxxxxxxxx",
      "pro",
      "team_year",
      "plus_month",
      "",
      "  ",
    ]) {
      expect(resolvePlanFromServerPriceId(unknown)).toBeNull();
    }
    expect(resolvePlanFromServerPriceId(null)).toBeNull();
    expect(resolvePlanFromServerPriceId(undefined)).toBeNull();
  });
});

describe("Webhook event allow-list: unpaid checkouts grant nothing (P0-1)", () => {
  it("ignores draft / ready / billed transactions even when custom_data names a real user", async () => {
    const user = await createUser("abandoned");

    for (const [eventType, status] of [
      ["transaction.created", "draft"],
      ["transaction.updated", "ready"],
      ["transaction.billed", "billed"],
      ["transaction.paid", "paid"],
    ] as const) {
      const result = await post(eventType, {
        id: id("txn"),
        status,
        customer_id: id("ctm"),
        items: [{ quantity: 1, price: { id: env.PADDLE_PRICE_PRO_MONTHLY } }],
        custom_data: { userId: user.id, plan: "pro", interval: "monthly" },
      });
      expect(result.ignored).toBe("event_not_actionable");
      expect(result.effectivePlan).toBeNull();
    }

    expect(await planOf(user.id)).toBe("free");
    expect(await subscriptionsOf(user.id)).toHaveLength(0);
  });

  it("ignores a transaction.completed that is not completed and one without a known subscription", async () => {
    const user = await createUser("txn-only");

    const notCompleted = await post("transaction.completed", {
      id: id("txn"),
      status: "billed",
      customer_id: id("ctm"),
      custom_data: { userId: user.id },
    });
    expect(notCompleted.ignored).toBe("transaction_not_completed");

    const unknownSub = await post("transaction.completed", {
      id: id("txn"),
      status: "completed",
      subscription_id: id("sub"),
      customer_id: id("ctm"),
      items: [{ quantity: 1, price: { id: env.PADDLE_PRICE_PRO_MONTHLY } }],
      custom_data: { userId: user.id },
    });
    expect(unknownSub.ignored).toBe("transaction_without_known_subscription");

    expect(await planOf(user.id)).toBe("free");
    expect(await subscriptionsOf(user.id)).toHaveLength(0);
  });
});

describe("Subscription ownership comes from a server checkout intent, not custom_data (P0-2)", () => {
  it("rejects a paid-looking subscription whose custom_data merely names someone else", async () => {
    const victim = await createUser("victim");
    const result = await post(
      "subscription.activated",
      subscriptionData({
        priceId: env.PADDLE_PRICE_PRO_MONTHLY,
        customData: { userId: victim.id, orgId: randomUUID(), plan: "pro" },
      }),
    );
    expect(result.ignored).toBe("unresolved_identity");
    expect(await planOf(victim.id)).toBe("free");
    expect(await subscriptionsOf(victim.id)).toHaveLength(0);
  });

  it("binds the purchase to the authenticated buyer even if custom_data points at a victim", async () => {
    const buyer = await createUser("buyer");
    const victim = await createUser("victim2");
    const session = await openCheckout(buyer, { plan: "pro", interval: "monthly" });

    const result = await post(
      "subscription.activated",
      subscriptionData({
        priceId: session.priceId,
        customData: { ...session.customData, userId: victim.id },
      }),
    );

    expect(result.ignored).toBeUndefined();
    expect(result.effectivePlan).toBe("pro");
    expect(await planOf(buyer.id)).toBe("pro");
    expect(await planOf(victim.id)).toBe("free");
    expect(await subscriptionsOf(victim.id)).toHaveLength(0);
  });

  it("cannot overwrite a victim's live subscription by claiming their id in custom_data", async () => {
    const victim = await createUser("victim3");
    const paid = await completeSandboxCheckoutForUser(victim, { plan: "pro", interval: "monthly" });
    expect(paid.ok).toBe(true);
    const [before] = await subscriptionsOf(victim.id);

    const attackerSubId = id("sub");
    const result = await post(
      "subscription.activated",
      subscriptionData({
        subId: attackerSubId,
        priceId: env.PADDLE_PRICE_PRO_YEARLY,
        customData: { userId: victim.id },
      }),
    );
    expect(result.ignored).toBe("unresolved_identity");

    const [after] = await subscriptionsOf(victim.id);
    expect(after?.paddleSubscriptionId).toBe(before?.paddleSubscriptionId);
    expect(after?.interval).toBe("monthly");
  });

  it("makes a checkout intent single-purchase", async () => {
    const buyer = await createUser("single-use");
    const session = await openCheckout(buyer, { plan: "pro", interval: "monthly" });

    const first = await post(
      "subscription.activated",
      subscriptionData({ priceId: session.priceId, customData: session.customData }),
    );
    expect(first.effectivePlan).toBe("pro");

    const replayWithNewSub = await post(
      "subscription.activated",
      subscriptionData({ priceId: session.priceId, customData: session.customData }),
    );
    expect(replayWithNewSub.ignored).toBe("invalid_checkout_intent");
    expect(await subscriptionsOf(buyer.id)).toHaveLength(1);
  });

  it("rejects an expired checkout intent", async () => {
    const buyer = await createUser("expired");
    const session = await openCheckout(buyer, { plan: "pro", interval: "monthly" });
    await db
      .update(dbSchema.billingOperations)
      .set({ createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000) })
      .where(eq(dbSchema.billingOperations.id, session.customData.operationId));

    const result = await post(
      "subscription.activated",
      subscriptionData({ priceId: session.priceId, customData: session.customData }),
    );
    expect(result.ignored).toBe("invalid_checkout_intent");
    expect(await planOf(buyer.id)).toBe("free");
  });
});

describe("Right plan, right interval, right scope", () => {
  it("never grants a plan for a price id that is not one of ours, even with a 'pro' look-alike", async () => {
    const buyer = await createUser("unknown-price");
    const session = await openCheckout(buyer, { plan: "pro", interval: "monthly" });

    const result = await post(
      "subscription.activated",
      subscriptionData({ priceId: "pri_01proxxxxxxxxxxxxxxxxxxxx", customData: session.customData }),
    );
    expect(result.ignored).toBe("unknown_price");
    expect(await planOf(buyer.id)).toBe("free");
  });

  it("derives interval from the paid price, not from browser custom_data", async () => {
    const yearlyBuyer = await createUser("yearly");
    const yearly = await openCheckout(yearlyBuyer, { plan: "pro", interval: "yearly" });
    await post(
      "subscription.activated",
      subscriptionData({
        priceId: env.PADDLE_PRICE_PRO_YEARLY,
        interval: "year",
        customData: { ...yearly.customData, interval: "monthly" },
      }),
    );
    expect((await subscriptionsOf(yearlyBuyer.id))[0]?.interval).toBe("yearly");

    const monthlyBuyer = await createUser("monthly");
    const monthly = await openCheckout(monthlyBuyer, { plan: "pro", interval: "monthly" });
    await post(
      "subscription.activated",
      subscriptionData({
        priceId: env.PADDLE_PRICE_PRO_MONTHLY,
        customData: { ...monthly.customData, interval: "yearly" },
      }),
    );
    expect((await subscriptionsOf(monthlyBuyer.id))[0]?.interval).toBe("monthly");
  });

  it("refuses a Teams price on a personal intent so a personal user never receives the team plan", async () => {
    const buyer = await createUser("scope");
    const session = await openCheckout(buyer, { plan: "pro", interval: "monthly" });

    const result = await post(
      "subscription.activated",
      subscriptionData({ priceId: env.PADDLE_PRICE_TEAM_MONTHLY, quantity: 5, customData: session.customData }),
    );
    expect(result.ignored).toBe("plan_scope_mismatch");
    expect(await planOf(buyer.id)).toBe("free");
    expect(await subscriptionsOf(buyer.id)).toHaveLength(0);
  });

  it("creates the organization before payment for Teams and grants seats to that org only", async () => {
    const owner = await createUser("team-owner");
    const session = await openCheckout(owner, { plan: "team", interval: "monthly", seats: 5 });
    expect(session.orgId).toBeTruthy();

    const result = await post(
      "subscription.activated",
      subscriptionData({
        priceId: env.PADDLE_PRICE_TEAM_MONTHLY,
        quantity: 5,
        customData: session.customData,
      }),
    );
    expect(result.effectivePlan).toBe("team");
    expect(result.currentPaidCapacity).toBe(5);
    expect(await planOf(owner.id)).toBe("free"); // Teams never grants personal Pro

    const [sub] = await db
      .select()
      .from(dbSchema.subscriptions)
      .where(eq(dbSchema.subscriptions.orgId, session.orgId!));
    expect(sub?.plan).toBe("team");
    expect(sub?.userId).toBeNull();
  });

  it("provisions flat-rate Plus agency workspace with 20 included seats and custom domain entitlement", async () => {
    const owner = await createUser("plus-owner");
    const session = await openCheckout(owner, { plan: "plus", interval: "monthly" });
    expect(session.orgId).toBeTruthy();
    expect(session.seats).toBe(1); // Flat-rate Paddle item quantity = 1 (covers 20 workspace seats)

    const result = await post(
      "subscription.activated",
      subscriptionData({
        priceId: env.PADDLE_PRICE_PLUS_MONTHLY,
        quantity: 1,
        customData: session.customData,
      }),
    );
    expect(result.effectivePlan).toBe("plus");
    expect(result.currentPaidCapacity).toBe(20);
    expect(await planOf(owner.id)).toBe("free"); // Plus scopes to the agency org workspace

    const [sub] = await db
      .select()
      .from(dbSchema.subscriptions)
      .where(eq(dbSchema.subscriptions.orgId, session.orgId!));
    expect(sub?.plan).toBe("plus");
    expect(sub?.maxSeats).toBe(20);
    expect(sub?.customDomainEnabled).toBe(true);
    expect(sub?.watermarkEnabled).toBe(false);
  });
});

describe("Duplicate purchases cannot orphan a billing subscription (P0-4)", () => {
  it("refuses a second checkout while a subscription is live", async () => {
    const user = await createUser("dup-prepare");
    const paid = await completeSandboxCheckoutForUser(user, { plan: "pro", interval: "monthly" });
    expect(paid.ok).toBe(true);

    const second = await prepareCheckoutSessionForUser(user, { plan: "pro", interval: "yearly" });
    expect(second).toMatchObject({ ok: false, code: "ALREADY_SUBSCRIBED" });
  });

  it("keeps the original subscription when a second one is paid anyway (e.g. two tabs)", async () => {
    const user = await createUser("dup-webhook");
    const paid = await completeSandboxCheckoutForUser(user, { plan: "pro", interval: "monthly" });
    expect(paid.ok).toBe(true);
    const [original] = await subscriptionsOf(user.id);

    // Second tab: the intent was created before the first purchase finished.
    const operationId = randomUUID();
    createdOperationIds.push(operationId);
    await db.insert(dbSchema.billingOperations).values({
      id: operationId,
      actorUserId: user.id,
      kind: "checkout",
      status: "pending",
      idempotencyKey: `checkout:${user.id}:${operationId}`,
      meta: { plan: "pro", interval: "monthly", seats: 1, orgId: null },
    });

    const duplicateSubId = id("sub");
    const result = await post(
      "subscription.activated",
      subscriptionData({
        subId: duplicateSubId,
        priceId: env.PADDLE_PRICE_PRO_MONTHLY,
        customData: { operationId },
      }),
    );
    expect(result.ignored).toBe("duplicate_subscription");

    const rows = await subscriptionsOf(user.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.paddleSubscriptionId).toBe(original?.paddleSubscriptionId);
    expect(await planOf(user.id)).toBe("pro");

    const [op] = await db
      .select()
      .from(dbSchema.billingOperations)
      .where(eq(dbSchema.billingOperations.id, operationId));
    expect(op?.status).toBe("failed");
    expect(op?.meta).toMatchObject({ reason: "duplicate_subscription", duplicatePaddleSubscriptionId: duplicateSubId });
  });

  it("allows re-subscribing after a subscription has fully ended", async () => {
    const user = await createUser("resub");
    const first = await completeSandboxCheckoutForUser(user, { plan: "pro", interval: "monthly" });
    expect(first.ok).toBe(true);
    const [sub] = await subscriptionsOf(user.id);

    await post("subscription.canceled", {
      id: sub!.paddleSubscriptionId,
      customer_id: sub!.paddleCustomerId,
      status: "canceled",
      canceled_at: new Date().toISOString(),
    });
    expect(await planOf(user.id)).toBe("free");

    const again = await completeSandboxCheckoutForUser(user, { plan: "pro", interval: "yearly" });
    expect(again.ok).toBe(true);
    expect(await planOf(user.id)).toBe("pro");
    const rows = await subscriptionsOf(user.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.interval).toBe("yearly");
  });
});

describe("Payment failure and renewal edge cases", () => {
  it("grants nothing for a failed first payment, and still works when the customer retries in the same checkout", async () => {
    const buyer = await createUser("retry");
    const session = await openCheckout(buyer, { plan: "pro", interval: "monthly" });

    const failed = await post("transaction.payment_failed", {
      id: id("txn"),
      status: "past_due",
      customer_id: id("ctm"),
      items: [{ quantity: 1, price: { id: session.priceId } }],
      custom_data: session.customData,
    });
    expect(failed.effectivePlan).toBe("free");
    expect(await planOf(buyer.id)).toBe("free");
    expect(await subscriptionsOf(buyer.id)).toHaveLength(0);

    const retried = await post(
      "subscription.activated",
      subscriptionData({ priceId: session.priceId, customData: session.customData }),
    );
    expect(retried.effectivePlan).toBe("pro");
    expect(await planOf(buyer.id)).toBe("pro");
  });

  it("does not resurrect a canceled subscription when a late transaction.completed arrives", async () => {
    const user = await createUser("no-resurrect");
    const paid = await completeSandboxCheckoutForUser(user, { plan: "pro", interval: "monthly" });
    expect(paid.ok).toBe(true);
    const [sub] = await subscriptionsOf(user.id);

    const canceledAt = new Date(Date.now() + 1_000);
    await post(
      "subscription.canceled",
      { id: sub!.paddleSubscriptionId, customer_id: sub!.paddleCustomerId, status: "canceled", canceled_at: canceledAt.toISOString() },
      { occurredAt: canceledAt },
    );
    expect(await planOf(user.id)).toBe("free");

    const later = new Date(Date.now() + 2_000);
    const late = await post(
      "transaction.completed",
      {
        id: id("txn"),
        status: "completed",
        subscription_id: sub!.paddleSubscriptionId,
        customer_id: sub!.paddleCustomerId,
        items: [{ quantity: 1, price: { id: env.PADDLE_PRICE_PRO_MONTHLY } }],
      },
      { occurredAt: later },
    );
    expect(late.effectivePlan).toBe("free");
    expect(late.lifecycleStatus).toBe("canceled");
    expect(await planOf(user.id)).toBe("free");
  });

  it("recovers a past_due subscription when the retry payment completes", async () => {
    const user = await createUser("recover");
    const paid = await completeSandboxCheckoutForUser(user, { plan: "pro", interval: "monthly" });
    expect(paid.ok).toBe(true);
    const [sub] = await subscriptionsOf(user.id);

    const pastDueAt = new Date(Date.now() + 1_000);
    await post(
      "subscription.past_due",
      { id: sub!.paddleSubscriptionId, customer_id: sub!.paddleCustomerId, status: "past_due" },
      { occurredAt: pastDueAt },
    );
    const overviewPastDue = await getUserBillingOverview(user.id);
    expect(overviewPastDue.subscription?.status).toBe("past_due");

    const recoveredAt = new Date(Date.now() + 2_000);
    const recovered = await post(
      "transaction.completed",
      {
        id: id("txn"),
        status: "completed",
        subscription_id: sub!.paddleSubscriptionId,
        customer_id: sub!.paddleCustomerId,
        items: [{ quantity: 1, price: { id: env.PADDLE_PRICE_PRO_MONTHLY } }],
      },
      { occurredAt: recoveredAt },
    );
    expect(recovered.lifecycleStatus).toBe("active");
    const [after] = await subscriptionsOf(user.id);
    expect(after?.pastDueSince).toBeNull();
  });

  it("ignores out-of-order events instead of rolling the subscription back", async () => {
    const user = await createUser("order");
    const paid = await completeSandboxCheckoutForUser(user, { plan: "pro", interval: "monthly" });
    expect(paid.ok).toBe(true);
    const [sub] = await subscriptionsOf(user.id);

    const t1 = new Date(Date.now() + 10_000);
    const t0 = new Date(Date.now() + 5_000);
    await post("subscription.canceled", { id: sub!.paddleSubscriptionId, customer_id: sub!.paddleCustomerId, status: "canceled" }, { occurredAt: t1 });
    const stale = await post(
      "subscription.updated",
      subscriptionData({ subId: sub!.paddleSubscriptionId!, customerId: sub!.paddleCustomerId!, priceId: env.PADDLE_PRICE_PRO_MONTHLY }),
      { occurredAt: t0 },
    );
    expect(stale.outOfOrderIgnored).toBe(true);
    expect(await planOf(user.id)).toBe("free");
  });
});

describe("Sandbox simulator is the same code path as Paddle", () => {
  it("creates exactly one subscription, one completed intent, and one invoice per purchase", async () => {
    const user = await createUser("one-invoice");
    const paid = await completeSandboxCheckoutForUser(user, { plan: "pro", interval: "monthly" });
    expect(paid.ok).toBe(true);

    expect(await subscriptionsOf(user.id)).toHaveLength(1);
    const ops = await db
      .select()
      .from(dbSchema.billingOperations)
      .where(
        and(
          eq(dbSchema.billingOperations.actorUserId, user.id),
          eq(dbSchema.billingOperations.kind, "checkout"),
        ),
      );
    expect(ops).toHaveLength(1);
    expect(ops[0]?.status).toBe("completed");

    const overview = await getUserBillingOverview(user.id);
    expect(overview.invoices).toHaveLength(1);
    expect(overview.effectivePlan).toBe("pro");
  });
});

describe("Customer-facing billing data is truthful and private", () => {
  it("lists exactly one invoice per real transaction, with the real card and amount from Paddle", async () => {
    const buyer = await createUser("real-invoice");
    const session = await openCheckout(buyer, { plan: "pro", interval: "yearly" });
    const subId = id("sub");
    const customerId = id("ctm");
    const t0 = new Date();

    await post(
      "subscription.created",
      subscriptionData({
        subId,
        customerId,
        priceId: session.priceId,
        interval: "year",
        customData: session.customData,
      }),
      { occurredAt: t0 },
    );
    await post(
      "subscription.activated",
      subscriptionData({ subId, customerId, priceId: session.priceId, interval: "year" }),
      { occurredAt: new Date(t0.getTime() + 1_000) },
    );
    await post(
      "transaction.completed",
      {
        id: id("txn"),
        status: "completed",
        invoice_number: "1042-10001",
        subscription_id: subId,
        customer_id: customerId,
        items: [{ quantity: 1, price: { id: session.priceId, billing_cycle: { interval: "year", frequency: 1 } } }],
        details: { totals: { currency_code: "USD", grand_total: "9588" } },
        payments: [
          {
            status: "captured",
            method_details: { type: "card", card: { type: "visa", last4: "1111", expiry_month: 8, expiry_year: 2029 } },
          },
        ],
      },
      { occurredAt: new Date(t0.getTime() + 2_000) },
    );

    const overview = await getUserBillingOverview(buyer.id);
    expect(overview.invoices).toHaveLength(1);
    expect(overview.invoices[0]).toMatchObject({
      invoiceNumber: "1042-10001",
      amountUsd: 95.88,
      status: "paid",
    });
    expect(overview.subscription).toMatchObject({
      interval: "yearly",
      paymentBrand: "Visa",
      paymentLast4: "1111",
      paymentExpiry: "08/29",
    });
  });

  it("never invents a card when Paddle has not reported one", async () => {
    const buyer = await createUser("no-card");
    const session = await openCheckout(buyer, { plan: "pro", interval: "monthly" });
    await post(
      "subscription.activated",
      subscriptionData({ priceId: session.priceId, customData: session.customData }),
    );
    const overview = await getUserBillingOverview(buyer.id);
    expect(overview.subscription?.paymentBrand).toBeNull();
    expect(overview.subscription?.paymentLast4).toBeNull();
    expect(overview.subscription?.paymentExpiry).toBeNull();
  });

  it("does not show another customer's (or a forged) event in your invoices", async () => {
    const owner = await createUser("invoice-owner");
    const paid = await completeSandboxCheckoutForUser(owner, { plan: "pro", interval: "monthly" });
    expect(paid.ok).toBe(true);

    const forged = await post("transaction.completed", {
      id: id("txn"),
      status: "completed",
      invoice_number: "FORGED-0001",
      subscription_id: id("sub"),
      customer_id: id("ctm"),
      items: [{ quantity: 1, price: { id: env.PADDLE_PRICE_PRO_MONTHLY } }],
      custom_data: { userId: owner.id, amountUsd: 0, invoiceNumber: "FORGED-0001" },
    });
    expect(forged.ignored).toBe("transaction_without_known_subscription");

    const overview = await getUserBillingOverview(owner.id);
    expect(overview.invoices.map((invoice) => invoice.invoiceNumber)).not.toContain("FORGED-0001");
    expect(overview.invoices).toHaveLength(1);
  });

  it("retrying a failed sandbox payment recovers the same subscription instead of buying a second one", async () => {
    const user = await createUser("sandbox-retry");
    const paid = await completeSandboxCheckoutForUser(user, { plan: "pro", interval: "monthly" });
    expect(paid.ok).toBe(true);
    const [sub] = await subscriptionsOf(user.id);

    await post(
      "subscription.past_due",
      { id: sub!.paddleSubscriptionId, customer_id: sub!.paddleCustomerId, status: "past_due" },
      { occurredAt: new Date(Date.now() + 1_000) },
    );
    expect((await getUserBillingOverview(user.id)).subscription?.status).toBe("past_due");

    const retry = await completeSandboxCheckoutForUser(user, { plan: "pro", interval: "monthly" }, {
      now: new Date(Date.now() + 5_000),
    });
    expect(retry.ok).toBe(true);

    const rows = await subscriptionsOf(user.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.paddleSubscriptionId).toBe(sub?.paddleSubscriptionId);
    expect(rows[0]?.status).toBe("active");
    expect(rows[0]?.pastDueSince).toBeNull();
  });
});
