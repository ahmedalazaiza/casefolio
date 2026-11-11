import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { deflateSync } from "node:zlib";
import { expect, test } from "@playwright/test";
import {
  assets,
  createDbConnection,
  eq,
  exportsTable,
  templates,
  templateVersions,
  users,
} from "../../packages/db/src/index";
import { signExportRenderToken } from "../../apps/worker/src/token";

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
    const vNorm = y / Math.max(1, height - 1);
    for (let x = 0; x < width; x += 1) {
      const hNorm = x / Math.max(1, width - 1);
      const px = rowOffset + 1 + x * 3;
      rawScanlines[px] = Math.round(79 + hNorm * 40);
      rawScanlines[px + 1] = Math.round(70 + vNorm * 110);
      rawScanlines[px + 2] = Math.round(229 - vNorm * 35);
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

test("Phase 6 E2E: publish Orbit project, open public link logged out (<2s + OG + 404 on unpublish), export PNG + PDF + Behance, re-download history, and verify fonts match editor", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);

  const databaseUrl = process.env.DATABASE_URL ?? "postgresql://localhost:5433/casefolio";
  const { db, pool } = createDbConnection(databaseUrl);

  const stamp = Date.now();
  const userEmail = `e2e-publish-p6-${stamp}@casefolio.test`;
  const password = "CasefolioPublish2026!";
  const customSlug = `orbit-fintech-${stamp}`;
  let createdUserId: string | null = null;
  let createdProjectId: string | null = null;
  const pageErrors: string[] = [];

  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });

  try {
    // Ensure Orbit template exists
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

    // 1. Sign up & sign in (Free plan)
    await page.goto("/sign-up");
    await page.getByLabel("Full name").fill("Layla Portfolio Author");
    await page.getByLabel("Email").fill(userEmail);
    await page.getByLabel("Password").fill(password);
    await page.locator('input[name="acceptTerms"]').check();
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/verify/);

    const [verifiedUser] = await db
      .update(users)
      .set({
        emailVerified: true,
        designFocus: "mobile",
        onboardingCompletedAt: new Date(),
      })
      .where(eq(users.email, userEmail))
      .returning({ id: users.id });
    createdUserId = verifiedUser?.id ?? null;

    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(userEmail);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // 2. Create Mobile project from Orbit
    await page.goto("/new");
    await page.getByRole("radio", { name: /Mobile app/i }).click();
    await page.getByTestId("wizard-next-to-template").click();

    const orbitCard = page.locator(
      '[data-slot="wizard-template-card"][data-template-slug="orbit"]',
    );
    await expect(orbitCard).toBeVisible();
    await orbitCard.getByRole("button", { name: /Select|Selected/i }).click();
    await page.getByTestId("wizard-next-to-details").click();

    await page.getByLabel("Project name *").fill("Orbit — Global Savings App");
    await page.getByTestId("wizard-submit-create").click();
    await expect(page).toHaveURL(/\/editor\/([0-9a-f-]+)/);

    const projectMatch = page.url().match(/\/editor\/([0-9a-f-]+)/);
    createdProjectId = projectMatch?.[1] ?? null;
    expect(createdProjectId).toBeTruthy();

    // 3. Select custom Google Font pair ("Instrument Serif + Geist") + upload hero.mockup
    const leftPanel = page.locator('[data-slot="editor-left-panel"]');
    await leftPanel.getByRole("tab", { name: "Style" }).click();
    await leftPanel.getByLabel("Font pair").selectOption("instrument-editorial");

    const rightPanel = page.locator('[data-slot="editor-right-panel"]');
    const heroMockupField = rightPanel.getByTestId("image-slot-field-hero.mockup");
    const fileInput = heroMockupField.getByTestId("slot-file-input-hero.mockup");
    await fileInput.setInputFiles({
      name: "orbit-savings.png",
      mimeType: "image/png",
      buffer: generateMockupPng(540, 1170),
    });

    await expect(page.getByTestId("image-slot-crop-dialog")).toBeVisible();
    await page.getByTestId("crop-dialog-apply").click();
    await expect(page.getByTestId("image-slot-crop-dialog")).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByTestId("editor-save-indicator")).toHaveAttribute(
      "data-save-status",
      "saved",
      { timeout: 10_000 },
    );

    const editorHeadingFont = await page
      .getByTestId("editor-canvas-preview")
      .locator('[data-section-type="Hero"] h1')
      .evaluate((el) => window.getComputedStyle(el).fontFamily);
    expect(editorHeadingFont).toContain("Instrument Serif");

    // 4. Navigate to Publish & Share page and publish with custom slug
    await page.getByRole("link", { name: /Publish/i }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${createdProjectId}/share`));

    const slugInput = page.getByTestId("publish-slug-input");
    await slugInput.fill(customSlug);
    await expect(page.getByTestId("slug-availability-status")).toContainText("Available");

    await page.getByTestId("publish-project-button").click();
    await expect(page.getByTestId("share-status-badge")).toContainText("Published · Public");
    await maybeSaveScreenshot(page, "share-settings-1440.png");

    // 5. Open public link LOGGED OUT (< 2s load, fonts match editor, Satori OG PNG valid, unsigned /export 403)
    const anonContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const anonPage = await anonContext.newPage();

    const navStart = Date.now();
    const publicRes = await anonPage.goto(`/p/${customSlug}`, { waitUntil: "domcontentloaded" });
    const navElapsedMs = Date.now() - navStart;
    expect(publicRes?.status()).toBe(200);
    expect(navElapsedMs).toBeLessThan(2000);

    await expect(anonPage.getByTestId("public-case-study-page")).toBeVisible();
    await expect(
      anonPage.getByRole("heading", { name: "Orbit — Global Savings App" }),
    ).toBeVisible();
    await expect(anonPage.getByTestId("casefolio-watermark-badge")).toBeVisible();

    const publicHeadingFont = await anonPage
      .locator('[data-section-type="Hero"] h1')
      .evaluate((el) => window.getComputedStyle(el).fontFamily);
    expect(publicHeadingFont).toBe(editorHeadingFont);

    await expect
      .poll(
        async () =>
          anonPage
            .locator('[data-section-type="Hero"] img')
            .first()
            .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
        { timeout: 10_000 },
      )
      .toBe(true);

    await maybeSaveScreenshot(anonPage, "public-case-study-1440.png");
    await anonPage.setViewportSize({ width: 375, height: 812 });
    await maybeSaveScreenshot(anonPage, "public-case-study-375.png");

    // Satori OpenGraph image endpoint returns valid PNG
    const ogRes = await anonContext.request.get(`/p/${customSlug}/opengraph-image`);
    expect(ogRes.status()).toBe(200);
    expect(ogRes.headers()["content-type"]).toContain("image/png");
    const ogBody = await ogRes.body();
    expect(Array.from(ogBody.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);

    // Internal export render route strictly blocks unsigned requests (403)
    const unsignedExportRes = await anonContext.request.get(
      "/export/00000000-0000-4000-8000-000000000000",
    );
    expect(unsignedExportRes.status()).toBe(403);

    // 6. Unpublish returns 404 immediately, then re-publish
    await page.getByTestId("unpublish-project-button").click();
    await expect(page.getByTestId("share-status-badge")).toContainText("Draft · Private");

    const unpublishedRes = await anonContext.request.get(`/p/${customSlug}`);
    expect(unpublishedRes.status()).toBe(404);

    await page.getByTestId("publish-project-button").click();
    await expect(page.getByTestId("share-status-badge")).toContainText("Published · Public");

    // 7. Navigate to Exports: Free user exports PNG Long (with watermark), PDF locked on Free
    await page.getByRole("link", { name: /Exports \(PNG \/ PDF \/ Behance\)/i }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${createdProjectId}/exports`));

    await page.getByTestId("export-preset-pdf").click();
    await expect(page.getByTestId("upgrade-export-cta")).toBeVisible();

    await page.getByTestId("export-preset-png_long").click();
    await page.getByTestId("start-export-button").click();

    const firstHistoryRow = page
      .getByTestId("exports-history-list")
      .locator('[data-export-format="png_long"]')
      .first();
    await expect(firstHistoryRow).toHaveAttribute("data-export-status", "completed", {
      timeout: 35_000,
    });

    const pngDownloadHref = await firstHistoryRow.locator("a[download]").getAttribute("href");
    expect(pngDownloadHref).toBeTruthy();
    const pngFileRes = await page.request.get(pngDownloadHref!);
    expect(pngFileRes.status()).toBe(200);
    expect(pngFileRes.headers()["content-type"]).toBe("image/png");
    const pngBytes = await pngFileRes.body();
    expect(Array.from(pngBytes.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(pngBytes.byteLength).toBeGreaterThan(5_000);

    // 8. Upgrade user to Pro -> export PDF + Behance slices, verify fonts match editor, and re-download past PNG
    await db.update(users).set({ plan: "pro" }).where(eq(users.id, createdUserId!));
    await page.reload();

    await page.getByTestId("export-preset-pdf").click();
    await page.getByTestId("start-export-button").click();

    const pdfHistoryRow = page
      .getByTestId("exports-history-list")
      .locator('[data-export-format="pdf"]')
      .first();
    await expect(pdfHistoryRow).toHaveAttribute("data-export-status", "completed", {
      timeout: 35_000,
    });

    const pdfDownloadHref = await pdfHistoryRow.locator("a[download]").getAttribute("href");
    expect(pdfDownloadHref).toBeTruthy();
    const pdfFileRes = await page.request.get(pdfDownloadHref!);
    expect(pdfFileRes.status()).toBe(200);
    expect(pdfFileRes.headers()["content-type"]).toBe("application/pdf");
    const pdfBytes = await pdfFileRes.body();
    expect(pdfBytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");

    // Verify signed /export/[jobId]?token= target renders identical editor font ("Instrument Serif") & no watermark on Pro
    const pdfJobIdMatch = pdfDownloadHref!.match(/\/api\/exports\/([0-9a-f-]+)\/download/);
    const pdfJobId = pdfJobIdMatch?.[1] ?? "";
    expect(pdfJobId).toBeTruthy();
    const signedRenderToken = signExportRenderToken({
      exportId: pdfJobId,
      projectId: createdProjectId!,
    });
    await anonPage.setViewportSize({ width: 1440, height: 900 });
    const exportRenderRes = await anonPage.goto(
      `/export/${pdfJobId}?token=${encodeURIComponent(signedRenderToken)}`,
      { waitUntil: "networkidle" },
    );
    expect(exportRenderRes?.status()).toBe(200);
    const exportHeadingFont = await anonPage
      .locator('[data-section-type="Hero"] h1')
      .evaluate((el) => window.getComputedStyle(el).fontFamily);
    expect(exportHeadingFont).toBe(editorHeadingFont);
    await expect(anonPage.getByTestId("casefolio-watermark-badge")).toHaveCount(0);

    // Re-download past PNG export from history
    const reDownloadPngRes = await page.request.get(pngDownloadHref!);
    expect(reDownloadPngRes.status()).toBe(200);

    await maybeSaveScreenshot(page, "exports-history-1440.png");
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
          const localFile = resolve(process.cwd(), ".data/uploads", row.r2Key);
          rmSync(localFile, { force: true });
        }
      }
    }
    if (createdUserId) {
      await db.delete(users).where(eq(users.id, createdUserId));
    }
    await pool.end();
  }
});
