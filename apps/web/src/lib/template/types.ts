import type {
  TemplateDocument,
  TemplateProjectType,
  TemplateStatus,
  TemplateTier,
  TemplateValidationIssue,
} from "@/lib/template/schema";

export interface AdminTemplateSummary {
  id: string;
  slug: string;
  name: string;
  type: TemplateProjectType;
  tier: TemplateTier;
  status: TemplateStatus;
  coverUrl: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  currentVersion: string | null;
  sectionCount: number;
  slotCount: number;
  projectCount: number;
  updatedAtIso: string;
}

export interface AdminTemplateVersionItem {
  id: string;
  version: string;
  changelog: string | null;
  publishedAtIso: string | null;
  createdAtIso: string;
  pinnedProjectCount: number;
  document: TemplateDocument | null;
  rawJson: string;
}

export interface AdminTemplateUsageProject {
  id: string;
  name: string;
  slug: string | null;
  visibility: "private" | "unlisted" | "public";
  ownerName: string;
  version: string;
  updatedAtIso: string;
}

export interface AdminTemplateDetail {
  id: string;
  slug: string;
  name: string;
  type: TemplateProjectType;
  tier: TemplateTier;
  status: TemplateStatus;
  coverUrl: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  currentVersionId: string | null;
  currentVersion: string | null;
  totalProjectCount: number;
  versions: AdminTemplateVersionItem[];
  usedInProjects?: AdminTemplateUsageProject[];
}

export interface AdminTemplateFilterState {
  searchQuery: string;
  type: "all" | TemplateProjectType;
  status: "all" | TemplateStatus;
  categorySlug: string;
  tier: "all" | TemplateTier;
}

export function filterAdminTemplates(
  templates: readonly AdminTemplateSummary[],
  filters: AdminTemplateFilterState,
): AdminTemplateSummary[] {
  const q = filters.searchQuery.trim().toLowerCase();

  return templates.filter((item) => {
    if (filters.type !== "all" && item.type !== filters.type) {
      return false;
    }
    if (filters.status !== "all" && item.status !== filters.status) {
      return false;
    }
    if (filters.tier !== "all" && item.tier !== filters.tier) {
      return false;
    }
    if (filters.categorySlug !== "all" && item.categorySlug !== filters.categorySlug) {
      return false;
    }
    if (q) {
      const hay = `${item.name} ${item.slug} ${item.categoryName ?? ""}`.toLowerCase();
      if (!hay.includes(q)) {
        return false;
      }
    }
    return true;
  });
}

export type CreateTemplateVersionResult =
  | {
      ok: true;
      versionId: string;
      version: string;
      status: TemplateStatus;
    }
  | {
      ok: false;
      error: string;
      issues: TemplateValidationIssue[];
    };

export type TemplateLifecycleActionResult =
  | {
      ok: true;
      status: TemplateStatus;
      currentVersionId: string | null;
    }
  | {
      ok: false;
      error: string;
    };

export type DeleteTemplateActionResult =
  | {
      ok: true;
      mode: "deleted" | "retired_archived";
    }
  | {
      ok: false;
      error: string;
    };

export type UpdateTemplateCoverActionResult =
  | {
      ok: true;
      coverUrl: string;
      coverRatio: string;
    }
  | {
      ok: false;
      error: string;
    };

export interface PublishedTemplateItem {
  id: string;
  versionId: string;
  slug: string;
  name: string;
  type: TemplateProjectType;
  tier: TemplateTier;
  coverUrl: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  version: string;
  sectionCount: number;
  slotCount: number;
  document: TemplateDocument;
}
