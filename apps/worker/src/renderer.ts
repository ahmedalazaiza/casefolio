import { chromium, type Browser } from "playwright";
import { buildZipArchive } from "./zip";

export type ExportFormat = "png_long" | "pdf" | "behance";

export const EXPORT_DESKTOP_WIDTH = 1440;
export const BEHANCE_SLICE_WIDTH = 1400;
export const BEHANCE_MAX_SLICE_HEIGHT = 1960;
export const FREE_MAX_EXPORT_MEGAPIXELS = 40;
export const PAID_MAX_EXPORT_MEGAPIXELS = 120;
export const MAX_PDF_EXPORT_PAGES = 60;

export interface RenderExportInput {
  exportId: string;
  projectId: string;
  format: ExportFormat;
  appUrl: string;
  renderToken: string;
  scale?: 1 | 2;
  maxMegapixels?: number;
  maxPdfPages?: number;
  timeoutMs?: number;
}

export interface RenderedExportArtifact {
  bytes: Uint8Array;
  contentType: "image/png" | "application/pdf" | "application/zip";
  extension: "png" | "pdf" | "zip";
  sliceCount: number;
  computedHeadingFont: string;
}

const ALLOWED_RASTER_DATA_PREFIXES = [
  "data:image/png;",
  "data:image/jpeg;",
  "data:image/jpg;",
  "data:image/webp;",
] as const;

const BLOCKED_INTERNAL_HOSTS = new Set([
  "169.254.169.254",
  "metadata.google.internal",
  "metadata.goog",
  "[fd00:ec2::254]",
]);

function isPrivateOrMetadataHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (BLOCKED_INTERNAL_HOSTS.has(lower)) {
    return true;
  }
  if (
    lower === "localhost" ||
    lower === "0.0.0.0" ||
    lower === "[::1]" ||
    lower === "::1" ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal")
  ) {
    return true;
  }
  // IPv4 private / loopback / link-local ranges
  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(lower);
  if (ipv4Match) {
    const a = Number(ipv4Match[1]);
    const b = Number(ipv4Match[2]);
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  return false;
}

/**
 * SSRF & arbitrary URL fetch defense for Playwright export rendering (`Spec §5.6 & §10.7`).
 * Allows ONLY:
 * 1. Exact `allowedOrigin` (`http(s)://host:port` of the Casefolio web app)
 * 2. First-party static asset CDN (`https://cdn.casefolio.app`)
 * 3. Non-SVG raster `data:image/(png|jpeg|webp);...` URIs
 * Blocks all arbitrary external hosts, `data:image/svg+xml`, `data:text/html`, `file:`, and internal/metadata IPs.
 */
export function isAllowedExportWorkerRequestUrl(
  requestUrl: string,
  allowedOrigin: string,
): boolean {
  const trimmed = requestUrl.trim();
  if (!trimmed) return false;

  const lower = trimmed.toLowerCase();
  for (const prefix of ALLOWED_RASTER_DATA_PREFIXES) {
    if (lower.startsWith(prefix)) {
      return true;
    }
  }

  let parsedAllowed: URL;
  let parsedRequest: URL;
  try {
    parsedAllowed = new URL(allowedOrigin);
    parsedRequest = new URL(trimmed);
  } catch {
    return false;
  }

  if (parsedRequest.protocol !== "http:" && parsedRequest.protocol !== "https:") {
    return false;
  }

  // Exact match to the configured Casefolio application origin (supports localhost in dev/test while blocking any other port/host)
  if (parsedRequest.origin === parsedAllowed.origin) {
    const reqHost = parsedRequest.hostname.toLowerCase();
    if (BLOCKED_INTERNAL_HOSTS.has(reqHost)) {
      return false;
    }
    const isExplicitLoopbackAllowed =
      reqHost === "localhost" || reqHost === "127.0.0.1" || reqHost === "[::1]";
    if (!isExplicitLoopbackAllowed && isPrivateOrMetadataHost(reqHost)) {
      return false;
    }
    return true;
  }

  // First-party static template asset host
  if (
    parsedRequest.protocol === "https:" &&
    parsedRequest.hostname.toLowerCase() === "cdn.casefolio.app" &&
    !isPrivateOrMetadataHost(parsedRequest.hostname)
  ) {
    return true;
  }

  return false;
}

export function countPdfPages(pdfBytes: Uint8Array): number {
  const text = new TextDecoder("latin1").decode(pdfBytes);
  const matches = text.match(/\/Type\s*\/Page\b(?!s)/g);
  return matches ? matches.length : 1;
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
  const allowedOrigin = new URL(cleanAppUrl).origin;
  const targetUrl = `${cleanAppUrl}/export/${encodeURIComponent(input.exportId)}?token=${encodeURIComponent(input.renderToken)}`;

  const requestedScale = input.scale === 2 ? 2 : 1;
  const deviceScaleFactor = input.format === "png_long" ? requestedScale : 1;
  const maxMegapixels = input.maxMegapixels ?? PAID_MAX_EXPORT_MEGAPIXELS;
  const maxPdfPages = input.maxPdfPages ?? MAX_PDF_EXPORT_PAGES;
  const timeoutMs = Math.max(10_000, Math.min(input.timeoutMs ?? 60_000, 120_000));

  const viewportWidth =
    input.format === "behance" ? BEHANCE_SLICE_WIDTH : EXPORT_DESKTOP_WIDTH;
  const viewportHeight =
    input.format === "behance" ? BEHANCE_MAX_SLICE_HEIGHT : 960;

  const context = await browser.newContext({
    viewport: { width: viewportWidth, height: viewportHeight },
    deviceScaleFactor,
    extraHTTPHeaders: {
      "x-casefolio-export-token": input.renderToken,
    },
  });

  try {
    const page = await context.newPage();
    page.setDefaultTimeout(timeoutMs);

    // Enforce SSRF & arbitrary URL fetch allowlist on every network request
    await page.route("**/*", async (route) => {
      const reqUrl = route.request().url();
      if (!isAllowedExportWorkerRequestUrl(reqUrl, allowedOrigin)) {
        await route.abort("blockedbyclient");
        return;
      }
      await route.continue();
    });

    const navTimeoutMs = Math.min(45_000, timeoutMs);
    const response = await page.goto(targetUrl, {
      waitUntil: "networkidle",
      timeout: navTimeoutMs,
    });

    if (!response || response.status() >= 400) {
      throw new Error(
        `Export render route returned HTTP ${response?.status() ?? "NO_RESPONSE"}.`,
      );
    }

    await page.locator('[data-testid="export-render-ready"]').waitFor({
      state: "visible",
      timeout: Math.min(15_000, timeoutMs),
    });

    const { computedHeadingFont, totalHeight } = await page.evaluate(async () => {
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
              // Ignore decode warnings on blocked/missing URLs
            }
          }
        }),
      );

      const measuredHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        1,
      );
      const heading =
        document.querySelector('[data-section-type="Hero"] h1') ??
        document.querySelector("h1, h2");
      return {
        computedHeadingFont: heading ? window.getComputedStyle(heading).fontFamily : "",
        totalHeight: measuredHeight,
      };
    });

    const renderedWidthPx = viewportWidth * deviceScaleFactor;
    const renderedHeightPx = totalHeight * deviceScaleFactor;
    const totalMegapixels = (renderedWidthPx * renderedHeightPx) / 1_000_000;
    if (totalMegapixels > maxMegapixels) {
      throw new Error(
        `Export exceeds maximum pixel budget (${totalMegapixels.toFixed(1)} MP > ${maxMegapixels} MP).`,
      );
    }

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
      const pdfBytes = new Uint8Array(
        pdfBuffer.buffer,
        pdfBuffer.byteOffset,
        pdfBuffer.byteLength,
      );
      const pageCount = countPdfPages(pdfBytes);
      if (pageCount > maxPdfPages) {
        throw new Error(
          `PDF export exceeds maximum allowed page count (${pageCount} > ${maxPdfPages} pages).`,
        );
      }
      return {
        bytes: pdfBytes,
        contentType: "application/pdf",
        extension: "pdf",
        sliceCount: pageCount,
        computedHeadingFont,
      };
    }

    // Behance 1400px vertical slices bundled into .zip (`Spec §5.5`: sliced panels rather than giant canvas)
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
