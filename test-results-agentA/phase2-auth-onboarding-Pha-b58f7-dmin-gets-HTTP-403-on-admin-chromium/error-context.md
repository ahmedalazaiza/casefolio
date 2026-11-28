# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: phase2-auth-onboarding.spec.ts >> Phase 2 E2E: sign up -> verify OTP -> 3-step onboarding -> dashboard, onboarding runs once, and non-admin gets HTTP 403 on /admin
- Location: tests/e2e/phase2-auth-onboarding.spec.ts:18:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Welcome back' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: 'Welcome back' }) with timeout 5000ms
  - waiting for getByRole('heading', { name: 'Welcome back' })

```

```yaml
- link "Skip to main content":
  - /url: "#main-content"
- complementary "Casefolio overview":
  - link "Casefolio":
    - /url: /
  - text: CASEFOLIO STUDIO / 01
  - heading "Your work deserves a great story." [level=2]
  - paragraph: A focused space to shape your process, frame every screen, and publish work that gets remembered.
- button "Toggle color theme"
- main:
  - paragraph: WELCOME BACK
  - heading "Continue your story." [level=1]
  - paragraph: Sign in to edit, publish, and share your case studies.
  - button "Continue with Google"
  - text: or
  - tablist:
    - tab "Email & password" [selected]
    - tab "Magic link"
  - tabpanel "Email & password":
    - text: Email
    - textbox "Email":
      - /placeholder: alex@casefol.io
    - text: Password
    - textbox "Password":
      - /placeholder: ••••••••••••
    - checkbox "Remember me" [checked]
    - text: Remember me
    - link "Forgot password?":
      - /url: /reset
    - button "Log in to your studio"
  - paragraph:
    - text: New to Casefolio?
    - link "Create a free account":
      - /url: /sign-up
- contentinfo:
  - text: © 2026 Casefolio ·
  - link "Privacy":
    - /url: /privacy
  - text: ·
  - link "Terms":
    - /url: /terms
- region "Notifications alt+T"
- alert
```

# Test source

```ts
  1   | import { existsSync } from "node:fs";
  2   | import { resolve } from "node:path";
  3   | import { expect, test } from "@playwright/test";
  4   | import {
  5   |   createDbConnection,
  6   |   desc,
  7   |   eq,
  8   |   like,
  9   |   users,
  10  |   verifications,
  11  | } from "../../packages/db/src/index";
  12  | 
  13  | const envPath = resolve(process.cwd(), ".env");
  14  | if (existsSync(envPath)) {
  15  |   process.loadEnvFile(envPath);
  16  | }
  17  | 
  18  | test("Phase 2 E2E: sign up -> verify OTP -> 3-step onboarding -> dashboard, onboarding runs once, and non-admin gets HTTP 403 on /admin", async ({
  19  |   page,
  20  | }) => {
  21  |   const databaseUrl = process.env.DATABASE_URL ?? "postgresql://localhost:5433/casefolio";
  22  |   const { db, pool } = createDbConnection(databaseUrl);
  23  | 
  24  |   const stamp = Date.now();
  25  |   const email = `e2e-phase2-${stamp}@casefolio.test`;
  26  |   const password = "CasefolioPassword2026!";
  27  | 
  28  |   try {
  29  |     // 1. Unauthenticated /dashboard redirects to /sign-in
  30  |     await page.goto("/dashboard");
  31  |     await expect(page).toHaveURL(/\/sign-in/);
> 32  |     await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
      |                                                                       ^ Error: expect(locator).toBeVisible() failed
  33  | 
  34  |     // 2. Sign up on /sign-up
  35  |     await page.goto("/sign-up");
  36  |     await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  37  | 
  38  |     await page.getByLabel("Full name").fill("Rami Al-Saleh");
  39  |     await page.getByLabel("Email").fill(email);
  40  |     await page.getByLabel("Password").fill(password);
  41  |     await page.locator('input[name="acceptTerms"]').check();
  42  |     await page.getByRole("button", { name: "Create account" }).click();
  43  | 
  44  |     // 3. Redirected to /verify -> retrieve 6-digit OTP from Postgres `verifications`
  45  |     await expect(page).toHaveURL(/\/verify/);
  46  |     await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();
  47  | 
  48  |     const [otpRow] = await db
  49  |       .select()
  50  |       .from(verifications)
  51  |       .where(like(verifications.identifier, `%${email}%`))
  52  |       .orderBy(desc(verifications.createdAt))
  53  |       .limit(1);
  54  | 
  55  |     expect(otpRow).toBeDefined();
  56  |     const otpCode = (otpRow?.value ?? "").split(":")[0] ?? "";
  57  |     expect(otpCode).toMatch(/^\d{6}$/);
  58  | 
  59  |     for (let i = 0; i < 6; i += 1) {
  60  |       await page.getByLabel(`Verification digit ${i + 1}`).fill(otpCode[i] ?? "");
  61  |     }
  62  |     await page.getByRole("button", { name: "Verify email" }).click();
  63  | 
  64  |     await expect(page.getByRole("heading", { name: "Email verified" })).toBeVisible();
  65  |     await page.getByRole("link", { name: "Start onboarding" }).click();
  66  | 
  67  |     // 4. Onboarding Step 1 (Role) -> Step 2 (What you present) -> Step 3 (Profile)
  68  |     await expect(page).toHaveURL(/\/onboarding/);
  69  |     await expect(page.getByRole("heading", { name: "What best describes you?" })).toBeVisible();
  70  |     await page.getByRole("button", { name: /UI\/UX designer/i }).click();
  71  |     await page.getByRole("button", { name: /Continue/i }).click();
  72  | 
  73  |     await expect(
  74  |       page.getByRole("heading", { name: "What will you present first?" }),
  75  |     ).toBeVisible();
  76  |     await page.getByRole("button", { name: /Continue/i }).click();
  77  | 
  78  |     await expect(page.getByRole("heading", { name: "Set up your public profile" })).toBeVisible();
  79  |     await page.getByLabel("Headline").fill("Principal Product Designer");
  80  |     await page.getByRole("button", { name: /Continue/i }).click();
  81  | 
  82  |     // 5. Lands directly on /dashboard empty state to create first project
  83  |     await expect(page).toHaveURL(/\/dashboard/);
  84  |     await expect(page.getByTestId("dashboard-empty-state")).toBeVisible();
  85  |     await expect(
  86  |       page.getByRole("heading", { name: /Your first case study starts here/i }),
  87  |     ).toBeVisible();
  88  | 
  89  |     // Verify onboarding only runs once (revisiting /onboarding redirects back to /dashboard)
  90  |     await page.goto("/onboarding");
  91  |     await expect(page).toHaveURL(/\/dashboard/);
  92  | 
  93  |     // Verify profile fields persisted in `users`
  94  |     const [savedUser] = await db.select().from(users).where(eq(users.email, email));
  95  |     expect(savedUser?.emailVerified).toBe(true);
  96  |     expect(savedUser?.jobTitle).toBe("Principal Product Designer");
  97  |     expect(savedUser?.designFocus).toBe("both");
  98  |     expect(savedUser?.onboardingCompletedAt).not.toBeNull();
  99  | 
  100 |     // 6. Visiting /admin as non-admin returns HTTP 403 and renders Access restricted
  101 |     const adminResponse = await page.goto("/admin");
  102 |     expect(adminResponse?.status()).toBe(403);
  103 |     await expect(page.getByRole("heading", { name: "Access restricted" })).toBeVisible();
  104 | 
  105 |     // 7. Sign out from dashboard revokes session and redirects to /sign-in
  106 |     await page.goto("/dashboard");
  107 |     await page.getByRole("button", { name: "Open account menu" }).click();
  108 |     await page.getByRole("menuitem", { name: "Sign out" }).click();
  109 |     await expect(page).toHaveURL(/\/sign-in/);
  110 |   } finally {
  111 |     await db.delete(users).where(eq(users.email, email));
  112 |     await db.delete(verifications).where(like(verifications.identifier, `%${email}%`));
  113 |     await pool.end();
  114 |   }
  115 | });
  116 | 
```