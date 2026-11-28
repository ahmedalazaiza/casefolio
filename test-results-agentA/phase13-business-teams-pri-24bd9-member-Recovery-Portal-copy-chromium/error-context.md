# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: phase13-business-teams-privacy.spec.ts >> Phase 13 Business Model, Teams Seat Billing, Private Spaces & Recovery Portal E2E >> verifies /pricing seat calculator, /help/billing-and-plans, Team workspace creation, Private Space 404 isolation from Owner, and departed-member Recovery Portal copy
- Location: tests/e2e/phase13-business-teams-privacy.spec.ts:47:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByTestId('teams-seat-calculator')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByTestId('teams-seat-calculator') with timeout 5000ms
  - waiting for getByTestId('teams-seat-calculator')

```

```yaml
- link "Skip to main content":
  - /url: "#main-content"
- banner:
  - link "Casefolio":
    - /url: /
  - navigation "Main navigation":
    - link "Home":
      - /url: /
    - link "Templates":
      - /url: /templates
    - link "Showcase":
      - /url: /showcase
    - link "Pricing":
      - /url: /pricing
  - link "Log in":
    - /url: /sign-in
  - link "Start creating":
    - /url: /sign-up
- main:
  - text: Pricing & Plans
  - heading "Simple tiers for solo designers & scaling studios." [level=1]
  - paragraph: Build and publish 1 complete Case Study free from A to Z — then upgrade to Pro for up to 10 rotatable Case Studies & custom URLs, or Teams (2–25 seats) for unlimited studio collaboration. Get 2 months free on annual billing.
  - link "Compare plans":
    - /url: "#plan-comparison"
  - link "Billing FAQ":
    - /url: /faq
  - region "Subscription plans":
    - group "Billing interval":
      - button "Monthly" [pressed]
      - button "Annual 2 months free"
    - heading "Free" [level=3]
    - text: Free starter
    - paragraph: Personal workspace · 1 lifetime Case Study credit
    - text: $0 /forever
    - paragraph: No credit card required · Upgrade anytime
    - paragraph: Build and publish 1 complete UI/UX Case Study from A to Z for free.
    - link "Start free":
      - /url: /sign-up
    - paragraph: Included in Free
    - list:
      - listitem: 1 user (Personal workspace)
      - listitem: 1 complete Case Study credit (one-time lifetime allowance)
      - listitem: Full A-to-Z builder with starter templates, colors & typography
      - listitem: 5 exports/mo (1× PNG & PDF exports with subtle watermark)
      - listitem: 250 MB cloud storage & shareable auto-generated link
    - heading "Pro" [level=3]
    - text: Most popular
    - paragraph: Solo designer plan · Up to 10 active projects
    - text: $7.99 /mo
    - paragraph: Billed monthly · $79.90/yr on annual (2 months free)
    - paragraph: Built for freelance designers and solo creators rotating up to 10 active projects.
    - link "Upgrade to Pro":
      - /url: /sign-up?plan=pro&interval=monthly
    - paragraph: "Includes everything in Free, plus:"
    - list:
      - listitem: 1 seat (Personal workspace)
      - listitem: Up to 10 active Case Studies (delete & replace anytime)
      - listitem: Custom Case Study URL (/p/your-custom-slug) for every live project
      - listitem: Full access to all Pro & Premium templates and custom styling
      - listitem: 60 exports/mo · Watermark-free 2× PNG, PDF & full Layerat export
      - listitem: 5 GB cloud storage & 90-day live portfolio view analytics
    - heading "Teams" [level=3]
    - text: Multi-seat studio
    - paragraph: Shared Team Workspace · 2–25 seats
    - text: $17.97 /mo
    - paragraph: $5.99/seat/mo · $179.70/yr on annual (2 months free)
    - paragraph: Built for product design teams and studios collaborating with per-seat control.
    - text: Seats 2–25 range
    - button "Decrease Team card seats"
    - text: "3"
    - button "Increase Team card seats"
    - link "Start Teams plan (3 seats)":
      - /url: /sign-up?plan=team&interval=monthly&seats=3
    - paragraph: "Includes everything in Pro, plus:"
    - list:
      - listitem: 2–25 seats ($5.99/seat/mo · 2 months free on annual)
      - listitem: Unlimited shared Case Studies across your studio
      - listitem: "Team Dashboard: invite by email, track invite status & manage roles"
      - listitem: Custom Case Study URLs (/p/your-custom-slug) on all live links
      - listitem: Shared Brand Kit, 75 exports/seat/mo, 10 GB/seat pooled storage & 365-day analytics
    - text: Secure checkout powered by Paddle (sandbox environment) · 2 months free on annual plans · Instant tax & VAT receipts · Cancel anytime.
  - region "See exactly what's included & what's not":
    - text: Plan comparison
    - heading "See exactly what's included & what's not" [level=2]
    - paragraph: Side-by-side quotas, seats, and export formats across Free, Pro, and Teams.
    - text: "Included in plan Not included Teams: 2–25 seats · Annual = 2 months free"
    - paragraph: Capability & quota breakdown
    - paragraph: Showing monthly billing rates
    - paragraph: Free
    - paragraph: $0 / forever
    - text: Pro Most popular
    - paragraph: $7.99/mo
    - paragraph: Teams
    - paragraph: $5.99/seat/mo
    - region "Workspace, Seats & Case Studies":
      - heading "Workspace, Seats & Case Studies" [level=3]
      - paragraph: Compare seat allocations, active project allowances, and shared vs. personal workspaces.
      - text: 4 capabilities
      - table "Workspace, Seats & Case Studies comparison":
        - rowgroup:
          - row "Capability Free Pro Teams":
            - columnheader "Capability"
            - columnheader "Free"
            - columnheader "Pro"
            - columnheader "Teams"
        - rowgroup:
          - row "Seats & workspace scope 1 seat · Personal workspace 1 seat · Personal workspace 2–25 seats · Shared Team workspace":
            - cell "Seats & workspace scope":
              - paragraph: Seats & workspace scope
            - cell "1 seat · Personal workspace"
            - cell "1 seat · Personal workspace"
            - cell "2–25 seats · Shared Team workspace"
          - row "Case Studies allowance Free grants 1 one-time lifetime credit; Pro slots can be deleted or archived anytime to rotate work 1 lifetime Case Study credit Up to 10 active (rotatable) Unlimited shared":
            - cell "Case Studies allowance Free grants 1 one-time lifetime credit; Pro slots can be deleted or archived anytime to rotate work":
              - paragraph: Case Studies allowance
              - paragraph: Free grants 1 one-time lifetime credit; Pro slots can be deleted or archived anytime to rotate work
            - cell "1 lifetime Case Study credit"
            - cell "Up to 10 active (rotatable)"
            - cell "Unlimited shared"
          - row "Team Dashboard (invite by email, invite status & roles) Manage Owner, Admin & Member seats with instant prorated additions Not included Not included Included":
            - cell "Team Dashboard (invite by email, invite status & roles) Manage Owner, Admin & Member seats with instant prorated additions":
              - paragraph: Team Dashboard (invite by email, invite status & roles)
              - paragraph: Manage Owner, Admin & Member seats with instant prorated additions
            - cell "Not included"
            - cell "Not included"
            - cell "Included"
          - row "Shared Team Workspace & Brand Kit Centralized studio logos, brand colors, reusable blocks, and collaborative spaces Not included Not included Included":
            - cell "Shared Team Workspace & Brand Kit Centralized studio logos, brand colors, reusable blocks, and collaborative spaces":
              - paragraph: Shared Team Workspace & Brand Kit
              - paragraph: Centralized studio logos, brand colors, reusable blocks, and collaborative spaces
            - cell "Not included"
            - cell "Not included"
            - cell "Included"
    - region "Templates & Styling Control":
      - heading "Templates & Styling Control" [level=3]
      - paragraph: Starter vs. Pro & Premium templates, custom typography, color palettes, and modular sections.
      - text: 4 capabilities
      - table "Templates & Styling Control comparison":
        - rowgroup:
          - row "Capability Free Pro Teams":
            - columnheader "Capability"
            - columnheader "Free"
            - columnheader "Pro"
            - columnheader "Teams"
        - rowgroup:
          - row "Starter case study templates Included Included Included":
            - cell "Starter case study templates":
              - paragraph: Starter case study templates
            - cell "Included"
            - cell "Included"
            - cell "Included"
          - row "All Pro & Premium templates Not included Included Included":
            - cell "All Pro & Premium templates":
              - paragraph: All Pro & Premium templates
            - cell "Not included"
            - cell "Included"
            - cell "Included"
          - row "Full A-to-Z styling (colors, typography & modular sections) Included Included Included":
            - cell "Full A-to-Z styling (colors, typography & modular sections)":
              - paragraph: Full A-to-Z styling (colors, typography & modular sections)
            - cell "Included"
            - cell "Included"
            - cell "Included"
          - row "Pre-publish contrast & empty-slot checks Included Included Included":
            - cell "Pre-publish contrast & empty-slot checks":
              - paragraph: Pre-publish contrast & empty-slot checks
            - cell "Included"
            - cell "Included"
            - cell "Included"
    - region "Live Links & Custom URLs":
      - heading "Live Links & Custom URLs" [level=3]
      - paragraph: Shareable web URLs, custom /p/your-slug branding, and watermark removal.
      - text: 3 capabilities
      - table "Live Links & Custom URLs comparison":
        - rowgroup:
          - row "Capability Free Pro Teams":
            - columnheader "Capability"
            - columnheader "Free"
            - columnheader "Pro"
            - columnheader "Teams"
        - rowgroup:
          - row "Live Shareable Link Included Included Included":
            - cell "Live Shareable Link":
              - paragraph: Live Shareable Link
            - cell "Included"
            - cell "Included"
            - cell "Included"
          - row "Custom Case Study URL (/p/your-slug) Customize the /p/ slug on published portfolio links Auto-generated link Included Included":
            - cell "Custom Case Study URL (/p/your-slug) Customize the /p/ slug on published portfolio links":
              - paragraph: Custom Case Study URL (/p/your-slug)
              - paragraph: Customize the /p/ slug on published portfolio links
            - cell "Auto-generated link"
            - cell "Included"
            - cell "Included"
          - row "Watermark-free exports & removable Casefolio footer Not included Subtle watermark Included Included":
            - cell "Watermark-free exports & removable Casefolio footer":
              - paragraph: Watermark-free exports & removable Casefolio footer
            - cell "Not included Subtle watermark"
            - cell "Included"
            - cell "Included"
    - region "Layerat, PNG & A4 PDF Exports":
      - heading "Layerat, PNG & A4 PDF Exports" [level=3]
      - paragraph: Export your complete case study cleanly to Layerat, high-res PNG, client presentations, and hiring decks.
      - text: 3 capabilities
      - table "Layerat, PNG & A4 PDF Exports comparison":
        - rowgroup:
          - row "Capability Free Pro Teams":
            - columnheader "Capability"
            - columnheader "Free"
            - columnheader "Pro"
            - columnheader "Teams"
        - rowgroup:
          - row "PNG & PDF Case Study export 1× with subtle watermark High-res, no watermark High-res, no watermark":
            - cell "PNG & PDF Case Study export":
              - paragraph: PNG & PDF Case Study export
            - cell "1× with subtle watermark"
            - cell "High-res, no watermark"
            - cell "High-res, no watermark"
          - row "Full case study Layerat export (1,400 px pack) & 2× Retina PNG (2,880 px) Not included Included Included":
            - cell "Full case study Layerat export (1,400 px pack) & 2× Retina PNG (2,880 px)":
              - paragraph: Full case study Layerat export (1,400 px pack) & 2× Retina PNG (2,880 px)
            - cell "Not included"
            - cell "Included"
            - cell "Included"
          - row "Monthly export allowance 5/mo 60/mo 100 × seats/mo":
            - cell "Monthly export allowance":
              - paragraph: Monthly export allowance
            - cell "5/mo"
            - cell "60/mo"
            - cell "100 × seats/mo"
    - region "Analytics, Storage & Recovery":
      - heading "Analytics, Storage & Recovery" [level=3]
      - paragraph: Live portfolio view insights, asset storage quotas, and member recovery protection.
      - text: 3 capabilities
      - table "Analytics, Storage & Recovery comparison":
        - rowgroup:
          - row "Capability Free Pro Teams":
            - columnheader "Capability"
            - columnheader "Free"
            - columnheader "Pro"
            - columnheader "Teams"
        - rowgroup:
          - row "View analytics on live links Not included 7-day summary 90-day portfolio analytics 365-day team analytics":
            - cell "View analytics on live links":
              - paragraph: View analytics on live links
            - cell "Not included 7-day summary"
            - cell "90-day portfolio analytics"
            - cell "365-day team analytics"
          - row "Asset storage & max upload size 250 MB · 10 MB/file 5 GB · 25 MB/file 10 GB × seats · 25 MB/file":
            - cell "Asset storage & max upload size":
              - paragraph: Asset storage & max upload size
            - cell "250 MB · 10 MB/file"
            - cell "5 GB · 25 MB/file"
            - cell "10 GB × seats · 25 MB/file"
          - row "7-day paid quota grace buffer & private member recovery Not included Included Included":
            - cell "7-day paid quota grace buffer & private member recovery":
              - paragraph: 7-day paid quota grace buffer & private member recovery
            - cell "Not included"
            - cell "Included"
            - cell "Included"
    - region "Privacy & Downgrade Protection":
      - heading "Privacy & Downgrade Protection" [level=3]
      - paragraph: Isolated personal member drafts and non-destructive downgrade safeguards.
      - text: 2 capabilities
      - table "Privacy & Downgrade Protection comparison":
        - rowgroup:
          - row "Capability Free Pro Teams":
            - columnheader "Capability"
            - columnheader "Free"
            - columnheader "Pro"
            - columnheader "Teams"
        - rowgroup:
          - row "Non-destructive Free downgrade protection Your Case Studies are never deleted — choose 1 active Case Study while extras remain safely stored Included Included Included":
            - cell "Non-destructive Free downgrade protection Your Case Studies are never deleted — choose 1 active Case Study while extras remain safely stored":
              - paragraph: Non-destructive Free downgrade protection
              - paragraph: Your Case Studies are never deleted — choose 1 active Case Study while extras remain safely stored
            - cell "Included"
            - cell "Included"
            - cell "Included"
          - row "Isolated private member drafts (hidden from Admins) Not included Not included Included":
            - cell "Isolated private member drafts (hidden from Admins)":
              - paragraph: Isolated private member drafts (hidden from Admins)
            - cell "Not included"
            - cell "Not included"
            - cell "Included"
  - heading "Test the canvas before paying a single cent." [level=2]
  - paragraph: Build and publish 1 Case Study free — no credit card required.
  - link "Start free":
    - /url: /sign-up
  - link "Billing guide":
    - /url: /help/billing-and-plans
- contentinfo:
  - link "Casefolio":
    - /url: /
  - paragraph: Tell the story behind the pixels.
  - list "Casefolio social media links":
    - listitem:
      - link "Casefolio on Instagram":
        - /url: https://www.instagram.com/layerat.portfolio/
    - listitem:
      - link "Casefolio on LinkedIn":
        - /url: https://www.linkedin.com/company/layerat
  - paragraph: Product
  - list:
    - listitem:
      - link "Home":
        - /url: /
    - listitem:
      - link "Templates":
        - /url: /templates
    - listitem:
      - link "Showcase":
        - /url: /showcase
    - listitem:
      - link "Pricing":
        - /url: /pricing
    - listitem:
      - link "FAQ":
        - /url: /faq
  - paragraph: Company
  - list:
    - listitem:
      - link "About us":
        - /url: /about
    - listitem:
      - link "Our team":
        - /url: /team
    - listitem:
      - link "Help center":
        - /url: /help
    - listitem:
      - link "Contact":
        - /url: /help/contact
  - paragraph: Legal
  - list:
    - listitem:
      - link "Terms of use":
        - /url: /terms
    - listitem:
      - link "Privacy policy":
        - /url: /privacy
    - listitem:
      - link "Refund policy":
        - /url: /terms#refunds
  - paragraph: © 2026 Casefolio, Inc. · A product of LAYERAT
  - link "www.layerat.com":
    - /url: https://www.layerat.com
  - button "Toggle color theme"
- region "Notifications alt+T"
- alert
```

# Test source

```ts
  1   | import { existsSync } from "node:fs";
  2   | import { resolve } from "node:path";
  3   | import AxeBuilder from "@axe-core/playwright";
  4   | import { expect, test, type Page } from "@playwright/test";
  5   | import {
  6   |   createDbConnection,
  7   |   eq,
  8   |   inArray,
  9   |   organizations,
  10  |   projects,
  11  |   users,
  12  | } from "../../packages/db/src/index";
  13  | 
  14  | const envPath = resolve(process.cwd(), ".env");
  15  | if (existsSync(envPath)) {
  16  |   process.loadEnvFile(envPath);
  17  | }
  18  | 
  19  | async function assertCleanA11yAndResponsive(page: Page, routeLabel: string) {
  20  |   await page.emulateMedia({ reducedMotion: "reduce" });
  21  | 
  22  |   for (const width of [375, 393, 1440] as const) {
  23  |     await page.setViewportSize({ width, height: width === 1440 ? 920 : 852 });
  24  |     const metrics = await page.evaluate(() => ({
  25  |       scrollWidth: document.documentElement.scrollWidth,
  26  |       innerWidth: window.innerWidth,
  27  |     }));
  28  |     expect(
  29  |       metrics.scrollWidth,
  30  |       `Horizontal overflow on ${routeLabel} at ${width}px (${metrics.scrollWidth} > ${metrics.innerWidth})`,
  31  |     ).toBeLessThanOrEqual(metrics.innerWidth);
  32  |   }
  33  | 
  34  |   const axe = await new AxeBuilder({ page })
  35  |     .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
  36  |     .analyze();
  37  |   const severe = axe.violations.filter(
  38  |     (v) => v.impact === "critical" || v.impact === "serious",
  39  |   );
  40  |   expect(
  41  |     severe,
  42  |     `Severe axe violations on ${routeLabel}:\n${JSON.stringify(severe, null, 2)}`,
  43  |   ).toEqual([]);
  44  | }
  45  | 
  46  | test.describe("Phase 13 Business Model, Teams Seat Billing, Private Spaces & Recovery Portal E2E", () => {
  47  |   test("verifies /pricing seat calculator, /help/billing-and-plans, Team workspace creation, Private Space 404 isolation from Owner, and departed-member Recovery Portal copy", async ({
  48  |     page,
  49  |     browser,
  50  |   }) => {
  51  |     test.setTimeout(150_000);
  52  | 
  53  |     const databaseUrl = process.env.DATABASE_URL ?? "postgresql://localhost:5433/casefolio";
  54  |     const { db, pool } = createDbConnection(databaseUrl);
  55  | 
  56  |     const stamp = Date.now();
  57  |     const ownerEmail = `e2e-p13-owner-${stamp}@casefolio.test`;
  58  |     const memberEmail = `e2e-p13-member-${stamp}@casefolio.test`;
  59  |     const password = "CasefolioTeams2026!";
  60  |     const teamName = `Horizon Studio ${stamp}`;
  61  |     const teamSlug = `horizon-studio-${stamp}`;
  62  | 
  63  |     const createdUserIds: string[] = [];
  64  |     const createdOrgIds: string[] = [];
  65  |     const pageErrors: string[] = [];
  66  | 
  67  |     page.on("pageerror", (err) => {
  68  |       pageErrors.push(err.message);
  69  |     });
  70  | 
  71  |     try {
  72  |       await page.setViewportSize({ width: 1440, height: 920 });
  73  | 
  74  |       // 1. Public /pricing page + interactive Teams Seat Calculator + 375/393/1440 + axe-core
  75  |       await page.goto("/pricing");
> 76  |       await expect(page.getByTestId("teams-seat-calculator")).toBeVisible();
      |                                                               ^ Error: expect(locator).toBeVisible() failed
  77  |       await expect(page.getByTestId("teams-calc-seat-count")).toHaveText("3");
  78  |       await expect(page.getByTestId("teams-calc-headline-price")).toHaveText("$17.97");
  79  | 
  80  |       await expect(async () => {
  81  |         await page.getByTestId("teams-calc-preset-5").click();
  82  |         await expect(page.getByTestId("teams-calc-seat-count")).toHaveText("5", {
  83  |           timeout: 1_000,
  84  |         });
  85  |       }).toPass({ timeout: 10_000 });
  86  |       await expect(page.getByTestId("teams-calc-headline-price")).toHaveText("$29.95");
  87  | 
  88  |       await page.getByTestId("teams-calc-preset-15").click();
  89  |       await expect(page.getByTestId("teams-calc-seat-count")).toHaveText("15");
  90  |       await expect(page.getByTestId("teams-calc-headline-price")).toHaveText("$89.85");
  91  | 
  92  |       await page.getByTestId("teams-calc-preset-26").click();
  93  |       await expect(page.getByTestId("teams-calc-capacity-review")).toBeVisible();
  94  |       await expect(page.getByTestId("teams-calc-disclaimer")).toContainText(
  95  |         "this calculator saves nothing and charges nothing",
  96  |       );
  97  | 
  98  |       await page.getByTestId("teams-calc-preset-3").click();
  99  |       await assertCleanA11yAndResponsive(page, "/pricing");
  100 | 
  101 |       // 2. Public /help/billing-and-plans article + 375/393/1440 + axe-core
  102 |       await page.goto("/help/billing-and-plans");
  103 |       await expect(page.getByText(/\$7\.99\/mo/i).first()).toBeVisible();
  104 |       await expect(page.getByText(/Departed member recovery/i).first()).toBeVisible();
  105 |       await assertCleanA11yAndResponsive(page, "/help/billing-and-plans");
  106 | 
  107 |       // 3. Sign up & verify Owner + Member accounts
  108 |       for (const acct of [
  109 |         { name: "Tariq Studio Owner", email: ownerEmail },
  110 |         { name: "Nour Team Designer", email: memberEmail },
  111 |       ]) {
  112 |         await page.context().clearCookies();
  113 |         await page.goto("/sign-up");
  114 |         await page.getByLabel("Full name").fill(acct.name);
  115 |         await page.getByLabel("Email").fill(acct.email);
  116 |         await page.getByLabel("Password").fill(password);
  117 |         await page.locator('input[name="acceptTerms"]').check();
  118 |         await page.getByRole("button", { name: "Create account" }).click();
  119 |         await expect(page).toHaveURL(/\/verify/);
  120 | 
  121 |         const [verified] = await db
  122 |           .update(users)
  123 |           .set({
  124 |             emailVerified: true,
  125 |             onboardingCompletedAt: new Date(),
  126 |           })
  127 |           .where(eq(users.email, acct.email))
  128 |           .returning({ id: users.id });
  129 |         expect(verified?.id).toBeTruthy();
  130 |         createdUserIds.push(verified!.id);
  131 |       }
  132 | 
  133 |       // 4. Owner signs in, creates Team organization, activates 3-seat Teams plan via Sandbox Checkout, and invites Member
  134 |       await page.context().clearCookies();
  135 |       await page.goto("/sign-in");
  136 |       await page.getByLabel("Email", { exact: true }).fill(ownerEmail);
  137 |       await page.getByLabel("Password", { exact: true }).fill(password);
  138 |       await page.getByRole("button", { name: "Log in" }).click();
  139 |       await expect(page).toHaveURL(/\/dashboard/);
  140 | 
  141 |       await page.goto("/account/team");
  142 |       await page.getByLabel("Team or studio name").fill(teamName);
  143 |       await page.getByLabel("Workspace slug").fill(teamSlug);
  144 |       await page.getByRole("button", { name: /Create team workspace/i }).click();
  145 |       await expect(page.getByText(teamName).first()).toBeVisible({ timeout: 10_000 });
  146 | 
  147 |       const [orgRow] = await db
  148 |         .select({ id: organizations.id })
  149 |         .from(organizations)
  150 |         .where(eq(organizations.slug, teamSlug))
  151 |         .limit(1);
  152 |       expect(orgRow?.id).toBeTruthy();
  153 |       const orgId = orgRow!.id;
  154 |       createdOrgIds.push(orgId);
  155 | 
  156 |       // Activate 3-seat Teams subscription via sandbox checkout endpoint
  157 |       const checkoutRes = await page.request.post("/api/paddle/sandbox-complete", {
  158 |         data: {
  159 |           plan: "team",
  160 |           interval: "monthly",
  161 |           orgId,
  162 |           seats: 3,
  163 |         },
  164 |       });
  165 |       expect(checkoutRes.status()).toBe(200);
  166 |       const checkoutJson = (await checkoutRes.json()) as { ok: boolean };
  167 |       expect(checkoutJson.ok).toBe(true);
  168 | 
  169 |       await page.reload({ waitUntil: "domcontentloaded" });
  170 |       await assertCleanA11yAndResponsive(page, "/account/team");
  171 | 
  172 |       // Invite Member via /api/team/invitations (same endpoint backing /account/team form)
  173 |       const inviteRes = await page.request.post("/api/team/invitations", {
  174 |         data: {
  175 |           organizationId: orgId,
  176 |           email: memberEmail,
```