import type { PlanTier, ProductFeedbackTrigger } from "@casefolio/db";
import { z } from "zod";

export const PRIMARY_USE_CASE_OPTIONS = [
  "Job search / UX portfolio",
  "Agency / Studio client work",
  "Freelance case studies",
  "Product team showcase",
] as const;

export const FEATURE_REQUEST_OPTIONS = [
  "More templates & layouts",
  "Custom domains & white-label",
  "Figma import / live sync",
  "More export formats (Video / Slides)",
  "Team collaboration comments",
  "Analytics & visitor insights",
] as const;

export const POSITIVE_SENTIMENT_TAGS = [
  "Fast workflow",
  "Clean templates",
  "Crisp exports",
  "Easy customization",
  "Great value",
] as const;

export const CRITICAL_SENTIMENT_TAGS = [
  "Need more templates",
  "Editor flexibility",
  "Export speed/quality",
  "Pricing limits",
  "Learning curve",
] as const;

export const FEEDBACK_SNOOZE_DAYS = 30;

export const feedbackPostSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("submit"),
    rating: z.number().int().min(1).max(5),
    triggerMoment: z
      .enum(["first_publish", "first_export", "milestone_usage", "manual"])
      .default("manual"),
    primaryUseCase: z.string().trim().max(120).optional().nullable(),
    topFeatureRequest: z.string().trim().max(120).optional().nullable(),
    sentimentTags: z.array(z.string().trim().max(60)).max(8).default([]),
    comment: z.string().trim().max(1500).optional().nullable(),
  }),
  z.object({
    action: z.literal("snooze"),
    triggerMoment: z
      .enum(["first_publish", "first_export", "milestone_usage", "manual"])
      .default("manual"),
  }),
]);

export interface FeedbackEligibilityState {
  eligible: boolean;
  alreadySubmitted: boolean;
  snoozedUntilIso: string | null;
  triggerMoment: ProductFeedbackTrigger | null;
}

export interface AdminFeedbackEntry {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  planTier: PlanTier;
  rating: number;
  triggerMoment: ProductFeedbackTrigger;
  primaryUseCase: string | null;
  topFeatureRequest: string | null;
  sentimentTags: string[];
  comment: string | null;
  createdAtIso: string;
}

export interface AdminFeedbackDistributionBucket {
  stars: 5 | 4 | 3 | 2 | 1;
  count: number;
  percent: number;
}

export interface AdminFeedbackFeatureTally {
  feature: string;
  count: number;
}

export interface AdminFeedbackOverview {
  totalResponses: number;
  averageRating: number | null;
  promoterPercent: number;
  distribution: AdminFeedbackDistributionBucket[];
  topFeatureRequests: AdminFeedbackFeatureTally[];
  entries: AdminFeedbackEntry[];
}
