import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { createDbConnection, eq, users } from "../../packages/db/src/index";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

test("Phase 3 E2E: admin uploads reference/template.example.json via wizard, publishes Orbit, and user sees Orbit rendered in /templates", async ({
  page,
}) => {
  const databaseUrl = process.env.DATABASE_URL ?? "postgresql://localhost:5433/casefolio";
  const { db, pool } = createDbConnection(databaseUrl);

  const stamp = Date.now();
  const adminEmail = `e2e-admin-p3-${stamp}@casefolio.test`;
  const password = "CasefolioAdminPassword2026!";
  const orbitJsonPath = resolve(process.cwd(), "reference/template.example.json");

  try {
    // 1. Register user via /sign-up, then elevate to verified admin in DB
    await page.goto("/sign-up");
    await page.getByLabel("Full name").fill("Noor Admin");
    await page.getByLabel("Email").fill(adminEmail);
    await page.getByLabel("Password").fill(password);
    await page.locator('input[name="acceptTerms"]').check();
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/verify/);

    await db
      .update(users)
      .set({
        emailVerified: true,
        role: "admin",
        onboardingCompletedAt: new Date(),
      })
      .where(eq(users.email, adminEmail));

    // Sign in with elevated admin credentials
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(adminEmail);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // 2. Navigate to /admin/templates/new and upload reference/template.example.json
    await page.goto("/admin/templates/new");
    await expect(page.getByRole("heading", { name: "Upload template" })).toBeVisible();

    await page.locator("#template-json-file").setInputFiles(orbitJsonPath);
    await page.getByRole("button", { name: /Validate JSON/i }).click();

    // Step 2: Validate
    await expect(page.getByTestId("validation-success-panel")).toBeVisible();
    await page.getByRole("button", { name: /Preview template/i }).click();

    // Step 3: Live Puck preview
    await expect(
      page.getByRole("heading", { name: "Orbit — Banking that moves with you" }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Continue to metadata/i }).click();

    // Step 4: Metadata & Save as draft (v1.0.0)
    await expect(page.getByLabel("Template name *")).toHaveValue("Orbit");
    await page.getByRole("button", { name: /Save as draft \(v1\.0\.0\)/i }).click();

    // 3. Lands on /admin/templates/[id] as Draft -> Publish v1.0.0
    await expect(page).toHaveURL(/\/admin\/templates\/[0-9a-f-]+/);
    await expect(page.getByRole("heading", { name: "Orbit", exact: true })).toBeVisible();
    await page.getByRole("button", { name: /Publish v1\.0\.0/i }).first().click();
    await expect(
      page.getByText("Template version published to the user library."),
    ).toBeVisible();

    // 4. Open user template library (/templates) logged out and verify Orbit renders accurately
    await page.context().clearCookies();
    await page.goto("/templates");
    await expect(page.getByRole("heading", { name: "Template library" })).toBeVisible();

    const orbitCard = page.locator('[data-template-slug="orbit"]');
    await expect(orbitCard).toBeVisible();

    await orbitCard.getByRole("button", { name: /Preview/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: "Orbit — Banking that moves with you" }),
    ).toBeVisible();
    await expect(dialog.getByText("Lead Product Designer")).toBeVisible();
    await expect(dialog.getByText("+42%")).toBeVisible();
  } finally {
    await db.delete(users).where(eq(users.email, adminEmail));
    await pool.end();
  }
});
