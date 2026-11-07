import type { ExportFormatOption, ExportHistoryItem } from "@/lib/exports/types";

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

/**
 * Builds a standards-compliant PDF 1.4 document embedding high-DPI JPEG page slices (`/DCTDecode`).
 */
export function buildMultiPageJpegPdf(pages: readonly PdfJpegPageInput[]): Uint8Array {
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

  const totalObjects = nextObjId;
  const xrefStart = bytePos;
  pushText(`xref\n0 ${totalObjects}\n0000000000 65535 f \n`);
  for (let i = 1; i < totalObjects; i++) {
    const padded = String(offsets[i] ?? 0).padStart(10, "0");
    pushText(`${padded} 00000 n \n`);
  }
  pushText(
    `trailer\n<< /Size ${totalObjects} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`,
  );

  return concatUint8Arrays(chunks);
}

async function canvasToBytes(
  canvas: HTMLCanvasElement,
  mimeType: "image/png" | "image/jpeg",
  quality?: number,
): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error("Canvas encoding failed."));
      },
      mimeType,
      quality,
    );
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

const inFlightClientExportIds = new Set<string>();

/**
 * Renders `/export/<jobId>?token=...` inside a hidden same-origin iframe and uploads the
 * resulting high-DPI PNG / Behance ZIP / multi-page PDF to `/api/exports/<jobId>/complete`
 * when no external Playwright worker has claimed a queued export job.
 */
export async function runBrowserAssistedExport(
  job: ExportHistoryItem,
): Promise<ExportHistoryItem | null> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }
  if (!job.renderUrl || job.status !== "queued") {
    return null;
  }
  if (inFlightClientExportIds.has(job.id)) {
    return null;
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
        reject(new Error("Timed out loading export render frame."));
      }, 20_000);

      iframe.onload = () => {
        window.clearTimeout(timeout);
        resolve();
      };
      iframe.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error("Failed to load export render frame."));
      };
      iframe.src = job.renderUrl!;
    });

    const iframeDoc = iframe.contentDocument;
    if (!iframeDoc) {
      throw new Error("Export render document unavailable.");
    }

    // Wait up to 8s for `[data-testid="export-render-ready"]`
    let readyRoot = iframeDoc.querySelector('[data-testid="export-render-ready"]') as HTMLElement | null;
    const deadline = Date.now() + 8_000;
    while (!readyRoot && Date.now() < deadline) {
      await new Promise((r) => window.setTimeout(r, 120));
      readyRoot = iframeDoc.querySelector('[data-testid="export-render-ready"]') as HTMLElement | null;
    }

    if (!readyRoot) {
      throw new Error("Export renderer did not become ready.");
    }

    if (iframeDoc.fonts?.ready) {
      await iframeDoc.fonts.ready.catch(() => undefined);
    }

    const images = Array.from(iframeDoc.images);
    await Promise.all(
      images.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise<void>((res) => {
          img.addEventListener("load", () => res(), { once: true });
          img.addEventListener("error", () => res(), { once: true });
        });
      }),
    );

    const fullHeight = Math.max(
      readyRoot.scrollHeight,
      iframeDoc.documentElement.scrollHeight,
      900,
    );
    iframe.style.height = `${fullHeight}px`;
    await new Promise((r) => window.setTimeout(r, 150));

    const { domToCanvas } = await import("modern-screenshot");
    const preferredScale = fullHeight * 2 <= 16_000 ? 2 : 1;
    const capturedCanvas = await domToCanvas(readyRoot, {
      scale: preferredScale,
      width: viewportWidth,
      height: fullHeight,
    });

    const computedBg =
      iframe.contentWindow?.getComputedStyle(readyRoot).backgroundColor || "#09090b";

    let payloadBytes: Uint8Array;
    let contentType: string;

    const format: ExportFormatOption = job.format;
    if (format === "png_long") {
      payloadBytes = await canvasToBytes(capturedCanvas, "image/png");
      contentType = "image/png";
    } else if (format === "behance") {
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
      payloadBytes = buildBrowserZipArchive(entries);
      contentType = "application/zip";
    } else {
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
      payloadBytes = buildMultiPageJpegPdf(pdfPages);
      contentType = "application/pdf";
    }

    const bodyBuffer = payloadBytes.buffer.slice(
      payloadBytes.byteOffset,
      payloadBytes.byteOffset + payloadBytes.byteLength,
    ) as ArrayBuffer;

    const completeRes = await fetch(`/api/exports/${encodeURIComponent(job.id)}/complete`, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
      },
      body: bodyBuffer,
    });

    if (!completeRes.ok) {
      return null;
    }

    const json = (await completeRes.json()) as {
      ok: boolean;
      exportJob?: ExportHistoryItem;
    };
    return json.ok && json.exportJob ? json.exportJob : null;
  } catch {
    return null;
  } finally {
    inFlightClientExportIds.delete(job.id);
    iframe.remove();
  }
}

