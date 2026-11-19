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
      expect(prep.session.amountUsd).toBe(79.9);
      expect(prep.session.amountCents).toBe(7990);

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

  it("enforces Teams 2–25 per-seat pricing ($5.99/mo · $59.90/yr = 2 months free), blocks >25 seats with CAPACITY_REVIEW_REQUIRED, and provisions multi-seat Teams workspaces", async () => {
    const twoSeatsMonthly = computeTeamsPrice(2, "monthly");
    expect(twoSeatsMonthly).toMatchObject({
      ok: true,
      seats: 2,
      monthlyTotalCents: 1198,
      monthlyTotalUsd: 11.98,
    });
    const tenSeatsYearly = computeTeamsPrice(10, "yearly");
    expect(tenSeatsYearly).toMatchObject({
      ok: true,
      seats: 10,
      yearlyMonthlyEquivalentCents: 4990,
      yearlyTotalCents: 59900,
      yearlyTotalUsd: 599,
    });
    const maxSelfServeSeats = computeTeamsPrice(25, "monthly");
    expect(maxSelfServeSeats).toMatchObject({
      ok: true,
      seats: 25,
      monthlyTotalCents: 14975,
      monthlyTotalUsd: 149.75,
    });
    const twentySixSeats = computeTeamsPrice(26, "monthly");
    expect(twentySixSeats).toMatchObject({
      ok: false,
      code: "CAPACITY_REVIEW_REQUIRED",
    });

    const stamp = Date.now();
    const email = `c701-teams-${stamp}@casefolio.test`;
    const [createdUser] = await db
      .insert(dbSchema.users)
      .values({
        email,
        emailVerified: true,
        name: "Teams Studio Owner",
        plan: "free",
        role: "user",
      })
      .returning();

    const userId = createdUser!.id;
    let createdOrgId: string | null = null;
    const createdEventIds: string[] = [];

    try {
      const prepTeams = await prepareCheckoutSessionForUser(
        { id: userId, email, name: "Teams Studio Owner" },
        { plan: "team", interval: "yearly", seats: 5 },
      );
      expect(prepTeams.ok).toBe(true);
      if (!prepTeams.ok) return;
      createdOrgId = prepTeams.session.orgId;
      expect(prepTeams.session.priceId).toBe(env.PADDLE_PRICE_TEAM_YEARLY);
      expect(prepTeams.session.amountCents).toBe(29950);
      expect(prepTeams.session.amountUsd).toBe(299.5);
      expect(prepTeams.session.seats).toBe(5);

      const completedTeams = await completeSandboxCheckoutForUser(
        { id: userId, email, name: "Teams Studio Owner" },
        { plan: "team", interval: "yearly", seats: 5, orgId: createdOrgId! },
      );
      expect(completedTeams.ok).toBe(true);
      if (!completedTeams.ok) return;
      createdEventIds.push(completedTeams.eventId);
      expect(completedTeams.effectivePlan).toBe("team");

      const [teamWs] = await db
        .select()
        .from(dbSchema.workspaces)
        .where(eq(dbSchema.workspaces.organizationId, createdOrgId!));
      expect(teamWs?.maxSeats).toBe(5);
      expect(teamWs?.customDomainEnabled).toBe(false);
      expect(teamWs?.watermarkEnabled).toBe(false);

      const domainRes = await updateTeamCustomDomain({
        actorUserId: userId,
        organizationId: createdOrgId!,
        customDomain: "work.northstar.agency",
      });
      expect(domainRes).toEqual({
        ok: false,
        code: "NOT_AVAILABLE",
        error: "Custom domains are not available yet.",
      });
      const [afterWs] = await db
        .select({ customDomain: dbSchema.workspaces.customDomain })
        .from(dbSchema.workspaces)
        .where(eq(dbSchema.workspaces.organizationId, createdOrgId!));
      expect(afterWs?.customDomain ?? null).toBeNull();
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
