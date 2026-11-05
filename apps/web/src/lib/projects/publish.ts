import { and, eq, ne, type PlanTier, type UserRole } from "@casefolio/db";
import { z } from "zod";
import { trackServerProductEvent } from "@/lib/analytics/posthog";
import { db, dbSchema } from "@/lib/db";
import { resolveEffectivePlanForUser } from "@/lib/entitlements/server";
import { slugifyProjectName } from "@/lib/projects/types";
import {
  puckDocumentSchema,
  templateThemeSchema,
  validateTemplateDocument,
  type PuckDocument,
  type TemplateProjectType,
  type TemplateSlotDefinition,
  type TemplateTheme,
} from "@/lib/template/schema";
import { extractRichTextParagraphs } from "@/lib/template/theme-vars";

export const RESERVED_PROJECT_SLUGS = new Set([
  "admin",
  "api",
  "auth",
  "account",
  "analytics",
  "billing",
  "cdn",
  "dashboard",
  "dev",
  "editor",
  "export",
  "exports",
  "help",
  "login",
  "new",
  "notifications",
  "onboarding",
  "p",
  "pricing",
  "projects",
  "published",
  "reset",
  "settings",
  "sign-in",
  "sign-up",
  "templates",
  "verify",
]);

export const PROJECT_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeProjectSlug(rawSlug: string): string {
  return rawSlug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isReservedProjectSlug(slug: string): boolean {
  return RESERVED_PROJECT_SLUGS.has(normalizeProjectSlug(slug));
}

export const projectSlugSchema = z
  .string()
  .transform((val) => normalizeProjectSlug(val))
  .pipe(
    z
      .string()
      .min(3, "Slug must be at least 3 characters.")
      .max(80, "Slug must be 80 characters or fewer.")
      .regex(
        PROJECT_SLUG_REGEX,
        "Slug can only contain lowercase letters, numbers, and single hyphens.",
      )
      .refine((val) => !RESERVED_PROJECT_SLUGS.has(val), {
        message: "This URL slug is reserved. Please pick a different slug.",
      }),
  );

export const publishProjectInputSchema = z.object({
  projectId: z.string().uuid("Invalid project ID."),
  slug: projectSlugSchema,
  visibility: z.enum(["public", "unlisted"]),
});

export type PublishProjectInput = z.input<typeof publishProjectInputSchema>;

export const unpublishProjectInputSchema = z.object({
  projectId: z.string().uuid("Invalid project ID."),
});

export type PublishProjectErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "SLUG_RESERVED"
  | "SLUG_TAKEN";

export type PublishProjectResult =
  | {
      ok: true;
      projectId: string;
      slug: string;
      visibility: "public" | "unlisted";
      publishedAtIso: string;
      publicPath: string;
      publicUrl: string;
    }
  | {
      ok: false;
      code: PublishProjectErrorCode;
      error: string;
      fieldErrors?: Record<string, string>;
    };

export type UnpublishProjectResult =
  | {
      ok: true;
      projectId: string;
      visibility: "private";
      slug: string | null;
      updatedAtIso: string;
    }
  | {
      ok: false;
      code: "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION_ERROR";
      error: string;
    };

export interface CaseStudyPreviewSummary {
  eyebrow: string;
  title: string;
  subtitle: string;
}

export interface ProjectShareSettingsPayload {
  projectId: string;
  projectName: string;
  projectType: TemplateProjectType;
  templateName: string;
  slug: string | null;
  suggestedSlug: string;
  visibility: "private" | "unlisted" | "public";
  isPublished: boolean;
  publishedAtIso: string | null;
  updatedAtIso: string;
  ownerPlan: PlanTier;
  appBaseUrl: string;
  preview: CaseStudyPreviewSummary;
  theme: TemplateTheme;
}

export type ProjectShareSettingsAccessResult =
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "ok"; settings: ProjectShareSettingsPayload };

export interface PublishedCaseStudyPayload {
  project: {
    id: string;
    name: string;
    slug: string;
    type: TemplateProjectType;
    visibility: "public" | "unlisted";
    publishedAtIso: string;
    updatedAtIso: string;
  };
  template: {
    id: string;
    name: string;
    slug: string;
    version: string;
  };
  slots: Record<string, TemplateSlotDefinition>;
  puckData: PuckDocument;
  theme: TemplateTheme;
  owner: {
    id: string;
    name: string | null;
    plan: PlanTier;
  };
  meta: {
    eyebrow: string;
    title: string;
    description: string;
  };
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function resolvePublicAppBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

export function buildPublicCaseStudyUrl(slug: string, baseUrl = resolvePublicAppBaseUrl()): string {
  return `${baseUrl}/p/${encodeURIComponent(slug)}`;
}

export function buildSuggestedProjectSlug(projectName: string, projectId: string): string {
  const base = slugifyProjectName(projectName);
  const shortSuffix = projectId.replace(/-/g, "").slice(0, 6).toLowerCase();

  let candidate = base.length >= 3 ? base : `${base}-${shortSuffix}`;
  if (RESERVED_PROJECT_SLUGS.has(candidate)) {
    candidate = `${candidate}-${shortSuffix}`;
  }
  return candidate.slice(0, 80).replace(/-+$/g, "");
}

function extractCaseStudyMetaFromPuck(
  projectName: string,
  puckData: PuckDocument,
): { eyebrow: string; title: string; description: string } {
  let eyebrow = "Case Study";
  let title = puckData.root?.props?.title?.trim() || projectName;
  let description = "";

  for (const section of puckData.content) {
    if (section.props.hidden) continue;
    if (section.type === "Hero") {
      if (section.props.eyebrow?.trim()) {
        eyebrow = section.props.eyebrow.trim();
      }
      if (section.props.title?.trim()) {
        title = section.props.title.trim();
      }
      if (section.props.subtitle?.trim()) {
        description = section.props.subtitle.trim();
      }
    } else if (!description && section.type === "Overview") {
      const paragraphs = extractRichTextParagraphs(section.props.summary);
      if (paragraphs[0]) {
        description = paragraphs[0];
      }
    }
  }

  if (!description) {
    description = `${title} — interactive design case study built with Casefolio.`;
  }

  return {
    eyebrow: eyebrow.slice(0, 80),
    title: title.slice(0, 140),
    description: description.slice(0, 240),
  };
}

async function canActorEditProjectRow(
  project: { ownerId: string; orgId: string | null },
  actor: { id: string; role: UserRole },
): Promise<boolean> {
  if (project.ownerId === actor.id || actor.role === "admin" || actor.role === "superadmin") {
    return true;
  }

  if (project.orgId) {
    const [membership] = await db
      .select({ role: dbSchema.memberships.role })
      .from(dbSchema.memberships)
      .where(
        and(
          eq(dbSchema.memberships.orgId, project.orgId),
          eq(dbSchema.memberships.userId, actor.id),
        ),
      )
      .limit(1);

    if (membership && (membership.role === "owner" || membership.role === "editor")) {
      return true;
    }
  }

  return false;
}

export async function checkProjectSlugAvailability(
  rawSlug: string,
  excludeProjectId?: string,
): Promise<{
  available: boolean;
  normalizedSlug: string;
  reason?: string;
}> {
  const normalized = normalizeProjectSlug(rawSlug);
  if (normalized.length < 3) {
    return {
      available: false,
      normalizedSlug: normalized,
      reason: "Slug must be at least 3 characters.",
    };
  }
  if (normalized.length > 80) {
    return {
      available: false,
      normalizedSlug: normalized,
      reason: "Slug must be 80 characters or fewer.",
    };
  }
  if (!PROJECT_SLUG_REGEX.test(normalized)) {
    return {
      available: false,
      normalizedSlug: normalized,
      reason: "Slug can only contain lowercase letters, numbers, and single hyphens.",
    };
  }
  if (RESERVED_PROJECT_SLUGS.has(normalized)) {
    return {
      available: false,
      normalizedSlug: normalized,
      reason: "This URL slug is reserved.",
    };
  }

  const whereClause =
    excludeProjectId && UUID_REGEX.test(excludeProjectId)
      ? and(eq(dbSchema.projects.slug, normalized), ne(dbSchema.projects.id, excludeProjectId))
      : eq(dbSchema.projects.slug, normalized);

  const [conflict] = await db
    .select({ id: dbSchema.projects.id })
    .from(dbSchema.projects)
    .where(whereClause)
    .limit(1);

  if (conflict) {
    return {
      available: false,
      normalizedSlug: normalized,
      reason: "That slug is already taken by another case study.",
    };
  }

  return {
    available: true,
    normalizedSlug: normalized,
  };
}

export async function getProjectShareSettingsForUser(
  projectId: string,
  user: { id: string; role: UserRole },
): Promise<ProjectShareSettingsAccessResult> {
  if (!UUID_REGEX.test(projectId)) {
    return { status: "not_found" };
  }

  const [row] = await db
    .select({
      project: dbSchema.projects,
      version: dbSchema.templateVersions,
      template: dbSchema.templates,
      ownerPlan: dbSchema.users.plan,
    })
    .from(dbSchema.projects)
    .innerJoin(
      dbSchema.templateVersions,
      eq(dbSchema.projects.templateVersionId, dbSchema.templateVersions.id),
    )
    .innerJoin(dbSchema.templates, eq(dbSchema.templateVersions.templateId, dbSchema.templates.id))
    .innerJoin(dbSchema.users, eq(dbSchema.projects.ownerId, dbSchema.users.id))
    .where(eq(dbSchema.projects.id, projectId))
    .limit(1);

  if (!row) {
    return { status: "not_found" };
  }

  const canEdit = await canActorEditProjectRow(row.project, user);
  if (!canEdit) {
    return { status: "forbidden" };
  }

  const tplDocCheck = validateTemplateDocument(row.version.data);
  if (!tplDocCheck.ok) {
    return { status: "not_found" };
  }

  const puckCheck = puckDocumentSchema.safeParse(row.project.puckData);
  const themeCheck = templateThemeSchema.safeParse(row.project.theme);
  const resolvedPuck = puckCheck.success ? puckCheck.data : tplDocCheck.data.puck;
  const resolvedTheme = themeCheck.success ? themeCheck.data : tplDocCheck.data.template.theme;

  let suggestedSlug = row.project.slug ?? buildSuggestedProjectSlug(row.project.name, row.project.id);
  if (!row.project.slug) {
    const availability = await checkProjectSlugAvailability(suggestedSlug, row.project.id);
    if (!availability.available) {
      const suffix = row.project.id.replace(/-/g, "").slice(0, 6).toLowerCase();
      suggestedSlug = `${suggestedSlug.slice(0, 70)}-${suffix}`;
    }
  }

  const meta = extractCaseStudyMetaFromPuck(row.project.name, resolvedPuck);
  const isPublished =
    (row.project.visibility === "public" || row.project.visibility === "unlisted") &&
    row.project.publishedAt !== null &&
    Boolean(row.project.slug);

  const effectiveOwnerPlan = await resolveEffectivePlanForUser(row.project.ownerId);

  return {
    status: "ok",
    settings: {
      projectId: row.project.id,
      projectName: row.project.name,
      projectType: row.project.type,
      templateName: row.template.name,
      slug: row.project.slug,
      suggestedSlug,
      visibility: row.project.visibility,
      isPublished,
      publishedAtIso: row.project.publishedAt ? row.project.publishedAt.toISOString() : null,
      updatedAtIso: row.project.updatedAt.toISOString(),
      ownerPlan: effectiveOwnerPlan,
      appBaseUrl: resolvePublicAppBaseUrl(),
      preview: {
        eyebrow: meta.eyebrow,
        title: meta.title,
        subtitle: meta.description,
      },
      theme: resolvedTheme,
    },
  };
}

export async function publishProjectForUser(
  rawInput: unknown,
  user: { id: string; role: UserRole },
): Promise<PublishProjectResult> {
  if (
    typeof rawInput === "object" &&
    rawInput !== null &&
    "slug" in rawInput &&
    typeof (rawInput as { slug?: unknown }).slug === "string" &&
    isReservedProjectSlug((rawInput as { slug: string }).slug)
  ) {
    return {
      ok: false,
      code: "SLUG_RESERVED",
      error: "This URL slug is reserved. Please pick a different slug.",
      fieldErrors: { slug: "This URL slug is reserved. Please pick a different slug." },
    };
  }

  const parsed = publishProjectInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] ? String(issue.path[0]) : "root";
      if (!fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: parsed.error.issues[0]?.message ?? "Invalid publish configuration.",
      fieldErrors,
    };
  }

  const valid = parsed.data;

  const [existing] = await db
    .select()
    .from(dbSchema.projects)
    .where(eq(dbSchema.projects.id, valid.projectId))
    .limit(1);

  if (!existing) {
    return {
      ok: false,
      code: "NOT_FOUND",
      error: "Project not found.",
    };
  }

  const canEdit = await canActorEditProjectRow(existing, user);
  if (!canEdit) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "You do not have permission to publish this project.",
    };
  }

  const availability = await checkProjectSlugAvailability(valid.slug, existing.id);
  if (!availability.available) {
    return {
      ok: false,
      code: "SLUG_TAKEN",
      error: availability.reason ?? "That slug is already taken.",
      fieldErrors: { slug: availability.reason ?? "That slug is already taken." },
    };
  }

  const now = new Date();
  const publishedAt = existing.publishedAt ?? now;

  try {
    const [updated] = await db
      .update(dbSchema.projects)
      .set({
        slug: availability.normalizedSlug,
        visibility: valid.visibility,
        publishedAt,
        updatedAt: now,
      })
      .where(eq(dbSchema.projects.id, existing.id))
      .returning();

    if (!updated || !updated.slug || !updated.publishedAt) {
      return {
        ok: false,
        code: "NOT_FOUND",
        error: "Failed to publish project.",
      };
    }

    await trackServerProductEvent({
      event: "published",
      distinctId: user.id,
      properties: {
        projectId: updated.id,
        visibility: valid.visibility,
        isFirstPublish: existing.publishedAt === null,
      },
    });

    return {
      ok: true,
      projectId: updated.id,
      slug: updated.slug,
      visibility: valid.visibility,
      publishedAtIso: updated.publishedAt.toISOString(),
      publicPath: `/p/${updated.slug}`,
      publicUrl: buildPublicCaseStudyUrl(updated.slug),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("unique") || message.includes("duplicate")) {
      return {
        ok: false,
        code: "SLUG_TAKEN",
        error: "That slug is already taken by another case study.",
        fieldErrors: { slug: "That slug is already taken by another case study." },
      };
    }
    throw err;
  }
}

export async function unpublishProjectForUser(
  rawProjectId: string,
  user: { id: string; role: UserRole },
): Promise<UnpublishProjectResult> {
  const parsed = unpublishProjectInputSchema.safeParse({ projectId: rawProjectId });
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: parsed.error.issues[0]?.message ?? "Invalid project ID.",
    };
  }

  const [existing] = await db
    .select()
    .from(dbSchema.projects)
    .where(eq(dbSchema.projects.id, parsed.data.projectId))
    .limit(1);

  if (!existing) {
    return {
      ok: false,
      code: "NOT_FOUND",
      error: "Project not found.",
    };
  }

  const canEdit = await canActorEditProjectRow(existing, user);
  if (!canEdit) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "You do not have permission to unpublish this project.",
    };
  }

  const now = new Date();
  const [updated] = await db
    .update(dbSchema.projects)
    .set({
      visibility: "private",
      publishedAt: null,
      updatedAt: now,
    })
    .where(eq(dbSchema.projects.id, existing.id))
    .returning();

  if (!updated) {
    return {
      ok: false,
      code: "NOT_FOUND",
      error: "Project not found.",
    };
  }

  return {
    ok: true,
    projectId: updated.id,
    visibility: "private",
    slug: updated.slug,
    updatedAtIso: updated.updatedAt.toISOString(),
  };
}

export async function getPublishedProjectBySlug(
  rawSlug: string,
): Promise<PublishedCaseStudyPayload | null> {
  const normalizedSlug = normalizeProjectSlug(rawSlug);
  if (!normalizedSlug || !PROJECT_SLUG_REGEX.test(normalizedSlug)) {
    return null;
  }

  const [row] = await db
    .select({
      project: dbSchema.projects,
      version: dbSchema.templateVersions,
      template: dbSchema.templates,
      owner: {
        id: dbSchema.users.id,
        name: dbSchema.users.name,
        plan: dbSchema.users.plan,
        suspended: dbSchema.users.suspended,
      },
    })
    .from(dbSchema.projects)
    .innerJoin(
      dbSchema.templateVersions,
      eq(dbSchema.projects.templateVersionId, dbSchema.templateVersions.id),
    )
    .innerJoin(dbSchema.templates, eq(dbSchema.templateVersions.templateId, dbSchema.templates.id))
    .innerJoin(dbSchema.users, eq(dbSchema.projects.ownerId, dbSchema.users.id))
    .where(eq(dbSchema.projects.slug, normalizedSlug))
    .limit(1);

  if (!row) {
    return null;
  }

  if (
    row.owner.suspended ||
    row.project.publishedAt === null ||
    !row.project.slug ||
    (row.project.visibility !== "public" && row.project.visibility !== "unlisted")
  ) {
    return null;
  }

  const tplDocCheck = validateTemplateDocument(row.version.data);
  if (!tplDocCheck.ok) {
    return null;
  }

  const tplDoc = tplDocCheck.data;
  const puckCheck = puckDocumentSchema.safeParse(row.project.puckData);
  const themeCheck = templateThemeSchema.safeParse(row.project.theme);
  const resolvedPuck = puckCheck.success ? puckCheck.data : structuredClone(tplDoc.puck);
  const resolvedTheme = themeCheck.success
    ? themeCheck.data
    : structuredClone(tplDoc.template.theme);

  const meta = extractCaseStudyMetaFromPuck(row.project.name, resolvedPuck);
  const effectiveOwnerPlan = await resolveEffectivePlanForUser(row.owner.id);

  return {
    project: {
      id: row.project.id,
      name: row.project.name,
      slug: row.project.slug,
      type: row.project.type,
      visibility: row.project.visibility,
      publishedAtIso: row.project.publishedAt.toISOString(),
      updatedAtIso: row.project.updatedAt.toISOString(),
    },
    template: {
      id: row.template.id,
      name: row.template.name,
      slug: row.template.slug,
      version: row.version.version,
    },
    slots: tplDoc.template.slots,
    puckData: resolvedPuck,
    theme: resolvedTheme,
    owner: {
      id: row.owner.id,
      name: row.owner.name,
      plan: effectiveOwnerPlan,
    },
    meta,
  };
}

