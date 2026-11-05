import { chromium, type Browser } from "playwright";
import { buildZipArchive } from "./zip";

export type ExportFormat = "png_long" | "pdf" | "behance";

export const EXPORT_DESKTOP_WIDTH = 1440;
export const BEHANCE_SLICE_WIDTH = 1400;
export const BEHANCE_MAX_SLICE_HEIGHT = 1960;

export interface RenderExportInput {
  exportId: string;
  projectId: string;
  format: ExportFormat;
  appUrl: string;
  renderToken: string;
}

export interface RenderedExportArtifact {
  bytes: Uint8Array;
  contentType: "image/png" | "application/pdf" | "application/zip";
  extension: "png" | "pdf" | "zip";
  sliceCount: number;
  computedHeadingFont: string;
}

let sharedBrowserPromise: Promise<Browser> | null = null;

async function getSharedChromiumBrowser(): Promise<Browser> {
  if (!sharedBrowserPromise) {
    sharedBrowserPromise = chromium
      .launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none"],
      })
      .catch((err) => {
        sharedBrowserPromise = null;
        throw err;
      });
  }

  const browser = await sharedBrowserPromise;
  if (!browser.isConnected()) {
    sharedBrowserPromise = null;
    return getSharedChromiumBrowser();
  }
  return browser;
}

export async function closeSharedExportBrowser(): Promise<void> {
  if (!sharedBrowserPromise) return;
  const current = sharedBrowserPromise;
  sharedBrowserPromise = null;
  try {
    const browser = await current;
    await browser.close();
  } catch {
    // Ignore close errors on shutdown
  }
}

export function computeBehanceSliceRanges(
  totalHeight: number,
  maxSliceHeight = BEHANCE_MAX_SLICE_HEIGHT,
): Array<{ y: number; height: number }> {
  const safeTotal = Math.max(1, Math.ceil(totalHeight));
  const slices: Array<{ y: number; height: number }> = [];

  for (let y = 0; y < safeTotal; y += maxSliceHeight) {
    const height = Math.max(1, Math.min(maxSliceHeight, safeTotal - y));
    slices.push({ y, height });
  }

  return slices;
}

export async function renderExportWithPlaywright(
  input: RenderExportInput,
): Promise<RenderedExportArtifact> {
  const browser = await getSharedChromiumBrowser();
  const cleanAppUrl = input.appUrl.replace(/\/+$/, "");
  const targetUrl = `${cleanAppUrl}/export/${encodeURIComponent(input.exportId)}?token=${encodeURIComponent(input.renderToken)}`;

  const viewportWidth =
    input.format === "behance" ? BEHANCE_SLICE_WIDTH : EXPORT_DESKTOP_WIDTH;
  const viewportHeight =
    input.format === "behance" ? BEHANCE_MAX_SLICE_HEIGHT : 960;
  const deviceScaleFactor = input.format === "png_long" ? 2 : 1;

  const context = await browser.newContext({
    viewport: { width: viewportWidth, height: viewportHeight },
    deviceScaleFactor,
    extraHTTPHeaders: {
      "x-casefolio-export-token": input.renderToken,
    },
  });

  try {
    const page = await context.newPage();
    const response = await page.goto(targetUrl, {
      waitUntil: "networkidle",
      timeout: 45_000,
    });

    if (!response || response.status() >= 400) {
      throw new Error(
        `Export render route returned HTTP ${response?.status() ?? "NO_RESPONSE"}.`,
      );
    }

    await page.locator('[data-testid="export-render-ready"]').waitFor({
      state: "visible",
      timeout: 15_000,
    });

    // Force eager loading on all images, scroll full page to trigger responsive srcset fetches,
    // wait for web fonts (`document.fonts.ready`) and full image decode, then return to top.
    const computedHeadingFont = await page.evaluate(async () => {
      const images = Array.from(document.querySelectorAll("img"));
      for (const img of images) {
        img.loading = "eager";
      }

      const maxScroll = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
      );
      for (let pos = 0; pos <= maxScroll; pos += 640) {
        window.scrollTo(0, pos);
        await new Promise((r) => setTimeout(r, 15));
      }
      window.scrollTo(0, 0);

      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      await Promise.all(
        Array.from(document.querySelectorAll("img")).map(async (img) => {
          if (!img.complete) {
            await new Promise<void>((resolve) => {
              img.addEventListener("load", () => resolve(), { once: true });
              img.addEventListener("error", () => resolve(), { once: true });
            });
          }
          if (typeof img.decode === "function") {
            try {
              await img.decode();
            } catch {
              // Ignore decode warnings on broken external URLs
            }
          }
        }),
      );

      const heading =
        document.querySelector('[data-section-type="Hero"] h1') ??
        document.querySelector("h1, h2");
      return heading ? window.getComputedStyle(heading).fontFamily : "";
    });

    if (input.format === "png_long") {
      const pngBuffer = await page.screenshot({
        fullPage: true,
        type: "png",
      });
      return {
        bytes: new Uint8Array(pngBuffer.buffer, pngBuffer.byteOffset, pngBuffer.byteLength),
        contentType: "image/png",
        extension: "png",
        sliceCount: 1,
        computedHeadingFont,
      };
    }

    if (input.format === "pdf") {
      await page.emulateMedia({ media: "screen" });
      const pdfBuffer = await page.pdf({
        width: `${EXPORT_DESKTOP_WIDTH}px`,
        printBackground: true,
        preferCSSPageSize: false,
      });
      return {
        bytes: new Uint8Array(pdfBuffer.buffer, pdfBuffer.byteOffset, pdfBuffer.byteLength),
        contentType: "application/pdf",
        extension: "pdf",
        sliceCount: 1,
        computedHeadingFont,
      };
    }

    // Behance 1400px vertical slices bundled into .zip
    const totalHeight = await page.evaluate(() =>
      Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, 1),
    );
    const sliceRanges = computeBehanceSliceRanges(totalHeight, BEHANCE_MAX_SLICE_HEIGHT);
    const entries: Array<{ name: string; data: Uint8Array }> = [];

    for (let idx = 0; idx < sliceRanges.length; idx++) {
      const slice = sliceRanges[idx]!;
      const sliceBuffer = await page.screenshot({
        type: "png",
        clip: {
          x: 0,
          y: slice.y,
          width: BEHANCE_SLICE_WIDTH,
          height: slice.height,
        },
      });
      const paddedIndex = String(idx + 1).padStart(2, "0");
      entries.push({
        name: `behance-slice-${paddedIndex}.png`,
        data: new Uint8Array(sliceBuffer.buffer, sliceBuffer.byteOffset, sliceBuffer.byteLength),
      });
    }

    const zipBytes = buildZipArchive(entries);
    return {
      bytes: zipBytes,
      contentType: "application/zip",
      extension: "zip",
      sliceCount: entries.length,
      computedHeadingFont,
    };
  } finally {
    await context.close();
  }
}

