import {
  and,
  eq,
  ne,
  sql,
  type PlanTier,
  type SpaceVisibility,
  type UserRole,
  type WorkspaceKind,
} from "@casefolio/db";
import { z } from "zod";
import { trackServerProductEvent } from "@/lib/analytics/posthog";
import { db, dbSchema } from "@/lib/db";
import {
  resolveEffectivePlanForUser,
  resolveWorkspaceEntitlementState,
} from "@/lib/entitlements/server";
import { notifyProjectPublished } from "@/lib/notifications/service";
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
import { recordAndCheckWorkspaceBandwidth } from "@/lib/usage/meter";
import { authorizeProjectAccess, ensureProjectWorkspaceAndSpace } from "@/lib/workspaces/acl";
import { getWorkspaceProjectCounts } from "@/lib/workspaces/service";

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
  "recovery",
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
  acknowledgePublicExposure: z.boolean().optional(),
  brandingRemoved: z.boolean().optional(),
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
  | "SLUG_TAKEN"
  | "PUBLISH_LIMIT_REACHED"
  | "PUBLIC_ACK_REQUIRED";

export type PublishProjectResult =
  | {
      ok: true;
      projectId: string;
      slug: string;
      visibility: "public" | "unlisted";
      brandingRemoved: boolean;
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
  workspaceKind: WorkspaceKind;
  spaceVisibility: SpaceVisibility;
  requiresTeamPrivatePublicAck: boolean;
  publicAcknowledged: boolean;
  canPublish: boolean;
  brandingRemoved: boolean;
  canRemoveBranding: boolean;
  whiteLabelEnabled: boolean;
  customDomain: string | null;
  publishedCount: number;
  maxPublishedProjects: number;
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
    brandingRemoved: boolean;
    whiteLabelEnabled: boolean;
    customDomain: string | null;
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

const EMBEDDED_UUID_REGEX =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

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

function collectReferencedAssetIds(puckData: unknown): string[] {
  const serialized = JSON.stringify(puckData ?? {});
  const matches = serialized.match(EMBEDDED_UUID_REGEX) ?? [];
  return Array.from(new Set(matches.map((m) => m.toLowerCase())));
}

function extractCaseStudyMetaFromPuck(
  projectName: string,
  puckData: PuckDocument,
  whiteLabel = false,
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
    description = whiteLabel
      ? `${title} — interactive design case study.`
      : `${title} — interactive design case study built with Casefolio.`;
  }

  return {
    eyebrow: eyebrow.slice(0, 80),
    title: title.slice(0, 140),
    description: description.slice(0, 240),
  };
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

  // Enforce `404` on unauthorized IDs (`Spec §9 & §10.1`)
  const readAuth = await authorizeProjectAccess(projectId, user.id, "read");
  if (!readAuth.ok) {
    return { status: "not_found" };
  }

  const [row] = await db
    .select({
      version: dbSchema.templateVersions,
      template: dbSchema.templates,
    })
    .from(dbSchema.templateVersions)
    .innerJoin(dbSchema.templates, eq(dbSchema.templateVersions.templateId, dbSchema.templates.id))
    .where(eq(dbSchema.templateVersions.id, readAuth.project.templateVersionId))
    .limit(1);

  if (!row) {
    return { status: "not_found" };
  }

  const tplDocCheck = validateTemplateDocument(row.version.data);
  if (!tplDocCheck.ok) {
    return { status: "not_found" };
  }

  const puckCheck = puckDocumentSchema.safeParse(readAuth.project.puckData);
  const themeCheck = templateThemeSchema.safeParse(readAuth.project.theme);
  const resolvedPuck = puckCheck.success ? puckCheck.data : tplDocCheck.data.puck;
  const resolvedTheme = themeCheck.success ? themeCheck.data : tplDocCheck.data.template.theme;

  let suggestedSlug =
    readAuth.project.slug ??
    buildSuggestedProjectSlug(readAuth.project.name, readAuth.project.id);
  if (!readAuth.project.slug) {
    const availability = await checkProjectSlugAvailability(suggestedSlug, readAuth.project.id);
    if (!availability.available) {
      const suffix = readAuth.project.id.replace(/-/g, "").slice(0, 6).toLowerCase();
      suggestedSlug = `${suggestedSlug.slice(0, 70)}-${suffix}`;
    }
  }

  const publishAuth = await authorizeProjectAccess(projectId, user.id, "publish");
  const counts = await getWorkspaceProjectCounts(readAuth.workspace.id);
  const whiteLabelShare = readAuth.entitlement.plan === "plus";
  const meta = extractCaseStudyMetaFromPuck(readAuth.project.name, resolvedPuck, whiteLabelShare);
  const isPublished =
    (readAuth.project.visibility === "public" || readAuth.project.visibility === "unlisted") &&
    readAuth.project.publishedAt !== null &&
    Boolean(readAuth.project.slug);

  const requiresTeamPrivatePublicAck =
    readAuth.workspace.kind === "team" && readAuth.space.visibility === "private";

  return {
    status: "ok",
    settings: {
      projectId: readAuth.project.id,
      projectName: readAuth.project.name,
      projectType: readAuth.project.type,
      templateName: row.template.name,
      slug: readAuth.project.slug,
      suggestedSlug,
      visibility: readAuth.project.visibility,
      isPublished,
      publishedAtIso: readAuth.project.publishedAt
        ? readAuth.project.publishedAt.toISOString()
        : null,
      updatedAtIso: readAuth.project.updatedAt.toISOString(),
      ownerPlan: readAuth.entitlement.plan,
      workspaceKind: readAuth.workspace.kind,
      spaceVisibility: readAuth.space.visibility,
      requiresTeamPrivatePublicAck,
      publicAcknowledged: Boolean(readAuth.project.publicAcknowledgedAt),
      canPublish: publishAuth.ok,
      brandingRemoved:
        whiteLabelShare ||
        (readAuth.project.brandingRemoved && readAuth.entitlement.quotas.brandingRemovable),
      canRemoveBranding: readAuth.entitlement.quotas.brandingRemovable,
      whiteLabelEnabled: whiteLabelShare,
      customDomain: whiteLabelShare ? (readAuth.workspace.customDomain ?? null) : null,
      publishedCount: counts.publishedProjects,
      maxPublishedProjects: readAuth.entitlement.quotas.publishedProjectsLimit,
      appBaseUrl:
        whiteLabelShare && readAuth.workspace.customDomain
          ? `https://${readAuth.workspace.customDomain}`
          : resolvePublicAppBaseUrl(),
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
  const now = new Date();

  const auth = await authorizeProjectAccess(valid.projectId, user.id, "publish", now);
  if (!auth.ok) {
    return {
      ok: false,
      code: auth.status === 404 ? "NOT_FOUND" : "FORBIDDEN",
      error: auth.status === 404 ? "Project not found." : auth.error,
    };
  }

  const existing = auth.project;

  // `Spec §9 line 314-316 & 332`: Publishing from one's own private space inside a Team workspace
  // requires explicit acknowledgment that the published snapshot & selected images will be online.
  const isTeamPrivateSpace =
    auth.workspace.kind === "team" && auth.space.visibility === "private";
  if (
    isTeamPrivateSpace &&
    !valid.acknowledgePublicExposure &&
    existing.publicAcknowledgedAt === null
  ) {
    return {
      ok: false,
      code: "PUBLIC_ACK_REQUIRED",
      error:
        "Acknowledge that publishing from your private team space puts this published snapshot and its selected images online (visible to anyone with the URL, including teammates), while your private space drafts remain hidden.",
    };
  }

  // Block re-publishing if an active moderation takedown exists on this project
  const [activeTakedown] = await db
    .select({ id: dbSchema.reports.id })
    .from(dbSchema.reports)
    .where(
      and(
        eq(dbSchema.reports.projectId, existing.id),
        eq(dbSchema.reports.status, "takedown"),
      ),
    )
    .limit(1);
  if (activeTakedown) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error:
        "This case study was unpublished following a moderation policy takedown and cannot be re-published until cleared by support.",
    };
  }

  const currentlyPublished =
    (existing.visibility === "public" || existing.visibility === "unlisted") &&
    existing.publishedAt !== null;

  const availability = await checkProjectSlugAvailability(valid.slug, existing.id);
  if (!availability.available) {
    return {
      ok: false,
      code: "SLUG_TAKEN",
      error: availability.reason ?? "That slug is already taken.",
      fieldErrors: { slug: availability.reason ?? "That slug is already taken." },
    };
  }

  const publishedAt = existing.publishedAt ?? now;
  const publicAcknowledgedAt =
    existing.publicAcknowledgedAt ??
    (valid.acknowledgePublicExposure || !isTeamPrivateSpace ? now : null);
  const effectiveBrandingRemoved = auth.entitlement.quotas.brandingRemovable
    ? (valid.brandingRemoved ?? true)
    : false;

  const projectAssets = await db
    .select({ id: dbSchema.assets.id })
    .from(dbSchema.assets)
    .where(eq(dbSchema.assets.projectId, existing.id));

  const referencedSet = new Set(collectReferencedAssetIds(existing.puckData));
  const publishedAssetIds = projectAssets
    .map((a) => a.id.toLowerCase())
    .filter((id) => referencedSet.has(id));

  try {
    const txOutcome = await db.transaction(async (tx) => {
      // Serialize simultaneous publish quota checks per workspace (`FOR UPDATE`)
      await tx.execute(
        sql`SELECT id FROM workspaces WHERE id = ${auth.workspace.id} FOR UPDATE`,
      );

      if (!currentlyPublished) {
        const publishedCountRes = await tx.execute<{ total: string | number }>(sql`
          SELECT count(*)::int AS total
          FROM projects
          WHERE workspace_id = ${auth.workspace.id}
            AND archived_at IS NULL
            AND published_at IS NOT NULL
            AND visibility IN ('public', 'unlisted')
        `);
        const publishedCount = Number(publishedCountRes.rows[0]?.total ?? 0);
        if (publishedCount >= auth.entitlement.quotas.publishedProjectsLimit) {
          return {
            ok: false as const,
            code: "PUBLISH_LIMIT_REACHED" as const,
            error: `This workspace has reached its simultaneous published case-study limit (${auth.entitlement.quotas.publishedProjectsLimit}). Unpublish another case study or upgrade your plan.`,
          };
        }
      }

      const [updatedRow] = await tx
        .update(dbSchema.projects)
        .set({
          slug: availability.normalizedSlug,
          visibility: valid.visibility,
          brandingRemoved: effectiveBrandingRemoved,
          publicAcknowledgedAt,
          publishedAt,
          updatedAt: now,
        })
        .where(eq(dbSchema.projects.id, existing.id))
        .returning();

      if (!updatedRow || !updatedRow.slug || !updatedRow.publishedAt) {
        return {
          ok: false as const,
          code: "NOT_FOUND" as const,
          error: "Failed to publish project.",
        };
      }

      // Isolate public rendering strictly to `published_snapshots` & referenced project assets (`Spec §10.3`)
      await tx
        .insert(dbSchema.publishedSnapshots)
        .values({
          projectId: updatedRow.id,
          workspaceId: auth.workspace.id,
          spaceId: auth.space.id,
          revision: updatedRow.revision,
          puckData: structuredClone(updatedRow.puckData),
          theme: structuredClone(updatedRow.theme),
          publishedAssetIds,
          brandingRemoved: effectiveBrandingRemoved,
          suspendedReason: null,
          publishedByUserId: user.id,
          publicAcknowledgedAt,
          publishedAt: updatedRow.publishedAt,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: dbSchema.publishedSnapshots.projectId,
          set: {
            workspaceId: auth.workspace.id,
            spaceId: auth.space.id,
            revision: updatedRow.revision,
            puckData: structuredClone(updatedRow.puckData),
            theme: structuredClone(updatedRow.theme),
            publishedAssetIds,
            brandingRemoved: effectiveBrandingRemoved,
            suspendedReason: null,
            publishedByUserId: user.id,
            publicAcknowledgedAt,
            publishedAt: updatedRow.publishedAt,
            updatedAt: now,
          },
        });

      return { ok: true as const, updated: updatedRow };
    });

    if (!txOutcome.ok) {
      return txOutcome;
    }

    const updated = txOutcome.updated;
    const resolvedSlug = updated.slug ?? valid.slug;
    const resolvedPublishedAt = updated.publishedAt ?? now;

    const isFirstPublish = existing.publishedAt === null;

    await trackServerProductEvent({
      event: "published",
      distinctId: user.id,
      properties: {
        projectId: updated.id,
        visibility: valid.visibility,
        isFirstPublish,
      },
    });

    if (isFirstPublish) {
      await notifyProjectPublished({
        userId: updated.ownerId,
        projectId: updated.id,
        projectName: updated.name,
        slug: resolvedSlug,
      }).catch(() => undefined);
    }

    return {
      ok: true,
      projectId: updated.id,
      slug: resolvedSlug,
      visibility: valid.visibility,
      brandingRemoved: effectiveBrandingRemoved,
      publishedAtIso: resolvedPublishedAt.toISOString(),
      publicPath: `/p/${resolvedSlug}`,
      publicUrl: buildPublicCaseStudyUrl(resolvedSlug),
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

  const auth = await authorizeProjectAccess(parsed.data.projectId, user.id, "unpublish");
  if (!auth.ok) {
    return {
      ok: false,
      code: auth.status === 404 ? "NOT_FOUND" : "FORBIDDEN",
      error: auth.status === 404 ? "Project not found." : auth.error,
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
    .where(eq(dbSchema.projects.id, auth.project.id))
    .returning();

  await db
    .delete(dbSchema.publishedSnapshots)
    .where(eq(dbSchema.publishedSnapshots.projectId, auth.project.id));

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
    row.project.archivedAt !== null ||
    row.project.publishedAt === null ||
    !row.project.slug ||
    (row.project.visibility !== "public" && row.project.visibility !== "unlisted")
  ) {
    return null;
  }

  const ensured = await ensureProjectWorkspaceAndSpace(row.project);
  if (ensured.space.recoveryState === "frozen_member_departed") {
    return null;
  }

  const ent = await resolveWorkspaceEntitlementState(ensured.workspace.id);
  if (ent && (ent.lifecycle.isPastDueReadOnly || ent.frozenReason === "fraud_suspended")) {
    return null;
  }

  const [snapshot] = await db
    .select()
    .from(dbSchema.publishedSnapshots)
    .where(eq(dbSchema.publishedSnapshots.projectId, row.project.id))
    .limit(1);

  if (snapshot?.suspendedReason) {
    return null;
  }

  const tplDocCheck = validateTemplateDocument(row.version.data);
  if (!tplDocCheck.ok) {
    return null;
  }

  const tplDoc = tplDocCheck.data;
  const sourcePuck = snapshot ? snapshot.puckData : row.project.puckData;
  const sourceTheme = snapshot ? snapshot.theme : row.project.theme;

  const puckCheck = puckDocumentSchema.safeParse(sourcePuck);
  const themeCheck = templateThemeSchema.safeParse(sourceTheme);
  const resolvedPuck = puckCheck.success ? puckCheck.data : structuredClone(tplDoc.puck);
  const resolvedTheme = themeCheck.success
    ? themeCheck.data
    : structuredClone(tplDoc.template.theme);

  // Check workspace monthly bandwidth cap (`Spec §5.7`: stops public delivery when exhausted)
  if (ent) {
    const htmlEstimatedBytes = Buffer.byteLength(JSON.stringify(resolvedPuck), "utf8");
    const bwCheck = await recordAndCheckWorkspaceBandwidth({
      workspaceId: ensured.workspace.id,
      bytes: htmlEstimatedBytes,
      limit: ent.quotas.monthlyBandwidthBytesLimit,
      isPaid: ent.plan !== "free",
      graceUsedAt: ent.graceUsedAt,
      graceExpiresAt: ent.graceExpiresAt,
    });
    if (!bwCheck.allowed) {
      return null;
    }
  }

  const effectivePlan = ent ? ent.plan : await resolveEffectivePlanForUser(row.owner.id);
  const whiteLabelEnabled = effectivePlan === "plus";
  const meta = extractCaseStudyMetaFromPuck(row.project.name, resolvedPuck, whiteLabelEnabled);
  const brandingRemoved =
    whiteLabelEnabled ||
    Boolean(
      (snapshot ? snapshot.brandingRemoved : row.project.brandingRemoved) &&
        ent?.quotas.brandingRemovable,
    );

  return {
    project: {
      id: row.project.id,
      name: row.project.name,
      slug: row.project.slug,
      type: row.project.type,
      visibility: row.project.visibility,
      brandingRemoved,
      whiteLabelEnabled,
      customDomain: whiteLabelEnabled ? (ensured.workspace.customDomain ?? null) : null,
      publishedAtIso: (snapshot?.publishedAt ?? row.project.publishedAt).toISOString(),
      updatedAtIso: (snapshot?.updatedAt ?? row.project.updatedAt).toISOString(),
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
      plan: effectivePlan,
    },
    meta,
  };
}
