import type { PlanTier, ProjectType, ProjectVisibility } from "@casefolio/db";
import { z } from "zod";

export const adminProjectPatchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("unpublish"),
    projectId: z.string().uuid("Invalid project ID."),
  }),
  z.object({
    action: z.literal("takedown"),
    projectId: z.string().uuid("Invalid project ID."),
    reason: z.string().trim().max(300).optional(),
  }),
  z.object({
    action: z.literal("restore"),
    projectId: z.string().uuid("Invalid project ID."),
  }),
  z.object({
    action: z.literal("archive"),
    projectId: z.string().uuid("Invalid project ID."),
  }),
  z.object({
    action: z.literal("unarchive"),
    projectId: z.string().uuid("Invalid project ID."),
  }),
]);

export const adminProjectDeleteSchema = z.object({
  projectId: z.string().uuid("Invalid project ID."),
});

export interface AdminProjectListItem {
  id: string;
  name: string;
  slug: string | null;
  type: ProjectType;
  visibility: ProjectVisibility;
  archivedAtIso: string | null;
  suspendedReason: string | null;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  ownerPlan: PlanTier;
  workspaceKind: "personal" | "team";
  orgName: string | null;
  templateName: string;
  templateCoverUrl: string | null;
  views: number;
  exports: number;
  publishedAtIso: string | null;
  updatedAtIso: string;
}

export interface AdminProjectsSummary {
  total: number;
  published: number;
  unlisted: number;
  draft: number;
  archived: number;
  takedownOrSuspended: number;
  team: number;
}

export interface AdminProjectsOverview {
  summary: AdminProjectsSummary;
  projects: AdminProjectListItem[];
}
