// @vitest-environment node
import { randomUUID } from "node:crypto";
import { eq } from "@casefolio/db";
import { describe, expect, it } from "vitest";
import { env } from "@/env";
import {
  cancelUserSubscription,
  completeSandboxCheckoutForUser,
  getUserBillingOverview,
  prepareCheckoutSessionForUser,
  resumeUserSubscription,
  updateTeamCustomDomain,
} from "@/lib/billing/service";
import { computeTeamsPrice } from "@/lib/billing/plans";
import {
  computePaddleWebhookHmacHex,
  signPaddleWebhookPayload,
  verifyPaddleWebhookSignature,
} from "@/lib/billing/signature";
import { handleSignedPaddleWebhookRequest } from "@/lib/billing/webhooks";
import { db, dbSchema } from "@/lib/db";

describe("Paddle Billing signature, checkout & idempotent webhooks (C-701)", () => {
  it("verifies authentic Paddle-Signature headers, supports key rotation, and blocks tampering or stale replays", () => {
    const secret = "pdl_ntfset_unit_test_secret_key_2026";
    const rawBody = JSON.stringify({
      event_id: "evt_01testsignature",
      event_type: "subscription.activated",
      data: { id: "sub_01test" },
    });
    const ts = 1_762_000_000;
    const nowMs = ts * 1000 + 15_000;

    const validHeader = signPaddleWebhookPayload(rawBody, secret, ts);
    const validCheck = verifyPaddleWebhookSignature({
      rawBody,
      signatureHeader: validHeader,
      secret,
      nowMs,
    });
    expect(validCheck).toEqual({ ok: true, timestampSeconds: ts });

    // Key rotation: multiple h1 values where second matches active secret
    const rotatedHeader = `ts=${ts};h1=${"0".repeat(64)};h1=${computePaddleWebhookHmacHex(rawBody, secret, ts)}`;
    expect(
      verifyPaddleWebhookSignature({
        rawBody,
        signatureHeader: rotatedHeader,
        secret,
        nowMs,
      }).ok,
    ).toBe(true);

    // Tampered body
    const tampered = verifyPaddleWebhookSignature({
      rawBody: `${rawBody} `,
      signatureHeader: validHeader,
      secret,
      nowMs,
    });
    expect(tampered).toEqual({
      ok: false,
      code: "INVALID_SIGNATURE",
      error: expect.any(String),
    });

    // Expired timestamp outside 5-minute replay window
    const expired = verifyPaddleWebhookSignature({
      rawBody,
      signatureHeader: validHeader,
      secret,
      nowMs: (ts + 600) * 1000,
    });
    expect(expired).toEqual({
      ok: false,
      code: "TIMESTAMP_EXPIRED",
      error: expect.any(String),
    });

    // Missing & malformed headers
    expect(
      verifyPaddleWebhookSignature({
        rawBody,
        signatureHeader: null,
        secret,
        nowMs,
      }).ok,
    ).toBe(false);
    expect(
      verifyPaddleWebhookSignature({
        rawBody,
        signatureHeader: "ts=abc;h1=nothex",
        secret,
        nowMs,
      }).ok,
    ).toBe(false);
  });

  it("upgrades Free user to Pro via sandbox checkout, enforces webhook idempotency on replay, and syncs lifecycle states", async () => {
    const stamp = Date.now();
    const email = `c701-billing-${stamp}@casefolio.test`;

    const [createdUser] = await db
      .insert(dbSchema.users)
      .values({
        email,
        emailVerified: true,
        name: "Billing Tester",
        plan: "free",
        role: "user",
      })
      .returning();

    const userId = createdUser!.id;
    const createdEventIds: string[] = [];

    try {
      // 1. Prepare checkout session -> maps server price ID cleanly
      const prep = await prepareCheckoutSessionForUser(
        { id: userId, email, name: "Billing Tester" },
        { plan: "pro", interval: "yearly" },
      );
      expect(prep.ok).toBe(true);
      if (!prep.ok) return;
      expect(prep.session.priceId).toBe(env.PADDLE_PRICE_PRO_YEARLY);
      expect(prep.session.amountUsd).toBe(95.88);
      expect(prep.session.amountCents).toBe(9588);

      // 2. Complete sandbox checkout -> dispatches signed webhook -> upgrades user to Pro
      const completed = await completeSandboxCheckoutForUser(
        { id: userId, email, name: "Billing Tester" },
        { plan: "pro", interval: "yearly" },
      );
      expect(completed.ok).toBe(true);
      if (!completed.ok) return;
      createdEventIds.push(completed.eventId);
      expect(completed.effectivePlan).toBe("pro");

      const [upgradedUser] = await db
        .select()
        .from(dbSchema.users)
        .where(eq(dbSchema.users.id, userId));
      expect(upgradedUser?.plan).toBe("pro");

      // 3. Fetch stored webhook payload and replay the EXACT SAME event_id -> idempotent!
      const [storedEvent] = await db
        .select()
        .from(dbSchema.webhookEvents)
        .where(eq(dbSchema.webhookEvents.eventId, completed.eventId));
      expect(storedEvent).toBeDefined();

      const replayBody = JSON.stringify(storedEvent!.payload);
      const replayNow = new Date();
      const replaySig = signPaddleWebhookPayload(
        replayBody,
        env.PADDLE_WEBHOOK_SECRET,
        Math.floor(replayNow.getTime() / 1000),
      );

      // Suppose user later cancelled; replaying old activation event must NOT re-activate!
      const cancelStep = await cancelUserSubscription(
        { id: userId, email },
        { reason: "finished_portfolio", immediate: false },
      );
      expect(cancelStep.ok).toBe(true);
      if (cancelStep.ok) {
        expect(cancelStep.status).toBe("cancel_at_period_end");
        expect(cancelStep.effectivePlan).toBe("pro"); // Keeps Pro until period end
      }

      const replayResult = await handleSignedPaddleWebhookRequest({
        rawBody: replayBody,
        signatureHeader: replaySig,
        now: replayNow,
      });
      expect(replayResult.ok).toBe(true);
      if (replayResult.ok) {
        expect(replayResult.deduplicated).toBe(true);
      }

      // Confirm status remained `cancel_at_period_end` (old replayed event had zero side effects)
      const overviewAfterReplay = await getUserBillingOverview(userId);
      expect(overviewAfterReplay.subscription?.status).toBe("cancel_at_period_end");
      expect(overviewAfterReplay.invoices.length).toBe(1);

      // 4. Resume subscription -> active again
      const resumed = await resumeUserSubscription({ id: userId, email });
      expect(resumed).toEqual({ ok: true, effectivePlan: "pro" });

      // 5. Receive signed subscription.canceled webhook -> downgrades user back to Free
      const cancelFinalEventId = `evt_final_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
      createdEventIds.push(cancelFinalEventId);
      const cancelFinalNow = new Date();
      const cancelFinalBody = JSON.stringify({
        event_id: cancelFinalEventId,
        event_type: "subscription.canceled",
        occurred_at: cancelFinalNow.toISOString(),
        data: {
          id: overviewAfterReplay.subscription?.paddleSubscriptionId,
          customer_id: overviewAfterReplay.subscription?.paddleCustomerId,
          status: "canceled",
          canceled_at: cancelFinalNow.toISOString(),
        },
      });
      const cancelFinalSig = signPaddleWebhookPayload(
        cancelFinalBody,
        env.PADDLE_WEBHOOK_SECRET,
        Math.floor(cancelFinalNow.getTime() / 1000),
      );

      const finalCancelResult = await handleSignedPaddleWebhookRequest({
        rawBody: cancelFinalBody,
        signatureHeader: cancelFinalSig,
        now: cancelFinalNow,
      });
      expect(finalCancelResult.ok).toBe(true);
      if (finalCancelResult.ok) {
        expect(finalCancelResult.effectivePlan).toBe("free");
        expect(finalCancelResult.lifecycleStatus).toBe("canceled");
      }

      const [downgradedUser] = await db
        .select()
        .from(dbSchema.users)
        .where(eq(dbSchema.users.id, userId));
      expect(downgradedUser?.plan).toBe("free");
    } finally {
      for (const eid of createdEventIds) {
        await db
          .delete(dbSchema.webhookEvents)
          .where(eq(dbSchema.webhookEvents.eventId, eid));
      }
      await db.delete(dbSchema.users).where(eq(dbSchema.users.id, userId));
    }
  });

  it("enforces Team 2–10 seat pricing ($6.99/$5.59), blocks 11th seat with PLUS_UPGRADE_REQUIRED, and provisions Plus ($99/$79, 20 seats, custom domain)", async () => {
    // Dynamic Team per-seat pricing (2..10 seats)
    const twoSeatsMonthly = computeTeamsPrice(2, "monthly");
    expect(twoSeatsMonthly).toMatchObject({
      ok: true,
      seats: 2,
      monthlyTotalCents: 1398,
      monthlyTotalUsd: 13.98,
    });
    const tenSeatsYearly = computeTeamsPrice(10, "yearly");
    expect(tenSeatsYearly).toMatchObject({
      ok: true,
      seats: 10,
      yearlyMonthlyEquivalentCents: 5590,
      yearlyTotalCents: 67080,
      yearlyTotalUsd: 670.8,
    });
    const elevenSeats = computeTeamsPrice(11, "monthly");
    expect(elevenSeats).toMatchObject({
      ok: false,
      code: "PLUS_UPGRADE_REQUIRED",
    });

    const stamp = Date.now();
    const email = `c701-plus-${stamp}@casefolio.test`;
    const [createdUser] = await db
      .insert(dbSchema.users)
      .values({
        email,
        emailVerified: true,
        name: "Plus Agency Owner",
        plan: "free",
        role: "user",
      })
      .returning();

    const userId = createdUser!.id;
    let createdOrgId: string | null = null;
    const createdEventIds: string[] = [];

    try {
      // Prepare Plus annual checkout ($948/yr flat, 20 seats included)
      const prepPlus = await prepareCheckoutSessionForUser(
        { id: userId, email, name: "Plus Agency Owner" },
        { plan: "plus", interval: "yearly" },
      );
      expect(prepPlus.ok).toBe(true);
      if (!prepPlus.ok) return;
      createdOrgId = prepPlus.session.orgId;
      expect(prepPlus.session.priceId).toBe(env.PADDLE_PRICE_PLUS_YEARLY);
      expect(prepPlus.session.amountCents).toBe(94800);
      expect(prepPlus.session.amountUsd).toBe(948);
      expect(prepPlus.session.seats).toBe(1); // Flat-rate Paddle item quantity = 1 (covers up to 20 seats)

      // Complete sandbox checkout for Plus org
      const completedPlus = await completeSandboxCheckoutForUser(
        { id: userId, email, name: "Plus Agency Owner" },
        { plan: "plus", interval: "yearly", orgId: createdOrgId! },
      );
      expect(completedPlus.ok).toBe(true);
      if (!completedPlus.ok) return;
      createdEventIds.push(completedPlus.eventId);
      expect(completedPlus.effectivePlan).toBe("plus");

      // Plus workspace has maxSeats=20, customDomainEnabled=true, watermarkEnabled=false
      const [plusWs] = await db
        .select()
        .from(dbSchema.workspaces)
        .where(eq(dbSchema.workspaces.organizationId, createdOrgId!));
      expect(plusWs?.maxSeats).toBe(20);
      expect(plusWs?.customDomainEnabled).toBe(true);
      expect(plusWs?.watermarkEnabled).toBe(false);

      // Configure agency custom domain on Plus workspace
      const domainRes = await updateTeamCustomDomain({
        actorUserId: userId,
        organizationId: createdOrgId!,
        customDomain: "work.northstar.agency",
      });
      expect(domainRes).toEqual({
        ok: true,
        customDomain: "work.northstar.agency",
      });
    } finally {
      for (const eid of createdEventIds) {
        await db
          .delete(dbSchema.webhookEvents)
          .where(eq(dbSchema.webhookEvents.eventId, eid));
      }
      if (createdOrgId) {
        await db
          .delete(dbSchema.organizations)
          .where(eq(dbSchema.organizations.id, createdOrgId));
      }
      await db.delete(dbSchema.users).where(eq(dbSchema.users.id, userId));
    }
  });
});
