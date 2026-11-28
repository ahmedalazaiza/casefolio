// @vitest-environment node
import { randomUUID } from "node:crypto";
import { eq } from "@casefolio/db";
import { afterEach, describe, expect, it } from "vitest";
import { auth } from "@/lib/auth/server";
import {
  consumeStepUpToken,
  MAX_STEP_UP_SESSION_AGE_MS,
  verifyStepUpWithPassword,
} from "@/lib/auth/step-up";
import { db, dbSchema } from "@/lib/db";
import {
  executeAccountPurge,
  processScheduledAccountDeletions,
} from "@/lib/retention/account";

const createdUserIds: string[] = [];

afterEach(async () => {
  for (const id of createdUserIds.splice(0, createdUserIds.length)) {
    await db.delete(dbSchema.users).where(eq(dbSchema.users.id, id)).catch(() => undefined);
  }
});

async function createVerifiedUserWithSession(password = "StrongPass#2026!") {
  const email = `del-${randomUUID()}@example.com`;
  const signedUp = await auth.api.signUpEmail({
    body: {
      name: "Delete Test Designer",
      email,
      password,
    },
  });
  createdUserIds.push(signedUp.user.id);

  await db
    .update(dbSchema.users)
    .set({ emailVerified: true })
    .where(eq(dbSchema.users.id, signedUp.user.id));

  const signedIn = await auth.api.signInEmail({
    body: {
      email,
      password,
    },
  });

  const [sessionRow] = await db
    .select()
    .from(dbSchema.sessions)
    .where(eq(dbSchema.sessions.userId, signedUp.user.id))
    .limit(1);

  return {
    userId: signedUp.user.id,
    email,
    password,
    sessionId: sessionRow!.id,
    token: signedIn.token,
  };
}

describe("Account deletion & server-side step-up auth (B1, S9)", () => {
  it("verifies step-up password, enforces single-use token, and rejects sessions older than 24h", async () => {
    const u = await createVerifiedUserWithSession();

    const badPass = await verifyStepUpWithPassword({
      userId: u.userId,
      sessionId: u.sessionId,
      purpose: "account_deletion",
      password: "WrongPassword123!",
    });
    expect(badPass.ok).toBe(false);

    const goodPass = await verifyStepUpWithPassword({
      userId: u.userId,
      sessionId: u.sessionId,
      purpose: "account_deletion",
      password: u.password,
    });
    expect(goodPass.ok).toBe(true);
    if (!goodPass.ok) return;

    // Cross-purpose replay must fail
    const wrongPurpose = await consumeStepUpToken({
      userId: u.userId,
      sessionId: u.sessionId,
      purpose: "ownership_transfer",
      stepUpToken: goodPass.stepUpToken,
    });
    expect(wrongPurpose.ok).toBe(false);

    // Valid consumption succeeds once, and immediate replay fails
    const firstConsume = await consumeStepUpToken({
      userId: u.userId,
      sessionId: u.sessionId,
      purpose: "account_deletion",
      stepUpToken: goodPass.stepUpToken,
    });
    expect(firstConsume.ok).toBe(true);

    const replayConsume = await consumeStepUpToken({
      userId: u.userId,
      sessionId: u.sessionId,
      purpose: "account_deletion",
      stepUpToken: goodPass.stepUpToken,
    });
    expect(replayConsume.ok).toBe(false);

    // Stale `createdAt` (> 24h) is rejected even if `updatedAt` is fresh
    const staleCreatedAt = new Date(Date.now() - MAX_STEP_UP_SESSION_AGE_MS - 60_000);
    await db
      .update(dbSchema.sessions)
      .set({ createdAt: staleCreatedAt, updatedAt: new Date() })
      .where(eq(dbSchema.sessions.id, u.sessionId));

    const staleAttempt = await verifyStepUpWithPassword({
      userId: u.userId,
      sessionId: u.sessionId,
      purpose: "account_deletion",
      password: u.password,
    });
    expect(staleAttempt).toMatchObject({
      ok: false,
      code: "SESSION_TOO_OLD",
    });
  });

  it("B1: aborts account purge without deleting user when Paddle cancellation fails or throws", async () => {
    const u = await createVerifiedUserWithSession();

    await db.insert(dbSchema.subscriptions).values({
      userId: u.userId,
      orgId: null,
      paddleCustomerId: `ctm_${randomUUID()}`,
      paddleSubscriptionId: `sub_${randomUUID()}`,
      plan: "pro",
      status: "active",
      currentPaidCapacity: 1,
    });

    // 1. Provider throws network/API error
    const thrownRes = await executeAccountPurge(u.userId, {
      cancelSubscriptionFn: async () => {
        throw new Error("Paddle API 503 Service Unavailable");
      },
    });
    expect(thrownRes).toMatchObject({
      ok: false,
      code: "BILLING_CANCEL_FAILED",
    });

    const [stillExistsAfterThrow] = await db
      .select({ id: dbSchema.users.id })
      .from(dbSchema.users)
      .where(eq(dbSchema.users.id, u.userId));
    expect(stillExistsAfterThrow?.id).toBe(u.userId);

    // 2. Provider returns ok: false
    const failedRes = await executeAccountPurge(u.userId, {
      cancelSubscriptionFn: async () => ({
        ok: false,
        error: "Gateway refused cancellation.",
      }),
    });
    expect(failedRes).toMatchObject({
      ok: false,
      code: "BILLING_CANCEL_FAILED",
    });

    const [stillExistsAfterFalse] = await db
      .select({ id: dbSchema.users.id })
      .from(dbSchema.users)
      .where(eq(dbSchema.users.id, u.userId));
    expect(stillExistsAfterFalse?.id).toBe(u.userId);

    // 3. Provider succeeds -> account is purged cleanly
    const okRes = await executeAccountPurge(u.userId, {
      cancelSubscriptionFn: async () => ({
        ok: true,
        status: "canceled",
        effectivePlan: "free",
        currentPeriodEndIso: null,
      }),
    });
    expect(okRes).toEqual({ ok: true, purgedUserId: u.userId });

    const [deletedUser] = await db
      .select({ id: dbSchema.users.id })
      .from(dbSchema.users)
      .where(eq(dbSchema.users.id, u.userId));
    expect(deletedUser).toBeUndefined();
  });

  it("processes scheduled deletions only after the 7-day grace window elapses", async () => {
    const u = await createVerifiedUserWithSession();
    const now = new Date();
    const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    await db
      .update(dbSchema.users)
      .set({
        deletionRequestedAt: now,
        deletionScheduledFor: inSevenDays,
      })
      .where(eq(dbSchema.users.id, u.userId));

    // Before scheduled date: untouched
    await processScheduledAccountDeletions(new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000));
    const [duringGrace] = await db
      .select({ id: dbSchema.users.id })
      .from(dbSchema.users)
      .where(eq(dbSchema.users.id, u.userId));
    expect(duringGrace?.id).toBe(u.userId);

    // Cancel grace deletion -> cleared
    await db
      .update(dbSchema.users)
      .set({ deletionRequestedAt: null, deletionScheduledFor: null })
      .where(eq(dbSchema.users.id, u.userId));
    await processScheduledAccountDeletions(new Date(inSevenDays.getTime() + 60_000));
    const [afterCancel] = await db
      .select({ id: dbSchema.users.id })
      .from(dbSchema.users)
      .where(eq(dbSchema.users.id, u.userId));
    expect(afterCancel?.id).toBe(u.userId);

    // Re-schedule and advance past 7 days -> purged
    await db
      .update(dbSchema.users)
      .set({
        deletionRequestedAt: now,
        deletionScheduledFor: inSevenDays,
      })
      .where(eq(dbSchema.users.id, u.userId));
    const sweep = await processScheduledAccountDeletions(
      new Date(inSevenDays.getTime() + 60_000),
    );
    expect(sweep.purged).toBeGreaterThanOrEqual(1);

    const [gone] = await db
      .select({ id: dbSchema.users.id })
      .from(dbSchema.users)
      .where(eq(dbSchema.users.id, u.userId));
    expect(gone).toBeUndefined();
  });

  it("handles Team sole-owner deletion: auto-dissolves empty teams, requires explicit dissolve when teammates exist, and preserves shared projects when a non-owner member purges permanently", async () => {
    const owner = await createVerifiedUserWithSession();
    const member = await createVerifiedUserWithSession();

    const [tpl] = await db
      .select({ id: dbSchema.templates.id, currentVersionId: dbSchema.templates.currentVersionId })
      .from(dbSchema.templates)
      .where(eq(dbSchema.templates.slug, "orbit"))
      .limit(1);
    expect(tpl?.currentVersionId).toBeTruthy();

    // 1. Empty sole-owned team -> auto-dissolves during immediate account purge
    const emptyOwner = await createVerifiedUserWithSession();
    const [emptyOrg] = await db
      .insert(dbSchema.organizations)
      .values({
        name: `Solo Team ${randomUUID().slice(0, 6)}`,
        slug: `solo-team-${randomUUID().slice(0, 8)}`,
        seats: 2,
      })
      .returning();
    await db.insert(dbSchema.memberships).values({
      userId: emptyOwner.userId,
      orgId: emptyOrg!.id,
      role: "owner",
    });
    const emptyPurge = await executeAccountPurge(emptyOwner.userId);
    expect(emptyPurge).toEqual({ ok: true, purgedUserId: emptyOwner.userId });
    const [goneOrg] = await db
      .select({ id: dbSchema.organizations.id })
      .from(dbSchema.organizations)
      .where(eq(dbSchema.organizations.id, emptyOrg!.id));
    expect(goneOrg).toBeUndefined();

    // 2. Active team with member: non-owner member purging leaves shared team project intact under Owner
    const [activeOrg] = await db
      .insert(dbSchema.organizations)
      .values({
        name: `Active Studio ${randomUUID().slice(0, 6)}`,
        slug: `active-studio-${randomUUID().slice(0, 8)}`,
        seats: 2,
      })
      .returning();
    await db.insert(dbSchema.memberships).values([
      { userId: owner.userId, orgId: activeOrg!.id, role: "owner" },
      { userId: member.userId, orgId: activeOrg!.id, role: "member" },
    ]);
    const [teamWs] = await db
      .insert(dbSchema.workspaces)
      .values({
        kind: "team",
        organizationId: activeOrg!.id,
        name: activeOrg!.name,
        slug: `ws-${randomUUID().slice(0, 8)}`,
        maxSeats: 2,
      })
      .returning();
    const [sharedSpace] = await db
      .insert(dbSchema.spaces)
      .values({
        workspaceId: teamWs!.id,
        name: "Team Shared",
        slug: "shared",
        visibility: "shared",
        isDefault: true,
        controllerUserId: owner.userId,
      })
      .returning();
    const [sharedProj] = await db
      .insert(dbSchema.projects)
      .values({
        ownerId: member.userId,
        createdByUserId: member.userId,
        orgId: activeOrg!.id,
        workspaceId: teamWs!.id,
        spaceId: sharedSpace!.id,
        templateVersionId: tpl!.currentVersionId!,
        name: "Shared Team Work",
        type: "mobile",
        puckData: {},
        theme: {},
      })
      .returning();

    const memberPurge = await executeAccountPurge(member.userId);
    expect(memberPurge).toEqual({ ok: true, purgedUserId: member.userId });

    // Shared Team project MUST survive with ownerId reassigned to surviving Owner!
    const [survivingSharedProj] = await db
      .select({ ownerId: dbSchema.projects.ownerId })
      .from(dbSchema.projects)
      .where(eq(dbSchema.projects.id, sharedProj!.id));
    expect(survivingSharedProj?.ownerId).toBe(owner.userId);

    // 3. Re-add another member so sole Owner deletion blocks unless `dissolveOwnedTeams: true`
    const mate2 = await createVerifiedUserWithSession();
    await db.insert(dbSchema.memberships).values({
      userId: mate2.userId,
      orgId: activeOrg!.id,
      role: "member",
    });

    const blockedOwnerPurge = await executeAccountPurge(owner.userId);
    expect(blockedOwnerPurge).toMatchObject({ ok: false, code: "SOLE_TEAM_OWNER" });

    const dissolvedOwnerPurge = await executeAccountPurge(owner.userId, {
      dissolveOwnedTeams: true,
    });
    expect(dissolvedOwnerPurge).toEqual({ ok: true, purgedUserId: owner.userId });

    const [goneActiveOrg] = await db
      .select({ id: dbSchema.organizations.id })
      .from(dbSchema.organizations)
      .where(eq(dbSchema.organizations.id, activeOrg!.id));
    expect(goneActiveOrg).toBeUndefined();
  });
});
