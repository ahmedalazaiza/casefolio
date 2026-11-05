import { z } from "zod";

export const REPORT_CATEGORIES = [
  "Spam or scam",
  "Plagiarism or copyright",
  "Phishing or malware",
  "Harassment or inappropriate",
  "Other policy violation",
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export const createCaseStudyReportSchema = z.object({
  projectId: z.string().uuid("Invalid case study ID."),
  category: z.enum(REPORT_CATEGORIES),
  details: z
    .string()
    .trim()
    .max(500, "Details must be 500 characters or fewer.")
    .optional(),
});

export type CreateCaseStudyReportInput = z.infer<typeof createCaseStudyReportSchema>;

export const MODERATION_QUEUE_FILTERS = ["open", "dismissed", "takedown"] as const;
export type ModerationQueueFilter = (typeof MODERATION_QUEUE_FILTERS)[number];

export const adminModerationPatchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("dismiss"),
    projectId: z.string().uuid("Invalid project ID."),
  }),
  z.object({
    action: z.literal("takedown"),
    projectId: z.string().uuid("Invalid project ID."),
  }),
  z.object({
    action: z.literal("dismiss_all_open"),
  }),
]);

export interface AdminModerationCaseItem {
  id: string;
  projectId: string;
  projectName: string;
  projectSlug: string | null;
  projectVisibility: "private" | "unlisted" | "public";
  publishedAtIso: string | null;
  authorId: string;
  authorName: string;
  authorEmail: string;
  queueBucket: ModerationQueueFilter;
  primaryReason: string;
  reportNotes: string[];
  reportCount: number;
  latestReportedAtIso: string;
}

export interface AdminModerationOverview {
  openCount: number;
  dismissedCount: number;
  takedownCount: number;
  items: AdminModerationCaseItem[];
}

export function filterModerationItems(
  items: readonly AdminModerationCaseItem[],
  filter: ModerationQueueFilter,
): AdminModerationCaseItem[] {
  return items.filter((item) => item.queueBucket === filter);
}

export function extractPrimaryReasonLabel(rawReason: string): string {
  const idx = rawReason.indexOf(":");
  if (idx > 0 && idx <= 40) {
    return rawReason.slice(0, idx).trim();
  }
  return rawReason.length > 36 ? `${rawReason.slice(0, 36).trim()}…` : rawReason.trim();
}
