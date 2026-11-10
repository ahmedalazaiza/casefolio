import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import {
  createDbConnection,
  eq,
  projects,
  templates,
  users,
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

test("Phase 8 E2E: PostHog zero-PII events -> unpublished analytics empty state -> visit public page 3 times (+ bot & prefetch ignored) -> owner SVG chart & top sources update -> PNG export completes -> Bell unread badge, dropdown, Resend email audit & /notifications center", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);

  const databaseUrl = process.env.DATABASE_URL ?? "postgresql://localhost:5433/casefolio";
  const { db, pool } = createDbConnection(databaseUrl);

  const stamp = Date.now();
  const userName = "Rami Al-Khatib";
  const userEmail = `e2e-analytics-p8-${stamp}@casefolio.test`;
  const password = "CasefolioAnalytics2026!";
  const customSlug = `orbit-analytics-${stamp}`;
  const projectName = "Orbit — Analytics & Alerts";

  let createdUserId: string | null = null;
  let createdProjectId: string | null = null;
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  try {
    const [orbitTpl] = await db
      .select()
      .from(templates)
      .where(eq(templates.slug, "orbit"))
      .limit(1);
    expect(orbitTpl).toBeTruthy();

    await page.setViewportSize({ width: 1440, height: 920 });

    // 0. Reset dev PostHog & notification email audit buffers
    const clearRes = await page.request.delete("/api/dev/analytics-events");
    // The in-memory PostHog/email audit buffers only exist outside production builds (the endpoint is
    // intentionally 404 in `NODE_ENV=production`). Run this spec against `pnpm dev`.
    test.skip(
      clearRes.status() === 404,
      "Requires the dev server: /api/dev/analytics-events is disabled in production builds.",
    );
    expect(clearRes.status()).toBe(200);

    // 1. Sign up & verify user (`signup` PostHog event)
    await page.goto("/sign-up");
    await page.getByLabel("Full name").fill(userName);
    await page.getByLabel("Email").fill(userEmail);
    await page.getByLabel("Password").fill(password);
    await page.locator('input[name="acceptTerms"]').check();
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/verify/);

    const [verifiedUser] = await db
      .update(users)
      .set({
        emailVerified: true,
        jobTitle: "Principal Product Designer",
        designFocus: "mobile",
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

    // 2. Create project via wizard (`template_selected` + `project_created` PostHog events)
    await page.goto("/new");
    await page.getByRole("radio", { name: /Mobile app/i }).click();
    await page.getByTestId("wizard-next-to-template").click();

    const orbitCard = page.locator(
      '[data-slot="wizard-template-card"][data-template-slug="orbit"]',
    );
    await expect(orbitCard).toBeVisible();
    await orbitCard.getByRole("button", { name: /Select|Selected/i }).click();
    await page.getByTestId("wizard-next-to-details").click();

    await page.getByLabel("Project name *").fill(projectName);
    await page.getByTestId("wizard-submit-create").click();
    await expect(page).toHaveURL(/\/editor\/([0-9a-f-]+)/);

    const projectMatch = page.url().match(/\/editor\/([0-9a-f-]+)/);
    createdProjectId = projectMatch?.[1] ?? null;
    expect(createdProjectId).toBeTruthy();

    // 3. Before publishing, /projects/[id]/analytics shows Figma 2:8745 "No data yet" empty state
    await page.goto(`/projects/${createdProjectId}/analytics`);
    await expect(page.getByTestId("analytics-unpublished-empty")).toBeVisible();
    await expect(page.getByRole("heading", { name: "No data yet" })).toBeVisible();
    await maybeSaveScreenshot(page, "analytics-unpublished-1440.png");

    // 4. Publish project (`published` PostHog event + in-app "Published" notification)
    await page.getByRole("link", { name: "Publish case study" }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${createdProjectId}/share`));

    await page.getByTestId("publish-slug-input").fill(customSlug);
    await expect(page.getByTestId("slug-availability-status")).toContainText("Available");
    await page.getByTestId("publish-project-button").click();
    await expect(page.getByTestId("share-status-badge")).toContainText("Published · Public");

    // 5. Visit public page 3 real times (+ 1 Googlebot visit + 1 prefetch visit that MUST be filtered)
    const visitorContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    });

    try {
      const visitorPage = await visitorContext.newPage();

      // Visit #1: Direct
      await visitorPage.goto(`/p/${customSlug}`);
      await expect(visitorPage.locator("main")).toBeVisible();

      // Visit #2: Direct
      await visitorPage.reload();
      await expect(visitorPage.locator("main")).toBeVisible();

      // Visit #3: Referred from LinkedIn
      const linkedInPage = await visitorContext.newPage();
      await linkedInPage.setExtraHTTPHeaders({
        Referer: "https://www.linkedin.com/feed/update/urn:li:activity:12345/",
      });
      await linkedInPage.goto(`/p/${customSlug}`);
      await expect(linkedInPage.locator("main")).toBeVisible();

      // Bot visit (Googlebot) -> must NOT increment views
      const botRes = await visitorContext.request.get(`/p/${customSlug}`, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        },
      });
      expect(botRes.status()).toBe(200);

      // Prefetch request -> must NOT increment views
      const prefetchRes = await visitorContext.request.get(`/p/${customSlug}`, {
        headers: {
          "Sec-Purpose": "prefetch",
        },
      });
      expect(prefetchRes.status()).toBe(200);
    } finally {
      await visitorContext.close();
    }

    // 6. Owner visits /projects/[id]/analytics -> KPIs, SVG bar chart, and Top sources update to 3 views!
    await page.goto(`/projects/${createdProjectId}/analytics`);
    await expect(page.getByTestId("analytics-total-views-value")).toHaveText("3");
    await expect(page.getByTestId("analytics-unique-visitors-value")).toHaveText("1");

    const activeChartBar = page.locator('[data-testid="analytics-chart-bar"][data-views="3"]');
    await expect(activeChartBar).toHaveCount(1);

    const directSourceRow = page.locator(
      '[data-testid="analytics-source-row"][data-source="Direct / link"]',
    );
    const linkedInSourceRow = page.locator(
      '[data-testid="analytics-source-row"][data-source="LinkedIn"]',
    );
    await expect(directSourceRow).toContainText("67%");
    await expect(linkedInSourceRow).toContainText("33%");

    // Free plan gating on 90d range opens UpgradePromptDialog
    await page.getByTestId("analytics-range-90d").click();
    await expect(
      page.getByRole("heading", { name: "Unlock 90-day & all-time analytics" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await maybeSaveScreenshot(page, "analytics-case-study-1440.png");

    // Mobile 375px responsive verification on Case Study Analytics
    await page.setViewportSize({ width: 375, height: 812 });
    const caseStudyOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(caseStudyOverflow).toBe(false);
    await maybeSaveScreenshot(page, "analytics-case-study-375.png");

    // 7. Workspace Analytics Overview (/analytics) matches DB numbers (3 views, 1 published)
    await page.setViewportSize({ width: 1440, height: 920 });
    await page.goto("/analytics");
    await expect(page.getByTestId("overview-total-views-value")).toHaveText("3");
    await expect(page.getByTestId("overview-kpi-top-page")).toContainText(projectName);
    await maybeSaveScreenshot(page, "analytics-overview-1440.png");

    await page.setViewportSize({ width: 375, height: 812 });
    const overviewOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overviewOverflow).toBe(false);
    await maybeSaveScreenshot(page, "analytics-overview-375.png");

    // 8. Trigger PNG Long export -> wait for completion -> verify Export-Ready Notification + PostHog events + Resend email
    await page.setViewportSize({ width: 1440, height: 920 });
    await page.goto(`/projects/${createdProjectId}/exports`);
    await page.getByTestId("export-preset-png_long").click();
    await page.getByTestId("start-export-button").click();

    const firstHistoryRow = page
      .getByTestId("exports-history-list")
      .locator('[data-export-format="png_long"]')
      .first();
    await expect(firstHistoryRow).toHaveAttribute("data-export-status", "completed", {
      timeout: 35_000,
    });

    // Reload so SSR topbar + live Bell reflect both "Published" and "Export ready" unread notifications
    await page.reload();
    const bellBadge = page.getByTestId("notifications-unread-badge");
    await expect(bellBadge).toBeVisible();
    await expect(bellBadge).toHaveText("2");

    await page.getByTestId("notifications-bell-button").click();
    const dropdownPanel = page.getByTestId("notifications-dropdown-panel");
    await expect(dropdownPanel).toBeVisible();
    await expect(dropdownPanel).toContainText("Export ready");
    await expect(dropdownPanel).toContainText(`“${projectName}” PNG is ready to download.`);
    await maybeSaveScreenshot(page, "notifications-dropdown-1440.png");

    // Navigate via "View all →" to /notifications center
    await page.getByTestId("notifications-dropdown-view-all").click();
    await expect(page).toHaveURL(/\/notifications/);
    await expect(page.getByTestId("notifications-page-list")).toContainText("Export ready");
    await expect(page.getByTestId("notifications-page-list")).toContainText("Published");
    await maybeSaveScreenshot(page, "notifications-page-1440.png");

    // Mobile 375px check on /notifications
    await page.setViewportSize({ width: 375, height: 812 });
    const notifOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(notifOverflow).toBe(false);
    await maybeSaveScreenshot(page, "notifications-page-375.png");

    // Filter to Exports -> shows Export ready; then Mark all as read -> Unread filter shows "You’re all caught up"
    await page.setViewportSize({ width: 1440, height: 920 });
    await page.getByTestId("notifications-filter-exports").click();
    await expect(page.getByTestId("notifications-page-list")).toContainText("Export ready");

    await page.getByTestId("notifications-page-mark-all").click();
    await expect(page.getByTestId("notifications-unread-badge")).toHaveCount(0);

    await page.getByTestId("notifications-filter-unread").click();
    await expect(page.getByTestId("notifications-empty-state")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "You’re all caught up" }),
    ).toBeVisible();
    await maybeSaveScreenshot(page, "notifications-empty-1440.png");

    // 9. Verify PostHog dev event buffer & Resend notification email audit trail (strictly zero PII!)
    const devEventsRes = await page.request.get("/api/dev/analytics-events");
    expect(devEventsRes.status()).toBe(200);
    const devPayload = (await devEventsRes.json()) as {
      events: Array<{
        event: string;
        distinctId: string;
        properties: Record<string, unknown>;
      }>;
      emailAudits: Array<{
        kind: string;
        subject: string;
        htmlLength: number;
      }>;
    };

    const capturedEventNames = new Set(devPayload.events.map((e) => e.event));
    expect(capturedEventNames.has("signup")).toBe(true);
    expect(capturedEventNames.has("template_selected")).toBe(true);
    expect(capturedEventNames.has("project_created")).toBe(true);
    expect(capturedEventNames.has("published")).toBe(true);
    expect(capturedEventNames.has("exported")).toBe(true);

    const serializedAnalytics = JSON.stringify(devPayload);
    expect(serializedAnalytics).not.toContain(userEmail);
    expect(serializedAnalytics).not.toContain(userName);

    const exportEmailAudit = devPayload.emailAudits.find(
      (audit) => audit.kind === "export_ready",
    );
    expect(exportEmailAudit).toBeTruthy();
    expect(exportEmailAudit!.htmlLength).toBeGreaterThan(200);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  } finally {
    if (createdProjectId) {
      await db.delete(projects).where(eq(projects.id, createdProjectId));
    }
    if (createdUserId) {
      await db.delete(users).where(eq(users.id, createdUserId));
    }
    await pool.end();
  }
});
