import { randomUUID } from "node:crypto";
import { stripImageExifAndMetadata } from "@/lib/storage/exif";
import {
  detectImageMimeFromMagicBytes,
  isAllowedUploadMimeType,
  type AllowedUploadMimeType,
} from "@/lib/storage/quotas";
import {
  deleteStoredObject,
  readStoredObjectBytes,
  writeStoredObject,
} from "@/lib/storage/r2";

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MiB

const AVATAR_FILE_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpg|webp)$/i;

function extensionForMime(mime: AllowedUploadMimeType): "png" | "jpg" | "webp" {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
  }
}

export function extractLocalAvatarKey(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null;
  const trimmed = avatarUrl.trim();
  if (!trimmed.startsWith("/cdn/avatars/")) return null;
  const file = trimmed.slice("/cdn/avatars/".length);
  if (!AVATAR_FILE_REGEX.test(file)) return null;
  return `avatars/${file.toLowerCase()}`;
}

export async function storeUserAvatarImage(args: {
  bytes: Uint8Array;
  previousAvatarUrl?: string | null;
}): Promise<
  | { ok: true; avatarUrl: string; r2Key: string; mimeType: AllowedUploadMimeType }
  | { ok: false; status: number; error: string }
> {
  if (args.bytes.byteLength === 0) {
    return { ok: false, status: 400, error: "Uploaded image file is empty." };
  }
  if (args.bytes.byteLength > MAX_AVATAR_BYTES) {
    return { ok: false, status: 413, error: "Profile photo must be 5 MB or smaller." };
  }

  const detectedMime = detectImageMimeFromMagicBytes(args.bytes);
  if (!detectedMime || !isAllowedUploadMimeType(detectedMime)) {
    return {
      ok: false,
      status: 415,
      error: "Please upload a valid PNG, JPG, or WebP image file.",
    };
  }

  const sanitizedBytes = stripImageExifAndMetadata(args.bytes, detectedMime);
  const ext = extensionForMime(detectedMime);
  const fileName = `${randomUUID()}.${ext}`.toLowerCase();
  const r2Key = `avatars/${fileName}`;

  await writeStoredObject(r2Key, sanitizedBytes, {
    contentType: detectedMime,
    cacheControl: "public, max-age=31536000, immutable",
  });

  const previousKey = extractLocalAvatarKey(args.previousAvatarUrl);
  if (previousKey && previousKey !== r2Key) {
    await deleteStoredObject(previousKey).catch(() => undefined);
  }

  return {
    ok: true,
    avatarUrl: `/cdn/avatars/${fileName}`,
    r2Key,
    mimeType: detectedMime,
  };
}

export async function readPublicAvatarByFileName(fileName: string): Promise<
  | { status: "not_found" }
  | {
      status: "ok";
      bytes: Uint8Array;
      contentType: string;
      cacheControl: string;
    }
> {
  const cleanFile = fileName.trim();
  if (!AVATAR_FILE_REGEX.test(cleanFile)) {
    return { status: "not_found" };
  }

  const lowerFile = cleanFile.toLowerCase();
  const r2Key = `avatars/${lowerFile}`;
  const bytes = await readStoredObjectBytes(r2Key);
  if (!bytes || bytes.byteLength === 0) {
    return { status: "not_found" };
  }

  const contentType = lowerFile.endsWith(".png")
    ? "image/png"
    : lowerFile.endsWith(".webp")
      ? "image/webp"
      : "image/jpeg";

  return {
    status: "ok",
    bytes,
    contentType,
    cacheControl: "public, max-age=31536000, s-maxage=31536000, immutable",
  };
}
