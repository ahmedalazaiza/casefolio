import { existsSync } from "node:fs";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  createDbConnection,
  eq,
  inArray,
  organizations,
  projects,
  users,
} from "../../packages/db/src/index";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

async function assertCleanA11yAndResponsive(page: Page, routeLabel: string) {
  await page.emulateMedia({ reducedMotion: "reduce" });

  for (const width of [375, 393, 1440] as const) {
    await page.setViewportSize({ width, height: width === 1440 ? 920 : 852 });
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(
      metrics.scrollWidth,
      `Horizontal overflow on ${routeLabel} at ${width}px (${metrics.scrollWidth} > ${metrics.innerWidth})`,
    ).toBeLessThanOrEqual(metrics.innerWidth);
  }

  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const severe = axe.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );
  expect(
    severe,
    `Severe axe violations on ${routeLabel}:\n${JSON.stringify(severe, null, 2)}`,
  ).toEqual([]);
}

test.describe("Phase 13 Business Model, Teams Seat Billing, Private Spaces & Recovery Portal E2E", () => {
  test("verifies /pricing seat calculator, /help/billing-and-plans, Team workspace creation, Private Space 404 isolation from Owner, and departed-member Recovery Portal copy", async ({
    page,
    browser,
  }) => {
    test.setTimeout(150_000);

    const databaseUrl = process.env.DATABASE_URL ?? "postgresql://localhost:5433/casefolio";
    const { db, pool } = createDbConnection(databaseUrl);

    const stamp = Date.now();
    const ownerEmail = `e2e-p13-owner-${stamp}@casefolio.test`;
    const memberEmail = `e2e-p13-member-${stamp}@casefolio.test`;
    const password = "CasefolioTeams2026!";
    const teamName = `Horizon Studio ${stamp}`;
    const teamSlug = `horizon-studio-${stamp}`;

    const createdUserIds: string[] = [];
    const createdOrgIds: string[] = [];
    const pageErrors: string[] = [];

    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    try {
      await page.setViewportSize({ width: 1440, height: 920 });

      // 1. Public /pricing page + interactive Teams Seat Calculator + 375/393/1440 + axe-core
      await page.goto("/pricing");
      await expect(page.getByTestId("teams-seat-calculator")).toBeVisible();
      await expect(page.getByTestId("teams-calc-seat-count")).toHaveText("3");
      await expect(page.getByTestId("teams-calc-headline-price")).toHaveText("$20.97");

      await expect(async () => {
        await page.getByTestId("teams-calc-preset-5").click();
        await expect(page.getByTestId("teams-calc-seat-count")).toHaveText("5", {
          timeout: 1_000,
        });
      }).toPass({ timeout: 10_000 });
      await expect(page.getByTestId("teams-calc-headline-price")).toHaveText("$34.95");

      await page.getByTestId("teams-calc-preset-15").click();
      await expect(page.getByTestId("teams-calc-plus-recommendation")).toBeVisible();
      await expect(page.getByTestId("teams-calc-headline-price")).toHaveText("$99");

      await page.getByTestId("teams-calc-preset-26").click();
      await expect(page.getByTestId("teams-calc-capacity-review")).toBeVisible();
      await expect(page.getByTestId("teams-calc-disclaimer")).toContainText(
        "this calculator saves nothing and charges nothing",
      );

      await page.getByTestId("teams-calc-preset-3").click();
      await assertCleanA11yAndResponsive(page, "/pricing");

      // 2. Public /help/billing-and-plans article + 375/393/1440 + axe-core
      await page.goto("/help/billing-and-plans");
      await expect(page.getByText(/\$9\.99\/mo/i).first()).toBeVisible();
      await expect(page.getByText(/Departed member recovery/i).first()).toBeVisible();
      await assertCleanA11yAndResponsive(page, "/help/billing-and-plans");

      // 3. Sign up & verify Owner + Member accounts
      for (const acct of [
        { name: "Tariq Studio Owner", email: ownerEmail },
        { name: "Nour Team Designer", email: memberEmail },
      ]) {
        await page.context().clearCookies();
        await page.goto("/sign-up");
        await page.getByLabel("Full name").fill(acct.name);
        await page.getByLabel("Email").fill(acct.email);
        await page.getByLabel("Password").fill(password);
        await page.locator('input[name="acceptTerms"]').check();
        await page.getByRole("button", { name: "Create account" }).click();
        await expect(page).toHaveURL(/\/verify/);

        const [verified] = await db
          .update(users)
          .set({
            emailVerified: true,
            onboardingCompletedAt: new Date(),
          })
          .where(eq(users.email, acct.email))
          .returning({ id: users.id });
        expect(verified?.id).toBeTruthy();
        createdUserIds.push(verified!.id);
      }

      // 4. Owner signs in, creates Team organization, activates 3-seat Teams plan via Sandbox Checkout, and invites Member
      await page.context().clearCookies();
      await page.goto("/sign-in");
      await page.getByLabel("Email", { exact: true }).fill(ownerEmail);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Log in" }).click();
      await expect(page).toHaveURL(/\/dashboard/);

      await page.goto("/account/team");
      await page.getByLabel("Team or studio name").fill(teamName);
      await page.getByLabel("Workspace slug").fill(teamSlug);
      await page.getByRole("button", { name: /Create team workspace/i }).click();
      await expect(page.getByText(teamName).first()).toBeVisible({ timeout: 10_000 });

      const [orgRow] = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.slug, teamSlug))
        .limit(1);
      expect(orgRow?.id).toBeTruthy();
      const orgId = orgRow!.id;
      createdOrgIds.push(orgId);

      // Activate 3-seat Teams subscription via sandbox checkout endpoint
      const checkoutRes = await page.request.post("/api/paddle/sandbox-complete", {
        data: {
          plan: "team",
          interval: "monthly",
          orgId,
          seats: 3,
        },
      });
      expect(checkoutRes.status()).toBe(200);
      const checkoutJson = (await checkoutRes.json()) as { ok: boolean };
      expect(checkoutJson.ok).toBe(true);

      await page.reload({ waitUntil: "domcontentloaded" });
      await assertCleanA11yAndResponsive(page, "/account/team");

      // Invite Member via /api/team/invitations (same endpoint backing /account/team form)
      const inviteRes = await page.request.post("/api/team/invitations", {
        data: {
          organizationId: orgId,
          email: memberEmail,
          role: "member",
        },
      });
      expect(inviteRes.status()).toBe(200);
      const inviteJson = (await inviteRes.json()) as {
        ok: boolean;
        invitation: { id: string; email: string; role: string };
      };
      expect(inviteJson.ok).toBe(true);

      // 5. Member signs in within separate browser context, accepts invite, switches to Team workspace, and creates a Private Space project
      const memberContext = await browser.newContext({
        viewport: { width: 1440, height: 920 },
      });
      const memberPage = await memberContext.newPage();

      await memberPage.goto("/sign-in");
      await memberPage.getByLabel("Email", { exact: true }).fill(memberEmail);
      await memberPage.getByLabel("Password", { exact: true }).fill(password);
      await memberPage.getByRole("button", { name: "Log in" }).click();
      await expect(memberPage).toHaveURL(/\/dashboard/);

      const acceptRes = await memberPage.request.post(
        `/api/team/invitations/${inviteJson.invitation.id}`,
        {
          data: { action: "accept" },
        },
      );
      expect(acceptRes.status()).toBe(200);

      // Switch Member's active workspace to the Team workspace on /dashboard
      await memberPage.goto("/dashboard");
      await memberPage.getByTestId("dashboard-workspace-select").selectOption(orgId);
      await expect(memberPage.getByRole("button", { name: /My Private Space/i })).toBeVisible();

      // Member creates a project inside Team workspace (defaults to Member's Private Space!)
      await memberPage.goto("/new");
      await memberPage.getByRole("radio", { name: /Mobile app/i }).click();
      await memberPage.getByTestId("wizard-next-to-template").click();
      await memberPage
        .locator('[data-slot="wizard-template-card"][data-template-slug="orbit"]')
        .getByRole("button", { name: /Select|Selected/i })
        .click();
      await memberPage.getByTestId("wizard-next-to-details").click();
      await memberPage.getByLabel("Project name *").fill("Member Confidential Fintech Draft");
      await memberPage.getByTestId("wizard-submit-create").click();
      await expect(memberPage).toHaveURL(/\/editor\/([0-9a-f-]+)/);
      const privateProjectId =
        memberPage.url().match(/\/editor\/([0-9a-f-]+)/)?.[1] ?? "";
      expect(privateProjectId).toBeTruthy();

      // 6. Verify strict privacy: Team Owner gets 404 when attempting to open Member's Private Space project AND cannot see it on Team /dashboard
      await page.goto("/dashboard");
      await page.getByTestId("dashboard-workspace-select").selectOption(orgId);
      await expect(page.getByText("Member Confidential Fintech Draft")).toHaveCount(0);

      const ownerEditorProbe = await page.goto(`/editor/${privateProjectId}`, {
        waitUntil: "domcontentloaded",
      });
      expect(ownerEditorProbe?.status()).toBe(404);

      // 7. Owner removes Member from Team -> Member recovers private project via /account/recovery into Personal Workspace
      const memberUserId = createdUserIds[1]!;
      const removeRes = await page.request.delete("/api/team/members", {
        data: { organizationId: orgId, targetUserId: memberUserId },
      });
      expect(removeRes.status()).toBe(200);

      await memberPage.goto("/dashboard");
      await expect(memberPage.getByTestId("dashboard-recovery-banner")).toBeVisible();

      await memberPage.goto("/account/recovery");
      await expect(memberPage.getByTestId("recovery-portal-panel")).toBeVisible();
      await expect(
        memberPage.getByText("Member Confidential Fintech Draft"),
      ).toBeVisible();
      await assertCleanA11yAndResponsive(memberPage, "/account/recovery");

      await memberPage
        .getByRole("button", { name: /Copy to Personal Workspace/i })
        .click();
      const openCopyLink = memberPage.getByRole("link", { name: /Open personal copy/i });
      await expect(openCopyLink).toBeVisible({ timeout: 10_000 });

      await openCopyLink.click();
      await expect(memberPage).toHaveURL(/\/editor\/([0-9a-f-]+)/);

      await memberContext.close();
      expect(pageErrors).toEqual([]);
    } finally {
      if (createdUserIds.length > 0) {
        await db.delete(projects).where(inArray(projects.ownerId, createdUserIds));
      }
      if (createdOrgIds.length > 0) {
        await db.delete(organizations).where(inArray(organizations.id, createdOrgIds));
      }
      if (createdUserIds.length > 0) {
        await db.delete(users).where(inArray(users.id, createdUserIds));
      }
      await pool.end();
    }
  });
});
