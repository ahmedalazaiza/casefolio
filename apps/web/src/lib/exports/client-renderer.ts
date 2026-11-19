import type { ExportFormatOption, ExportHistoryItem } from "@/lib/exports/types";

const DIRECT_POST_FALLBACK_MAX_BYTES = 4 * 1024 * 1024; // 4 MiB (below Vercel 4.5 MB request cap)

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function computeCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.byteLength; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concatUint8Arrays(chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/**
 * Pure browser-safe PKZIP (`STORE` method 0) builder for Behance 1400px PNG slices.
 */
export function buildBrowserZipArchive(
  entries: ReadonlyArray<{ name: string; data: Uint8Array }>,
): Uint8Array {
  const encoder = new TextEncoder();
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name.replace(/^\/+/, ""));
    const checksum = computeCrc32(entry.data);
    const size = entry.data.byteLength;

    const localHeader = new Uint8Array(30 + nameBytes.byteLength);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, size, true);
    localView.setUint32(22, size, true);
    localView.setUint16(26, nameBytes.byteLength, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localChunks.push(localHeader, entry.data);

    const centralHeader = new Uint8Array(46 + nameBytes.byteLength);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, size, true);
    centralView.setUint32(24, size, true);
    centralView.setUint16(28, nameBytes.byteLength, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, localOffset, true);
    centralHeader.set(nameBytes, 46);

    centralChunks.push(centralHeader);
    localOffset += localHeader.byteLength + size;
  }

  const centralSize = centralChunks.reduce((sum, c) => sum + c.byteLength, 0);
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(4, 0, true);
  eocdView.setUint16(6, 0, true);
  eocdView.setUint16(8, entries.length, true);
  eocdView.setUint16(10, entries.length, true);
  eocdView.setUint32(12, centralSize, true);
  eocdView.setUint32(16, localOffset, true);
  eocdView.setUint16(20, 0, true);

  return concatUint8Arrays([...localChunks, ...centralChunks, eocd]);
}

export interface PdfJpegPageInput {
  jpegBytes: Uint8Array;
  pixelWidth: number;
  pixelHeight: number;
  pageWidthPt: number;
  pageHeightPt: number;
}

export interface PdfDocumentMetadataOptions {
  title?: string;
  whiteLabel?: boolean;
}

function escapePdfLiteralString(raw: string): string {
  return raw
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

/**
 * Builds a standards-compliant PDF 1.4 document embedding high-DPI JPEG page slices (`/DCTDecode`).
 * When `options.whiteLabel` is `true`, omits Casefolio Creator/Producer fields from PDF metadata.
 */
export function buildMultiPageJpegPdf(
  pages: readonly PdfJpegPageInput[],
  options?: PdfDocumentMetadataOptions,
): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0]; // 1-indexed object byte offsets
  let bytePos = 0;

  function pushText(text: string) {
    const encoded = encoder.encode(text);
    chunks.push(encoded);
    bytePos += encoded.byteLength;
  }

  function pushBytes(bytes: Uint8Array) {
    chunks.push(bytes);
    bytePos += bytes.byteLength;
  }

  // Header with binary comment marker per PDF 1.4 spec
  pushText("%PDF-1.4\n");
  pushBytes(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  // Object 1: Catalog, Object 2: Pages
  const pageObjectIds: number[] = [];
  let nextObjId = 3;
  const pageTriples: Array<{
    pageId: number;
    contentId: number;
    imageId: number;
    page: PdfJpegPageInput;
  }> = [];

  for (const page of pages) {
    const pageId = nextObjId++;
    const contentId = nextObjId++;
    const imageId = nextObjId++;
    pageObjectIds.push(pageId);
    pageTriples.push({ pageId, contentId, imageId, page });
  }

  offsets[1] = bytePos;
  pushText("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  offsets[2] = bytePos;
  const kidsRefs = pageObjectIds.map((id) => `${id} 0 R`).join(" ");
  pushText(
    `2 0 obj\n<< /Type /Pages /Count ${pages.length} /Kids [ ${kidsRefs} ] >>\nendobj\n`,
  );

  for (const triple of pageTriples) {
    const { pageId, contentId, imageId, page } = triple;
    const wPt = Number(page.pageWidthPt.toFixed(2));
    const hPt = Number(page.pageHeightPt.toFixed(2));
    const streamCmd = `q\n${wPt} 0 0 ${hPt} 0 0 cm\n/Im1 Do\nQ\n`;
    const streamBytes = encoder.encode(streamCmd);

    offsets[pageId] = bytePos;
    pushText(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [ 0 0 ${wPt} ${hPt} ] /Resources << /XObject << /Im1 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`,
    );

    offsets[contentId] = bytePos;
    pushText(`${contentId} 0 obj\n<< /Length ${streamBytes.byteLength} >>\nstream\n`);
    pushBytes(streamBytes);
    pushText("\nendstream\nendobj\n");

    offsets[imageId] = bytePos;
    pushText(
      `${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${page.pixelWidth} /Height ${page.pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpegBytes.byteLength} >>\nstream\n`,
    );
    pushBytes(page.jpegBytes);
    pushText("\nendstream\nendobj\n");
  }

  let infoObjId: number | null = null;
  if (options && (options.title || options.whiteLabel !== undefined)) {
    infoObjId = nextObjId++;
    offsets[infoObjId] = bytePos;
    const safeTitle = escapePdfLiteralString(options.title?.trim() || "Case Study");
    const infoFields = options.whiteLabel
      ? `/Title (${safeTitle})`
      : `/Title (${safeTitle}) /Creator (Casefolio) /Producer (Casefolio)`;
    pushText(`${infoObjId} 0 obj\n<< ${infoFields} >>\nendobj\n`);
  }

  const totalObjects = nextObjId;
  const xrefStart = bytePos;
  pushText(`xref\n0 ${totalObjects}\n0000000000 65535 f \n`);
  for (let i = 1; i < totalObjects; i++) {
    const padded = String(offsets[i] ?? 0).padStart(10, "0");
    pushText(`${padded} 00000 n \n`);
  }
  const infoRef = infoObjId !== null ? ` /Info ${infoObjId} 0 R` : "";
  pushText(
    `trailer\n<< /Size ${totalObjects} /Root 1 0 R${infoRef} >>\nstartxref\n${xrefStart}\n%%EOF\n`,
  );

  return concatUint8Arrays(chunks);
}

async function canvasToBytes(
  canvas: HTMLCanvasElement,
  mimeType: "image/png" | "image/jpeg",
  quality?: number,
): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result);
          else reject(new Error("Canvas encoding failed."));
        },
        mimeType,
        quality,
      );
    } catch (err) {
      reject(err instanceof Error ? err : new Error("Canvas export blocked by cross-origin asset."));
    }
  });
  return new Uint8Array(await blob.arrayBuffer());
}

function sliceCanvasVertically(
  source: HTMLCanvasElement,
  sliceHeightPx: number,
  fillBackground = "#ffffff",
): HTMLCanvasElement[] {
  const slices: HTMLCanvasElement[] = [];
  const totalHeight = Math.max(1, source.height);
  const width = Math.max(1, source.width);

  for (let y = 0; y < totalHeight; y += sliceHeightPx) {
    const remaining = Math.min(sliceHeightPx, totalHeight - y);
    const slice = document.createElement("canvas");
    slice.width = width;
    slice.height = remaining;
    const ctx = slice.getContext("2d");
    if (ctx) {
      ctx.fillStyle = fillBackground;
      ctx.fillRect(0, 0, width, remaining);
      ctx.drawImage(source, 0, y, width, remaining, 0, 0, width, remaining);
    }
    slices.push(slice);
  }
  return slices;
}

function isCrossOriginHttpAsset(rawSrc: string): boolean {
  if (!rawSrc || rawSrc.startsWith("data:") || rawSrc.startsWith("blob:")) {
    return false;
  }
  try {
    const parsed = new URL(rawSrc, window.location.origin);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.origin !== window.location.origin
    );
  } catch {
    return false;
  }
}

async function prepareIframeImagesForCanvasCapture(iframeDoc: Document): Promise<void> {
  const images = Array.from(iframeDoc.images);
  await Promise.all(
    images.map((img) => {
      img.loading = "eager";
      img.decoding = "sync";

      const currentSrc = img.getAttribute("src") ?? img.src;
      if (isCrossOriginHttpAsset(currentSrc) && !img.crossOrigin) {
        img.crossOrigin = "anonymous";
        if (img.complete && img.naturalWidth > 0) {
          const reloadSrc = img.src;
          img.src = reloadSrc;
        }
      }

      if (img.complete) {
        return Promise.resolve();
      }

      return new Promise<void>((resolve) => {
        const timer = window.setTimeout(() => resolve(), 6_000);
        const finish = () => {
          window.clearTimeout(timer);
          resolve();
        };
        img.addEventListener("load", finish, { once: true });
        img.addEventListener("error", finish, { once: true });
      });
    }),
  );
}

async function encodeRenderedCanvasArtifact(
  capturedCanvas: HTMLCanvasElement,
  format: ExportFormatOption,
  preferredScale: number,
  computedBg: string,
  projectTitle: string,
  whiteLabel: boolean,
): Promise<{
  payloadBytes: Uint8Array;
  contentType: "image/png" | "application/pdf" | "application/zip";
}> {
  if (format === "png_long") {
    const payloadBytes = await canvasToBytes(capturedCanvas, "image/png");
    return { payloadBytes, contentType: "image/png" };
  }

  if (format === "behance") {
    const sliceHeight = Math.round(1960 * preferredScale);
    const slices = sliceCanvasVertically(capturedCanvas, sliceHeight, computedBg);
    const entries: Array<{ name: string; data: Uint8Array }> = [];
    for (let idx = 0; idx < slices.length; idx++) {
      const sliceBytes = await canvasToBytes(slices[idx]!, "image/png");
      const paddedIdx = String(idx + 1).padStart(2, "0");
      entries.push({
        name: `${paddedIdx}-behance-1400px.png`,
        data: sliceBytes,
      });
    }
    return {
      payloadBytes: buildBrowserZipArchive(entries),
      contentType: "application/zip",
    };
  }

  const pageSliceHeightPx = Math.round(1920 * preferredScale);
  const slices = sliceCanvasVertically(capturedCanvas, pageSliceHeightPx, computedBg);
  const pdfPages: PdfJpegPageInput[] = [];
  for (const slice of slices) {
    const jpegBytes = await canvasToBytes(slice, "image/jpeg", 0.92);
    const pageWidthPt = 1080;
    const pageHeightPt = Math.max(200, (slice.height / slice.width) * pageWidthPt);
    pdfPages.push({
      jpegBytes,
      pixelWidth: slice.width,
      pixelHeight: slice.height,
      pageWidthPt,
      pageHeightPt,
    });
  }
  return {
    payloadBytes: buildMultiPageJpegPdf(pdfPages, {
      title: projectTitle,
      whiteLabel,
    }),
    contentType: "application/pdf",
  };
}

interface PresignCompleteApiResponse {
  ok: boolean;
  code?: string;
  error?: string;
  mode?: "r2" | "direct" | "already_completed";
  uploadUrl?: string;
  r2Key?: string;
  uploadHeaders?: Record<string, string>;
  exportJob?: ExportHistoryItem;
}

interface FinalizeCompleteApiResponse {
  ok: boolean;
  code?: string;
  error?: string;
  exportJob?: ExportHistoryItem;
}

async function uploadCompletedExportBytes(
  exportId: string,
  payloadBytes: Uint8Array,
  contentType: "image/png" | "application/pdf" | "application/zip",
): Promise<
  | { status: "completed"; exportJob: ExportHistoryItem }
  | { status: "deferred_to_worker" }
  | { status: "failed"; error: string }
> {
  const endpoint = `/api/exports/${encodeURIComponent(exportId)}/complete`;
  const bodyBuffer = payloadBytes.buffer.slice(
    payloadBytes.byteOffset,
    payloadBytes.byteOffset + payloadBytes.byteLength,
  ) as ArrayBuffer;

  const presignRes = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "presign",
      contentType,
      byteLength: payloadBytes.byteLength,
    }),
  });

  if (presignRes.status === 409) {
    return { status: "deferred_to_worker" };
  }

  if (presignRes.ok) {
    const presignJson = (await presignRes.json()) as PresignCompleteApiResponse;
    if (presignJson.ok && presignJson.mode === "already_completed" && presignJson.exportJob) {
      return { status: "completed", exportJob: presignJson.exportJob };
    }

    if (
      presignJson.ok &&
      presignJson.mode === "r2" &&
      presignJson.uploadUrl &&
      presignJson.r2Key
    ) {
      let directPutSucceeded: boolean;
      try {
        const putRes = await fetch(presignJson.uploadUrl, {
          method: "PUT",
          headers: presignJson.uploadHeaders ?? { "Content-Type": contentType },
          body: bodyBuffer,
        });
        directPutSucceeded = putRes.ok;
      } catch {
        directPutSucceeded = false;
      }

      if (directPutSucceeded) {
        const finalizeRes = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "finalize",
            r2Key: presignJson.r2Key,
            contentType,
            byteLength: payloadBytes.byteLength,
          }),
        });

        if (finalizeRes.status === 409) {
          return { status: "deferred_to_worker" };
        }

        const finalizeJson = (await finalizeRes.json().catch(() => null)) as
          | FinalizeCompleteApiResponse
          | null;

        if (finalizeRes.ok && finalizeJson?.ok && finalizeJson.exportJob) {
          return { status: "completed", exportJob: finalizeJson.exportJob };
        }

        return {
          status: "failed",
          error: finalizeJson?.error ?? "Unable to finalize uploaded export file.",
        };
      }

      if (payloadBytes.byteLength > DIRECT_POST_FALLBACK_MAX_BYTES) {
        return {
          status: "failed",
          error:
            "Direct cloud storage upload failed for this high-resolution export. Try 1× scale or check R2 CORS configuration.",
        };
      }
    }
  } else if (payloadBytes.byteLength > DIRECT_POST_FALLBACK_MAX_BYTES) {
    const errJson = (await presignRes.json().catch(() => null)) as
      | PresignCompleteApiResponse
      | null;
    return {
      status: "failed",
      error: errJson?.error ?? "Export file exceeds direct serverless upload size limit.",
    };
  }

  // Direct binary POST (local storage mode OR <= 4 MiB fallback when direct R2 PUT is blocked)
  const directRes = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
    },
    body: bodyBuffer,
  });

  if (directRes.status === 409) {
    return { status: "deferred_to_worker" };
  }

  const directJson = (await directRes.json().catch(() => null)) as
    | FinalizeCompleteApiResponse
    | null;

  if (directRes.ok && directJson?.ok && directJson.exportJob) {
    return { status: "completed", exportJob: directJson.exportJob };
  }

  return {
    status: "failed",
    error: directJson?.error ?? `Export upload failed (HTTP ${directRes.status}).`,
  };
}

async function notifyServerExportRenderFailure(
  exportId: string,
  reason: string,
): Promise<ExportHistoryItem | undefined> {
  try {
    const res = await fetch(`/api/exports/${encodeURIComponent(exportId)}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "fail",
        error: reason.slice(0, 400),
      }),
    });
    if (!res.ok) return undefined;
    const json = (await res.json()) as FinalizeCompleteApiResponse;
    return json.exportJob;
  } catch {
    return undefined;
  }
}

export function triggerExportFileDownload(downloadUrl: string): void {
  if (typeof window === "undefined" || typeof document === "undefined" || !downloadUrl) {
    return;
  }
  if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent)) {
    return;
  }
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = "";
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    link.remove();
  }, 1_000);
}

export type BrowserAssistedExportOutcome =
  | { status: "completed"; exportJob: ExportHistoryItem }
  | { status: "skipped" | "deferred_to_worker" }
  | { status: "failed"; error: string; exportJob?: ExportHistoryItem };

const inFlightClientExportIds = new Set<string>();

/**
 * Renders `/export/<jobId>?token=...` inside a hidden same-origin iframe, captures high-DPI
 * PNG / PDF / Behance ZIP, and uploads via presigned R2 PUT (or direct fallback) with structured
 * error diagnostics so exports never hang silently on Queued.
 */
export async function runBrowserAssistedExportDetailed(
  job: ExportHistoryItem,
): Promise<BrowserAssistedExportOutcome> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { status: "skipped" };
  }
  if (!job.renderUrl || job.status !== "queued") {
    return { status: "skipped" };
  }
  if (inFlightClientExportIds.has(job.id)) {
    return { status: "skipped" };
  }

  inFlightClientExportIds.add(job.id);
  const viewportWidth = job.format === "behance" ? 1400 : 1440;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.tabIndex = -1;
  Object.assign(iframe.style, {
    position: "fixed",
    left: "-99999px",
    top: "0px",
    width: `${viewportWidth}px`,
    height: "1200px",
    border: "0",
    opacity: "0",
    pointerEvents: "none",
  });

  document.body.appendChild(iframe);

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        reject(new Error("Timed out loading the case study render frame."));
      }, 20_000);

      iframe.onload = () => {
        window.clearTimeout(timeout);
        resolve();
      };
      iframe.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error("Failed to load the case study render frame."));
      };
      iframe.src = job.renderUrl!;
    });

    let iframeDoc: Document | null = null;
    try {
      iframeDoc = iframe.contentDocument;
    } catch {
      iframeDoc = null;
    }

    if (!iframeDoc) {
      throw new Error(
        "Export render frame was blocked or returned an invalid page. Refresh and try exporting again.",
      );
    }

    // Wait up to 10s for `[data-testid="export-render-ready"]`
    let readyRoot = iframeDoc.querySelector(
      '[data-testid="export-render-ready"]',
    ) as HTMLElement | null;
    const deadline = Date.now() + 10_000;
    while (!readyRoot && Date.now() < deadline) {
      await new Promise((r) => window.setTimeout(r, 100));
      readyRoot = iframeDoc.querySelector(
        '[data-testid="export-render-ready"]',
      ) as HTMLElement | null;
    }

    if (!readyRoot) {
      throw new Error("Case study export view did not finish initializing.");
    }

    const initialHeight = Math.max(
      readyRoot.scrollHeight,
      iframeDoc.documentElement.scrollHeight,
      900,
    );
    iframe.style.height = `${initialHeight}px`;

    if (iframeDoc.fonts?.ready) {
      await iframeDoc.fonts.ready.catch(() => undefined);
    }

    await prepareIframeImagesForCanvasCapture(iframeDoc);

    const fullHeight = Math.max(
      readyRoot.scrollHeight,
      iframeDoc.documentElement.scrollHeight,
      900,
    );
    iframe.style.height = `${fullHeight}px`;
    await new Promise((r) => window.setTimeout(r, 120));

    const { domToCanvas } = await import("modern-screenshot");
    const ownerPlan = readyRoot.dataset.ownerPlan ?? "free";
    const whiteLabel = readyRoot.dataset.whiteLabel === "true";
    const projectTitle = readyRoot.dataset.projectTitle?.trim() || "Case Study";
    const preferredScale =
      ownerPlan === "free" ? 1 : job.scale === 1 ? 1 : fullHeight * 2 <= 16_000 ? 2 : 1;

    const computedBg =
      iframe.contentWindow?.getComputedStyle(readyRoot).backgroundColor || "#09090b";

    const attachCrossOriginOnClone = (cloned: Node) => {
      if (cloned instanceof HTMLImageElement) {
        const src = cloned.getAttribute("src") ?? cloned.src;
        if (isCrossOriginHttpAsset(src)) {
          cloned.crossOrigin = "anonymous";
        }
      }
    };

    let artifact: {
      payloadBytes: Uint8Array;
      contentType: "image/png" | "application/pdf" | "application/zip";
    };

    try {
      const capturedCanvas = await domToCanvas(readyRoot, {
        scale: preferredScale,
        width: viewportWidth,
        height: fullHeight,
        timeout: 20_000,
        onCloneEachNode: attachCrossOriginOnClone,
      });

      artifact = await encodeRenderedCanvasArtifact(
        capturedCanvas,
        job.format,
        preferredScale,
        computedBg,
        projectTitle,
        whiteLabel,
      );
    } catch {
      // Graceful tainted-canvas fallback: filter out uncorsed third-party images if canvas readback failed
      const safeCanvas = await domToCanvas(readyRoot, {
        scale: preferredScale,
        width: viewportWidth,
        height: fullHeight,
        timeout: 20_000,
        filter: (node) => {
          if (node instanceof HTMLImageElement) {
            const src = node.getAttribute("src") ?? node.src;
            if (isCrossOriginHttpAsset(src)) {
              return false;
            }
          }
          return true;
        },
      });

      artifact = await encodeRenderedCanvasArtifact(
        safeCanvas,
        job.format,
        preferredScale,
        computedBg,
        projectTitle,
        whiteLabel,
      );
    }

    const uploadOutcome = await uploadCompletedExportBytes(
      job.id,
      artifact.payloadBytes,
      artifact.contentType,
    );

    if (uploadOutcome.status === "completed") {
      return uploadOutcome;
    }

    if (uploadOutcome.status === "deferred_to_worker") {
      return { status: "deferred_to_worker" };
    }

    const failedJob = await notifyServerExportRenderFailure(job.id, uploadOutcome.error);
    return {
      status: "failed",
      error: uploadOutcome.error,
      exportJob: failedJob,
    };
  } catch (err) {
    const message =
      err instanceof Error && err.message
        ? err.message
        : "Unable to render export in your browser. Please try again.";
    const failedJob = await notifyServerExportRenderFailure(job.id, message);
    return {
      status: "failed",
      error: message,
      exportJob: failedJob,
    };
  } finally {
    inFlightClientExportIds.delete(job.id);
    iframe.remove();
  }
}

export async function runBrowserAssistedExport(
  job: ExportHistoryItem,
): Promise<ExportHistoryItem | null> {
  const outcome = await runBrowserAssistedExportDetailed(job);
  return outcome.status === "completed" ? outcome.exportJob : null;
}
