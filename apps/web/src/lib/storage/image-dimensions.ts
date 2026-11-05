import type { CSSProperties } from "react";
import type { CropRect } from "@/lib/template/schema";

function readUint16BE(buf: Uint8Array, offset: number): number {
  return ((buf[offset] ?? 0) << 8) | (buf[offset + 1] ?? 0);
}

function readUint16LE(buf: Uint8Array, offset: number): number {
  return (buf[offset] ?? 0) | ((buf[offset + 1] ?? 0) << 8);
}

function readUint24LE(buf: Uint8Array, offset: number): number {
  return (
    (buf[offset] ?? 0) |
    ((buf[offset + 1] ?? 0) << 8) |
    ((buf[offset + 2] ?? 0) << 16)
  );
}

function readUint32BE(buf: Uint8Array, offset: number): number {
  return (
    (((buf[offset] ?? 0) << 24) >>> 0) +
    (((buf[offset + 1] ?? 0) << 16) | ((buf[offset + 2] ?? 0) << 8) | (buf[offset + 3] ?? 0))
  );
}

function readUint32LE(buf: Uint8Array, offset: number): number {
  return (
    ((buf[offset] ?? 0) |
      ((buf[offset + 1] ?? 0) << 8) |
      ((buf[offset + 2] ?? 0) << 16) |
      (((buf[offset + 3] ?? 0) << 24) >>> 0)) >>>
    0
  );
}

function readAscii4(buf: Uint8Array, offset: number): string {
  return String.fromCharCode(
    buf[offset] ?? 0,
    buf[offset + 1] ?? 0,
    buf[offset + 2] ?? 0,
    buf[offset + 3] ?? 0,
  );
}

/**
 * Synchronously extracts intrinsic pixel dimensions from PNG, JPEG, and WebP headers.
 * Works identically in Node, jsdom, and all modern browsers.
 */
export function readImageDimensionsFromBytes(
  bytes: Uint8Array,
  mimeType: string,
): { width: number; height: number } | null {
  const mime = mimeType.toLowerCase().trim();

  // PNG: 8-byte signature + 4-byte length + "IHDR" + 4-byte width + 4-byte height
  if (mime === "image/png" && bytes.length >= 24 && readAscii4(bytes, 12) === "IHDR") {
    const width = readUint32BE(bytes, 16);
    const height = readUint32BE(bytes, 20);
    if (width > 0 && height > 0) {
      return { width, height };
    }
  }

  // JPEG: scan markers until SOF0..SOF15 (excluding DHT 0xC4, JPG 0xC8, DAC 0xCC)
  if (mime === "image/jpeg" && bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset < bytes.length) {
      if (bytes[offset] !== 0xff) break;
      while (offset < bytes.length && bytes[offset] === 0xff) {
        offset += 1;
      }
      if (offset >= bytes.length) break;
      const marker = bytes[offset]!;
      offset += 1;

      if (
        marker === 0xd8 ||
        marker === 0xd9 ||
        marker === 0x01 ||
        (marker >= 0xd0 && marker <= 0xd7)
      ) {
        continue;
      }

      if (offset + 2 > bytes.length) break;
      const segLen = readUint16BE(bytes, offset);
      if (segLen < 2 || offset + segLen > bytes.length) break;

      const isSof =
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc;

      if (isSof && segLen >= 7) {
        const height = readUint16BE(bytes, offset + 3);
        const width = readUint16BE(bytes, offset + 5);
        if (width > 0 && height > 0) {
          return { width, height };
        }
      }

      offset += segLen;
    }
  }

  // WebP: RIFF....WEBP followed by VP8X, VP8L, or VP8 chunk
  if (
    mime === "image/webp" &&
    bytes.length >= 30 &&
    readAscii4(bytes, 0) === "RIFF" &&
    readAscii4(bytes, 8) === "WEBP"
  ) {
    const chunkType = readAscii4(bytes, 12);
    if (chunkType === "VP8X" && bytes.length >= 30) {
      const width = 1 + readUint24LE(bytes, 24);
      const height = 1 + readUint24LE(bytes, 27);
      return { width, height };
    }
    if (chunkType === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
      const bits = readUint32LE(bytes, 21);
      const width = (bits & 0x3fff) + 1;
      const height = ((bits >>> 14) & 0x3fff) + 1;
      return { width, height };
    }
    if (
      chunkType === "VP8 " &&
      bytes.length >= 30 &&
      bytes[23] === 0x9d &&
      bytes[24] === 0x01 &&
      bytes[25] === 0x2a
    ) {
      const width = readUint16LE(bytes, 26) & 0x3fff;
      const height = readUint16LE(bytes, 28) & 0x3fff;
      if (width > 0 && height > 0) {
        return { width, height };
      }
    }
  }

  return null;
}

/**
 * Clamps and rounds a crop rectangle so `x >= 0`, `y >= 0`, `width >= 1`, `height >= 1`.
 */
export function sanitizeCropRect(area: CropRect): CropRect {
  return {
    x: Number.isFinite(area.x) ? Math.max(0, Math.round(area.x)) : 0,
    y: Number.isFinite(area.y) ? Math.max(0, Math.round(area.y)) : 0,
    width: Number.isFinite(area.width) && area.width > 0 ? Math.max(1, Math.round(area.width)) : 1,
    height:
      Number.isFinite(area.height) && area.height > 0 ? Math.max(1, Math.round(area.height)) : 1,
  };
}

/**
 * Computes a centered pixel crop rectangle locked strictly to `targetAspect` (`slotWidth / slotHeight`).
 */
export function computeCenteredLockedCropRect(
  imageWidth: number,
  imageHeight: number,
  targetAspect: number,
): CropRect {
  const safeW = Math.max(1, Math.round(imageWidth));
  const safeH = Math.max(1, Math.round(imageHeight));
  const safeAspect = targetAspect > 0 ? targetAspect : 1;

  const imgAspect = safeW / safeH;
  if (imgAspect > safeAspect) {
    const cropHeight = safeH;
    const cropWidth = Math.min(safeW, Math.max(1, Math.round(cropHeight * safeAspect)));
    const x = Math.max(0, Math.round((safeW - cropWidth) / 2));
    return { x, y: 0, width: cropWidth, height: cropHeight };
  }

  const cropWidth = safeW;
  const cropHeight = Math.min(safeH, Math.max(1, Math.round(cropWidth / safeAspect)));
  const y = Math.max(0, Math.round((safeH - cropHeight) / 2));
  return { x: 0, y, width: cropWidth, height: cropHeight };
}

export function parseNaturalDimensionsFromSrc(
  src: string,
): { width: number; height: number } | null {
  if (!src) return null;
  try {
    const parsed = new URL(src, "http://casefolio.local");
    const nw = Number(parsed.searchParams.get("nw"));
    const nh = Number(parsed.searchParams.get("nh"));
    if (Number.isFinite(nw) && nw > 0 && Number.isFinite(nh) && nh > 0) {
      return { width: nw, height: nh };
    }
  } catch {
    return null;
  }
  return null;
}

export function isUrlServerPreCropped(src: string): boolean {
  return (
    src.includes("trim=") &&
    (src.includes("/cdn-cgi/image/") || src.includes("imagedelivery.net/"))
  );
}

/**
 * Computes SSR/CSR-pure CSS positioning to display the exact pixel `crop` region
 * inside a slot frame without requiring client layout measurement or canvas re-encoding.
 */
export function computeCssCropFramingStyle(
  naturalWidth: number,
  naturalHeight: number,
  crop: CropRect | null | undefined,
): CSSProperties | null {
  if (
    !crop ||
    naturalWidth <= 0 ||
    naturalHeight <= 0 ||
    crop.width <= 0 ||
    crop.height <= 0
  ) {
    return null;
  }

  const widthPct = (naturalWidth / crop.width) * 100;
  const heightPct = (naturalHeight / crop.height) * 100;
  const leftPct = -(crop.x / crop.width) * 100;
  const topPct = -(crop.y / crop.height) * 100;

  return {
    position: "absolute",
    maxWidth: "none",
    width: `${widthPct.toFixed(4)}%`,
    height: `${heightPct.toFixed(4)}%`,
    left: `${leftPct.toFixed(4)}%`,
    top: `${topPct.toFixed(4)}%`,
  };
}
