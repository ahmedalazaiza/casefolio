import type { PlanTier } from "@casefolio/db";
import { z } from "zod";

export const EXPORT_FORMATS = ["png_long", "pdf", "behance"] as const;
export type ExportFormatOption = (typeof EXPORT_FORMATS)[number];

export const EXPORT_STATUSES = ["queued", "processing", "completed", "failed"] as const;
export type ExportJobStatus = (typeof EXPORT_STATUSES)[number];

export const FREE_MONTHLY_EXPORT_LIMIT = 5;
export const PRO_MONTHLY_EXPORT_LIMIT = 60;
export const TEAMS_MONTHLY_EXPORT_LIMIT_PER_SEAT = 100;

export const FREE_MAX_PNG_WIDTH_PX = 1_440;
export const PAID_MAX_PNG_WIDTH_PX = 2_880;
export const FREE_MAX_EXPORT_MEGAPIXELS = 40;
export const PAID_MAX_EXPORT_MEGAPIXELS = 120;
export const PAID_MAX_PDF_PAGES = 60;

export interface ExportPresetDescriptor {
  format: ExportFormatOption;
  label: string;
  badge: string;
  description: string;
  requiresPro: boolean;
  fileExtension: "png" | "pdf" | "zip";
}

export const EXPORT_PRESETS: readonly ExportPresetDescriptor[] = [
  {
    format: "png_long",
    label: "PNG Long Presentation",
    badge: "1,440px (1×) · 2,880px (2× Paid)",
    description:
      "Full-length PNG presentation (1× with subtle Casefolio watermark on Free; high-res 1×/2× without watermark on Pro, Team & Plus).",
    requiresPro: false,
    fileExtension: "png",
  },
  {
    format: "pdf",
    label: "PDF Case Study",
    badge: "Up to 60 Pages · Selectable Text",
    description:
      "Multi-section PDF document (includes subtle Casefolio watermark on Free; unwatermarked on Pro/Team and completely white-labeled on Plus).",
    requiresPro: false,
    fileExtension: "pdf",
  },
  {
    format: "behance",
    label: "Behance Image Pack (.zip)",
    badge: "1,400px Slices · Manual Upload",
    description:
      "Slices your case study into seamless 1,400px PNG panels packaged in a ZIP for manual upload to Behance.",
    requiresPro: true,
    fileExtension: "zip",
  },
] as const;

export const createExportInputSchema = z.object({
  projectId: z.string().uuid("Invalid project ID."),
  format: z.enum(EXPORT_FORMATS),
  scale: z.union([z.literal(1), z.literal(2)]).optional(),
});

export type CreateExportInput = z.infer<typeof createExportInputSchema>;

export interface ExportHistoryItem {
  id: string;
  projectId: string;
  format: ExportFormatOption;
  status: ExportJobStatus;
  scale?: number;
  projectRevision?: number;
  hasWatermark?: boolean;
  r2Key: string | null;
  error: string | null;
  createdAtIso: string;
  expiresAtIso?: string | null;
  downloadUrl: string | null;
  renderUrl?: string | null;
}

export interface ProjectExportsOverviewPayload {
  projectId: string;
  projectName: string;
  templateName: string;
  slug: string | null;
  isPublished: boolean;
  ownerPlan: PlanTier;
  hasWatermark: boolean;
  monthlyExportsUsed: number;
  monthlyExportsLimit: number;
  exports: ExportHistoryItem[];
}

export type EnqueueExportErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "PLAN_UPGRADE_REQUIRED"
  | "EXPORT_LIMIT_REACHED"
  | "PAST_DUE_READ_ONLY"
  | "RATE_LIMITED";

export type EnqueueExportResult =
  | {
      ok: true;
      exportJob: ExportHistoryItem;
      reusedCachedArtifact?: boolean;
      hasWatermark: boolean;
      monthlyExportsUsed: number;
      monthlyExportsLimit: number;
    }
  | {
      ok: false;
      code: EnqueueExportErrorCode;
      error: string;
    };
