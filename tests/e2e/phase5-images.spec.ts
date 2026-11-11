import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { deflateSync } from "node:zlib";
import { expect, test } from "@playwright/test";
import {
  assets,
  createDbConnection,
  eq,
  projects,
  templates,
  templateVersions,
  users,
} from "../../packages/db/src/index";

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

/**
 * Generates a valid, visually rich gradient RGB PNG buffer in pure Node.js
 * so Chromium decodes and paints a crisp mobile mockup screenshot without external fixtures.
 */
function generateGradientMockupPng(width: number, height: number): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 2; // RGB truecolor
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Each scanline has 1 filter byte (0 = None) + width * 3 RGB bytes
  const rowStride = 1 + width * 3;
  const rawScanlines = Buffer.alloc(rowStride * height);

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * rowStride;
    rawScanlines[rowOffset] = 0; // Filter: None
    const vNorm = y / Math.max(1, height - 1);

    for (let x = 0; x < width; x += 1) {
      const hNorm = x / Math.max(1, width - 1);
      // Indigo -> teal fintech card gradient with an inner card highlight band
      const inCard = x > width * 0.12 && x < width * 0.88 && y > height * 0.18 && y < height * 0.46;
      const r = inCard
        ? Math.round(235 - hNorm * 35)
        : Math.round(72 + (1 - vNorm) * 65 + hNorm * 30);
      const g = inCard
        ? Math.round(240 - vNorm * 20)
        : Math.round(58 + vNorm * 130);
      const b = inCard ? 255 : Math.round(215 - vNorm * 30);

      const px = rowOffset + 1 + x * 3;
      rawScanlines[px] = r;
      rawScanlines[px + 1] = g;
      rawScanlines[px + 2] = b;
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

test("Phase 5 E2E: upload image into hero.mockup, verify locked 9:19.5 crop, CDN URL + srcset delivery, private-until-published 403 gate, and reload persistence", async ({
  page,
  browser,
}) => {
  const databaseUrl = process.env.DATABASE_URL ?? "postgresql://localhost:5433/casefolio";
  const { db, pool } = createDbConnection(databaseUrl);

  const stamp = Date.now();
  const userEmail = `e2e-designer-p5-${stamp}@casefolio.test`;
  const password = "CasefolioDesigner2026!";
  let createdUserId: string | null = null;
  let createdProjectId: string | null = null;
  const pageErrors: string[] = [];

  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });

  try {
    // Ensure Orbit v1.0.0 exists in DB
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

    // 1. Sign up & sign in
    await page.goto("/sign-up");
    await page.getByLabel("Full name").fill("Noor Media Designer");
    await page.getByLabel("Email").fill(userEmail);
    await page.getByLabel("Password").fill(password);
    await page.locator('input[name="acceptTerms"]').check();
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/verify/);

    const [updatedUser] = await db
      .update(users)
      .set({
        emailVerified: true,
        designFocus: "mobile",
        onboardingCompletedAt: new Date(),
      })
      .where(eq(users.email, userEmail))
      .returning({ id: users.id });
    createdUserId = updatedUser?.id ?? null;

    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(userEmail);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // 2. Create Mobile project from Orbit
    await page.goto("/new");
    await page.getByRole("radio", { name: /Mobile app/i }).click();
    await page.getByTestId("wizard-next-to-template").click();

    const orbitWizardCard = page.locator(
      '[data-slot="wizard-template-card"][data-template-slug="orbit"]',
    );
    await expect(orbitWizardCard).toBeVisible();
    await orbitWizardCard.getByRole("button", { name: /Select|Selected/i }).click();
    await page.getByTestId("wizard-next-to-details").click();

    await page.getByLabel("Project name *").fill("Orbit — Mobile Wallet Case Study");
    await page.getByTestId("wizard-submit-create").click();
    await expect(page).toHaveURL(/\/editor\/([0-9a-f-]+)/);

    const match = page.url().match(/\/editor\/([0-9a-f-]+)/);
    createdProjectId = match?.[1] ?? null;

    // 3. Verify unsupported file rejection on hero.mockup (Figma 2:6162)
    const desktopRightPanel = page.locator('[data-slot="editor-right-panel"]');
    const heroMockupField = desktopRightPanel.getByTestId("image-slot-field-hero.mockup");
    await expect(heroMockupField).toBeVisible();
    await expect(heroMockupField).toHaveAttribute("data-slot-ratio", "9:19.5");

    const fileInput = heroMockupField.getByTestId("slot-file-input-hero.mockup");
    await fileInput.setInputFiles({
      name: "settings.heic",
      mimeType: "image/heic",
      buffer: Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]),
    });

    await expect(heroMockupField.getByTestId("slot-error-hero.mockup")).toContainText(
      '"settings.heic" isn\'t a supported file type',
    );

    // 4. Upload valid 720x1300 PNG into hero.mockup -> verify locked 9:19.5 crop modal opens
    const pngBuffer = generateGradientMockupPng(720, 1300);
    await fileInput.setInputFiles({
      name: "orbit-home-screen.png",
      mimeType: "image/png",
      buffer: pngBuffer,
    });

    const cropDialog = page.getByTestId("image-slot-crop-dialog");
    await expect(cropDialog).toBeVisible();
    await expect(cropDialog).toHaveAttribute("data-locked-ratio", "9:19.5");
    expect(Number(await cropDialog.getAttribute("data-locked-aspect"))).toBeCloseTo(9 / 19.5, 5);
    await expect(cropDialog.getByText(/Locked ratio · 9:19\.5/)).toBeVisible();

    // Wait briefly for react-easy-crop image inside modal to paint, then capture crop modal screenshot
    await page.waitForTimeout(250);
    await maybeSaveScreenshot(page, "editor-upload-crop-1440.png");

    const appliedCropJson = await cropDialog.getAttribute("data-crop-rect");
    expect(appliedCropJson).toBeTruthy();
    const appliedCrop = JSON.parse(appliedCropJson!);
    expect(appliedCrop.width / appliedCrop.height).toBeCloseTo(9 / 19.5, 2);

    await page.getByTestId("crop-dialog-apply").click();
    await expect(cropDialog).toHaveCount(0);

    // Wait for debounced autosave to persist puckData + crop to PostgreSQL
    await expect(page.getByTestId("editor-save-indicator")).toHaveAttribute(
      "data-save-status",
      "saved",
      { timeout: 10000 },
    );

    // 5. Verify hero.mockup on live preview canvas is locked to 9:19.5 and served from CDN URL with srcset
    const canvasViewport = page
      .getByTestId("editor-canvas-preview")
      .locator('[data-slot="image-slot-viewport"][data-slot-key="hero.mockup"]');
    await expect(canvasViewport).toBeVisible();
    await expect(canvasViewport).toHaveAttribute("data-ratio", "9:19.5");
    await expect(canvasViewport).toHaveAttribute("data-cropped", "true");

    const canvasImg = canvasViewport.locator("img");
    await expect(canvasImg).toBeVisible();

    const imgSrc = await canvasImg.getAttribute("src");
    const imgSrcSet = await canvasImg.getAttribute("srcset");
    expect(imgSrc).toBeTruthy();
    expect(imgSrc).toContain("/cdn/images/");
    expect(imgSrcSet).toBeTruthy();
    expect(imgSrcSet).toContain("/cdn/images/");
    expect(imgSrcSet).toContain("640w");
    expect(imgSrcSet).toContain("1080w");

    // Confirm browser decoded the CDN-delivered PNG cleanly (HTML5 srcset w-descriptors density-scale naturalWidth)
    await expect
      .poll(async () => {
        return await canvasImg.evaluate(
          (el: HTMLImageElement) => el.complete && el.naturalWidth > 0 && el.naturalHeight > 0,
        );
      })
      .toBe(true);

    // 6. Verify C-501 private-until-published: anonymous visitor gets 404 (existence is not revealed, Spec §10.2/§15) on CDN URL while owner gets 200
    const ownerCdnRes = await page.request.get(imgSrc!);
    expect(ownerCdnRes.status()).toBe(200);
    expect(ownerCdnRes.headers()["content-type"]).toBe("image/png");
    expect(ownerCdnRes.headers()["x-casefolio-cdn"]).toBe("cloudflare-images-compat");

    const anonContext = await browser.newContext();
    try {
      const anonRes = await anonContext.request.get(`http://localhost:3000${imgSrc}`);
      expect(anonRes.status()).toBe(404);
    } finally {
      await anonContext.close();
    }

    await maybeSaveScreenshot(page, "editor-hero-mockup-filled-1440.png");

    // 7. Reload page -> confirm uploaded CDN image & crop rect persist and are re-editable
    await page.reload();
    await expect(page.getByTestId("constrained-editor-root")).toBeVisible();

    const reloadedImg = page
      .getByTestId("editor-canvas-preview")
      .locator('[data-slot="image-slot-viewport"][data-slot-key="hero.mockup"] img');
    await expect(reloadedImg).toBeVisible();
    expect(await reloadedImg.getAttribute("src")).toContain("/cdn/images/");

    await desktopRightPanel.getByTestId("slot-crop-btn-hero.mockup").click();
    const reopenedDialog = page.getByTestId("image-slot-crop-dialog");
    await expect(reopenedDialog).toBeVisible();
    const restoredCrop = JSON.parse((await reopenedDialog.getAttribute("data-crop-rect")) || "{}");
    expect(restoredCrop).toEqual(appliedCrop);
    await page.getByTestId("crop-dialog-cancel").click();

    // 8. Verify 375px mobile viewport rendering with filled hero.mockup
    await page.setViewportSize({ width: 375, height: 812 });
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
    await maybeSaveScreenshot(page, "editor-hero-mockup-mobile-375.png");

    expect(pageErrors).toEqual([]);
  } finally {
    if (createdProjectId) {
      const projectAssets = await db
        .select({ r2Key: assets.r2Key })
        .from(assets)
        .where(eq(assets.projectId, createdProjectId));
      for (const a of projectAssets) {
        try {
          rmSync(resolve(process.cwd(), ".data/uploads", a.r2Key), { force: true });
        } catch {
          // Ignore cleanup errors
        }
      }
    }
    if (createdUserId) {
      await db.delete(projects).where(eq(projects.ownerId, createdUserId));
      await db.delete(users).where(eq(users.id, createdUserId));
    }
    await pool.end();
  }
});

