import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  createDbConnection,
  eq,
  projects,
  templateVersions,
  templates,
  users,
} from "../../packages/db/src/index";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const ARTIFACT_DIR = process.env.CASEFOLIO_E2E_ARTIFACT_DIR ?? "";

async function maybeSaveScreenshot(page: Page, filename: string, fullPage = false) {
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
  const overflow = await page.evaluate(() => {
    const culprits: string[] = [];
    for (const el of Array.from(document.querySelectorAll("*"))) {
      const scroller = el.parentElement?.closest(".overflow-x-auto");
      if (scroller && scroller.getBoundingClientRect().right <= window.innerWidth + 1) {
        continue;
      }
      const r = el.getBoundingClientRect();
      if (r.right > window.innerWidth + 1) {
        culprits.push(
          `${el.tagName.toLowerCase()}.${(el.className || "").toString().slice(0, 60)}->${Math.round(r.right)}`,
        );
      }
    }
    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      culprits: culprits.slice(0, 8),
    };
  });
  expect(
    overflow.scrollWidth,
    `Expected zero horizontal overflow on ${label} (${overflow.scrollWidth} > ${overflow.innerWidth}); culprits=${JSON.stringify(overflow.culprits)}`,
  ).toBeLessThanOrEqual(overflow.innerWidth);
}

test("Phase 10 E2E: Marketing landing (27:6665), Pricing (2:8841), Help center + MDX + Support ticket (2:9899/10019/10147), and Dashboard empty/grid/duplicate/rename/delete (2:2172/2003/2583/2980) at 1440px & 375px", async ({
  page,
}) => {
  test.setTimeout(120_000);

  const databaseUrl = process.env.DATABASE_URL ?? "postgresql://localhost:5433/casefolio";
  const { db, pool } = createDbConnection(databaseUrl);

  const stamp = Date.now();
  const userEmail = `e2e-phase10-${stamp}@casefolio.test`;
  const password = "CasefolioDesigner2026!";
  let createdUserId: string | null = null;

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

    // =========================================================================
    // 1. Marketing Landing `/` (Figma 27:6665) at 1440px & 375px
    // =========================================================================
    await page.setViewportSize({ width: 1440, height: 920 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        name: /Turn finished UI screens into published case studies/i,
      }),
    ).toBeVisible();
    await assertNoHorizontalOverflow(page, "/ at 1440px");
    await maybeSaveScreenshot(page, "landing-hero-1440.png", false);
    await maybeSaveScreenshot(page, "landing-1440.png", true);

    // Verify app-launch CTA actions replace home-page pricing cards & open an FAQ item
    await expect(page.getByTestId("landing-start-cta")).toBeVisible();
    await expect(page.getByTestId("paid-plan-cards-grid")).toHaveCount(0);
    await page
      .getByRole("button", {
        name: /Can I use my own colors, fonts, and custom domain/i,
      })
      .click();
    await expect(page.getByText(/Plus also includes custom domains/i)).toBeVisible();

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        name: /Turn finished UI screens into published case studies/i,
      }),
    ).toBeVisible();
    await assertNoHorizontalOverflow(page, "/ at 375px");
    await maybeSaveScreenshot(page, "landing-hero-375.png", false);
    await maybeSaveScreenshot(page, "landing-375.png", true);

    // =========================================================================
    // 2. Pricing `/pricing` (Figma 2:8841) at 1440px & 375px
    // =========================================================================
    await page.setViewportSize({ width: 1440, height: 920 });
    await page.goto("/pricing");
    await expect(
      page.getByRole("heading", {
        name: /Simple pricing for solo designers, studios, and agencies/i,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /^Annual/i })
      .first()
      .click();
    await expect(page.getByText("$7.99").first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Compare every feature & quota/i }),
    ).toBeVisible();
    await assertNoHorizontalOverflow(page, "/pricing at 1440px");
    await maybeSaveScreenshot(page, "pricing-1440.png", true);

    await page.setViewportSize({ width: 375, height: 812 });
    await assertNoHorizontalOverflow(page, "/pricing at 375px");
    await maybeSaveScreenshot(page, "pricing-375.png", true);

    // =========================================================================
    // 3. Public Help Article `/help/exports` (MDX rendering)
    // =========================================================================
    await page.setViewportSize({ width: 1440, height: 920 });
    await page.goto("/help");
    await page.getByLabel("Search help articles").fill("PDF");
    await expect(page.getByText(/articles? match/i)).toBeVisible();
    await page.locator('a[href="/help/exports"]').first().click();
    await expect(page).toHaveURL(/\/help\/exports/);
    await expect(
      page.getByRole("heading", {
        name: /Pixel-identical PNG, PDF and Behance exports/i,
      }),
    ).toBeVisible();
    await assertNoHorizontalOverflow(page, "/help/exports at 1440px");
    await maybeSaveScreenshot(page, "help-article-1440.png", false);

    // =========================================================================
    // 4. Sign up & authenticate Designer user for AppShell Help + Dashboard
    // =========================================================================
    await page.goto("/sign-up");
    await page.getByLabel("Full name").fill("Rami Al-Saleh");
    await page.getByLabel("Email").fill(userEmail);
    await page.getByLabel("Password").fill(password);
    await page.locator('input[name="acceptTerms"]').check();
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/verify/);

    const [userRow] = await db
      .update(users)
      .set({
        emailVerified: true,
        plan: "pro",
        jobTitle: "Principal Product Designer",
        designFocus: "both",
        onboardingCompletedAt: new Date(),
      })
      .where(eq(users.email, userEmail))
      .returning();
    expect(userRow).toBeTruthy();
    createdUserId = userRow!.id;

    await page.context().clearCookies();
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(userEmail);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // =========================================================================
    // 5. Dashboard Empty State `/dashboard` (Figma 2:2172) at 1440px & 375px
    // =========================================================================
    await page.setViewportSize({ width: 1440, height: 920 });
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", {
        name: "Your first case study starts here",
      }),
    ).toBeVisible();
    await expect(page.getByText("Pick a template")).toBeVisible();
    await expect(page.getByText("Fill the slots")).toBeVisible();
    await expect(page.getByText("Publish or export")).toBeVisible();
    await assertNoHorizontalOverflow(page, "/dashboard empty at 1440px");
    await maybeSaveScreenshot(page, "dashboard-empty-1440.png", false);

    await page.setViewportSize({ width: 375, height: 812 });
    await assertNoHorizontalOverflow(page, "/dashboard empty at 375px");
    await maybeSaveScreenshot(page, "dashboard-empty-375.png", false);

    // =========================================================================
    // 6. Seed 3 Projects & Verify Dashboard Grid + Actions (Figma 2:2003)
    // =========================================================================
    const now = Date.now();
    const docData = tplVer!.data as {
      puckData?: Record<string, unknown>;
      theme?: Record<string, unknown>;
    };
    await db.insert(projects).values([
      {
        ownerId: createdUserId,
        templateVersionId: tplVer!.id,
        name: "Mosaed — Debt app",
        slug: `mosaed-debt-${stamp}`,
        type: "mobile",
        visibility: "public",
        publishedAt: new Date(now - 7200_000),
        updatedAt: new Date(now - 7200_000),
        puckData: docData.puckData ?? { content: [], root: {} },
        theme: docData.theme ?? {},
      },
      {
        ownerId: createdUserId,
        templateVersionId: tplVer!.id,
        name: "Kayan — Architecture studio",
        slug: `kayan-arch-${stamp}`,
        type: "web",
        visibility: "public",
        publishedAt: new Date(now - 86_400_000),
        updatedAt: new Date(now - 86_400_000),
        puckData: docData.puckData ?? { content: [], root: {} },
        theme: docData.theme ?? {},
      },
      {
        ownerId: createdUserId,
        templateVersionId: tplVer!.id,
        name: "Tadawul — Investor onboarding",
        slug: null,
        type: "mobile",
        visibility: "private",
        publishedAt: null,
        updatedAt: new Date(now - 3 * 86_400_000),
        puckData: docData.puckData ?? { content: [], root: {} },
        theme: docData.theme ?? {},
      },
    ]);

    await page.setViewportSize({ width: 1440, height: 920 });
    await page.goto("/dashboard");
    await expect(page.getByText("Mosaed — Debt app")).toBeVisible();
    await expect(page.getByText("Kayan — Architecture studio")).toBeVisible();
    await expect(page.getByText("Tadawul — Investor onboarding")).toBeVisible();
    await assertNoHorizontalOverflow(page, "/dashboard grid at 1440px");
    await maybeSaveScreenshot(page, "dashboard-projects-1440.png", false);

    await page.setViewportSize({ width: 375, height: 812 });
    await assertNoHorizontalOverflow(page, "/dashboard grid at 375px");
    await maybeSaveScreenshot(page, "dashboard-projects-375.png", false);

    // Card context menu (Figma 2:2583), Duplicate, Rename (2:2783), Delete (2:2980)
    await page.setViewportSize({ width: 1440, height: 920 });
    await page.getByRole("button", { name: "Actions for Mosaed — Debt app" }).click();
    await expect(page.getByRole("menuitem", { name: "Duplicate" })).toBeVisible();
    await maybeSaveScreenshot(page, "dashboard-menu-1440.png", false);

    // Duplicate
    await page.getByRole("menuitem", { name: "Duplicate" }).click();
    await expect(page.getByText("Mosaed — Debt app (Copy)", { exact: true })).toBeVisible();

    // Rename
    await page.getByRole("button", { name: "Actions for Mosaed — Debt app (Copy)" }).click();
    await page.getByRole("menuitem", { name: "Rename" }).click();
    await expect(page.getByRole("heading", { name: "Rename project" })).toBeVisible();
    await maybeSaveScreenshot(page, "dashboard-rename-1440.png", false);
    await page.getByLabel("Project name").fill("Mosaed — Case Study v2");
    await page.getByRole("button", { name: "Save name" }).click();
    await expect(page.getByText("Mosaed — Case Study v2", { exact: true })).toBeVisible();

    // Delete with exact name confirmation
    await page.getByRole("button", { name: "Actions for Mosaed — Case Study v2" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await expect(
      page.getByRole("heading", { name: /Delete “Mosaed — Case Study v2”\?/ }),
    ).toBeVisible();
    const confirmDeleteBtn = page.getByRole("button", {
      name: "Delete project",
    });
    await expect(confirmDeleteBtn).toBeDisabled();
    await page.getByLabel("Type the project name to confirm").fill("Mosaed — Case Study v2");
    await expect(confirmDeleteBtn).toBeEnabled();
    await maybeSaveScreenshot(page, "dashboard-delete-1440.png", false);
    await confirmDeleteBtn.click();
    await expect(page.getByText("Mosaed — Case Study v2", { exact: true })).toHaveCount(0);

    // =========================================================================
    // 7. Authenticated Help Center & Contact Support (Figma 2:9899/10019/10147)
    // =========================================================================
    await page.setViewportSize({ width: 1440, height: 920 });
    await page.goto("/help");
    await expect(page.getByRole("heading", { name: "How can we help?" })).toBeVisible();
    await assertNoHorizontalOverflow(page, "/help signed-in at 1440px");
    await maybeSaveScreenshot(page, "help-center-1440.png", false);

    await page.setViewportSize({ width: 375, height: 812 });
    await assertNoHorizontalOverflow(page, "/help signed-in at 375px");
    await maybeSaveScreenshot(page, "help-center-375.png", false);

    await page.setViewportSize({ width: 1440, height: 920 });
    await page.goto("/help/contact");
    await expect(page.getByRole("heading", { name: "Contact support" })).toBeVisible();
    await assertNoHorizontalOverflow(page, "/help/contact at 1440px");
    await maybeSaveScreenshot(page, "help-contact-1440.png", false);

    await page.getByLabel("Subject").fill("PDF export question on Orbit");
    await page
      .getByLabel("Message")
      .fill("Could you confirm whether Presentation 16:9 PDF keeps vector typography?");
    await page.getByRole("button", { name: /Send message/i }).click();
    await expect(page.getByRole("heading", { name: "Message sent" })).toBeVisible();
    await expect(page.getByText(/Ticket #CF-/)).toBeVisible();
    await maybeSaveScreenshot(page, "help-sent-1440.png", false);

    expect(pageErrors).toEqual([]);
  } finally {
    if (createdUserId) {
      await db.delete(users).where(eq(users.id, createdUserId));
    }
    await pool.end();
  }
});
