// @vitest-environment node
import { randomUUID } from "node:crypto";
import { eq, inArray } from "@casefolio/db";
import { afterAll, describe, expect, it, vi } from "vitest";
import type * as ServerConfigModule from "@/lib/billing/server-config";
import { env } from "@/env";
import { evaluateSubscriptionLifecycle } from "@/lib/billing/plans";
import { reconcileSubscriptionWithPaddle } from "@/lib/billing/reconcile";
import { prepareCheckoutSessionForUser } from "@/lib/billing/service";
import { signPaddleWebhookPayload } from "@/lib/billing/signature";
import { handleSignedPaddleWebhookRequest } from "@/lib/billing/webhooks";
import { db, dbSchema } from "@/lib/db";

vi.mock("@/lib/billing/server-config", async (importOriginal) => {
  const actual = await importOriginal<typeof ServerConfigModule>();
  return { ...actual, isRealPaddleApiKeyConfigured: () => true };
});

const userIds: string[] = [];
const eventIds: string[] = [];
const opIds: string[] = [];

afterAll(async () => {
  if (eventIds.length) {
    await db.delete(dbSchema.webhookEvents).where(inArray(dbSchema.webhookEvents.eventId, eventIds));
  }
  if (opIds.length) {
    await db.delete(dbSchema.billingOperations).where(inArray(dbSchema.billingOperations.id, opIds));
  }
  if (userIds.length) {
    await db.delete(dbSchema.users).where(inArray(dbSchema.users.id, userIds));
  }
});

describe("stale-subscription fail-safe", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  const days = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  it("keeps paying customers entitled through short webhook delays but not forever", () => {
    expect(evaluateSubscriptionLifecycle({ status: "active", currentPeriodEnd: days(-20), now }).grantsPaidAccess).toBe(true);
    expect(evaluateSubscriptionLifecycle({ status: "active", currentPeriodEnd: days(5), now }).grantsPaidAccess).toBe(true);
    expect(evaluateSubscriptionLifecycle({ status: "active", currentPeriodEnd: days(15), now }).grantsPaidAccess).toBe(false);
    expect(evaluateSubscriptionLifecycle({ status: "trialing", currentPeriodEnd: days(15), now }).grantsPaidAccess).toBe(false);
    expect(evaluateSubscriptionLifecycle({ status: "active", currentPeriodEnd: null, now }).grantsPaidAccess).toBe(true);
  });
});

describe("reconcileSubscriptionWithPaddle", () => {
  async function createPaidUser() {
    const email = `reconcile-${randomUUID().slice(0, 8)}@casefolio.test`;
    const [user] = await db
      .insert(dbSchema.users)
      .values({ email, emailVerified: true, name: "Reconcile", plan: "free", role: "user" })
      .returning();
    userIds.push(user!.id);

    const prep = await prepareCheckoutSessionForUser({ id: user!.id, email, name: "Reconcile" }, { plan: "pro", interval: "monthly" });
    if (!prep.ok) throw new Error("prepare failed");
    opIds.push(prep.session.customData.operationId);

    const subId = `sub_01${randomUUID().replace(/-/g, "").slice(0, 24)}`;
    const eventId = `evt_01${randomUUID().replace(/-/g, "").slice(0, 24)}`;
    eventIds.push(eventId);
    const occurredAt = new Date(Date.now() - 60_000);
    const periodEnd = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const rawBody = JSON.stringify({
      event_id: eventId,
      event_type: "subscription.activated",
      occurred_at: occurredAt.toISOString(),
      data: {
        id: subId,
        customer_id: `ctm_01${randomUUID().replace(/-/g, "").slice(0, 24)}`,
        status: "active",
        items: [{ quantity: 1, price: { id: env.PADDLE_PRICE_PRO_MONTHLY } }],
        current_billing_period: { starts_at: occurredAt.toISOString(), ends_at: periodEnd.toISOString() },
        custom_data: prep.session.customData,
      },
    });
    await handleSignedPaddleWebhookRequest({
      rawBody,
      signatureHeader: signPaddleWebhookPayload(rawBody, env.PADDLE_WEBHOOK_SECRET, Math.floor(occurredAt.getTime() / 1000)),
      now: occurredAt,
    });
    return { userId: user!.id, subId };
  }

  function paddleReturns(data: Record<string, unknown>): typeof fetch {
    return (async () =>
      new Response(JSON.stringify({ data }), { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch;
  }

  it("repairs a missed cancellation: Paddle says canceled → the user drops to Free", async () => {
    const { userId, subId } = await createPaidUser();
    const [before] = await db.select({ plan: dbSchema.users.plan }).from(dbSchema.users).where(eq(dbSchema.users.id, userId));
    expect(before?.plan).toBe("pro");

    const now = new Date();
    const outcome = await reconcileSubscriptionWithPaddle(
      subId,
      now,
      paddleReturns({ id: subId, status: "canceled", canceled_at: now.toISOString(), items: [{ quantity: 1, price: { id: env.PADDLE_PRICE_PRO_MONTHLY } }] }),
    );
    expect(outcome).toEqual({ status: "synced", paddleStatus: "canceled" });
    eventIds.push(`reconcile_${subId}_${Math.floor(now.getTime() / 3_600_000)}`);

    const [after] = await db.select({ plan: dbSchema.users.plan }).from(dbSchema.users).where(eq(dbSchema.users.id, userId));
    expect(after?.plan).toBe("free");
  });

  it("does nothing harmful when Paddle is unreachable or returns an error", async () => {
    const { userId, subId } = await createPaidUser();

    const failing = (async () => new Response("{}", { status: 500 })) as typeof fetch;
    expect(await reconcileSubscriptionWithPaddle(subId, new Date(), failing)).toEqual({ status: "error", reason: "paddle_http_500" });

    const throwing = (async () => {
      throw new Error("network down");
    }) as typeof fetch;
    expect(await reconcileSubscriptionWithPaddle(subId, new Date(), throwing)).toEqual({ status: "error", reason: "paddle_unreachable" });

    const [row] = await db.select({ plan: dbSchema.users.plan }).from(dbSchema.users).where(eq(dbSchema.users.id, userId));
    expect(row?.plan).toBe("pro");
  });

  it("never reconciles simulated sandbox subscriptions against the real Paddle API", async () => {
    expect(await reconcileSubscriptionWithPaddle("sub_sdbx_abc123", new Date(), paddleReturns({}))).toEqual({
      status: "skipped",
      reason: "simulated_subscription",
    });
    expect(await reconcileSubscriptionWithPaddle(null)).toEqual({ status: "skipped", reason: "no_subscription_id" });
  });
});
