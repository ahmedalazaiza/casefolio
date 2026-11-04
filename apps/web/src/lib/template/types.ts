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
