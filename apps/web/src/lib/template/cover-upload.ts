import {
  defaultPutBinaryTransport,
  putBinaryWithFallback,
  UploadClientError,
  type PutBinaryTransport,
} from "@/lib/storage/client-upload";
import { stripImageExifAndMetadata } from "@/lib/storage/exif";
import { readImageDimensionsFromBytes } from "@/lib/storage/image-dimensions";
import {
  detectImageMimeFromMagicBytes,
  isAllowedUploadMimeType,
  type AllowedUploadMimeType,
} from "@/lib/storage/quotas";
import type {
  CompleteTemplateCoverResult,
  PresignTemplateCoverResult,
} from "@/lib/template/cover-storage";

function inferMimeFromExtension(fileName: string): string {
  const lower = fileName.toLowerCase().trim();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

async function readFileBytes(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === "function") {
    const buf = await file.arrayBuffer();
    return new Uint8Array(buf);
  }

  return await new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result));
      } else {
        reject(new UploadClientError("INVALID_IMAGE", "Couldn't read cover image bytes."));
      }
    };
    reader.onerror = () =>
      reject(new UploadClientError("INVALID_IMAGE", "Couldn't read cover image bytes."));
    reader.readAsArrayBuffer(file);
  });
}

async function loadDimensionsFromBrowserImage(
  bytes: Uint8Array,
  mimeType: string,
): Promise<{ width: number; height: number } | null> {
  if (typeof window === "undefined" || typeof URL.createObjectURL !== "function") {
    return null;
  }

  const copy = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const blobUrl = URL.createObjectURL(new Blob([copy], { type: mimeType }));

  try {
    return await new Promise<{ width: number; height: number } | null>((resolve) => {
      const img = new window.Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = blobUrl;
    });
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

export interface UploadTemplateCoverOptions {
  file: File;
  onProgress?: (percent: number) => void;
  putTransport?: PutBinaryTransport;
}

export interface UploadedTemplateCoverResult {
  coverUrl: string;
  width: number;
  height: number;
  bytes: number;
}

export async function uploadTemplateCoverClient({
  file,
  onProgress,
  putTransport = defaultPutBinaryTransport,
}: UploadTemplateCoverOptions): Promise<UploadedTemplateCoverResult> {
  const declaredMime = file.type || inferMimeFromExtension(file.name);
  if (!isAllowedUploadMimeType(declaredMime)) {
    throw new UploadClientError(
      "UNSUPPORTED_MIME_TYPE",
      `"${file.name || "Selected file"}" isn't supported. Upload a PNG, JPG, or WebP cover image.`,
    );
  }

  const rawBytes = await readFileBytes(file);
  if (rawBytes.byteLength === 0) {
    throw new UploadClientError("EMPTY_FILE", `"${file.name}" is empty.`);
  }

  const magicMime = detectImageMimeFromMagicBytes(rawBytes);
  if (!magicMime) {
    throw new UploadClientError(
      "UNSUPPORTED_MIME_TYPE",
      `"${file.name}" isn't a valid PNG, JPG, or WebP image.`,
    );
  }

  const sanitizedBytes = stripImageExifAndMetadata(rawBytes, magicMime as AllowedUploadMimeType);
  const dims =
    readImageDimensionsFromBytes(sanitizedBytes, magicMime) ??
    (await loadDimensionsFromBrowserImage(sanitizedBytes, magicMime));

  if (!dims || dims.width <= 0 || dims.height <= 0) {
    throw new UploadClientError(
      "INVALID_IMAGE",
      `Couldn't read image dimensions from "${file.name}".`,
    );
  }

  onProgress?.(10);

  const presignRes = await fetch("/api/admin/templates/cover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "presign",
      fileName: file.name || "cover.png",
      mimeType: magicMime,
      bytes: sanitizedBytes.byteLength,
      width: dims.width,
      height: dims.height,
    }),
  });

  const presignJson = (await presignRes.json()) as PresignTemplateCoverResult;
  if (!presignRes.ok || !presignJson.ok) {
    const errMsg = !presignJson.ok ? presignJson.error : "Couldn't initialize cover upload.";
    const errCode = !presignJson.ok ? presignJson.code : "PRESIGN_FAILED";
    throw new UploadClientError(errCode, errMsg);
  }

  onProgress?.(20);

  await putBinaryWithFallback({
    uploadUrl: presignJson.uploadUrl,
    fallbackUploadUrl: presignJson.fallbackUploadUrl,
    headers: presignJson.uploadHeaders,
    body: sanitizedBytes,
    putTransport,
    onProgress: (putPct) => {
      const scaled = Math.round(20 + putPct * 0.7);
      onProgress?.(Math.min(92, scaled));
    },
  });

  const completeRes = await fetch("/api/admin/templates/cover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "complete",
      completeToken: presignJson.completeToken,
    }),
  });

  const completeJson = (await completeRes.json()) as CompleteTemplateCoverResult;
  if (!completeRes.ok || !completeJson.ok) {
    const errMsg = !completeJson.ok ? completeJson.error : "Couldn't finalize cover image.";
    const errCode = !completeJson.ok ? completeJson.code : "COMPLETE_FAILED";
    throw new UploadClientError(errCode, errMsg);
  }

  onProgress?.(100);

  return {
    coverUrl: completeJson.coverUrl,
    width: completeJson.width,
    height: completeJson.height,
    bytes: completeJson.bytes,
  };
}

