import type {
  ProjectType,
  ProjectVisibility,
  SpaceVisibility,
  TemplateTier,
  WorkspaceKind,
} from "@casefolio/db";
import { z } from "zod";

export const renameProjectInputSchema = z.object({
  projectId: z.string().uuid("Invalid project ID."),
  name: z
    .string()
    .trim()
    .min(2, "Project name must be at least 2 characters.")
    .max(120, "Project name must be 120 characters or fewer."),
});

export type RenameProjectInput = z.infer<typeof renameProjectInputSchema>;

export const duplicateProjectInputSchema = z.object({
  projectId: z.string().uuid("Invalid project ID."),
});

export type DuplicateProjectInput = z.infer<typeof duplicateProjectInputSchema>;

export const deleteProjectInputSchema = z.object({
  projectId: z.string().uuid("Invalid project ID."),
  confirmName: z.string().trim().min(1, "Type the project name to confirm deletion."),
  deleteExports: z.boolean().default(true),
});

export type DeleteProjectInput = z.infer<typeof deleteProjectInputSchema>;

export const archiveProjectInputSchema = z.object({
  projectId: z.string().uuid("Invalid project ID."),
});

export type ArchiveProjectInput = z.infer<typeof archiveProjectInputSchema>;

export interface DashboardProjectItem {
  id: string;
  name: string;
  type: ProjectType;
  visibility: ProjectVisibility;
  slug: string | null;
  publishedAtIso: string | null;
  archivedAtIso?: string | null;
  createdAtIso: string;
  updatedAtIso: string;
  templateName: string;
  templateTier: TemplateTier;
  templateSlug?: string;
  templateCoverUrl?: string | null;
  thumbnailUrl?: string | null;
  workspaceId?: string | null;
  workspaceKind?: WorkspaceKind;
  spaceId?: string | null;
  spaceName?: string;
  spaceVisibility?: SpaceVisibility;
  isCreator?: boolean;
  isLockedByDowngrade?: boolean;
  isKeptActiveProject?: boolean;
}

export type DashboardProjectMutationCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "PLAN_LIMIT_REACHED"
  | "WORKSPACE_FROZEN";

export type RenameProjectResult =
  | { ok: true; projectId: string; name: string; updatedAtIso: string }
  | { ok: false; code: DashboardProjectMutationCode; error: string };

export type DuplicateProjectResult =
  | { ok: true; project: DashboardProjectItem }
  | { ok: false; code: DashboardProjectMutationCode; error: string };

export type DeleteProjectResult =
  | { ok: true; deletedProjectId: string }
  | { ok: false; code: DashboardProjectMutationCode; error: string };

export type ArchiveProjectResult =
  | { ok: true; projectId: string; archivedAtIso: string | null }
  | { ok: false; code: DashboardProjectMutationCode; error: string };
