import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import {
  createDbConnection,
  eq,
  projects,
  templates,
  templateVersions,
  users,
} from "../../packages/db/src/index";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const ARTIFACT_DIR = process.env.CASEFOLIO_E2E_ARTIFACT_DIR ?? "";

async function maybeSaveScreenshot(
  target: { screenshot: (opts: { path: string; fullPage?: boolean }) => Promise<Buffer> },
  filename: string,
  fullPage = false,
) {
  if (ARTIFACT_DIR && existsSync(ARTIFACT_DIR)) {
    await target.screenshot({
      path: resolve(ARTIFACT_DIR, filename),
      fullPage,
    });
  }
}

test("Phase 4 E2E: create Mobile project from Orbit, edit text/colors, undo/redo, autosave + reload persistence, zero free-canvas components, and 375px responsive bottom-sheet editor", async ({
  page,
}) => {
  const databaseUrl = process.env.DATABASE_URL ?? "postgresql://localhost:5433/casefolio";
  const { db, pool } = createDbConnection(databaseUrl);

  const stamp = Date.now();
  const userEmail = `e2e-designer-p4-${stamp}@casefolio.test`;
  const password = "CasefolioDesigner2026!";
  let createdUserId: string | null = null;
  const pageErrors: string[] = [];

  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });

  try {
    // Ensure Orbit v1.0.0 is published in DB (idempotent for fresh CI containers)
    const [existingOrbit] = await db
      .select()
      .from(templates)
      .where(eq(templates.slug, "orbit"))
      .limit(1);

    if (!existingOrbit) {
      const orbitRaw = JSON.parse(
        readFileSync(resolve(process.cwd(), "reference/template.example.json"), "utf-8"),
      );
      const [insertedTpl] = await db
        .insert(templates)
        .values({
          slug: "orbit",
          name: "Orbit",
          type: "mobile",
          category: "Fintech",
          tier: "free",
          status: "published",
          coverUrl: orbitRaw.template.cover.src,
        })
        .returning();
      if (insertedTpl) {
        const [insertedVer] = await db
          .insert(templateVersions)
          .values({
            templateId: insertedTpl.id,
            version: "1.0.0",
            data: orbitRaw,
            changelog: "Initial seed",
            publishedAt: new Date(),
          })
          .returning();
        if (insertedVer) {
          await db
            .update(templates)
            .set({ currentVersionId: insertedVer.id })
            .where(eq(templates.id, insertedTpl.id));
        }
      }
    }

    await page.setViewportSize({ width: 1440, height: 900 });

    // 1. Register user via /sign-up, mark verified & onboarded
    await page.goto("/sign-up");
    await page.getByLabel("Full name").fill("Layla Designer");
    await page.getByLabel("Email").fill(userEmail);
    await page.getByLabel("Password").fill(password);
    await page.locator('input[name="acceptTerms"]').check();
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/verify/);

    const [updatedUser] = await db
      .update(users)
      .set({
        emailVerified: true,
        designFocus: "mobile",
        onboardingCompletedAt: new Date(),
      })
      .where(eq(users.email, userEmail))
      .returning({ id: users.id });
    createdUserId = updatedUser?.id ?? null;

    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(userEmail);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // 2. Create Mobile project from Orbit via /new 3-step wizard (C-401)
    await page.goto("/new");
    await expect(page.getByTestId("wizard-step-type")).toBeVisible();
    await page.getByRole("radio", { name: /Mobile app/i }).click();
    await page.getByTestId("wizard-next-to-template").click();

    await expect(page.getByTestId("wizard-step-template")).toBeVisible();
    const orbitWizardCard = page.locator('[data-slot="wizard-template-card"][data-template-slug="orbit"]');
    await expect(orbitWizardCard).toBeVisible();
    await orbitWizardCard.getByRole("button", { name: /Select|Selected/i }).click();
    await page.getByTestId("wizard-next-to-details").click();

    await expect(page.getByTestId("wizard-step-details")).toBeVisible();
    await page.getByLabel("Project name *").fill("Mosaed — Smart debt management");
    await page.getByLabel("Short description").fill("Helping consumers consolidate high-interest debt.");
    await page.getByLabel("Client").fill("Mosaed Fintech");
    await page.getByLabel("Your role").fill("Lead Product Designer");
    await page.getByLabel("Tools", { exact: true }).fill("Figma, Principle");

    // Verify Back / Next keeps wizard state
    await page.getByTestId("wizard-back-to-template").click();
    await expect(page.getByTestId("wizard-step-template")).toBeVisible();
    await page.getByTestId("wizard-next-to-details").click();
    await expect(page.getByLabel("Project name *")).toHaveValue("Mosaed — Smart debt management");
    await expect(page.getByLabel("Client")).toHaveValue("Mosaed Fintech");

    await maybeSaveScreenshot(page, "wizard-details-1440.png");

    await page.getByTestId("wizard-submit-create").click();
    await expect(page).toHaveURL(/\/editor\/[0-9a-f-]+/);

    // 3. Constrained Puck editor checks: zero free-canvas add/drag features (C-402)
    await expect(page.getByTestId("constrained-editor-root")).toBeVisible();
    await expect(page.locator("[data-puck-drawer]")).toHaveCount(0);
    await expect(page.locator("[data-puck-dropzone]")).toHaveCount(0);
    await expect(page.getByText(/Add section|Add component/i)).toHaveCount(0);

    // Hero is locked; Problem optional section can be toggled off
    const desktopLeftPanel = page.locator('[data-slot="editor-left-panel"]');
    await expect(desktopLeftPanel.getByTestId("section-row-Hero")).toContainText("Locked");
    await expect(
      page.getByText("68% of new users dropped off before making their first deposit."),
    ).toBeVisible();

    await desktopLeftPanel.getByTestId("toggle-section-Problem").click();
    await expect(
      page.getByText("68% of new users dropped off before making their first deposit."),
    ).toHaveCount(0);

    await maybeSaveScreenshot(page, "editor-sections-1440.png");

    // 4. Edit constrained Hero text field & verify live canvas updates (C-402)
    const desktopRightPanel = page.locator('[data-slot="editor-right-panel"]');
    const heroTitleInput = desktopRightPanel.locator('input[value="Mosaed — Smart debt management"]');
    await expect(heroTitleInput).toBeVisible();
    await heroTitleInput.fill("Mosaed — Effortless debt clarity");

    await expect(
      page.getByRole("heading", { name: "Mosaed — Effortless debt clarity" }),
    ).toBeVisible();

    // 5. Edit Overview TipTap rich text field & verify structured update (C-403)
    await desktopLeftPanel.getByTestId("section-row-Overview").getByRole("button").first().click();
    const richTextEditor = desktopRightPanel.locator('[data-testid="rich-text-field"] .ProseMirror');
    await expect(richTextEditor).toBeVisible();
    await richTextEditor.click();
    await page.keyboard.press("End");
    await page.keyboard.type(" Shipped across iOS and Android.");
    await expect(
      page.getByTestId("editor-canvas-preview").getByText(/Shipped across iOS and Android\./),
    ).toBeVisible();

    // 6. Theme panel: contrast warning (< 4.5:1) & curated palette preset (C-404)
    await desktopLeftPanel.getByRole("tab", { name: "Style" }).click();
    await expect(desktopLeftPanel.getByTestId("editor-style-panel")).toBeVisible();

    const textHexInput = desktopLeftPanel.getByLabel("Text hex code");
    await textHexInput.fill("#1E1F2E");
    await expect(desktopLeftPanel.getByTestId("theme-contrast-warning")).toBeVisible();

    await desktopLeftPanel.getByTestId("palette-preset-emerald-slate").click();
    await expect(desktopLeftPanel.getByTestId("theme-contrast-warning")).toHaveCount(0);

    const canvasFrame = page.getByTestId("editor-canvas-preview");
    await expect(canvasFrame).toHaveAttribute("style", /--tpl-color-primary:\s*#059669/i);

    await maybeSaveScreenshot(page, "editor-desktop-1440.png");

    // 7. Undo / Redo keyboard shortcuts + Autosave + Reload persistence (C-405)
    // Undo Emerald Slate preset -> low-contrast #D1D5DB state returns
    await page.keyboard.press("Control+z");
    await expect(desktopLeftPanel.getByTestId("theme-contrast-warning")).toBeVisible();

    // Redo -> Emerald Slate preset returns
    await page.keyboard.press("Control+Shift+z");
    await expect(desktopLeftPanel.getByTestId("theme-contrast-warning")).toHaveCount(0);
    await expect(canvasFrame).toHaveAttribute("style", /--tpl-color-primary:\s*#059669/i);

    // Wait for debounced autosave to persist to PostgreSQL
    await expect(page.getByTestId("editor-save-indicator")).toHaveAttribute(
      "data-save-status",
      "saved",
      { timeout: 10_000 },
    );

    // Reload browser and confirm zero data loss
    await page.reload();
    await expect(page.getByTestId("constrained-editor-root")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Mosaed — Effortless debt clarity" }),
    ).toBeVisible();
    await expect(
      page.getByTestId("editor-canvas-preview").getByText(/Shipped across iOS and Android\./),
    ).toBeVisible();
    await expect(
      page.getByText("68% of new users dropped off before making their first deposit."),
    ).toHaveCount(0);
    await expect(page.getByTestId("editor-canvas-preview")).toHaveAttribute(
      "style",
      /--tpl-color-primary:\s*#059669/i,
    );

    // 8. Responsive 375px mobile editor + bottom-sheet fields (C-406)
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.getByTestId("editor-mobile-bar")).toBeVisible();
    await expect(page.locator('[data-slot="editor-left-panel"]')).toBeHidden();
    await expect(page.locator('[data-slot="editor-right-panel"]')).toBeHidden();

    const scrollWidth375 = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth375).toBeLessThanOrEqual(375);

    await maybeSaveScreenshot(page, "editor-mobile-canvas-375.png");

    // Tap Hero section on mobile preview -> opens bottom-sheet Fields drawer
    await page.getByRole("button", { name: "Edit Hero section" }).click();
    const mobileSheet = page.getByTestId("editor-mobile-sheet");
    await expect(mobileSheet).toBeVisible();
    await expect(mobileSheet.getByTestId("mobile-fields-drawer")).toBeVisible();
    await page.waitForTimeout(550);

    await maybeSaveScreenshot(page, "editor-mobile-375.png");

    const scrollWidthWithSheet = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidthWithSheet).toBeLessThanOrEqual(375);
    expect(pageErrors).toEqual([]);
  } finally {
    if (createdUserId) {
      await db.delete(projects).where(eq(projects.ownerId, createdUserId));
    }
    await db.delete(users).where(eq(users.email, userEmail));
    await pool.end();
  }
});
