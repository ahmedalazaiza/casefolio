import { createHmac } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import {
  createDbConnection,
  desc,
  eq,
  subscriptions,
  templates,
  users,
  webhookEvents,
} from "../../packages/db/src/index";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const ARTIFACT_DIR =
  "/Users/apple/.gemini/antigravity/brain/289549fa-2861-4b0a-807a-bf94aa1bca6b";

async function maybeSaveScreenshot(
  target: {
    screenshot: (opts: {
      path: string;
      fullPage?: boolean;
      animations?: "disabled" | "allow";
      caret?: "hide" | "initial";
    }) => Promise<Buffer>;
  },
  filename: string,
  fullPage = false,
) {
  if (existsSync(ARTIFACT_DIR)) {
    await target.screenshot({
      path: resolve(ARTIFACT_DIR, filename),
      fullPage,
      animations: "disabled",
      caret: "initial",
    });
  }
}

function signPaddlePayload(rawBody: string, secret: string, tsSeconds: number): string {
  const digest = createHmac("sha256", secret)
    .update(`${tsSeconds}:${rawBody}`, "utf8")
    .digest("hex");
  return `ts=${tsSeconds};h1=${digest}`;
}

test("Phase 7 E2E: Free gating -> Paddle Sandbox checkout upgrades to Pro -> Meridian Pro template unlocks -> public watermark removed -> webhook replay is idempotent -> Account/Billing/Security/Invoices UI", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);

  const databaseUrl = process.env.DATABASE_URL ?? "postgresql://localhost:5433/casefolio";
  const webhookSecret =
    process.env.PADDLE_WEBHOOK_SECRET ?? "pdl_ntfset_dev_secret_1234567890";
  const { db, pool } = createDbConnection(databaseUrl);

  const stamp = Date.now();
  const userEmail = `e2e-billing-p7-${stamp}@casefolio.test`;
  const password = "CasefolioBilling2026!";
  const customSlug = `orbit-billing-${stamp}`;
  let createdUserId: string | null = null;
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      // Ignore browser network 401 log from our intentional tampered-signature API test if any
      if (!msg.text().includes("401")) {
        consoleErrors.push(msg.text());
      }
    }
  });

  try {
    // Verify Meridian Pro template is present in DB
    const [meridianTpl] = await db
      .select()
      .from(templates)
      .where(eq(templates.slug, "meridian-pro"))
      .limit(1);
    expect(meridianTpl).toBeTruthy();
    expect(meridianTpl?.tier).toBe("pro");

    await page.setViewportSize({ width: 1440, height: 920 });

    // 1. Sign up & sign in as a new Free user
    await page.goto("/sign-up");
    await page.getByLabel("Full name").fill("Nadia Studio Lead");
    await page.getByLabel("Email").fill(userEmail);
    await page.getByLabel("Password").fill(password);
    await page.locator('input[name="acceptTerms"]').check();
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/verify/);

    const [verifiedUser] = await db
      .update(users)
      .set({
        emailVerified: true,
        jobTitle: "Staff Product Designer",
        designFocus: "both",
        onboardingCompletedAt: new Date(),
      })
      .where(eq(users.email, userEmail))
      .returning({ id: users.id });
    createdUserId = verifiedUser?.id ?? null;
    expect(createdUserId).toBeTruthy();

    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(userEmail);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // 2. Free user visits /templates -> Meridian (Pro) is locked
    await page.goto("/templates");
    const meridianCardFree = page.locator(
      '[data-slot="library-template-card"][data-template-slug="meridian-pro"]',
    );
    await expect(meridianCardFree).toBeVisible();
    await expect(meridianCardFree).toHaveAttribute("data-locked", "true");
    await expect(page.getByTestId("pro-lock-badge-meridian-pro")).toBeVisible();

    // 3. Free user creates & publishes an Orbit case study -> public page shows watermark
    await page.goto("/new");
    await page.getByRole("radio", { name: /Mobile app/i }).click();
    await page.getByTestId("wizard-next-to-template").click();

    const orbitCard = page.locator(
      '[data-slot="wizard-template-card"][data-template-slug="orbit"]',
    );
    await expect(orbitCard).toBeVisible();
    await orbitCard.getByRole("button", { name: /Select|Selected/i }).click();
    await page.getByTestId("wizard-next-to-details").click();

    await page.getByLabel("Project name *").fill("Orbit — Free Watermark Check");
    await page.getByTestId("wizard-submit-create").click();
    await expect(page).toHaveURL(/\/editor\/([0-9a-f-]+)/);

    await page.getByRole("link", { name: /Publish/i }).click();
    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+\/share/);

    await page.getByTestId("publish-slug-input").fill(customSlug);
    await expect(page.getByTestId("slug-availability-status")).toContainText("Available");
    await page.getByTestId("publish-project-button").click();
    await expect(page.getByTestId("share-status-badge")).toContainText(
      "Published · Public",
    );

    const anonContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const anonPage = await anonContext.newPage();
    await anonPage.goto(`/p/${customSlug}`, { waitUntil: "domcontentloaded" });
    await expect(anonPage.getByTestId("public-case-study-page")).toBeVisible();
    await expect(anonPage.getByTestId("casefolio-watermark-badge")).toBeVisible();

    // 4. Inspect Account pages on Free plan (/account, /account/security, /account/invoices, /account/billing)
    await page.goto("/account");
    await expect(page.getByTestId("profile-settings-card")).toBeVisible();
    await maybeSaveScreenshot(page, "account-profile-1440.png");

    await page.goto("/account/security");
    await expect(page.getByTestId("security-settings-panel")).toBeVisible();
    await expect(page.getByTestId("current-session-row")).toContainText("This device");
    await maybeSaveScreenshot(page, "account-security-1440.png");

    await page.goto("/account/invoices");
    await expect(page.getByTestId("invoices-empty-state")).toBeVisible();

    await page.goto("/account/billing");
    await expect(page.getByTestId("billing-current-plan-title")).toHaveText("Free");
    await maybeSaveScreenshot(page, "account-billing-free-1440.png");

    // Open Change Plan modal & screenshot
    await page.getByTestId("open-change-plan-modal").click();
    await expect(page.getByTestId("change-plan-dialog")).toBeVisible();
    await maybeSaveScreenshot(page, "account-change-plan-modal-1440.png");
    await page.getByRole("button", { name: "Cancel" }).click();

    // 5. Upgrade to Pro via Paddle Sandbox Checkout
    await page.getByTestId("billing-upgrade-pro-btn").click();
    await expect(page.getByTestId("paddle-checkout-dialog")).toBeVisible();
    await page.getByTestId("proceed-to-paddle-checkout").click();
    await expect(page.getByTestId("sandbox-payment-sheet")).toBeVisible();
    await maybeSaveScreenshot(page, "paddle-sandbox-checkout-1440.png");

    await page.getByTestId("complete-sandbox-checkout").click();
    await expect(page.getByTestId("paddle-checkout-dialog")).toHaveCount(0, {
      timeout: 10_000,
    });

    // 6. Verify /account/billing reflects Pro · Monthly immediately after webhook
    await expect(page.getByTestId("billing-current-plan-title")).toHaveText(
      "Pro · Monthly",
    );
    await expect(page.getByTestId("billing-payment-method-card")).toContainText(
      "Visa ending 4242",
    );
    await maybeSaveScreenshot(page, "account-billing-pro-1440.png");

    // Check responsive 375px layout on /account/billing (zero horizontal overflow)
    await page.setViewportSize({ width: 375, height: 812 });
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
    await maybeSaveScreenshot(page, "account-billing-pro-375.png");
    await page.setViewportSize({ width: 1440, height: 920 });

    // 7. Verify /account/invoices shows Paid $12 invoice + downloadable receipt
    await page.goto("/account/invoices");
    await expect(page.getByTestId("invoices-table")).toBeVisible();
    await expect(page.getByTestId("invoice-row").first()).toContainText("Pro · Monthly");
    await expect(page.getByTestId("invoice-row").first()).toContainText("$12");
    await maybeSaveScreenshot(page, "account-invoices-1440.png");

    const receiptHref = await page
      .getByTestId("invoice-download-link")
      .first()
      .getAttribute("href");
    expect(receiptHref).toBeTruthy();
    const receiptRes = await page.request.get(receiptHref!);
    expect(receiptRes.status()).toBe(200);
    const receiptText = await receiptRes.text();
    expect(receiptText).toContain("PADDLE BILLING RECEIPT");
    expect(receiptText).toContain("Pro · Monthly");

    // 8. Verify Pro template Meridian is now UNLOCKED & usable in /new
    await page.goto("/templates");
    const meridianCardPro = page.locator(
      '[data-slot="library-template-card"][data-template-slug="meridian-pro"]',
    );
    await expect(meridianCardPro).toBeVisible();
    await expect(meridianCardPro).toHaveAttribute("data-locked", "false");
    await expect(page.getByTestId("pro-lock-badge-meridian-pro")).toHaveCount(0);

    await page.goto("/new?template=meridian-pro");
    await page.getByLabel("Project name *").fill("Meridian — Pro Unlocked SaaS");
    await page.getByTestId("wizard-submit-create").click();
    await expect(page).toHaveURL(/\/editor\/([0-9a-f-]+)/);

    // 9. Verify public case study watermark is REMOVED on Pro
    await anonPage.reload({ waitUntil: "domcontentloaded" });
    await expect(anonPage.getByTestId("public-case-study-page")).toBeVisible();
    await expect(anonPage.getByTestId("casefolio-watermark-badge")).toHaveCount(0);
    await anonContext.close();

    // 10. Verify Paddle webhook replay is strictly idempotent + tampered signature rejected
    const [latestSub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, createdUserId!))
      .limit(1);
    expect(latestSub?.plan).toBe("pro");
    expect(latestSub?.status).toBe("active");

    const recentWebhooks = await db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.provider, "paddle"))
      .orderBy(desc(webhookEvents.processedAt))
      .limit(20);

    const checkoutEvent = recentWebhooks.find((evt) => {
      const payload = evt.payload as { data?: { custom_data?: { userId?: string } } };
      return payload?.data?.custom_data?.userId === createdUserId;
    });
    expect(checkoutEvent).toBeTruthy();

    const replayRawBody = JSON.stringify(checkoutEvent!.payload);
    const nowSeconds = Math.floor(Date.now() / 1000);
    const validReplaySig = signPaddlePayload(replayRawBody, webhookSecret, nowSeconds);

    const replayRes = await page.request.post("/api/paddle/webhook", {
      data: replayRawBody,
      headers: {
        "Content-Type": "application/json",
        "Paddle-Signature": validReplaySig,
      },
    });
    expect(replayRes.status()).toBe(200);
    const replayJson = (await replayRes.json()) as {
      ok: boolean;
      deduplicated: boolean;
      eventId: string;
    };
    expect(replayJson).toEqual(
      expect.objectContaining({
        ok: true,
        deduplicated: true,
        eventId: checkoutEvent!.eventId,
      }),
    );

    // Tampered signature must be rejected with 401
    const badSigRes = await page.request.post("/api/paddle/webhook", {
      data: replayRawBody,
      headers: {
        "Content-Type": "application/json",
        "Paddle-Signature": `ts=${nowSeconds};h1=0000000000000000000000000000000000000000000000000000000000000000`,
      },
    });
    expect(badSigRes.status()).toBe(401);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  } finally {
    if (createdUserId) {
      await db.delete(users).where(eq(users.id, createdUserId));
    }
    await pool.end();
  }
});
