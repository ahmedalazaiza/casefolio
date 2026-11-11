import type { AllowedUploadMimeType } from "@/lib/storage/quotas";

function readUint16BE(buf: Uint8Array, offset: number): number {
  return ((buf[offset] ?? 0) << 8) | (buf[offset + 1] ?? 0);
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

function writeUint32LE(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >>> 8) & 0xff;
  buf[offset + 2] = (value >>> 16) & 0xff;
  buf[offset + 3] = (value >>> 24) & 0xff;
}

function readAscii4(buf: Uint8Array, offset: number): string {
  return String.fromCharCode(
    buf[offset] ?? 0,
    buf[offset + 1] ?? 0,
    buf[offset + 2] ?? 0,
    buf[offset + 3] ?? 0,
  );
}

function concatUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const chunk of chunks) {
    total += chunk.length;
  }
  const result = new Uint8Array(total);
  let cursor = 0;
  for (const chunk of chunks) {
    result.set(chunk, cursor);
    cursor += chunk.length;
  }
  return result;
}

/**
 * Losslessly strips APP1 (Exif/GPS/XMP), APP13 (IPTC), and COM (comment) markers from JPEG bytes.
 */
function stripJpegMetadata(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return bytes;
  }

  const keptSegments: Uint8Array[] = [bytes.subarray(0, 2)]; // SOI (FFD8)
  let offset = 2;

  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) {
      // Malformed marker stream — preserve remainder safely rather than corrupting image data
      keptSegments.push(bytes.subarray(offset));
      break;
    }

    // Skip padding 0xFF bytes
    const markerStart = offset;
    while (offset < bytes.length && bytes[offset] === 0xff) {
      offset += 1;
    }
    if (offset >= bytes.length) {
      keptSegments.push(bytes.subarray(markerStart));
      break;
    }

    const marker = bytes[offset]!;
    offset += 1;

    // Standalone markers without length payload (RST0-RST7, SOI, EOI, TEM)
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      keptSegments.push(bytes.subarray(markerStart, offset));
      if (marker === 0xd9) {
        break;
      }
      continue;
    }

    // SOS (Start of Scan, 0xDA): header has length, followed by entropy-coded image stream to EOF
    if (marker === 0xda) {
      keptSegments.push(bytes.subarray(markerStart));
      break;
    }

    if (offset + 2 > bytes.length) {
      keptSegments.push(bytes.subarray(markerStart));
      break;
    }

    const segmentLength = readUint16BE(bytes, offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) {
      keptSegments.push(bytes.subarray(markerStart));
      break;
    }

    const segmentEnd = offset + segmentLength;

    // Drop APP1 (0xE1: EXIF / GPS / XMP), APP13 (0xED: IPTC), and COM (0xFE: comments)
    const shouldDrop = marker === 0xe1 || marker === 0xed || marker === 0xfe;
    if (!shouldDrop) {
      keptSegments.push(bytes.subarray(markerStart, segmentEnd));
    }

    offset = segmentEnd;
  }

  return concatUint8Arrays(keptSegments);
}

const PNG_STRIP_CHUNKS = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);

/**
 * Losslessly strips eXIf, tEXt, zTXt, iTXt, and tIME metadata chunks from PNG bytes.
 */
function stripPngMetadata(bytes: Uint8Array): Uint8Array {
  if (
    bytes.length < 8 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47
  ) {
    return bytes;
  }

  const keptChunks: Uint8Array[] = [bytes.subarray(0, 8)]; // 8-byte PNG signature
  let offset = 8;
  let strippedAny = false;

  while (offset + 12 <= bytes.length) {
    const dataLength = readUint32BE(bytes, offset);
    const chunkType = readAscii4(bytes, offset + 4);
    const totalChunkLength = 12 + dataLength;

    if (offset + totalChunkLength > bytes.length) {
      keptChunks.push(bytes.subarray(offset));
      offset = bytes.length;
      break;
    }

    if (PNG_STRIP_CHUNKS.has(chunkType)) {
      strippedAny = true;
    } else {
      keptChunks.push(bytes.subarray(offset, offset + totalChunkLength));
    }

    offset += totalChunkLength;
    if (chunkType === "IEND") {
      break;
    }
  }

  if (!strippedAny) {
    return bytes;
  }
  if (offset < bytes.length) {
    keptChunks.push(bytes.subarray(offset));
  }

  return concatUint8Arrays(keptChunks);
}

/**
 * Losslessly strips EXIF and XMP RIFF chunks from WebP bytes and updates VP8X flags + RIFF size.
 */
function stripWebpMetadata(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 12 || readAscii4(bytes, 0) !== "RIFF" || readAscii4(bytes, 8) !== "WEBP") {
    return bytes;
  }

  const header = new Uint8Array(bytes.subarray(0, 12));
  const keptChunks: Uint8Array[] = [header];
  let offset = 12;

  while (offset + 8 <= bytes.length) {
    const chunkId = readAscii4(bytes, offset);
    const chunkSize = readUint32LE(bytes, offset + 4);
    const paddedSize = chunkSize + (chunkSize % 2);
    const chunkEnd = offset + 8 + paddedSize;

    if (chunkEnd > bytes.length) {
      keptChunks.push(bytes.subarray(offset));
      break;
    }

    if (chunkId === "EXIF" || chunkId === "XMP ") {
      offset = chunkEnd;
      continue;
    }

    if (chunkId === "VP8X" && chunkSize >= 10) {
      const vp8xCopy = new Uint8Array(bytes.subarray(offset, chunkEnd));
      // Clear EXIF (bit 3: 0x08) and XMP (bit 2: 0x04) flags in VP8X flags byte at offset+8
      vp8xCopy[8] = (vp8xCopy[8] ?? 0) & ~(0x08 | 0x04);
      keptChunks.push(vp8xCopy);
    } else {
      keptChunks.push(bytes.subarray(offset, chunkEnd));
    }

    offset = chunkEnd;
  }

  const output = concatUint8Arrays(keptChunks);
  if (output.length >= 8) {
    writeUint32LE(output, 4, output.length - 8);
  }
  return output;
}

/**
 * Losslessly strips EXIF, GPS, XMP, IPTC, and comment metadata from PNG, JPEG, and WebP buffers.
 */
export function stripImageExifAndMetadata(
  bytes: Uint8Array,
  mimeType: AllowedUploadMimeType | string,
): Uint8Array {
  const normalized = mimeType.toLowerCase().trim();
  if (normalized === "image/jpeg") {
    return stripJpegMetadata(bytes);
  }
  if (normalized === "image/png") {
    return stripPngMetadata(bytes);
  }
  if (normalized === "image/webp") {
    return stripWebpMetadata(bytes);
  }
  return bytes;
}
