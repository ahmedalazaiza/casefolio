import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { deflateSync } from "node:zlib";
import { expect, test } from "@playwright/test";
import {
  assets,
  auditLogs,
  createDbConnection,
  eq,
  exportsTable,
  like,
  projects,
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

function generateSolidPng(width: number, height: number, rgb: [number, number, number]): Buffer {
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
      rawScanlines[px] = rgb[0];
      rawScanlines[px + 1] = rgb[1];
      rawScanlines[px + 2] = rgb[2];
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

test.describe("Phase 12 Production Readiness & Mandatory Template Cover E2E", () => {
  test("Admin uploads mandatory template cover, replaces it on detail page, and beta tester sees cover everywhere + completes full editor/publish/export journey", async ({
    page,
    browser,
  }) => {
    test.setTimeout(150_000);

    const databaseUrl = process.env.DATABASE_URL ?? "postgresql://localhost:5433/casefolio";
    const { db, pool } = createDbConnection(databaseUrl);

    const stamp = Date.now();
    const adminEmail = `e2e-p12-admin-${stamp}@casefolio.test`;
    const testerEmail = `e2e-p12-tester-${stamp}@casefolio.test`;
    const password = "CasefolioBetaReady2026!";
    const uniqueSlug = `nova-studio-${stamp}`;
    const uniqueName = `Nova Studio ${stamp}`;
    const publicSlug = `nova-beta-${stamp}`;

    const orbitJsonPath = resolve(process.cwd(), "reference/template.example.json");
    const rawOrbit = JSON.parse(readFileSync(orbitJsonPath, "utf-8")) as {
      template: { name: string; slug: string; cover?: unknown };
    };
    rawOrbit.template.name = uniqueName;
    rawOrbit.template.slug = uniqueSlug;
    delete rawOrbit.template.cover;

    let adminUserId: string | null = null;
    let testerUserId: string | null = null;
    let createdTemplateId: string | null = null;
    let createdProjectId: string | null = null;
    const uploadedCoverUrls: string[] = [];
    const pageErrors: string[] = [];

    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    try {
      await page.setViewportSize({ width: 1440, height: 920 });

      // 1. Register & elevate Admin account
      await page.goto("/sign-up");
      await page.getByLabel("Full name").fill("Rami Admin");
      await page.getByLabel("Email").fill(adminEmail);
      await page.getByLabel("Password").fill(password);
      await page.locator('input[name="acceptTerms"]').check();
      await page.getByRole("button", { name: "Create account" }).click();
      await expect(page).toHaveURL(/\/verify/);

      const [elevatedAdmin] = await db
        .update(users)
        .set({
          emailVerified: true,
          role: "admin",
          onboardingCompletedAt: new Date(),
        })
        .where(eq(users.email, adminEmail))
        .returning({ id: users.id });
      adminUserId = elevatedAdmin?.id ?? null;
      expect(adminUserId).toBeTruthy();

      await page.context().clearCookies();
      await page.goto("/sign-in");
      await page.getByLabel("Email", { exact: true }).fill(adminEmail);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Log in" }).click();
      await expect(page).toHaveURL(/\/dashboard/);

      // 2. Admin visits /admin/templates/new with JSON omitting template.cover
      await page.goto("/admin/templates/new");
      await expect(page.getByRole("heading", { name: "Upload template" })).toBeVisible();
      await expect(page.getByTestId("template-cover-uploader")).toBeVisible();

      await page.locator("#template-json-file").setInputFiles({
        name: `${uniqueSlug}.json`,
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(rawOrbit), "utf-8"),
      });
      await page.getByRole("button", { name: /Validate JSON/i }).click();

      // Step 2: Validation succeeds even when raw converter JSON omitted cover
      await expect(page.getByTestId("validation-success-panel")).toBeVisible();
      await page.getByRole("button", { name: /Preview template/i }).click();

      // Step 3: Preview
      await expect(
        page.getByRole("heading", { name: "Orbit — Banking that moves with you" }),
      ).toBeVisible();
      await page.getByRole("button", { name: /Continue to metadata/i }).click();

      // Step 4: Attempting to save without cover is blocked
      await page.getByRole("button", { name: /Save as draft \(v1\.0\.0\)/i }).click();
      await expect(
        page.getByText(/A cover \/ thumbnail image is required when adding a template/i),
      ).toBeVisible();

      // Upload first real PNG cover (800x600)
      await page.getByTestId("template-cover-file-input").setInputFiles({
        name: "nova-cover-v1.png",
        mimeType: "image/png",
        buffer: generateSolidPng(800, 600, [58, 76, 245]),
      });

      const previewThumb = page.getByTestId("template-cover-live-preview");
      await expect(previewThumb).toBeVisible({ timeout: 15_000 });
      const firstCoverImg = previewThumb.locator("img").first();
      await expect(firstCoverImg).toHaveAttribute("src", /^\/cdn\/covers\/[0-9a-f-]+\.png$/);
      const firstCoverSrc = (await firstCoverImg.getAttribute("src")) ?? "";
      uploadedCoverUrls.push(firstCoverSrc);

      await expect
        .poll(() =>
          firstCoverImg.evaluate((el: HTMLImageElement) => (el.complete ? el.naturalWidth : 0)),
        )
        .toBe(800);

      // Save draft v1.0.0
      await page.getByRole("button", { name: /Save as draft \(v1\.0\.0\)/i }).click();
      await expect(page).toHaveURL(/\/admin\/templates\/([0-9a-f-]+)/);
      createdTemplateId = page.url().match(/\/admin\/templates\/([0-9a-f-]+)/)?.[1] ?? null;
      expect(createdTemplateId).toBeTruthy();

      // 3. Verify detail page cover card & test "Change cover" dialog
      const detailThumb = page.getByTestId("admin-detail-cover-thumbnail").locator("img").first();
      await expect(detailThumb).toHaveAttribute("src", firstCoverSrc);

      await page.getByTestId("open-change-cover-dialog").click();
      const dialogUploader = page.getByRole("dialog").getByTestId("template-cover-file-input");
      await dialogUploader.setInputFiles({
        name: "nova-cover-v2.png",
        mimeType: "image/png",
        buffer: generateSolidPng(800, 600, [18, 148, 112]),
      });

      const dialogImg = page
        .getByRole("dialog")
        .getByTestId("template-cover-live-preview")
        .locator("img")
        .first();
      await expect(dialogImg).not.toHaveAttribute("src", firstCoverSrc, { timeout: 15_000 });
      const finalCoverSrc = (await dialogImg.getAttribute("src")) ?? "";
      expect(finalCoverSrc).toMatch(/^\/cdn\/covers\/[0-9a-f-]+\.png$/);
      uploadedCoverUrls.push(finalCoverSrc);

      await page.getByTestId("save-updated-cover-button").click();
      await expect(
        page.getByText("Template cover / thumbnail updated across the website."),
      ).toBeVisible();
      await expect(detailThumb).toHaveAttribute("src", finalCoverSrc);

      // Publish v1.0.0
      await page
        .getByRole("button", { name: /Publish v1\.0\.0/i })
        .first()
        .click();
      await expect(page.getByText("Template version published to the user library.")).toBeVisible();

      // 4. Verify thumbnail on /admin/templates table
      await page.goto("/admin/templates");
      const adminRowImg = page.locator(`img[src="${finalCoverSrc}"]`).first();
      await expect(adminRowImg).toBeVisible();
      await expect
        .poll(() =>
          adminRowImg.evaluate((el: HTMLImageElement) => (el.complete ? el.naturalWidth : 0)),
        )
        .toBe(800);

      // 5. Sign out Admin & verify cover on public Landing Page (/) and Template Library (/templates)
      await page.context().clearCookies();

      await page.goto("/");
      const landingImg = page.locator(`img[alt="${uniqueName} template preview"]`);
      await expect(landingImg).toHaveAttribute("src", finalCoverSrc);
      await expect
        .poll(() =>
          landingImg.evaluate((el: HTMLImageElement) => (el.complete ? el.naturalWidth : 0)),
        )
        .toBe(800);

      await page.goto("/templates");
      const libraryCard = page.locator(`[data-template-slug="${uniqueSlug}"]`);
      await expect(libraryCard).toBeVisible();
      const libraryImg = libraryCard.locator(`img[src="${finalCoverSrc}"]`).first();
      await expect(libraryImg).toBeVisible();
      await expect
        .poll(() =>
          libraryImg.evaluate((el: HTMLImageElement) => (el.complete ? el.naturalWidth : 0)),
        )
        .toBe(800);

      // 6. Beta Tester Journey: Sign-up -> Skip Verify link -> Onboarding -> /new (Step 2 & Step 3 thumbnails)
      await page.goto("/sign-up");
      await page.getByLabel("Full name").fill("Yara Beta Tester");
      await page.getByLabel("Email").fill(testerEmail);
      await page.getByLabel("Password").fill(password);
      await page.locator('input[name="acceptTerms"]').check();
      await page.getByRole("button", { name: "Create account" }).click();
      await expect(page).toHaveURL(/\/verify/);

      await page.getByTestId("skip-verify-for-now").click();
      await expect(page).toHaveURL(/\/onboarding/);

      await page.getByRole("button", { name: /UI\/UX designer/i }).click();
      await page.getByRole("button", { name: /Continue/i }).click();
      await expect(
        page.getByRole("heading", { name: "What will you present first?" }),
      ).toBeVisible();
      await page.getByRole("button", { name: /Continue/i }).click();
      await expect(page.getByRole("heading", { name: "Set up your public profile" })).toBeVisible();
      await page.getByLabel("Headline").fill("Product Designer");
      await page.getByRole("button", { name: /Continue/i }).click();
      await expect(page).toHaveURL(/\/dashboard/);

      const [testerRow] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, testerEmail))
        .limit(1);
      testerUserId = testerRow?.id ?? null;
      expect(testerUserId).toBeTruthy();

      await page.goto("/new");
      await page.getByTestId("type-card-mobile").click();
      await page.getByTestId("wizard-next-to-template").click();

      const wizardCard = page.locator(
        `[data-slot="wizard-template-card"][data-template-slug="${uniqueSlug}"]`,
      );
      await expect(wizardCard).toBeVisible();
      const wizardCardImg = wizardCard.locator(`img[src="${finalCoverSrc}"]`).first();
      await expect(wizardCardImg).toBeVisible();
      await expect
        .poll(() =>
          wizardCardImg.evaluate((el: HTMLImageElement) => (el.complete ? el.naturalWidth : 0)),
        )
        .toBe(800);

      await wizardCard.getByRole("button", { name: /Select|Selected/i }).click();
      await page.getByTestId("wizard-next-to-details").click();

      // Step 3 shows both mini thumbnail in Template bar & Live cover preview thumbnail
      const step3Imgs = page.locator(`img[src="${finalCoverSrc}"]`);
      await expect(step3Imgs).toHaveCount(2);

      await page.getByLabel("Project name *").fill("Nova Beta Case Study");
      await page.getByTestId("wizard-submit-create").click();
      await expect(page).toHaveURL(/\/editor\/([0-9a-f-]+)/);
      createdProjectId = page.url().match(/\/editor\/([0-9a-f-]+)/)?.[1] ?? null;
      expect(createdProjectId).toBeTruthy();

      // 7. Editor controls: collapse/open left & right panels, zoom +/-/reset, edit & autosave
      const leftPanel = page.locator('[data-slot="editor-left-panel"]');
      const rightPanel = page.locator('[data-slot="editor-right-panel"]');
      await expect(leftPanel).toHaveAttribute("data-open", "true");
      await expect(rightPanel).toHaveAttribute("data-open", "true");

      await page.getByTestId("toggle-left-panel").click();
      await expect(leftPanel).toHaveAttribute("data-open", "false");
      await page.getByTestId("toggle-left-panel").click();
      await expect(leftPanel).toHaveAttribute("data-open", "true");

      await page.getByTestId("toggle-right-panel").click();
      await expect(rightPanel).toHaveAttribute("data-open", "false");
      await page.getByTestId("toggle-right-panel").click();
      await expect(rightPanel).toHaveAttribute("data-open", "true");

      await expect(page.getByTestId("zoom-reset-button")).toHaveText("100%");
      await page.keyboard.press("+");
      await expect(page.getByTestId("zoom-reset-button")).toHaveText("110%");
      await page.keyboard.press("-");
      await expect(page.getByTestId("zoom-reset-button")).toHaveText("100%");
      await page.getByTestId("zoom-in-button").click();
      await expect(page.getByTestId("zoom-reset-button")).toHaveText("110%");
      await page.getByTestId("zoom-reset-button").click();
      await expect(page.getByTestId("zoom-reset-button")).toHaveText("100%");

      // Edit case study title in Content tab and verify autosave
      await leftPanel.getByRole("tab", { name: "Content" }).click();
      await page.locator("#editor-case-study-title").fill("Nova Beta — Mobile Checkout Redesign");
      await expect(page.getByTestId("editor-save-indicator")).toHaveAttribute(
        "data-save-status",
        "saved",
        { timeout: 10_000 },
      );

      // 8. Verify /dashboard project card uses template cover thumbnail before Hero mockup is uploaded
      await page.goto("/dashboard");
      const dashCoverImg = page.locator(`img[src="${finalCoverSrc}"]`).first();
      await expect(dashCoverImg).toBeVisible();
      await expect
        .poll(() =>
          dashCoverImg.evaluate((el: HTMLImageElement) => (el.complete ? el.naturalWidth : 0)),
        )
        .toBe(800);

      // 9. Publish to /p/[slug] & verify /published row thumbnail + public SSR 200
      await page.goto(`/projects/${createdProjectId}/share`);
      await page.getByTestId("publish-slug-input").fill(publicSlug);
      await expect(page.getByTestId("slug-availability-status")).toContainText("Available");
      await page.getByTestId("publish-project-button").click();
      await expect(page.getByTestId("share-status-badge")).toContainText("Published · Public");

      await page.goto("/published");
      await expect(page.locator(`img[src="${finalCoverSrc}"]`).first()).toBeVisible();

      const anonContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const anonPage = await anonContext.newPage();
      const pubRes = await anonPage.goto(`/p/${publicSlug}`, { waitUntil: "domcontentloaded" });
      expect(pubRes?.status()).toBe(200);
      await anonContext.close();

      // 10. Browser-assisted PNG Export (works seamlessly even with zero external worker running)
      await page.goto(`/projects/${createdProjectId}/exports`);
      await page.getByTestId("export-preset-png_long").click();
      await page.getByTestId("start-export-button").click();

      const pngRow = page
        .getByTestId("exports-history-list")
        .locator('[data-export-format="png_long"]')
        .first();
      await expect(pngRow).toHaveAttribute("data-export-status", "completed", {
        timeout: 40_000,
      });

      const pngHref = await pngRow.locator("a[download]").getAttribute("href");
      expect(pngHref).toBeTruthy();
      const pngRes = await page.request.get(pngHref!);
      expect(pngRes.status()).toBe(200);
      const pngBytes = await pngRes.body();
      expect(Array.from(pngBytes.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);

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
            rmSync(resolve(process.cwd(), ".data/uploads", row.r2Key), { force: true });
          }
        }
        await db.delete(projects).where(eq(projects.id, createdProjectId));
      }

      for (const coverUrl of uploadedCoverUrls) {
        const fileName = coverUrl.replace("/cdn/covers/", "");
        if (fileName) {
          rmSync(resolve(process.cwd(), ".data/uploads/templates/covers", fileName), {
            force: true,
          });
        }
      }

      if (createdTemplateId) {
        await db
          .update(templates)
          .set({ currentVersionId: null })
          .where(eq(templates.id, createdTemplateId));
        await db.delete(templates).where(eq(templates.id, createdTemplateId));
      }

      if (testerUserId) {
        await db.delete(users).where(eq(users.id, testerUserId));
      }
      if (adminUserId) {
        await db.delete(auditLogs).where(eq(auditLogs.actorId, adminUserId));
        await db.delete(users).where(eq(users.id, adminUserId));
      }
      await db.delete(verifications).where(like(verifications.identifier, `%${adminEmail}%`));
      await db.delete(verifications).where(like(verifications.identifier, `%${testerEmail}%`));
      await pool.end();
    }
  });
});
