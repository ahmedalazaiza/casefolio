// @vitest-environment node
import { randomUUID } from "node:crypto";
import { eq, seedDatabase } from "@casefolio/db";
import { describe, expect, it } from "vitest";
import { auth } from "@/lib/auth/server";
import { completeSandboxCheckoutForUser } from "@/lib/billing/service";
import { db, dbSchema } from "@/lib/db";
import { can, evaluateEntitlement } from "@/lib/entitlements";
import { resolveEffectivePlanForUser } from "@/lib/entitlements/server";
import { createGatedTeamInvitation } from "@/lib/entitlements/team-invitations";
import { enqueueProjectExportForUser } from "@/lib/exports/service";
import { createProjectFromTemplate } from "@/lib/projects/service";

function extractCookieHeader(setCookie: string | null): string {
  return (setCookie ?? "")
    .split(/,(?=\s*[A-Za-z0-9_.-]+=)/)
    .map((part) => part.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

describe("Entitlements `can()` & server-side gating (C-702)", () => {
  it("evaluates all features accurately across Free, Pro, Team (2–10 seats), and Plus (up to 20 seats)", () => {
    // Free plan checks (1 active Case Study, watermarked PNG & PDF included, Behance/2x PNG locked)
    expect(can("free", "create_project", { projectsCount: 0 })).toBe(true);
    expect(can("free", "create_project", { projectsCount: 1 })).toBe(false);
    expect(can("free", "pro_templates")).toBe(false);
    expect(can("free", "export_png", { monthlyExportsCount: 4 })).toBe(true);
    expect(can("free", "export_png", { monthlyExportsCount: 5 })).toBe(false);
    expect(can("free", "export_pdf")).toBe(true);
    expect(can("free", "export_behance")).toBe(false);
    expect(can("free", "remove_watermark")).toBe(false);
    expect(can("free", "custom_domain")).toBe(false);
    expect(can("free", "white_label")).toBe(false);
    expect(can("free", "full_analytics")).toBe(false);
    expect(can("free", "team_seats", { seatsUsed: 1, seatsLimit: 3 })).toBe(false);
    expect(can("free", "shared_spaces")).toBe(false);
    expect(can("free", "export_png_2x")).toBe(false);
    expect(can(null, "pro_templates")).toBe(false);

    // Pro plan checks (unlimited Case Studies, watermark-free exports, no custom domain/white-label)
    expect(can({ plan: "pro" }, "create_project", { projectsCount: 0 })).toBe(true);
    expect(can({ plan: "pro" }, "create_project", { projectsCount: 250 })).toBe(true);
    expect(can({ plan: "pro" }, "pro_templates")).toBe(true);
    expect(can({ plan: "pro" }, "export_png", { monthlyExportsCount: 59 })).toBe(true);
    expect(can({ plan: "pro" }, "export_png", { monthlyExportsCount: 60 })).toBe(false);
    expect(can({ plan: "pro" }, "export_png_2x")).toBe(true);
    expect(can({ plan: "pro" }, "export_pdf")).toBe(true);
    expect(can({ plan: "pro" }, "export_behance")).toBe(true);
    expect(can({ plan: "pro" }, "remove_watermark")).toBe(true);
    expect(can({ plan: "pro" }, "custom_domain")).toBe(false);
    expect(can({ plan: "pro" }, "white_label")).toBe(false);
    expect(can({ plan: "pro" }, "full_analytics")).toBe(true);
    expect(can({ plan: "pro" }, "team_seats", { seatsUsed: 1, seatsLimit: 3 })).toBe(false);
    expect(can({ plan: "pro" }, "shared_spaces")).toBe(false);

    // Team plan checks (2–10 seats, 11th seat requires Plus)
    expect(can({ plan: "team" }, "create_project", { projectsCount: 500 })).toBe(true);
    expect(can({ plan: "team" }, "pro_templates")).toBe(true);
    expect(can({ plan: "team" }, "export_pdf")).toBe(true);
    expect(can({ plan: "team" }, "export_png_2x")).toBe(true);
    expect(can({ plan: "team" }, "remove_watermark")).toBe(true);
    expect(can({ plan: "team" }, "custom_domain")).toBe(false);
    expect(can({ plan: "team" }, "white_label")).toBe(false);
    expect(can({ plan: "team" }, "shared_spaces")).toBe(true);
    expect(can({ plan: "team" }, "team_seats", { seatsUsed: 2, seatsLimit: 3 })).toBe(true);
    expect(can({ plan: "team" }, "team_seats", { seatsUsed: 3, seatsLimit: 3 })).toBe(false);
    expect(can({ plan: "team" }, "team_seats", { seatsUsed: 10, seatsLimit: 10 })).toBe(false);

    const seatLimitDecision = evaluateEntitlement("team", "team_seats", {
      seatsUsed: 3,
      seatsLimit: 3,
    });
    expect(seatLimitDecision.code).toBe("TEAM_SEAT_LIMIT_REACHED");

    const plusUpgradeDecision = evaluateEntitlement("team", "team_seats", {
      seatsUsed: 10,
      seatsLimit: 10,
    });
    expect(plusUpgradeDecision.code).toBe("PLUS_PLAN_REQUIRED");
    expect(plusUpgradeDecision.requiredPlan).toBe("plus");

    // Plus plan checks (up to 20 seats flat, custom domain & complete white-labeling)
    expect(can({ plan: "plus" }, "create_project", { projectsCount: 1000 })).toBe(true);
    expect(can({ plan: "plus" }, "pro_templates")).toBe(true);
    expect(can({ plan: "plus" }, "remove_watermark")).toBe(true);
    expect(can({ plan: "plus" }, "custom_domain")).toBe(true);
    expect(can({ plan: "plus" }, "white_label")).toBe(true);
    expect(can({ plan: "plus" }, "shared_spaces")).toBe(true);
    expect(can({ plan: "plus" }, "team_seats", { seatsUsed: 19, seatsLimit: 20 })).toBe(true);
    expect(can({ plan: "plus" }, "team_seats", { seatsUsed: 20, seatsLimit: 20 })).toBe(false);
  });

  it("enforces server-side Pro template, export format, watermark, subscription expiry, and Team seat gating", async () => {
    await seedDatabase(db);

    const stamp = `${Date.now()}-${randomUUID().slice(0, 6)}`;
    const userEmail = `c702-designer-${stamp}@casefolio.test`;
    const password = "CasefolioPassword2026!";

    const signUp = await auth.api.signUpEmail({
      body: {
        name: "C702 Designer",
        email: userEmail,
        password,
      },
      returnHeaders: true,
    });
    const userId = signUp.response.user.id;
    const cookieHeaders = new Headers({
      cookie: extractCookieHeader(signUp.headers.get("set-cookie")),
    });

    await db
      .update(dbSchema.users)
      .set({ emailVerified: true })
      .where(eq(dbSchema.users.id, userId));

    try {
      const [orbitTpl] = await db
        .select()
        .from(dbSchema.templates)
        .where(eq(dbSchema.templates.slug, "orbit"));
      const [meridianProTpl] = await db
        .select()
        .from(dbSchema.templates)
        .where(eq(dbSchema.templates.slug, "meridian-pro"));

      expect(orbitTpl).toBeDefined();
      expect(meridianProTpl?.tier).toBe("pro");

      // 1. Free user blocked from Pro template ("meridian-pro")
      const blockedProProject = await createProjectFromTemplate({
        userId,
        userPlan: await resolveEffectivePlanForUser(userId),
        input: {
          type: "web",
          templateId: meridianProTpl!.id,
          name: "Meridian Attempt on Free",
        },
      });
      expect(blockedProProject.ok).toBe(false);
      if (!blockedProProject.ok) {
        expect(blockedProProject.code).toBe("PRO_TEMPLATE_LOCKED");
      }

      // 2. Edge Case 1: Free user creates 1 Orbit Case Study, then 2nd is blocked by PLAN_LIMIT_REACHED
      const proj1 = await createProjectFromTemplate({
        userId,
        userPlan: "free",
        input: { type: "mobile", templateId: orbitTpl!.id, name: "Orbit Free One" },
      });
      expect(proj1.ok).toBe(true);

      const proj2 = await createProjectFromTemplate({
        userId,
        userPlan: "free",
        input: { type: "mobile", templateId: orbitTpl!.id, name: "Orbit Free Two" },
      });
      expect(proj2.ok).toBe(false);
      if (!proj2.ok) {
        expect(proj2.code).toBe("PLAN_LIMIT_REACHED");
      }

      // 3. Free user gets watermarked PNG & PDF exports, while Behance requires Pro+
      const projectId = proj1.ok ? proj1.projectId : "";
      const freePdf = await enqueueProjectExportForUser(
        { projectId, format: "pdf" },
        { id: userId, role: "user" },
        { enqueueJobFn: async () => {} },
      );
      expect(freePdf.ok).toBe(true);
      if (freePdf.ok) {
        expect(freePdf.hasWatermark).toBe(true);
      }

      const blockedBehance = await enqueueProjectExportForUser(
        { projectId, format: "behance" },
        { id: userId, role: "user" },
        { enqueueJobFn: async () => {} },
      );
      expect(blockedBehance.ok).toBe(false);
      if (!blockedBehance.ok) {
        expect(blockedBehance.code).toBe("PLAN_UPGRADE_REQUIRED");
      }

      const freePng = await enqueueProjectExportForUser(
        { projectId, format: "png_long" },
        { id: userId, role: "user" },
        { enqueueJobFn: async () => {} },
      );
      expect(freePng.ok).toBe(true);
      if (freePng.ok) {
        expect(freePng.hasWatermark).toBe(true);
      }

      // 4. Create organization & verify Free user cannot invite via gated team endpoint
      const createdOrg = await auth.api.createOrganization({
        body: {
          name: "C702 Studio",
          slug: `c702-studio-${stamp}`,
        },
        headers: cookieHeaders,
      });
      const orgId = createdOrg!.id;

      const blockedFreeInvite = await createGatedTeamInvitation({
        actorUserId: userId,
        rawInput: {
          organizationId: orgId,
          email: `invitee-${stamp}@casefolio.test`,
          role: "editor",
        },
        requestHeaders: cookieHeaders,
      });
      expect(blockedFreeInvite.ok).toBe(false);
      if (!blockedFreeInvite.ok) {
        expect(blockedFreeInvite.code).toBe("TEAM_PLAN_REQUIRED");
      }

      // 5. Upgrade user to Pro via sandbox checkout -> unlocks Pro template & watermark-free PDF export
      const proUpgrade = await completeSandboxCheckoutForUser(
        { id: userId, email: userEmail },
        { plan: "pro", interval: "monthly" },
      );
      expect(proUpgrade.ok).toBe(true);
      expect(await resolveEffectivePlanForUser(userId)).toBe("pro");

      const unlockedProProject = await createProjectFromTemplate({
        userId,
        userPlan: await resolveEffectivePlanForUser(userId),
        input: {
          type: "web",
          templateId: meridianProTpl!.id,
          name: "Meridian Unlocked on Pro",
        },
      });
      expect(unlockedProProject.ok).toBe(true);

      const proPdf = await enqueueProjectExportForUser(
        { projectId, format: "pdf" },
        { id: userId, role: "user" },
        { enqueueJobFn: async () => {} },
      );
      expect(proPdf.ok).toBe(true);
      if (proPdf.ok) {
        expect(proPdf.hasWatermark).toBe(false);
        expect(proPdf.monthlyExportsLimit).toBe(60);
      }

      // Pro user STILL cannot invite collaborative Team seats
      const blockedProInvite = await createGatedTeamInvitation({
        actorUserId: userId,
        rawInput: {
          organizationId: orgId,
          email: `invitee-${stamp}@casefolio.test`,
          role: "editor",
        },
        requestHeaders: cookieHeaders,
      });
      expect(blockedProInvite.ok).toBe(false);
      if (!blockedProInvite.ok) {
        expect(blockedProInvite.code).toBe("TEAM_PLAN_REQUIRED");
      }

      // 6. Upgrade organization to 3-seat Team -> unlocks gated Team invitations up to 3-seat limit
      const teamUpgrade = await completeSandboxCheckoutForUser(
        { id: userId, email: userEmail },
        { plan: "team", interval: "monthly", orgId, seats: 3 },
      );
      expect(teamUpgrade.ok).toBe(true);

      const invite1 = await createGatedTeamInvitation({
        actorUserId: userId,
        rawInput: {
          organizationId: orgId,
          email: `seat2-${stamp}@casefolio.test`,
          role: "editor",
        },
        requestHeaders: cookieHeaders,
      });
      const invite2 = await createGatedTeamInvitation({
        actorUserId: userId,
        rawInput: {
          organizationId: orgId,
          email: `seat3-${stamp}@casefolio.test`,
          role: "viewer",
        },
        requestHeaders: cookieHeaders,
      });
      expect(invite1.ok).toBe(true);
      expect(invite2.ok).toBe(true);

      // 4th seat exceeds 3-seat Team workspace -> TEAM_SEAT_LIMIT_REACHED
      const inviteOverLimit = await createGatedTeamInvitation({
        actorUserId: userId,
        rawInput: {
          organizationId: orgId,
          email: `seat4-${stamp}@casefolio.test`,
          role: "viewer",
        },
        requestHeaders: cookieHeaders,
      });
      expect(inviteOverLimit.ok).toBe(false);
      if (!inviteOverLimit.ok) {
        expect(inviteOverLimit.code).toBe("TEAM_SEAT_LIMIT_REACHED");
      }

      // Edge Case 2: Team workspace at maximum 10 seats trying to invite 11th member -> PLUS_PLAN_REQUIRED
      await db
        .update(dbSchema.subscriptions)
        .set({ currentPaidCapacity: 10, maxSeats: 10 })
        .where(eq(dbSchema.subscriptions.orgId, orgId));
      await db
        .update(dbSchema.workspaces)
        .set({ maxSeats: 10 })
        .where(eq(dbSchema.workspaces.organizationId, orgId));

      for (let seatIdx = 4; seatIdx <= 10; seatIdx++) {
        const inv = await createGatedTeamInvitation({
          actorUserId: userId,
          rawInput: {
            organizationId: orgId,
            email: `seat${seatIdx}-${stamp}@casefolio.test`,
            role: "viewer",
          },
          requestHeaders: cookieHeaders,
        });
        expect(inv.ok).toBe(true);
      }

      const eleventhSeatInvite = await createGatedTeamInvitation({
        actorUserId: userId,
        rawInput: {
          organizationId: orgId,
          email: `seat11-${stamp}@casefolio.test`,
          role: "viewer",
        },
        requestHeaders: cookieHeaders,
      });
      expect(eleventhSeatInvite.ok).toBe(false);
      if (!eleventhSeatInvite.ok) {
        expect(eleventhSeatInvite.code).toBe("PLUS_PLAN_REQUIRED");
      }

      // Upgrading workspace to Plus unlocks up to 20 seats immediately
      await db
        .update(dbSchema.subscriptions)
        .set({ plan: "plus", currentPaidCapacity: 20, maxSeats: 20, customDomainEnabled: true })
        .where(eq(dbSchema.subscriptions.orgId, orgId));
      await db
        .update(dbSchema.workspaces)
        .set({ maxSeats: 20, customDomainEnabled: true })
        .where(eq(dbSchema.workspaces.organizationId, orgId));

      const eleventhOnPlus = await createGatedTeamInvitation({
        actorUserId: userId,
        rawInput: {
          organizationId: orgId,
          email: `seat11-${stamp}@casefolio.test`,
          role: "viewer",
        },
        requestHeaders: cookieHeaders,
      });
      expect(eleventhOnPlus.ok).toBe(true);

      // 7. Expired canceled subscription reconciles effective plan back to Free
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await db
        .update(dbSchema.subscriptions)
        .set({ status: "canceled", currentPeriodEnd: pastDate })
        .where(eq(dbSchema.subscriptions.userId, userId));
      await db
        .update(dbSchema.subscriptions)
        .set({ status: "canceled", currentPeriodEnd: pastDate })
        .where(eq(dbSchema.subscriptions.orgId, orgId));

      expect(await resolveEffectivePlanForUser(userId)).toBe("free");
    } finally {
      await db.delete(dbSchema.users).where(eq(dbSchema.users.id, userId));
    }
  });
});
