// @vitest-environment node
import { desc, eq, inArray } from "@casefolio/db";
import { afterAll, describe, expect, it } from "vitest";
import {
  fetchLivePaddleSubscription,
  getAdminSubscriptionsOverview,
  getAdminUserDetail,
  listAdminUsers,
  setAdminUserSuspension,
  syncUserSubscriptionFromPaddle,
} from "@/lib/admin/users";
import { filterAdminUsers, serializeAdminUsersCsv } from "@/lib/admin/users-types";
import { auth } from "@/lib/auth/server";
import { resolveServerPaddlePriceId } from "@/lib/billing/server-config";
import { db, dbSchema } from "@/lib/db";

const createdUserIds: string[] = [];
const createdSubscriptionIds: string[] = [];

afterAll(async () => {
  if (createdSubscriptionIds.length > 0) {
    await db
      .delete(dbSchema.subscriptions)
      .where(inArray(dbSchema.subscriptions.id, createdSubscriptionIds));
  }
  if (createdUserIds.length > 0) {
    await db
      .delete(dbSchema.auditLogs)
      .where(inArray(dbSchema.auditLogs.actorId, createdUserIds));
    await db
      .delete(dbSchema.sessions)
      .where(inArray(dbSchema.sessions.userId, createdUserIds));
    await db
      .delete(dbSchema.accounts)
      .where(inArray(dbSchema.accounts.userId, createdUserIds));
    await db.delete(dbSchema.users).where(inArray(dbSchema.users.id, createdUserIds));
  }
});

describe("Admin users & subscriptions service (C-904)", () => {
  it("lists users, syncs live Paddle subscription status, revokes sessions on suspend, and blocks login when suspended", async () => {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
    const adminEmail = `c904-admin-${suffix}@casefolio.test`;
    const memberEmail = `c904-member-${suffix}@casefolio.test`;
    const password = "CasefolioPassword123!";

    const adminSignUp = await auth.api.signUpEmail({
      body: {
        email: adminEmail,
        password,
        name: "C904 Admin",
      },
    });
    createdUserIds.push(adminSignUp.user.id);
    await db
      .update(dbSchema.users)
      .set({ role: "admin" })
      .where(eq(dbSchema.users.id, adminSignUp.user.id));

    const memberSignUp = await auth.api.signUpEmail({
      body: {
        email: memberEmail,
        password,
        name: "C904 Member Designer",
      },
    });
    createdUserIds.push(memberSignUp.user.id);

    // Ensure member currently has an active session from autoSignIn
    const initialSessions = await db
      .select()
      .from(dbSchema.sessions)
      .where(eq(dbSchema.sessions.userId, memberSignUp.user.id));
    expect(initialSessions.length).toBeGreaterThanOrEqual(1);

    // Insert a Paddle subscription mirror row
    const paddleSubId = `sub_01_c904_${suffix}`;
    const periodEnd = new Date(Date.now() + 25 * 24 * 60 * 60 * 1000);
    const [subRow] = await db
      .insert(dbSchema.subscriptions)
      .values({
        userId: memberSignUp.user.id,
        paddleCustomerId: `ctm_01_c904_${suffix}`,
        paddleSubscriptionId: paddleSubId,
        plan: "pro",
        status: "active",
        currentPeriodEnd: periodEnd,
      })
      .returning();

    if (!subRow) throw new Error("Failed to insert subscription");
    createdSubscriptionIds.push(subRow.id);

    await db
      .update(dbSchema.users)
      .set({ plan: "pro" })
      .where(eq(dbSchema.users.id, memberSignUp.user.id));

    // 1. List & filter users + CSV export
    const allUsers = await listAdminUsers();
    const proFiltered = filterAdminUsers(allUsers, {
      searchQuery: memberEmail,
      filter: "pro",
    });
    expect(proFiltered).toHaveLength(1);
    expect(proFiltered[0]?.id).toBe(memberSignUp.user.id);

    const csv = serializeAdminUsersCsv(proFiltered);
    expect(csv).toContain(memberEmail);
    expect(csv).toContain("pro");

    // 2. Subscriptions overview includes active MRR
    const subsOverview = await getAdminSubscriptionsOverview();
    expect(subsOverview.mrrUsd).toBeGreaterThanOrEqual(16);
    expect(subsOverview.payingUsersCount).toBeGreaterThanOrEqual(1);

    // 3. Live Paddle API fetch & sync
    const teamMonthlyPriceId = resolveServerPaddlePriceId("team", "monthly");
    const nextRenewalIso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const mockFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          data: {
            status: "active",
            billing_cycle: { interval: "month" },
            current_billing_period: { ends_at: nextRenewalIso },
            items: [{ price: { id: teamMonthlyPriceId } }],
            payment_method_id: "paymtd_01_test",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    const liveSnap = await fetchLivePaddleSubscription(paddleSubId, {
      apiKey: "pdl_sdbx_apikey_01j8z9y0x1w2v3u4t5s6r7q8p9",
      fetchImpl: mockFetch,
    });
    expect(liveSnap?.plan).toBe("team");
    expect(liveSnap?.status).toBe("active");

    const detailLive = await getAdminUserDetail(memberSignUp.user.id, {
      apiKey: "pdl_sdbx_apikey_01j8z9y0x1w2v3u4t5s6r7q8p9",
      fetchImpl: mockFetch,
    });
    expect(detailLive?.subscription.source).toBe("paddle_api");
    expect(detailLive?.subscription.plan).toBe("team");

    const syncRes = await syncUserSubscriptionFromPaddle(
      {
        actorId: adminSignUp.user.id,
        targetUserId: memberSignUp.user.id,
      },
      {
        apiKey: "pdl_sdbx_apikey_01j8z9y0x1w2v3u4t5s6r7q8p9",
        fetchImpl: mockFetch,
      },
    );
    expect(syncRes).toEqual({ ok: true, source: "paddle_api", status: "active" });

    const [updatedMember] = await db
      .select()
      .from(dbSchema.users)
      .where(eq(dbSchema.users.id, memberSignUp.user.id))
      .limit(1);
    expect(updatedMember?.plan).toBe("team");

    // 4. Self-suspension guard
    const selfSuspend = await setAdminUserSuspension({
      actorId: adminSignUp.user.id,
      actorRole: "admin",
      targetUserId: adminSignUp.user.id,
      suspended: true,
    });
    expect(selfSuspend.ok).toBe(false);

    // 5. Suspend member -> revokes sessions & blocks login immediately
    const suspendRes = await setAdminUserSuspension({
      actorId: adminSignUp.user.id,
      actorRole: "admin",
      targetUserId: memberSignUp.user.id,
      suspended: true,
    });
    expect(suspendRes).toEqual({ ok: true, suspended: true });

    const remainingSessions = await db
      .select()
      .from(dbSchema.sessions)
      .where(eq(dbSchema.sessions.userId, memberSignUp.user.id));
    expect(remainingSessions).toHaveLength(0);

    await expect(
      auth.api.signInEmail({
        body: {
          email: memberEmail,
          password,
        },
      }),
    ).rejects.toThrow(/suspended/i);

    // 6. Unsuspend member -> login succeeds again
    const unsuspendRes = await setAdminUserSuspension({
      actorId: adminSignUp.user.id,
      actorRole: "admin",
      targetUserId: memberSignUp.user.id,
      suspended: false,
    });
    expect(unsuspendRes).toEqual({ ok: true, suspended: false });

    const reSignIn = await auth.api.signInEmail({
      body: {
        email: memberEmail,
        password,
      },
    });
    expect(reSignIn.user.id).toBe(memberSignUp.user.id);

    // 7. Verify audit log records all 3 mutations
    const logs = await db
      .select()
      .from(dbSchema.auditLogs)
      .where(eq(dbSchema.auditLogs.actorId, adminSignUp.user.id))
      .orderBy(desc(dbSchema.auditLogs.at));
    const actions = logs.map((l) => l.action);
    expect(actions).toContain("admin.subscription.synced");
    expect(actions).toContain("admin.user.suspended");
    expect(actions).toContain("admin.user.unsuspended");
  });
});
