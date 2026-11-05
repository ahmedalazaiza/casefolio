import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { deflateSync } from "node:zlib";
import { expect, test } from "@playwright/test";
import {
  assets,
  auditLogs,
  createDbConnection,
  desc,
  eq,
  exportsTable,
  like,
  templates,
  users,
  verifications,
} from "../../packages/db/src/index";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc = (CRC_TABLE[(crc ^ (buf[i] ?? 0)) & 0xff]! ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makePngChunk(type: string, data: Uint8Array): Buffer {
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  chunk.write(type, 4, 4, "ascii");
  Buffer.from(data).copy(chunk, 8);
  const crcInput = new Uint8Array(chunk.buffer, chunk.byteOffset + 4, 4 + data.length);
  chunk.writeUInt32BE(crc32(crcInput), 8 + data.length);
  return chunk;
}

function generateMockupPng(width: number, height: number): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowStride = 1 + width * 3;
  const rawScanlines = Buffer.alloc(rowStride * height);
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * rowStride;
    rawScanlines[rowOffset] = 0;
    for (let x = 0; x < width; x += 1) {
      const px = rowOffset + 1 + x * 3;
      rawScanlines[px] = 79;
      rawScanlines[px + 1] = 70;
      rawScanlines[px + 2] = 229;
    }
  }

  const compressed = deflateSync(rawScanlines, { level: 6 });
  return Buffer.concat([
    signature,
    makePngChunk("IHDR", ihdr),
    makePngChunk("IDAT", compressed),
    makePngChunk("IEND", new Uint8Array(0)),
  ]);
}

test.describe("Phase 11 Core E2E Journeys (C-1102)", () => {
  test("Journey 1: Signup -> OTP Verify -> Onboarding -> Create Project -> Constrained Edit -> Publish -> Export PNG -> Upgrade to Pro -> Export PDF & Remove Watermark", async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);

    const databaseUrl = process.env.DATABASE_URL ?? "postgresql://localhost:5433/casefolio";
    const { db, pool } = createDbConnection(databaseUrl);

    const stamp = Date.now();
    const email = `e2e-core-designer-${stamp}@casefolio.test`;
    const password = "CasefolioJourney2026!";
    const publicSlug = `core-orbit-${stamp}`;
    let createdUserId: string | null = null;
    let createdProjectId: string | null = null;
    const pageErrors: string[] = [];

    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    try {
      await page.setViewportSize({ width: 1440, height: 920 });

      // 1. Sign up on /sign-up
      await page.goto("/sign-up");
      await page.getByLabel("Full name").fill("Tariq Al-Harbi");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(password);
      await page.locator('input[name="acceptTerms"]').check();
      await page.getByRole("button", { name: "Create account" }).click();

      // 2. Verify email with 6-digit OTP from Postgres
      await expect(page).toHaveURL(/\/verify/);
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

      // 3. Complete 3-step onboarding
      await expect(page).toHaveURL(/\/onboarding/);
      await page.getByRole("button", { name: /UI\/UX designer/i }).click();
      await page.getByRole("button", { name: /Continue/i }).click();
      await expect(
        page.getByRole("heading", { name: "What will you present first?" }),
      ).toBeVisible();
      await page.getByRole("button", { name: /Continue/i }).click();
      await expect(page.getByRole("heading", { name: "Set up your public profile" })).toBeVisible();
      await page.getByLabel("Headline").fill("Staff Product Designer");
      await page.getByRole("button", { name: /Continue/i }).click();

      await expect(page).toHaveURL(/\/dashboard/);
      const [userRow] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      createdUserId = userRow?.id ?? null;
      expect(createdUserId).toBeTruthy();

      // 4. Create project via /new 3-step wizard
      await page.goto("/new");
      await page.getByRole("radio", { name: /Mobile app/i }).click();
      await page.getByTestId("wizard-next-to-template").click();

      const orbitCard = page.locator(
        '[data-slot="wizard-template-card"][data-template-slug="orbit"]',
      );
      await expect(orbitCard).toBeVisible();
      await orbitCard.getByRole("button", { name: /Select|Selected/i }).click();
      await page.getByTestId("wizard-next-to-details").click();

      await page.getByLabel("Project name *").fill("Orbit — Core Journey Case Study");
      await page.getByTestId("wizard-submit-create").click();
      await expect(page).toHaveURL(/\/editor\/([0-9a-f-]+)/);

      const match = page.url().match(/\/editor\/([0-9a-f-]+)/);
      createdProjectId = match?.[1] ?? null;
      expect(createdProjectId).toBeTruthy();

      // 5. Edit theme & upload/crop slot screenshot in Constrained Editor
      const leftPanel = page.locator('[data-slot="editor-left-panel"]');
      await leftPanel.getByRole("tab", { name: "Style" }).click();
      await leftPanel.getByLabel("Font pair").selectOption("instrument-editorial");

      const rightPanel = page.locator('[data-slot="editor-right-panel"]');
      const heroSlot = rightPanel.getByTestId("image-slot-field-hero.mockup");
      await heroSlot.getByTestId("slot-file-input-hero.mockup").setInputFiles({
        name: "core-journey-screen.png",
        mimeType: "image/png",
        buffer: generateMockupPng(360, 780),
      });

      await expect(page.getByTestId("image-slot-crop-dialog")).toBeVisible();
      await page.getByTestId("crop-dialog-apply").click();
      await expect(page.getByTestId("image-slot-crop-dialog")).toHaveCount(0, {
        timeout: 15_000,
      });
      await expect(page.getByTestId("editor-save-indicator")).toHaveAttribute(
        "data-save-status",
        "saved",
        { timeout: 10_000 },
      );

      // 6. Publish public case study & verify live SSR + watermark on Free
      await page.getByRole("link", { name: /Publish/i }).click();
      await expect(page).toHaveURL(new RegExp(`/projects/${createdProjectId}/share`));
      await page.getByTestId("publish-slug-input").fill(publicSlug);
      await expect(page.getByTestId("slug-availability-status")).toContainText("Available");
      await page.getByTestId("publish-project-button").click();
      await expect(page.getByTestId("share-status-badge")).toContainText("Published · Public");

      const anonContext = await browser.newContext({
        viewport: { width: 1440, height: 900 },
      });
      const anonPage = await anonContext.newPage();
      const pubRes = await anonPage.goto(`/p/${publicSlug}`, {
        waitUntil: "domcontentloaded",
      });
      expect(pubRes?.status()).toBe(200);
      await expect(
        anonPage.getByRole("heading", {
          name: "Orbit — Core Journey Case Study",
        }),
      ).toBeVisible();
      await expect(anonPage.getByTestId("casefolio-watermark-badge")).toBeVisible();

      // 7. Export PNG on Free (PDF gated on Free)
      await page.getByRole("link", { name: /Exports \(PNG \/ PDF \/ Behance\)/i }).click();
      await expect(page).toHaveURL(new RegExp(`/projects/${createdProjectId}/exports`));

      await page.getByTestId("export-preset-pdf").click();
      await expect(page.getByTestId("upgrade-export-cta")).toBeVisible();

      await page.getByTestId("export-preset-png_long").click();
      await page.getByTestId("start-export-button").click();

      const pngRow = page
        .getByTestId("exports-history-list")
        .locator('[data-export-format="png_long"]')
        .first();
      await expect(pngRow).toHaveAttribute("data-export-status", "completed", {
        timeout: 35_000,
      });

      const pngHref = await pngRow.locator("a[download]").getAttribute("href");
      expect(pngHref).toBeTruthy();
      const pngRes = await page.request.get(pngHref!);
      expect(pngRes.status()).toBe(200);
      const pngBytes = await pngRes.body();
      expect(Array.from(pngBytes.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);

      // 8. Upgrade to Pro via Paddle Sandbox checkout
      await page.goto("/account/billing");
      await expect(page.getByTestId("billing-current-plan-title")).toHaveText("Free");
      await page.getByTestId("billing-upgrade-pro-btn").click();
      await expect(page.getByTestId("paddle-checkout-dialog")).toBeVisible();
      await page.getByTestId("proceed-to-paddle-checkout").click();
      await expect(page.getByTestId("sandbox-payment-sheet")).toBeVisible();
      await page.getByTestId("complete-sandbox-checkout").click();
      await expect(page.getByTestId("paddle-checkout-dialog")).toHaveCount(0, {
        timeout: 10_000,
      });
      await expect(page.getByTestId("billing-current-plan-title")).toHaveText("Pro · Monthly");

      // 9. Verify Pro perks: public watermark removed & A4 PDF export unlocked
      await anonPage.reload({ waitUntil: "domcontentloaded" });
      await expect(anonPage.getByTestId("casefolio-watermark-badge")).toHaveCount(0);

      await page.goto(`/projects/${createdProjectId}/exports`);
      await page.getByTestId("export-preset-pdf").click();
      await page.getByTestId("start-export-button").click();

      const pdfRow = page
        .getByTestId("exports-history-list")
        .locator('[data-export-format="pdf"]')
        .first();
      await expect(pdfRow).toHaveAttribute("data-export-status", "completed", {
        timeout: 35_000,
      });

      const pdfHref = await pdfRow.locator("a[download]").getAttribute("href");
      expect(pdfHref).toBeTruthy();
      const pdfRes = await page.request.get(pdfHref!);
      expect(pdfRes.status()).toBe(200);
      const pdfBytes = await pdfRes.body();
      expect(pdfBytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");

      await anonContext.close();
      expect(pageErrors).toEqual([]);
    } finally {
      if (createdProjectId) {
        const uploadedAssets = await db
          .select({ r2Key: assets.r2Key })
          .from(assets)
          .where(eq(assets.projectId, createdProjectId));
        const generatedExports = await db
          .select({ r2Key: exportsTable.r2Key })
          .from(exportsTable)
          .where(eq(exportsTable.projectId, createdProjectId));
        for (const row of [...uploadedAssets, ...generatedExports]) {
          if (row.r2Key) {
            rmSync(resolve(process.cwd(), ".data/uploads", row.r2Key), {
              force: true,
            });
          }
        }
      }
      if (createdUserId) {
        await db.delete(users).where(eq(users.id, createdUserId));
      }
      await db.delete(verifications).where(like(verifications.identifier, `%${email}%`));
      await pool.end();
    }
  });

  test("Journey 2: Admin Template Import — Upload JSON -> Validate Schema -> Preview -> Save Draft -> Publish v1.0.0 -> Audit Log & Live Library", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    const databaseUrl = process.env.DATABASE_URL ?? "postgresql://localhost:5433/casefolio";
    const { db, pool } = createDbConnection(databaseUrl);

    const stamp = Date.now();
    const adminEmail = `e2e-core-admin-${stamp}@casefolio.test`;
    const password = "CasefolioAdminCore2026!";
    const uniqueSlug = `orbit-core-${stamp}`;
    const uniqueName = `Orbit Core ${stamp}`;
    const orbitJsonPath = resolve(process.cwd(), "reference/template.example.json");
    let adminUserId: string | null = null;

    try {
      await page.setViewportSize({ width: 1440, height: 920 });

      await page.goto("/sign-up");
      await page.getByLabel("Full name").fill("Dana Superadmin");
      await page.getByLabel("Email").fill(adminEmail);
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
        .where(eq(users.email, adminEmail))
        .returning({ id: users.id });
      adminUserId = elevated?.id ?? null;
      expect(adminUserId).toBeTruthy();

      await page.context().clearCookies();
      await page.goto("/sign-in");
      await page.getByLabel("Email", { exact: true }).fill(adminEmail);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Log in" }).click();
      await expect(page).toHaveURL(/\/dashboard/);

      // Admin imports template via 4-step wizard
      await page.goto("/admin/templates/new");
      await expect(page.getByRole("heading", { name: "Upload template" })).toBeVisible();
      await page.locator("#template-json-file").setInputFiles(orbitJsonPath);
      await page.getByRole("button", { name: /Validate JSON/i }).click();

      await expect(page.getByTestId("validation-success-panel")).toBeVisible();
      await page.getByRole("button", { name: /Preview template/i }).click();

      await expect(
        page.getByRole("heading", {
          name: "Orbit — Banking that moves with you",
        }),
      ).toBeVisible();
      await page.getByRole("button", { name: /Continue to metadata/i }).click();

      await page.getByLabel("Template name *").fill(uniqueName);
      await page.getByLabel("Slug *").fill(uniqueSlug);
      await page.getByRole("button", { name: /Save as draft \(v1\.0\.0\)/i }).click();

      await expect(page).toHaveURL(/\/admin\/templates\/[0-9a-f-]+/);
      await page
        .getByRole("button", { name: /Publish v1\.0\.0/i })
        .first()
        .click();
      await expect(page.getByText("Template version published to the user library.")).toBeVisible();

      // Verify audit_logs entry recorded for admin template publication
      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.actorId, adminUserId!))
        .orderBy(desc(auditLogs.at));
      expect(logs.length).toBeGreaterThanOrEqual(2);

      // Verify anonymous visitor sees newly imported template in /templates
      await page.context().clearCookies();
      await page.goto("/templates");
      const card = page.locator(`[data-template-slug="${uniqueSlug}"]`);
      await expect(card).toBeVisible();
      await card.getByRole("button", { name: /Preview/i }).click();
      await expect(
        page.getByRole("dialog").getByRole("heading", {
          name: "Orbit — Banking that moves with you",
        }),
      ).toBeVisible();
    } finally {
      await db
        .update(templates)
        .set({ currentVersionId: null })
        .where(eq(templates.slug, uniqueSlug));
      await db.delete(templates).where(eq(templates.slug, uniqueSlug));
      if (adminUserId) {
        await db.delete(auditLogs).where(eq(auditLogs.actorId, adminUserId));
        await db.delete(users).where(eq(users.id, adminUserId));
      }
      await pool.end();
    }
  });
});
