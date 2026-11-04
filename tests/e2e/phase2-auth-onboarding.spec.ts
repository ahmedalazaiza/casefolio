import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import {
  createDbConnection,
  desc,
  eq,
  like,
  users,
  verifications,
} from "../../packages/db/src/index";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

test("Phase 2 E2E: sign up -> verify OTP -> 3-step onboarding -> dashboard, onboarding runs once, and non-admin gets HTTP 403 on /admin", async ({
  page,
}) => {
  const databaseUrl = process.env.DATABASE_URL ?? "postgresql://localhost:5433/casefolio";
  const { db, pool } = createDbConnection(databaseUrl);

  const stamp = Date.now();
  const email = `e2e-phase2-${stamp}@casefolio.test`;
  const password = "CasefolioPassword2026!";

  try {
    // 1. Unauthenticated /dashboard redirects to /sign-in
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();

    // 2. Sign up on /sign-up
    await page.goto("/sign-up");
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();

    await page.getByLabel("Full name").fill("Rami Al-Saleh");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.locator('input[name="acceptTerms"]').check();
    await page.getByRole("button", { name: "Create account" }).click();

    // 3. Redirected to /verify -> retrieve 6-digit OTP from Postgres `verifications`
    await expect(page).toHaveURL(/\/verify/);
    await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();

    const [otpRow] = await db
      .select()
      .from(verifications)
      .where(like(verifications.identifier, `%${email}%`))
      .orderBy(desc(verifications.createdAt))
      .limit(1);

    expect(otpRow).toBeDefined();
    const otpCode = (otpRow?.value ?? "").split(":")[0] ?? "";
    expect(otpCode).toMatch(/^\d{6}$/);

    for (let i = 0; i < 6; i += 1) {
      await page.getByLabel(`Verification digit ${i + 1}`).fill(otpCode[i] ?? "");
    }
    await page.getByRole("button", { name: "Verify email" }).click();

    await expect(page.getByRole("heading", { name: "Email verified" })).toBeVisible();
    await page.getByRole("link", { name: "Start onboarding" }).click();

    // 4. Onboarding Step 1 (Role) -> Step 2 (What you present) -> Step 3 (Profile)
    await expect(page).toHaveURL(/\/onboarding/);
    await expect(page.getByRole("heading", { name: "What best describes you?" })).toBeVisible();
    await page.getByRole("button", { name: /UI\/UX designer/i }).click();
    await page.getByRole("button", { name: /Continue/i }).click();

    await expect(
      page.getByRole("heading", { name: "What will you present first?" }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Continue/i }).click();

    await expect(page.getByRole("heading", { name: "Set up your public profile" })).toBeVisible();
    await page.getByLabel("Headline").fill("Principal Product Designer");
    await page.getByRole("button", { name: /Continue/i }).click();

    // 5. Lands on first-run /dashboard with welcome checklist & toast
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      page.getByRole("heading", { name: /Let’s make your first case study|Let's make your first case study/i }),
    ).toBeVisible();
    await expect(page.getByText(/Welcome, Rami/i)).toBeVisible();

    // Verify onboarding only runs once (revisiting /onboarding redirects back to /dashboard)
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/dashboard/);

    // Verify profile fields persisted in `users`
    const [savedUser] = await db.select().from(users).where(eq(users.email, email));
    expect(savedUser?.emailVerified).toBe(true);
    expect(savedUser?.jobTitle).toBe("Principal Product Designer");
    expect(savedUser?.designFocus).toBe("both");
    expect(savedUser?.onboardingCompletedAt).not.toBeNull();

    // 6. Visiting /admin as non-admin returns HTTP 403 and renders Access restricted
    const adminResponse = await page.goto("/admin");
    expect(adminResponse?.status()).toBe(403);
    await expect(page.getByRole("heading", { name: "Access restricted" })).toBeVisible();

    // 7. Sign out from dashboard revokes session and redirects to /sign-in
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Open account menu" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in/);
  } finally {
    await db.delete(users).where(eq(users.email, email));
    await db.delete(verifications).where(like(verifications.identifier, `%${email}%`));
    await pool.end();
  }
});
