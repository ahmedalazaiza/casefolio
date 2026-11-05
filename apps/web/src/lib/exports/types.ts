import { z } from "zod";

export const EXPORT_FORMATS = ["png_long", "pdf", "behance"] as const;
export type ExportFormatOption = (typeof EXPORT_FORMATS)[number];

export const EXPORT_STATUSES = ["queued", "processing", "completed", "failed"] as const;
export type ExportJobStatus = (typeof EXPORT_STATUSES)[number];

export const FREE_MONTHLY_EXPORT_LIMIT = 5;

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
    badge: "1440px · Retina 2×",
    description:
      "Full-length vertical PNG presentation optimized for Dribbble, Notion, and portfolio decks.",
    requiresPro: false,
    fileExtension: "png",
  },
  {
    format: "pdf",
    label: "PDF Case Study",
    badge: "Vector Text · Print Ready",
    description:
      "Crisp multi-section PDF document with selectable typography and embedded theme backgrounds.",
    requiresPro: true,
    fileExtension: "pdf",
  },
  {
    format: "behance",
    label: "Behance Slices (.zip)",
    badge: "1400px Seamless Slices",
    description:
      "Automatically slices your case study into 1400px-wide PNG panels ready to upload in sequence on Behance.",
    requiresPro: true,
    fileExtension: "zip",
  },
] as const;

export const createExportInputSchema = z.object({
  projectId: z.string().uuid("Invalid project ID."),
  format: z.enum(EXPORT_FORMATS),
});

export type CreateExportInput = z.infer<typeof createExportInputSchema>;

export interface ExportHistoryItem {
  id: string;
  projectId: string;
  format: ExportFormatOption;
  status: ExportJobStatus;
  r2Key: string | null;
  error: string | null;
  createdAtIso: string;
  downloadUrl: string | null;
}

export interface ProjectExportsOverviewPayload {
  projectId: string;
  projectName: string;
  templateName: string;
  slug: string | null;
  isPublished: boolean;
  ownerPlan: "free" | "pro" | "team";
  hasWatermark: boolean;
  monthlyExportsUsed: number;
  monthlyExportsLimit: number | null;
  exports: ExportHistoryItem[];
}

export type EnqueueExportErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "PLAN_UPGRADE_REQUIRED"
  | "EXPORT_LIMIT_REACHED"
  | "RATE_LIMITED";

export type EnqueueExportResult =
  | {
      ok: true;
      exportJob: ExportHistoryItem;
      hasWatermark: boolean;
      monthlyExportsUsed: number;
      monthlyExportsLimit: number | null;
    }
  | {
      ok: false;
      code: EnqueueExportErrorCode;
      error: string;
    };
