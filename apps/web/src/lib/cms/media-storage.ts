import { randomUUID } from "node:crypto";
import type { UserRole } from "@casefolio/db";
import { z } from "zod";
import { hasAdminRole } from "@/lib/auth/guards";
import { stripImageExifAndMetadata } from "@/lib/storage/exif";
import {
  detectImageMimeFromMagicBytes,
  formatBytesHuman,
  isAllowedUploadMimeType,
  type AllowedUploadMimeType,
} from "@/lib/storage/quotas";
import {
  createPresignedPutTarget,
  deleteStoredObject,
  headStoredObject,
  readStoredObjectBytes,
  signStorageToken,
  verifyStorageToken,
  writeStoredObject,
} from "@/lib/storage/r2";

export const MAX_CMS_RASTER_BYTES = 10 * 1024 * 1024; // 10 MiB
export const MAX_CMS_SVG_BYTES = 512 * 1024; // 512 KiB

export const ALLOWED_CMS_MEDIA_MIMES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
] as const;

export type AllowedCmsMediaMime = (typeof ALLOWED_CMS_MEDIA_MIMES)[number];

const CMS_ASSET_FILE_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpg|webp|svg)$/i;

const presignCmsMediaSchema = z.object({
  action: z.literal("presign"),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1),
  bytes: z.number().int().positive("File cannot be empty."),
});

const completeCmsMediaSchema = z.object({
  action: z.literal("complete"),
  completeToken: z.string().trim().min(16, "Invalid upload completion token."),
});

export interface CmsMediaActor {
  id: string;
  role: UserRole;
}

export interface CmsMediaCompleteTokenPayload {
  kind: "cms-media-complete";
  assetId: string;
  fileNameOnCdn: string;
  r2Key: string;
  userId: string;
  mimeType: AllowedCmsMediaMime;
  exp: number;
}

function normalizeCmsMime(mime: string): AllowedCmsMediaMime | null {
  const clean = mime.toLowerCase().trim();
  if (clean === "image/jpg") return "image/jpeg";
  if ((ALLOWED_CMS_MEDIA_MIMES as readonly string[]).includes(clean)) {
    return clean as AllowedCmsMediaMime;
  }
  return null;
}

function extensionForCmsMime(mime: AllowedCmsMediaMime): "png" | "jpg" | "webp" | "svg" {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/svg+xml":
      return "svg";
  }
}

/**
 * Validates and sanitizes uploaded SVG icons/logos to eliminate script execution,
 * external entity injection, event handlers, or active content.
 */
export function sanitizeUploadedSvg(
  rawText: string,
): { ok: true; svg: string } | { ok: false; error: string } {
  const trimmed = rawText.replace(/^\uFEFF/, "").trim();
  if (!/<svg[\s>]/i.test(trimmed) || !/<\/svg>/i.test(trimmed)) {
    return { ok: false, error: "SVG file must contain a valid <svg>...</svg> root element." };
  }
  if (/<!DOCTYPE|<!ENTITY/i.test(trimmed)) {
    return { ok: false, error: "DOCTYPE and ENTITY declarations are not permitted in SVG icons." };
  }
  if (/<script\b|<foreignObject\b|<iframe\b|<object\b|<embed\b/i.test(trimmed)) {
    return { ok: false, error: "Active script or embedded object tags are not allowed in SVG icons." };
  }
  if (/\bon[a-z]+\s*=|javascript:|vbscript:|data:text\/html/i.test(trimmed)) {
    return { ok: false, error: "Event handlers and executable URI schemes are not allowed in SVG icons." };
  }

  // Extract clean root svg element bounds cleanly
  const startIdx = trimmed.search(/<svg[\s>]/i);
  const endIdx = trimmed.toLowerCase().lastIndexOf("</svg>");
  if (startIdx < 0 || endIdx < startIdx) {
    return { ok: false, error: "Malformed SVG markup." };
  }

  return {
    ok: true,
    svg: trimmed.slice(startIdx, endIdx + "</svg>".length),
  };
}

export type PresignCmsMediaResult =
  | {
      ok: true;
      assetId: string;
      r2Key: string;
      mode: "r2" | "local";
      uploadUrl: string;
      fallbackUploadUrl?: string;
      uploadMethod: "PUT";
      uploadHeaders: Record<string, string>;
      completeToken: string;
      expiresInSeconds: number;
      maxFileBytes: number;
    }
  | {
      ok: false;
      code: "FORBIDDEN" | "UNSUPPORTED_MIME_TYPE" | "VALIDATION_ERROR" | "FILE_TOO_LARGE";
      error: string;
    };

export async function createAdminCmsMediaPresign(
  rawInput: unknown,
  actor: CmsMediaActor,
): Promise<PresignCmsMediaResult> {
  if (!hasAdminRole(actor.role)) {
    return { ok: false, code: "FORBIDDEN", error: "Admin role required to upload CMS assets." };
  }

  const parsed = presignCmsMediaSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: parsed.error.issues[0]?.message ?? "Invalid CMS upload metadata.",
    };
  }

  const normalizedMime = normalizeCmsMime(parsed.data.mimeType);
  if (!normalizedMime) {
    return {
      ok: false,
      code: "UNSUPPORTED_MIME_TYPE",
      error: "Only PNG, JPG, WebP images and clean SVG icons are supported.",
    };
  }

  const maxBytes = normalizedMime === "image/svg+xml" ? MAX_CMS_SVG_BYTES : MAX_CMS_RASTER_BYTES;
  if (parsed.data.bytes > maxBytes) {
    return {
      ok: false,
      code: "FILE_TOO_LARGE",
      error: `File exceeds ${formatBytesHuman(maxBytes)} limit for this format.`,
    };
  }

  if (normalizedMime === "image/svg+xml") {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: "Use upload_svg action for SVG icon uploads.",
    };
  }

  const assetId = randomUUID();
  const ext = extensionForCmsMime(normalizedMime);
  const fileNameOnCdn = `${assetId}.${ext}`;
  const r2Key = `cms/media/${fileNameOnCdn}`;

  const putTarget = await createPresignedPutTarget({
    r2Key,
    mimeType: normalizedMime as AllowedUploadMimeType,
    bytes: parsed.data.bytes,
    maxFileBytes: MAX_CMS_RASTER_BYTES,
    cacheControl: "public, max-age=31536000, immutable",
    expiresInSeconds: 300,
  });

  const completeToken = signStorageToken({
    kind: "cms-media-complete",
    assetId,
    fileNameOnCdn,
    r2Key,
    userId: actor.id,
    mimeType: normalizedMime,
    exp: Date.now() + 10 * 60 * 1000,
  });

  return {
    ok: true,
    assetId,
    r2Key,
    mode: putTarget.mode,
    uploadUrl: putTarget.uploadUrl,
    fallbackUploadUrl: putTarget.fallbackUploadUrl,
    uploadMethod: putTarget.uploadMethod,
    uploadHeaders: putTarget.uploadHeaders,
    completeToken,
    expiresInSeconds: putTarget.expiresInSeconds,
    maxFileBytes: MAX_CMS_RASTER_BYTES,
  };
}

const directSvgUploadSchema = z.object({
  action: z.literal("upload_svg"),
  svgContent: z.string().min(10, "Empty SVG payload.").max(MAX_CMS_SVG_BYTES),
});

export async function uploadAdminCmsSvgDirect(
  rawInput: unknown,
  actor: CmsMediaActor,
): Promise<CompleteCmsMediaResult> {
  if (!hasAdminRole(actor.role)) {
    return { ok: false, code: "FORBIDDEN", error: "Admin role required to upload SVG icons." };
  }

  const parsed = directSvgUploadSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: parsed.error.issues[0]?.message ?? "Invalid SVG upload payload.",
    };
  }

  const sanitized = sanitizeUploadedSvg(parsed.data.svgContent);
  if (!sanitized.ok) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: sanitized.error,
    };
  }

  const assetId = randomUUID();
  const fileNameOnCdn = `${assetId}.svg`;
  const r2Key = `cms/media/${fileNameOnCdn}`;
  const encoded = new TextEncoder().encode(sanitized.svg);

  await writeStoredObject(r2Key, encoded, {
    contentType: "image/svg+xml",
    cacheControl: "public, max-age=31536000, immutable",
  });

  return {
    ok: true,
    assetUrl: `/cdn/cms/${fileNameOnCdn}`,
    r2Key,
    bytes: encoded.byteLength,
    mimeType: "image/svg+xml",
  };
}

export type CompleteCmsMediaResult =
  | {
      ok: true;
      assetUrl: string;
      r2Key: string;
      bytes: number;
      mimeType: AllowedCmsMediaMime;
    }
  | {
      ok: false;
      code: "FORBIDDEN" | "VALIDATION_ERROR" | "INVALID_TOKEN" | "UPLOAD_MISSING" | "FILE_TOO_LARGE";
      error: string;
    };

export async function completeAdminCmsMediaUpload(
  rawInput: unknown,
  actor: CmsMediaActor,
): Promise<CompleteCmsMediaResult> {
  if (!hasAdminRole(actor.role)) {
    return { ok: false, code: "FORBIDDEN", error: "Admin role required to finalize CMS uploads." };
  }

  const parsed = completeCmsMediaSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: parsed.error.issues[0]?.message ?? "Invalid upload completion payload.",
    };
  }

  const tokenPayload = verifyStorageToken<CmsMediaCompleteTokenPayload>(
    parsed.data.completeToken,
  );
  if (
    !tokenPayload ||
    tokenPayload.kind !== "cms-media-complete" ||
    tokenPayload.userId !== actor.id
  ) {
    return {
      ok: false,
      code: "INVALID_TOKEN",
      error: "Upload session expired or invalid. Please re-upload.",
    };
  }

  const storedInfo = await headStoredObject(tokenPayload.r2Key);
  if (!storedInfo.exists || storedInfo.bytes <= 0) {
    return {
      ok: false,
      code: "UPLOAD_MISSING",
      error: "Uploaded file bytes were not found. Please try again.",
    };
  }

  const maxBytes =
    tokenPayload.mimeType === "image/svg+xml" ? MAX_CMS_SVG_BYTES : MAX_CMS_RASTER_BYTES;
  if (storedInfo.bytes > maxBytes) {
    await deleteStoredObject(tokenPayload.r2Key);
    return {
      ok: false,
      code: "FILE_TOO_LARGE",
      error: `Uploaded asset exceeds the ${formatBytesHuman(maxBytes)} limit.`,
    };
  }

  const rawBytes = await readStoredObjectBytes(tokenPayload.r2Key);
  if (!rawBytes || rawBytes.byteLength === 0) {
    return {
      ok: false,
      code: "UPLOAD_MISSING",
      error: "Uploaded asset bytes could not be read.",
    };
  }

  if (tokenPayload.mimeType === "image/svg+xml") {
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(rawBytes);
    const sanitized = sanitizeUploadedSvg(decoded);
    if (!sanitized.ok) {
      await deleteStoredObject(tokenPayload.r2Key);
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        error: sanitized.error,
      };
    }

    const encoded = new TextEncoder().encode(sanitized.svg);
    await writeStoredObject(tokenPayload.r2Key, encoded, {
      contentType: "image/svg+xml",
      cacheControl: "public, max-age=31536000, immutable",
    });

    return {
      ok: true,
      assetUrl: `/cdn/cms/${tokenPayload.fileNameOnCdn}`,
      r2Key: tokenPayload.r2Key,
      bytes: encoded.byteLength,
      mimeType: "image/svg+xml",
    };
  }

  const detectedMime = detectImageMimeFromMagicBytes(rawBytes);
  if (!detectedMime || !isAllowedUploadMimeType(detectedMime) || detectedMime !== tokenPayload.mimeType) {
    await deleteStoredObject(tokenPayload.r2Key);
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: "Uploaded image file signature does not match an allowed PNG, JPG, or WebP.",
    };
  }

  const sanitizedBytes = stripImageExifAndMetadata(rawBytes, detectedMime);
  if (
    sanitizedBytes.byteLength !== rawBytes.byteLength ||
    Buffer.compare(Buffer.from(sanitizedBytes), Buffer.from(rawBytes)) !== 0
  ) {
    await writeStoredObject(tokenPayload.r2Key, sanitizedBytes, {
      contentType: detectedMime,
      cacheControl: "public, max-age=31536000, immutable",
    });
  }

  return {
    ok: true,
    assetUrl: `/cdn/cms/${tokenPayload.fileNameOnCdn}`,
    r2Key: tokenPayload.r2Key,
    bytes: sanitizedBytes.byteLength,
    mimeType: tokenPayload.mimeType,
  };
}

export async function readPublicCmsAssetByFileName(fileName: string): Promise<
  | { status: "not_found" }
  | {
      status: "ok";
      bytes: Uint8Array;
      contentType: string;
      cacheControl: string;
      isSvg: boolean;
    }
> {
  const cleanFile = fileName.trim();
  if (!CMS_ASSET_FILE_REGEX.test(cleanFile)) {
    return { status: "not_found" };
  }

  const lowerFile = cleanFile.toLowerCase();
  const r2Key = `cms/media/${lowerFile}`;
  const bytes = await readStoredObjectBytes(r2Key);
  if (!bytes || bytes.byteLength === 0) {
    return { status: "not_found" };
  }

  const isSvg = lowerFile.endsWith(".svg");
  const contentType = isSvg
    ? "image/svg+xml; charset=utf-8"
    : lowerFile.endsWith(".png")
      ? "image/png"
      : lowerFile.endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";

  return {
    status: "ok",
    bytes,
    contentType,
    cacheControl: "public, max-age=31536000, s-maxage=31536000, immutable",
    isSvg,
  };
}
