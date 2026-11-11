import { randomUUID } from "node:crypto";
import type { UserRole } from "@casefolio/db";
import { z } from "zod";
import { hasAdminRole } from "@/lib/auth/guards";
import { stripImageExifAndMetadata } from "@/lib/storage/exif";
import {
  detectImageMimeFromMagicBytes,
  extensionForMimeType,
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

export const MAX_TEMPLATE_COVER_BYTES = 10 * 1024 * 1024; // 10 MiB

const COVER_FILE_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpg|webp)$/i;

export interface TemplateCoverActor {
  id: string;
  role: UserRole;
}

export interface TemplateCoverCompleteTokenPayload {
  kind: "template-cover-complete";
  coverId: string;
  fileNameOnCdn: string;
  r2Key: string;
  userId: string;
  mimeType: AllowedUploadMimeType;
  width: number;
  height: number;
  exp: number;
}

const presignCoverSchema = z.object({
  action: z.literal("presign"),
  fileName: z.string().trim().min(1, "File name is required.").max(255),
  mimeType: z.string().trim().min(1, "MIME type is required."),
  bytes: z.number().int().positive("File cannot be empty."),
  width: z.number().int().positive().max(12000),
  height: z.number().int().positive().max(12000),
});

const completeCoverSchema = z.object({
  action: z.literal("complete"),
  completeToken: z.string().trim().min(16, "Invalid completion token."),
});

export type PresignTemplateCoverResult =
  | {
      ok: true;
      coverId: string;
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

export type CompleteTemplateCoverResult =
  | {
      ok: true;
      coverUrl: string;
      r2Key: string;
      width: number;
      height: number;
      bytes: number;
      mimeType: AllowedUploadMimeType;
    }
  | {
      ok: false;
      code: "FORBIDDEN" | "VALIDATION_ERROR" | "INVALID_TOKEN" | "UPLOAD_MISSING" | "FILE_TOO_LARGE";
      error: string;
    };

export async function createAdminTemplateCoverPresign(
  rawInput: unknown,
  actor: TemplateCoverActor,
): Promise<PresignTemplateCoverResult> {
  if (!hasAdminRole(actor.role)) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "Admin access is required to upload template covers.",
    };
  }

  const parsed = presignCoverSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: parsed.error.issues[0]?.message ?? "Invalid cover upload request.",
    };
  }

  const valid = parsed.data;
  if (!isAllowedUploadMimeType(valid.mimeType)) {
    return {
      ok: false,
      code: "UNSUPPORTED_MIME_TYPE",
      error: `"${valid.fileName}" isn't supported. Upload a PNG, JPG, or WebP cover image.`,
    };
  }

  if (valid.bytes > MAX_TEMPLATE_COVER_BYTES) {
    return {
      ok: false,
      code: "FILE_TOO_LARGE",
      error: `"${valid.fileName}" exceeds the ${formatBytesHuman(MAX_TEMPLATE_COVER_BYTES)} cover image limit.`,
    };
  }

  const normalizedMime = valid.mimeType.toLowerCase().trim() as AllowedUploadMimeType;
  const coverId = randomUUID();
  const ext = extensionForMimeType(normalizedMime);
  const fileNameOnCdn = `${coverId}.${ext}`;
  const r2Key = `templates/covers/${fileNameOnCdn}`;

  const putTarget = await createPresignedPutTarget({
    r2Key,
    mimeType: normalizedMime,
    bytes: valid.bytes,
    maxFileBytes: MAX_TEMPLATE_COVER_BYTES,
    cacheControl: "public, max-age=31536000, immutable",
  });

  const completeToken = signStorageToken<TemplateCoverCompleteTokenPayload>({
    kind: "template-cover-complete",
    coverId,
    fileNameOnCdn,
    r2Key,
    userId: actor.id,
    mimeType: normalizedMime,
    width: valid.width,
    height: valid.height,
    exp: Date.now() + 10 * 60 * 1000,
  });

  return {
    ok: true,
    coverId,
    r2Key,
    mode: putTarget.mode,
    uploadUrl: putTarget.uploadUrl,
    fallbackUploadUrl: putTarget.fallbackUploadUrl,
    uploadMethod: putTarget.uploadMethod,
    uploadHeaders: putTarget.uploadHeaders,
    completeToken,
    expiresInSeconds: putTarget.expiresInSeconds,
    maxFileBytes: MAX_TEMPLATE_COVER_BYTES,
  };
}

export async function completeAdminTemplateCoverUpload(
  rawInput: unknown,
  actor: TemplateCoverActor,
): Promise<CompleteTemplateCoverResult> {
  if (!hasAdminRole(actor.role)) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "Admin access is required to finalize template covers.",
    };
  }

  const parsed = completeCoverSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: parsed.error.issues[0]?.message ?? "Invalid cover completion payload.",
    };
  }

  const tokenPayload = verifyStorageToken<TemplateCoverCompleteTokenPayload>(
    parsed.data.completeToken,
  );
  if (
    !tokenPayload ||
    tokenPayload.kind !== "template-cover-complete" ||
    tokenPayload.userId !== actor.id
  ) {
    return {
      ok: false,
      code: "INVALID_TOKEN",
      error: "Cover upload session expired or is invalid. Please upload the image again.",
    };
  }

  const storedInfo = await headStoredObject(tokenPayload.r2Key);
  if (!storedInfo.exists || storedInfo.bytes <= 0) {
    return {
      ok: false,
      code: "UPLOAD_MISSING",
      error: "Cover image bytes were not found in storage. Please try uploading again.",
    };
  }

  if (storedInfo.bytes > MAX_TEMPLATE_COVER_BYTES) {
    await deleteStoredObject(tokenPayload.r2Key);
    return {
      ok: false,
      code: "FILE_TOO_LARGE",
      error: `Uploaded cover exceeds the ${formatBytesHuman(MAX_TEMPLATE_COVER_BYTES)} limit.`,
    };
  }

  const rawBytes = await readStoredObjectBytes(tokenPayload.r2Key);
  if (!rawBytes || rawBytes.byteLength === 0) {
    return {
      ok: false,
      code: "UPLOAD_MISSING",
      error: "Cover image bytes were not found in storage. Please try uploading again.",
    };
  }

  const detectedMime = detectImageMimeFromMagicBytes(rawBytes);
  if (!detectedMime || detectedMime !== tokenPayload.mimeType) {
    await deleteStoredObject(tokenPayload.r2Key);
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: "Uploaded cover file header does not match an allowed PNG, JPG, or WebP image.",
    };
  }

  const sanitizedBytes = stripImageExifAndMetadata(rawBytes, detectedMime);
  const bytesChanged =
    sanitizedBytes.byteLength !== rawBytes.byteLength ||
    Buffer.compare(Buffer.from(sanitizedBytes), Buffer.from(rawBytes)) !== 0;
  if (bytesChanged) {
    await writeStoredObject(tokenPayload.r2Key, sanitizedBytes, {
      contentType: detectedMime,
      cacheControl: "public, max-age=31536000, immutable",
    });
  }

  return {
    ok: true,
    coverUrl: `/cdn/covers/${tokenPayload.fileNameOnCdn}`,
    r2Key: tokenPayload.r2Key,
    width: tokenPayload.width,
    height: tokenPayload.height,
    bytes: sanitizedBytes.byteLength,
    mimeType: tokenPayload.mimeType,
  };
}

export async function readPublicTemplateCoverByFileName(fileName: string): Promise<
  | { status: "not_found" }
  | {
      status: "ok";
      bytes: Uint8Array;
      contentType: string;
      cacheControl: string;
    }
> {
  const cleanFile = fileName.trim();
  if (!COVER_FILE_REGEX.test(cleanFile)) {
    return { status: "not_found" };
  }

  const lowerFile = cleanFile.toLowerCase();
  const r2Key = `templates/covers/${lowerFile}`;
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

