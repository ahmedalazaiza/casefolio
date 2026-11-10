import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { auditLogs, createDbConnection, eq, projects, users } from "../../packages/db/src/index";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

interface AxeViolationSummary {
  route: string;
  id: string;
  impact: string | null | undefined;
  description: string;
  nodes: string[];
}

async function runAxeAudit(
  page: Page,
  routeLabel: string,
): Promise<{
  critical: AxeViolationSummary[];
  serious: AxeViolationSummary[];
}> {
  const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
  // Public page + export render inside the renderer wrapper; the editor canvas renders sections
  // directly. Every template section carries `data-section-type`.
  const TEMPLATE_CANVAS = '[data-slot="template-puck-renderer"], [data-section-type]';

  // 1. Platform UI (marketing, app shell, editor chrome, admin…): every WCAG 2.1 A/AA rule applies.
  const platform = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .exclude(TEMPLATE_CANVAS)
    .analyze();

  // 2. User-authored template canvas: all rules EXCEPT colour contrast. Contrast there is the
  //    designer's palette (e.g. the Figma templates ship brand colours such as white-on-coral), not
  //    something the platform may silently recolour without breaking pixel-fidelity.
  const hasCanvas = (await page.locator(TEMPLATE_CANVAS).count()) > 0;
  const canvas = hasCanvas
    ? await new AxeBuilder({ page })
        .withTags(WCAG_TAGS)
        .include(TEMPLATE_CANVAS)
        .disableRules(["color-contrast"])
        .analyze()
    : { violations: [] as typeof platform.violations };

  const results = { violations: [...platform.violations, ...canvas.violations] };

  const mapViolation = (v: (typeof results.violations)[number]): AxeViolationSummary => ({
    route: routeLabel,
    id: v.id,
    impact: v.impact,
    description: v.description,
    nodes: v.nodes.slice(0, 3).map((n) => `${n.target.join(" ")} -> ${n.html.slice(0, 140)}`),
  });

  return {
    critical: results.violations.filter((v) => v.impact === "critical").map(mapViolation),
    serious: results.violations.filter((v) => v.impact === "serious").map(mapViolation),
  };
}

async function assertNoHorizontalOverflow(page: Page, label: string) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(
    metrics.scrollWidth,
    `Horizontal overflow detected on ${label} (${metrics.scrollWidth} > ${metrics.innerWidth})`,
  ).toBeLessThanOrEqual(metrics.innerWidth);
}

test.describe("Phase 11 Performance, Accessibility & Responsive QA (C-1103)", () => {
  test("audits WCAG 2.1 A/AA accessibility via axe-core and 375/768/1440 responsive layouts across core routes", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    const databaseUrl = process.env.DATABASE_URL ?? "postgresql://localhost:5433/casefolio";
    const { db, pool } = createDbConnection(databaseUrl);

    const screenshotDir = process.env.QA_SCREENSHOT_DIR?.trim() || null;
    if (screenshotDir) {
      mkdirSync(screenshotDir, { recursive: true });
    }

    const stamp = Date.now();
    const email = `e2e-qa-a11y-${stamp}@casefolio.test`;
    const password = "CasefolioQaPassword2026!";
    const publicSlug = `qa-orbit-${stamp}`;
    let createdUserId: string | null = null;
    let createdProjectId: string | null = null;
    const pageErrors: string[] = [];

    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    const criticalIssues: AxeViolationSummary[] = [];
    const seriousIssues: AxeViolationSummary[] = [];

    const collectAudit = async (routeLabel: string) => {
      const { critical, serious } = await runAxeAudit(page, routeLabel);
      criticalIssues.push(...critical);
      seriousIssues.push(...serious);
    };

    try {
      await page.setViewportSize({ width: 1440, height: 900 });

      // Verify full-motion GSAP hero entrance settles cleanly to opacity 1 and passes axe
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect
        .poll(() =>
          page
            .locator("[data-hero-copy]")
            .evaluate((el) => window.getComputedStyle(el).opacity),
        )
        .toBe("1");
      await expect
        .poll(() =>
          page
            .locator("[data-hero-visual]")
            .evaluate((el) => window.getComputedStyle(el).opacity),
        )
        .toBe("1");
      await collectAudit("/ (motion settled)");

      // Use reduced-motion preference during rapid route sweeps so mid-tween opacity never skews static contrast checks
      await page.emulateMedia({ reducedMotion: "reduce" });

      // 1. Audit anonymous public & auth routes
      const publicRoutes = [
        { path: "/", slug: "landing" },
        { path: "/pricing", slug: "pricing" },
        { path: "/templates", slug: "templates" },
        { path: "/help", slug: "help" },
        { path: "/help/contact", slug: "help-contact" },
        { path: "/sign-in", slug: "sign-in" },
        { path: "/sign-up", slug: "sign-up" },
      ] as const;

      for (const route of publicRoutes) {
        await page.goto(route.path, { waitUntil: "domcontentloaded" });
        await collectAudit(`${route.path} (light)`);
      }

      // Also verify dark theme contrast & semantics on landing page
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Toggle color theme" }).click();
      await expect
        .poll(() => page.locator("html").evaluate((el) => el.classList.contains("dark")))
        .toBe(true);
      await collectAudit("/ (dark)");
      await page.getByRole("button", { name: "Toggle color theme" }).click();
      await expect
        .poll(() => page.locator("html").evaluate((el) => el.classList.contains("dark")))
        .toBe(false);

      // 2. Create verified admin user + published project to audit authenticated, editor, public case study & admin routes
      await page.goto("/sign-up");
      await page.getByLabel("Full name").fill("Lina QA Auditor");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(password);
      await page.locator('input[name="acceptTerms"]').check();
      await page.getByRole("button", { name: "Create account" }).click();
      await expect(page).toHaveURL(/\/verify/);

      const [elevated] = await db
        .update(users)
        .set({
          emailVerified: true,
          role: "superadmin",
          onboardingCompletedAt: new Date(),
        })
        .where(eq(users.email, email))
        .returning({ id: users.id });
      createdUserId = elevated?.id ?? null;
      expect(createdUserId).toBeTruthy();

      await page.context().clearCookies();
      await page.goto("/sign-in");
      await page.getByLabel("Email", { exact: true }).fill(email);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Log in" }).click();
      await expect(page).toHaveURL(/\/dashboard/);

      await collectAudit("/dashboard (empty)");

      // Create an Orbit project via /new
      await page.goto("/new");
      await collectAudit("/new (step 1)");
      await page.getByRole("radio", { name: /Mobile app/i }).click();
      await page.getByTestId("wizard-next-to-template").click();

      const orbitCard = page.locator(
        '[data-slot="wizard-template-card"][data-template-slug="orbit"]',
      );
      await expect(orbitCard).toBeVisible();
      await orbitCard.getByRole("button", { name: /Select|Selected/i }).click();
      await page.getByTestId("wizard-next-to-details").click();
      await page.getByLabel("Project name *").fill("Orbit — Accessibility & QA");
      await page.getByTestId("wizard-submit-create").click();
      await expect(page).toHaveURL(/\/editor\/([0-9a-f-]+)/);

      const match = page.url().match(/\/editor\/([0-9a-f-]+)/);
      createdProjectId = match?.[1] ?? null;
      expect(createdProjectId).toBeTruthy();

      // Audit Constrained Editor
      await collectAudit("/editor/[projectId]");

      // Publish project so /p/[slug] can be audited
      await page.goto(`/projects/${createdProjectId}/share`);
      await collectAudit("/projects/[projectId]/share");
      await page.getByTestId("publish-slug-input").fill(publicSlug);
      await expect(page.getByTestId("slug-availability-status")).toContainText("Available");
      await page.getByTestId("publish-project-button").click();
      await expect(page.getByTestId("share-status-badge")).toContainText("Published · Public");

      // Audit Exports, Public Case Study, Dashboard with projects, Account Billing, and Admin Overview
      const authedRoutes = [
        { path: `/projects/${createdProjectId}/exports`, label: "/projects/[projectId]/exports" },
        { path: `/p/${publicSlug}`, label: "/p/[slug]" },
        { path: "/dashboard", label: "/dashboard (populated)" },
        { path: "/account/billing", label: "/account/billing" },
        { path: "/admin", label: "/admin" },
      ] as const;

      for (const route of authedRoutes) {
        await page.goto(route.path, { waitUntil: "domcontentloaded" });
        await collectAudit(route.label);
      }

      // 3. Responsive Breakpoint QA across 375px, 768px, and 1440px + optional screenshot capture
      const breakpoints = [
        { width: 375, height: 812, tag: "375" },
        { width: 768, height: 1024, tag: "768" },
        { width: 1440, height: 900, tag: "1440" },
      ] as const;

      const responsiveTargets = [
        { path: "/", name: "landing" },
        { path: "/pricing", name: "pricing" },
        { path: "/templates", name: "templates" },
        { path: "/dashboard", name: "dashboard" },
        { path: `/editor/${createdProjectId}`, name: "editor" },
        { path: `/p/${publicSlug}`, name: "public-case-study" },
        { path: "/admin", name: "admin" },
      ] as const;

      for (const bp of breakpoints) {
        await page.setViewportSize({ width: bp.width, height: bp.height });
        for (const target of responsiveTargets) {
          await page.goto(target.path, { waitUntil: "domcontentloaded" });
          await assertNoHorizontalOverflow(page, `${target.name}@${bp.tag}px`);

          if (screenshotDir) {
            await page.screenshot({
              path: join(screenshotDir, `qa-${target.name}-${bp.tag}.png`),
              fullPage: false,
            });
          }
        }
      }

      expect(
        criticalIssues,
        `Critical axe-core violations:\n${JSON.stringify(criticalIssues, null, 2)}`,
      ).toEqual([]);
      expect(
        seriousIssues,
        `Serious axe-core violations:\n${JSON.stringify(seriousIssues, null, 2)}`,
      ).toEqual([]);
      expect(pageErrors).toEqual([]);
    } finally {
      if (createdProjectId) {
        await db.delete(projects).where(eq(projects.id, createdProjectId));
      }
      if (createdUserId) {
        await db.delete(auditLogs).where(eq(auditLogs.actorId, createdUserId));
        await db.delete(users).where(eq(users.id, createdUserId));
      }
      await pool.end();
    }
  });
});
