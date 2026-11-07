import type { PlanTier } from "@casefolio/db";
import { z } from "zod";
import {
  DECIMAL_GB,
  DECIMAL_KB,
  DECIMAL_MB,
  getWorkspaceQuotas,
} from "@/lib/billing/plans";
import { cropRectSchema } from "@/lib/template/schema";

export const ALLOWED_UPLOAD_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export type AllowedUploadMimeType = (typeof ALLOWED_UPLOAD_MIME_TYPES)[number];

export const MAX_IMAGE_DIMENSION_PX = 16_384;
export const MAX_IMAGE_MEGAPIXELS = 64;

export interface PlanUploadQuota {
  maxFileBytes: number;
  maxTotalBytes: number;
  monthlyUploadsBytes: number;
  maxAssetsPerProject: number;
}

export const PLAN_UPLOAD_QUOTAS: Record<PlanTier, PlanUploadQuota> = {
  free: {
    maxFileBytes: 10 * DECIMAL_MB,
    maxTotalBytes: 250 * DECIMAL_MB,
    monthlyUploadsBytes: 500 * DECIMAL_MB,
    maxAssetsPerProject: 50,
  },
  pro: {
    maxFileBytes: 25 * DECIMAL_MB,
    maxTotalBytes: 5 * DECIMAL_GB,
    monthlyUploadsBytes: 10 * DECIMAL_GB,
    maxAssetsPerProject: 200,
  },
  team: {
    maxFileBytes: 25 * DECIMAL_MB,
    maxTotalBytes: 10 * DECIMAL_GB,
    monthlyUploadsBytes: 20 * DECIMAL_GB,
    maxAssetsPerProject: 300,
  },
};

export function getUploadQuotaForPlan(
  plan: PlanTier,
  paidSeats = 1,
): PlanUploadQuota {
  const wsQuotas = getWorkspaceQuotas(plan, paidSeats);
  return {
    maxFileBytes: wsQuotas.maxFileBytes,
    maxTotalBytes: wsQuotas.storageBytesLimit,
    monthlyUploadsBytes: wsQuotas.monthlyUploadsBytesLimit,
    maxAssetsPerProject:
      plan === "team" ? 300 : plan === "pro" ? 200 : 50,
  };
}

export function isAllowedUploadMimeType(mime: string): mime is AllowedUploadMimeType {
  return (ALLOWED_UPLOAD_MIME_TYPES as readonly string[]).includes(
    mime.toLowerCase().trim(),
  );
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
  if (bytes >= DECIMAL_GB) {
    const gb = bytes / DECIMAL_GB;
    return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`;
  }
  if (bytes >= DECIMAL_MB) {
    const mb = bytes / DECIMAL_MB;
    return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
  }
  if (bytes >= DECIMAL_KB) {
    return `${Math.round(bytes / DECIMAL_KB)} KB`;
  }
  return `${bytes} B`;
}

export function validateImagePixelBounds(
  width: number,
  height: number,
): { ok: true } | { ok: false; error: string } {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width > MAX_IMAGE_DIMENSION_PX ||
    height > MAX_IMAGE_DIMENSION_PX
  ) {
    return {
      ok: false,
      error: `Image dimensions must be between 1×1 and ${MAX_IMAGE_DIMENSION_PX}×${MAX_IMAGE_DIMENSION_PX} pixels.`,
    };
  }

  if (width * height > MAX_IMAGE_MEGAPIXELS * 1_000_000) {
    return {
      ok: false,
      error: `Image exceeds the ${MAX_IMAGE_MEGAPIXELS} MP safety limit.`,
    };
  }

  return { ok: true };
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
  width: z.number().int().positive("Image width must be positive.").max(MAX_IMAGE_DIMENSION_PX),
  height: z.number().int().positive("Image height must be positive.").max(MAX_IMAGE_DIMENSION_PX),
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
