import { stripImageExifAndMetadata } from "@/lib/storage/exif";
import {
  computeCenteredLockedCropRect,
  readImageDimensionsFromBytes,
} from "@/lib/storage/image-dimensions";
import {
  detectImageMimeFromMagicBytes,
  isAllowedUploadMimeType,
  type AllowedUploadMimeType,
} from "@/lib/storage/quotas";
import type { PersistedAssetRecord, PresignUploadResult } from "@/lib/storage/service";
import type { CropRect } from "@/lib/template/schema";

export class UploadClientError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "UploadClientError";
    this.code = code;
  }
}

export type PutBinaryTransport = (params: {
  url: string;
  headers: Record<string, string>;
  body: Uint8Array;
  onProgress?: (percent: number) => void;
}) => Promise<void>;

export const defaultPutBinaryTransport: PutBinaryTransport = ({
  url,
  headers,
  body,
  onProgress,
}) =>
  new Promise<void>((resolve, reject) => {
    if (typeof XMLHttpRequest === "undefined") {
      reject(new UploadClientError("NETWORK_ERROR", "Upload transport unavailable."));
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0 && onProgress) {
        const pct = Math.min(99, Math.max(1, Math.round((event.loaded / event.total) * 100)));
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }

      try {
        const parsed = JSON.parse(xhr.responseText) as { code?: string; error?: string };
        reject(
          new UploadClientError(
            parsed.code || "UPLOAD_FAILED",
            parsed.error || `Upload failed with status ${xhr.status}.`,
          ),
        );
      } catch {
        reject(new UploadClientError("UPLOAD_FAILED", `Upload failed with status ${xhr.status}.`));
      }
    };

    xhr.onerror = () => {
      reject(
        new UploadClientError(
          "NETWORK_ERROR",
          "Network error while uploading image. Please check your connection and try again.",
        ),
      );
    };

    const arrayBuf = body.buffer.slice(
      body.byteOffset,
      body.byteOffset + body.byteLength,
    ) as ArrayBuffer;
    xhr.send(new Blob([arrayBuf], { type: headers["Content-Type"] || "application/octet-stream" }));
  });

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

function inferMimeFromExtension(fileName: string): string {
  const lower = fileName.toLowerCase().trim();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic")) return "image/heic";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".gif")) return "image/gif";
  return "application/octet-stream";
}

export async function putBinaryWithFallback(params: {
  uploadUrl: string;
  fallbackUploadUrl?: string;
  headers: Record<string, string>;
  body: Uint8Array;
  onProgress?: (percent: number) => void;
  putTransport?: PutBinaryTransport;
}): Promise<void> {
  const transport = params.putTransport ?? defaultPutBinaryTransport;
  try {
    await transport({
      url: params.uploadUrl,
      headers: params.headers,
      body: params.body,
      onProgress: params.onProgress,
    });
  } catch (err) {
    if (
      err instanceof UploadClientError &&
      err.code === "NETWORK_ERROR" &&
      params.fallbackUploadUrl &&
      params.fallbackUploadUrl !== params.uploadUrl
    ) {
      await transport({
        url: params.fallbackUploadUrl,
        headers: params.headers,
        body: params.body,
        onProgress: params.onProgress,
      });
      return;
    }
    throw err;
  }
}

export interface UploadSlotImageOptions {
  projectId: string;
  slot: string;
  file: File;
  lockedAspect: number;
  onProgress?: (percent: number) => void;
  putTransport?: PutBinaryTransport;
}

export interface UploadedSlotImageResult {
  asset: PersistedAssetRecord;
  width: number;
  height: number;
  initialCrop: CropRect;
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
        reject(new UploadClientError("INVALID_IMAGE", "Couldn't read file bytes."));
      }
    };
    reader.onerror = () =>
      reject(new UploadClientError("INVALID_IMAGE", "Couldn't read file bytes."));
    reader.readAsArrayBuffer(file);
  });
}

export async function uploadSlotImageClient({
  projectId,
  slot,
  file,
  lockedAspect,
  onProgress,
  putTransport = defaultPutBinaryTransport,
}: UploadSlotImageOptions): Promise<UploadedSlotImageResult> {
  const declaredMime = file.type || inferMimeFromExtension(file.name);
  if (!isAllowedUploadMimeType(declaredMime)) {
    throw new UploadClientError(
      "UNSUPPORTED_MIME_TYPE",
      `"${file.name || "Selected file"}" isn't a supported file type. Upload a PNG, JPG, or WebP image.`,
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

  onProgress?.(5);

  const presignRes = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId,
      slot,
      fileName: file.name,
      mimeType: magicMime,
      bytes: sanitizedBytes.byteLength,
      width: dims.width,
      height: dims.height,
    }),
  });

  const presignJson = (await presignRes.json()) as PresignUploadResult;
  if (!presignRes.ok || !presignJson.ok) {
    const errMsg = !presignJson.ok
      ? presignJson.error
      : "Couldn't initialize image upload.";
    const errCode = !presignJson.ok ? presignJson.code : "PRESIGN_FAILED";
    throw new UploadClientError(errCode, errMsg);
  }

  onProgress?.(15);

  await putBinaryWithFallback({
    uploadUrl: presignJson.uploadUrl,
    fallbackUploadUrl: presignJson.fallbackUploadUrl,
    headers: presignJson.uploadHeaders,
    body: sanitizedBytes,
    putTransport,
    onProgress: (putPct) => {
      const scaled = Math.round(15 + putPct * 0.75);
      onProgress?.(Math.min(92, scaled));
    },
  });

  const initialCrop = computeCenteredLockedCropRect(dims.width, dims.height, lockedAspect);

  const completeRes = await fetch("/api/uploads/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      completeToken: presignJson.completeToken,
      crop: initialCrop,
    }),
  });

  const completeJson = (await completeRes.json()) as
    | { ok: true; asset: PersistedAssetRecord }
    | { ok: false; code: string; error: string };

  if (!completeRes.ok || !completeJson.ok) {
    const errMsg = !completeJson.ok
      ? completeJson.error
      : "Couldn't finalize uploaded image.";
    const errCode = !completeJson.ok ? completeJson.code : "COMPLETE_FAILED";
    throw new UploadClientError(errCode, errMsg);
  }

  onProgress?.(100);

  return {
    asset: completeJson.asset,
    width: dims.width,
    height: dims.height,
    initialCrop,
  };
}

export async function persistAssetCropClient(
  assetId: string,
  crop: CropRect | null,
): Promise<void> {
  await fetch(`/api/assets/${encodeURIComponent(assetId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ crop }),
  });
}
