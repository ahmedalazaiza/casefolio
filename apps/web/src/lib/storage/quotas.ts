import type { PlanTier } from "@casefolio/db";
import { z } from "zod";
import { cropRectSchema } from "@/lib/template/schema";

export const ALLOWED_UPLOAD_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export type AllowedUploadMimeType = (typeof ALLOWED_UPLOAD_MIME_TYPES)[number];

export interface PlanUploadQuota {
  maxFileBytes: number;
  maxTotalBytes: number;
  maxAssetsPerProject: number;
}

const MB = 1024 * 1024;
const GB = 1024 * MB;

export const PLAN_UPLOAD_QUOTAS: Record<PlanTier, PlanUploadQuota> = {
  free: {
    maxFileBytes: 5 * MB,
    maxTotalBytes: 50 * MB,
    maxAssetsPerProject: 25,
  },
  pro: {
    maxFileBytes: 15 * MB,
    maxTotalBytes: 2 * GB,
    maxAssetsPerProject: 150,
  },
  team: {
    maxFileBytes: 25 * MB,
    maxTotalBytes: 10 * GB,
    maxAssetsPerProject: 300,
  },
};

export function getUploadQuotaForPlan(plan: PlanTier): PlanUploadQuota {
  return PLAN_UPLOAD_QUOTAS[plan] ?? PLAN_UPLOAD_QUOTAS.free;
}

export function isAllowedUploadMimeType(mime: string): mime is AllowedUploadMimeType {
  return (ALLOWED_UPLOAD_MIME_TYPES as readonly string[]).includes(mime.toLowerCase().trim());
}

export function extensionForMimeType(mime: AllowedUploadMimeType): "png" | "jpg" | "webp" {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
  }
}

export function formatBytesHuman(bytes: number): string {
  if (bytes >= GB) {
    const gb = bytes / GB;
    return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`;
  }
  if (bytes >= MB) {
    const mb = bytes / MB;
    return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}

/**
 * Inspects file header magic bytes so spoofed extensions or MIME headers
 * (e.g. an SVG or executable renamed to `.png`) are rejected server-side.
 */
export function detectImageMimeFromMagicBytes(bytes: Uint8Array): AllowedUploadMimeType | null {
  if (bytes.length >= 8) {
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    ) {
      return "image/png";
    }
  }

  if (bytes.length >= 3) {
    // JPEG: FF D8 FF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return "image/jpeg";
    }
  }

  if (bytes.length >= 12) {
    // WebP: "RIFF" <4-byte size> "WEBP"
    if (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    ) {
      return "image/webp";
    }
  }

  return null;
}

export const presignUploadInputSchema = z.object({
  projectId: z.string().uuid("Valid project ID is required."),
  slot: z.string().trim().min(1, "Slot key is required.").max(120),
  fileName: z.string().trim().min(1, "File name is required.").max(255),
  mimeType: z.string().trim().min(1, "MIME type is required."),
  bytes: z.number().int().positive("File size must be greater than 0 bytes."),
  width: z.number().int().positive("Image width must be positive.").max(16384),
  height: z.number().int().positive("Image height must be positive.").max(16384),
});

export type PresignUploadInput = z.infer<typeof presignUploadInputSchema>;

export const completeUploadInputSchema = z.object({
  completeToken: z.string().min(20, "Upload completion token is required."),
  crop: cropRectSchema.nullable().optional(),
});

export type CompleteUploadInput = z.infer<typeof completeUploadInputSchema>;

export const updateAssetCropInputSchema = z.object({
  crop: cropRectSchema.nullable(),
});
