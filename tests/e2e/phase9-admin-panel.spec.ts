import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  auditLogs,
  categories,
  createDbConnection,
  eq,
  inArray,
  notifications,
  projects,
  reports,
  sessions,
  subscriptions,
  templateVersions,
  templates,
  users,
  accounts,
} from "../../packages/db/src/index";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const ARTIFACT_DIR = process.env.CASEFOLIO_E2E_ARTIFACT_DIR ?? "";

async function maybeSaveScreenshot(
  page: Page,
  filename: string,
  fullPage = false,
) {
  if (ARTIFACT_DIR && existsSync(ARTIFACT_DIR)) {
    await page.screenshot({
      path: resolve(ARTIFACT_DIR, filename),
      fullPage,
      animations: "disabled",
      caret: "initial",
    });
  }
}

async function assertNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(
    overflow.scrollWidth,
    `Expected zero horizontal overflow on ${label} (${overflow.scrollWidth} > ${overflow.innerWidth})`,
  ).toBeLessThanOrEqual(overflow.innerWidth);
}

test("Phase 9 E2E: Full Admin Panel (31:6665) — 403 RBAC guard, overview, analytics, templates & detail, categories -> library sync, users & suspend login block, subscriptions, public report -> moderation takedown 404, settings/roles, and 100% mutation audit log verification", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);

  const databaseUrl = process.env.DATABASE_URL ?? "postgresql://localhost:5433/casefolio";
  const { db, pool } = createDbConnection(databaseUrl);

  const stamp = Date.now();
  const adminEmail = `e2e-superadmin-p9-${stamp}@casefolio.test`;
  const memberEmail = `e2e-member-p9-${stamp}@casefolio.test`;
  const password = "CasefolioAdmin2026!";
  const flaggedSlug = `flagged-checkout-${stamp}`;
  const tempCatName = `AI Studio ${stamp.toString().slice(-4)}`;
  const tempCatSlug = `ai-studio-${stamp.toString().slice(-4)}`;

  const createdUserIds: string[] = [];
  let createdProjectId: string | null = null;
  let createdSubId: string | null = null;
  const pageErrors: string[] = [];

  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });

  try {
    const [orbitTpl] = await db
      .select()
      .from(templates)
      .where(eq(templates.slug, "orbit"))
      .limit(1);
    expect(orbitTpl).toBeTruthy();

    const [tplVer] = await db
      .select()
      .from(templateVersions)
      .where(eq(templateVersions.templateId, orbitTpl!.id))
      .limit(1);
    expect(tplVer).toBeTruthy();

    await page.setViewportSize({ width: 1440, height: 920 });

    // 1. Sign up member user & verify non-admin gets 403 on /admin
    await page.goto("/sign-up");
    await page.getByLabel("Full name").fill("Lina Al-Mansoor");
    await page.getByLabel("Email").fill(memberEmail);
    await page.getByLabel("Password").fill(password);
    await page.locator('input[name="acceptTerms"]').check();
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/verify/);

    const [memberRow] = await db
      .update(users)
      .set({
        emailVerified: true,
        plan: "pro",
        jobTitle: "Senior Product Designer",
        designFocus: "mobile",
        onboardingCompletedAt: new Date(),
      })
      .where(eq(users.email, memberEmail))
      .returning();
    expect(memberRow).toBeTruthy();
    createdUserIds.push(memberRow!.id);

    // Seed a Pro subscription mirror row for Lina so Subscriptions & User Detail show rich data
    const [subRow] = await db
      .insert(subscriptions)
      .values({
        userId: memberRow!.id,
        paddleCustomerId: `ctm_01p9_${stamp}`,
        paddleSubscriptionId: `sub_01p9_${stamp}`,
        plan: "pro",
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
      })
      .returning();
    createdSubId = subRow?.id ?? null;

    // Seed a published case study owned by Lina
    const docData = tplVer!.data as {
      puckData?: Record<string, unknown>;
      theme?: Record<string, unknown>;
    };
    const [projRow] = await db
      .insert(projects)
      .values({
        ownerId: memberRow!.id,
        templateVersionId: tplVer!.id,
        name: "Souq — Flagged Checkout Concept",
        type: "mobile",
        puckData: docData.puckData ?? { content: [], root: {} },
        theme: docData.theme ?? {},
        slug: flaggedSlug,
        visibility: "public",
        publishedAt: new Date(),
      })
      .returning();
    createdProjectId = projRow?.id ?? null;
    expect(createdProjectId).toBeTruthy();

    // Sign in as non-admin member in an isolated context and verify 403 on /admin
    const memberCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const memberPage = await memberCtx.newPage();
    await memberPage.goto("/sign-in");
    await memberPage.getByLabel("Email", { exact: true }).fill(memberEmail);
    await memberPage.getByLabel("Password", { exact: true }).fill(password);
    await memberPage.getByRole("button", { name: "Log in" }).click();
    await expect(memberPage).toHaveURL(/\/dashboard/);

    const nonAdminRes = await memberPage.goto("/admin");
    expect(nonAdminRes?.status()).toBe(403);
    const nonAdminApiRes = await memberPage.request.get("/api/admin/users");
    expect(nonAdminApiRes.status()).toBe(403);

    // 2. Visit public /p/[slug] (HTTP 200) and submit a public moderation report
    const pubBeforeRes = await memberPage.goto(`/p/${flaggedSlug}`);
    expect(pubBeforeRes?.status()).toBe(200);
    await memberPage.getByTestId("report-case-study-trigger").click();
    await memberPage.getByLabel("Reason").selectOption("Spam or scam");
    await memberPage
      .getByLabel(/Additional context/i)
      .fill("Reporters say the page promotes a token scheme and external wallet.");
    await memberPage.getByRole("button", { name: "Submit report" }).click();
    await expect(memberPage.getByTestId("report-submitted-confirmation")).toBeVisible();
    await memberCtx.close();

    // 3. Sign up & promote Superadmin, then sign in on main page
    await page.context().clearCookies();
    await page.goto("/sign-up");
    await page.getByLabel("Full name").fill("Ahmed Hamdan");
    await page.getByLabel("Email").fill(adminEmail);
    await page.getByLabel("Password").fill(password);
    await page.locator('input[name="acceptTerms"]').check();
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/verify/);

    const [adminRow] = await db
      .update(users)
      .set({
        emailVerified: true,
        role: "superadmin",
        onboardingCompletedAt: new Date(),
      })
      .where(eq(users.email, adminEmail))
      .returning();
    expect(adminRow).toBeTruthy();
    createdUserIds.push(adminRow!.id);

    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(adminEmail);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // 4. C-901: Admin Overview (/admin) + Mobile 375px + Platform Analytics (/admin/analytics)
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    await assertNoHorizontalOverflow(page, "/admin (1440px)");
    await maybeSaveScreenshot(page, "admin-overview-1440.png");

    await page.setViewportSize({ width: 375, height: 812 });
    await assertNoHorizontalOverflow(page, "/admin (375px)");
    await maybeSaveScreenshot(page, "admin-overview-375.png");
    await page.setViewportSize({ width: 1440, height: 920 });

    await page.goto("/admin/analytics");
    await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
    await assertNoHorizontalOverflow(page, "/admin/analytics (1440px)");
    await maybeSaveScreenshot(page, "admin-analytics-1440.png");

    // 5. C-902: Admin Templates list & Template Detail
    await page.goto("/admin/templates");
    await expect(page.getByRole("heading", { name: "Templates" })).toBeVisible();
    await assertNoHorizontalOverflow(page, "/admin/templates (1440px)");
    await maybeSaveScreenshot(page, "admin-templates-1440.png");

    await page.setViewportSize({ width: 375, height: 812 });
    await assertNoHorizontalOverflow(page, "/admin/templates (375px)");
    await maybeSaveScreenshot(page, "admin-templates-375.png");
    await page.setViewportSize({ width: 1440, height: 920 });

    await page.goto(`/admin/templates/${orbitTpl!.id}`);
    await expect(
      page.getByRole("heading", { name: orbitTpl!.name, exact: true }),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Sections" }).click();
    await page.getByRole("tab", { name: "Usage" }).click();
    await page.getByRole("tab", { name: "Preview" }).click();
    await assertNoHorizontalOverflow(page, "/admin/templates/[id] (1440px)");
    await maybeSaveScreenshot(page, "admin-template-detail-1440.png");

    // 6. C-903: Admin Categories CRUD -> verify in /templates filter bar -> delete temp category
    await page.goto("/admin/categories");
    await expect(page.getByRole("heading", { name: "Categories & types" })).toBeVisible();
    await assertNoHorizontalOverflow(page, "/admin/categories (1440px)");
    await maybeSaveScreenshot(page, "admin-categories-1440.png");

    await page.getByRole("button", { name: "Add category" }).click();
    await page.getByLabel("Category name").fill(tempCatName);
    await page.getByRole("button", { name: "Create category" }).click();
    await expect(
      page.getByTestId("admin-categories-list").getByText(tempCatName),
    ).toBeVisible();

    // Verify new category appears in /templates library filter bar
    await page.goto("/templates");
    await expect(page.getByRole("button", { name: tempCatName })).toBeVisible();

    // Return to /admin/categories and delete temporary category
    await page.goto("/admin/categories");
    await page
      .getByTestId("admin-categories-list")
      .locator("li")
      .filter({ hasText: tempCatName })
      .getByRole("button", { name: "Edit" })
      .click();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(
      page.getByTestId("admin-categories-list").getByText(tempCatName),
    ).toHaveCount(0);

    // 7. C-904: Admin Users, User Detail, Suspend blocks login, Subscriptions
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
    await assertNoHorizontalOverflow(page, "/admin/users (1440px)");
    await maybeSaveScreenshot(page, "admin-users-1440.png");

    await page.setViewportSize({ width: 375, height: 812 });
    await assertNoHorizontalOverflow(page, "/admin/users (375px)");
    await maybeSaveScreenshot(page, "admin-users-375.png");
    await page.setViewportSize({ width: 1440, height: 920 });

    await page.goto(`/admin/users/${memberRow!.id}`);
    await expect(
      page.getByRole("heading", { level: 1, name: "Lina Al-Mansoor" }),
    ).toBeVisible();
    await assertNoHorizontalOverflow(page, "/admin/users/[id] (1440px)");
    await maybeSaveScreenshot(page, "admin-user-detail-1440.png");

    // Suspend Lina -> verify login is blocked in isolated context -> reactivate Lina
    await page.getByRole("button", { name: "Suspend user" }).click();
    await expect(page.getByText(/Account suspended/i)).toBeVisible();

    const blockedCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const blockedPage = await blockedCtx.newPage();
    await blockedPage.goto("/sign-in");
    await blockedPage.getByLabel("Email", { exact: true }).fill(memberEmail);
    await blockedPage.getByLabel("Password", { exact: true }).fill(password);
    await blockedPage.getByRole("button", { name: "Log in" }).click();
    await expect(blockedPage.getByText(/suspended/i)).toBeVisible();
    await expect(blockedPage).toHaveURL(/\/sign-in/);
    await blockedCtx.close();

    await page.getByRole("button", { name: "Reactivate user" }).click();
    await expect(page.getByText(/Account reactivated/i)).toBeVisible();

    // Subscriptions & plans page
    await page.goto("/admin/subscriptions");
    await expect(page.getByRole("heading", { name: "Subscriptions & plans" })).toBeVisible();
    await assertNoHorizontalOverflow(page, "/admin/subscriptions (1440px)");
    await maybeSaveScreenshot(page, "admin-subscriptions-1440.png");

    // 8. C-905: Moderation queue -> Takedown makes /p/[slug] return HTTP 404 -> Empty state
    await page.goto("/admin/moderation");
    await expect(page.getByRole("heading", { name: "Moderation" })).toBeVisible();
    await expect(page.getByText("Souq — Flagged Checkout Concept").first()).toBeVisible();
    await assertNoHorizontalOverflow(page, "/admin/moderation (1440px)");
    await maybeSaveScreenshot(page, "admin-moderation-1440.png");

    await page
      .getByTestId("moderation-review-panel")
      .getByRole("button", { name: "Take down" })
      .click();
    await expect(page.getByText(/Case study unpublished/i)).toBeVisible();

    // Verify /p/[slug] immediately returns HTTP 404!
    const afterTakedownRes = await page.request.get(`/p/${flaggedSlug}`);
    expect(afterTakedownRes.status()).toBe(404);

    // If no other open reports exist, capture empty state; otherwise switch to Reviewed (0)
    const emptyVisible = await page.getByTestId("moderation-empty-state").isVisible();
    if (!emptyVisible) {
      await page.getByRole("tab", { name: /Reviewed/i }).click();
    }
    if (await page.getByTestId("moderation-empty-state").isVisible()) {
      await maybeSaveScreenshot(page, "admin-moderation-empty-1440.png");
    }

    // 9. C-906: Settings & roles + Platform feature flags + Audit log verification
    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { name: "Settings & roles" })).toBeVisible();
    await assertNoHorizontalOverflow(page, "/admin/settings (1440px)");
    await maybeSaveScreenshot(page, "admin-settings-1440.png");

    await page.setViewportSize({ width: 375, height: 812 });
    await assertNoHorizontalOverflow(page, "/admin/settings (375px)");
    await maybeSaveScreenshot(page, "admin-settings-375.png");
    await page.setViewportSize({ width: 1440, height: 920 });

    // Promote Lina to Admin via "+ Add admin", then remove admin role
    await page.getByRole("button", { name: "Add admin" }).click();
    await page.getByLabel("Account email").fill(memberEmail);
    await page.getByRole("button", { name: "Grant access" }).click();
    await expect(page.getByText(/Admin role granted/i)).toBeVisible();

    const linaAdminRow = page
      .getByTestId("admin-team-row")
      .filter({ hasText: "Lina Al-Mansoor" });
    await expect(linaAdminRow).toBeVisible();
    await linaAdminRow.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText(/Removed admin access/i)).toBeVisible();

    // Toggle "Require email verification" off and back on
    const verifySwitch = page.locator("#flag-email-verify");
    await verifySwitch.click();
    await expect(page.getByText(/Platform setting updated/i)).toBeVisible();
    await verifySwitch.click();
    await expect(page.getByText(/Platform setting updated/i)).toBeVisible();

    // Switch to Audit log tab and verify EVERY admin mutation from this E2E run is logged!
    await page.getByRole("tab", { name: /Audit log/i }).click();
    const auditPanel = page.getByTestId("admin-audit-log-panel");
    await expect(auditPanel).toBeVisible();

    const expectedAuditActions = [
      "admin.category.created",
      "admin.category.deleted",
      "admin.user.suspended",
      "admin.user.unsuspended",
      "admin.moderation.takedown",
      "admin.role.updated",
      "admin.platform_settings.updated",
    ];

    for (const action of expectedAuditActions) {
      await expect(
        auditPanel.locator(`[data-audit-action="${action}"]`).first(),
        `Expected audit log entry for ${action}`,
      ).toBeVisible();
    }

    await assertNoHorizontalOverflow(page, "/admin/settings?tab=audit (1440px)");
    await maybeSaveScreenshot(page, "admin-audit-log-1440.png");

    expect(pageErrors).toEqual([]);
  } finally {
    await db.delete(categories).where(eq(categories.slug, tempCatSlug));
    if (createdProjectId) {
      await db.delete(reports).where(eq(reports.projectId, createdProjectId));
      await db.delete(projects).where(eq(projects.id, createdProjectId));
    }
    if (createdSubId) {
      await db.delete(subscriptions).where(eq(subscriptions.id, createdSubId));
    }
    if (createdUserIds.length > 0) {
      await db.delete(notifications).where(inArray(notifications.userId, createdUserIds));
      await db.delete(auditLogs).where(inArray(auditLogs.actorId, createdUserIds));
      await db.delete(sessions).where(inArray(sessions.userId, createdUserIds));
      await db.delete(accounts).where(inArray(accounts.userId, createdUserIds));
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
    await pool.end();
  }
});
