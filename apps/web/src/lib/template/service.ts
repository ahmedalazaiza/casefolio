import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  type ProjectType,
  type TemplateTier,
} from "@casefolio/db";
import { db, dbSchema } from "@/lib/db";
import { notifyTemplateVersionPublished } from "@/lib/notifications/service";
import {
  parseAndValidateTemplateJson,
  wizardMetadataInputSchema,
  type SaveTemplateDraftResult,
  type WizardMetadataInput,
} from "@/lib/template/parse";
import { semverSchema, validateTemplateDocument, type TemplateDocument } from "@/lib/template/schema";
import { compareSemver } from "@/lib/template/semver";
import type {
  AdminTemplateDetail,
  AdminTemplateSummary,
  AdminTemplateUsageProject,
  CreateTemplateVersionResult,
  DeleteTemplateActionResult,
  PublishedTemplateItem,
  TemplateLifecycleActionResult,
} from "@/lib/template/types";

export { wizardMetadataInputSchema, type SaveTemplateDraftResult, type WizardMetadataInput };
export type {
  AdminTemplateDetail,
  AdminTemplateSummary,
  AdminTemplateUsageProject,
  CreateTemplateVersionResult,
  DeleteTemplateActionResult,
  PublishedTemplateItem,
  TemplateLifecycleActionResult,
};

export interface SaveTemplateDraftInput {
  actorId: string | null;
  rawJson: string;
  metadata?: Partial<WizardMetadataInput>;
}

export function slugifyCategoryName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function listTemplateCategories() {
  return db
    .select()
    .from(dbSchema.categories)
    .orderBy(asc(dbSchema.categories.sort), asc(dbSchema.categories.name));
}

export async function resolveOrCreateCategory(categoryName: string): Promise<{
  id: string;
  name: string;
  slug: string;
}> {
  const cleanName = categoryName.trim();
  const slug = slugifyCategoryName(cleanName);
  if (!slug) {
    throw new Error("Category name must include at least one alphanumeric character.");
  }

  const [existing] = await db
    .select()
    .from(dbSchema.categories)
    .where(eq(dbSchema.categories.slug, slug))
    .limit(1);

  if (existing) {
    return { id: existing.id, name: existing.name, slug: existing.slug };
  }

  const [created] = await db
    .insert(dbSchema.categories)
    .values({
      name: cleanName,
      slug,
      sort: 10,
    })
    .onConflictDoUpdate({
      target: dbSchema.categories.slug,
      set: { name: cleanName },
    })
    .returning();

  if (!created) {
    throw new Error("Failed to resolve template category.");
  }

  return { id: created.id, name: created.name, slug: created.slug };
}

export async function recordAdminAuditLog(
  actorId: string | null,
  action: string,
  meta: Record<string, unknown>,
): Promise<void> {
  await db.insert(dbSchema.auditLogs).values({
    actorId,
    action,
    meta,
  });
}

export async function saveTemplateDraftFromWizard({
  actorId,
  rawJson,
  metadata,
}: SaveTemplateDraftInput): Promise<SaveTemplateDraftResult> {
  const parsedJson = parseAndValidateTemplateJson(rawJson);
  if (!parsedJson.ok) {
    return {
      ok: false,
      error: "Template JSON failed validation.",
      issues: parsedJson.issues,
    };
  }

  const baseDoc = parsedJson.data;
  const mergedMetaCandidate: WizardMetadataInput = {
    name: metadata?.name ?? baseDoc.template.name,
    slug: metadata?.slug ?? baseDoc.template.slug,
    type: metadata?.type ?? baseDoc.template.type,
    category: metadata?.category ?? baseDoc.template.category,
    tier: metadata?.tier ?? baseDoc.template.tier,
    coverUrl: metadata?.coverUrl ?? baseDoc.template.cover.src,
    coverRatio: metadata?.coverRatio ?? baseDoc.template.cover.ratio,
    changelog: metadata?.changelog,
  };

  const metaParsed = wizardMetadataInputSchema.safeParse(mergedMetaCandidate);
  if (!metaParsed.success) {
    return {
      ok: false,
      error: "Metadata fields are invalid.",
      issues: metaParsed.error.issues.map((issue) => ({
        path: `metadata.${issue.path.join(".")}`,
        message: issue.message,
      })),
    };
  }

  const validMeta = metaParsed.data;
  const draftDocument: TemplateDocument = {
    ...baseDoc,
    template: {
      ...baseDoc.template,
      name: validMeta.name,
      slug: validMeta.slug,
      type: validMeta.type,
      version: "1.0.0",
      status: "draft",
      category: validMeta.category,
      tier: validMeta.tier,
      cover: {
        src: validMeta.coverUrl,
        ratio: validMeta.coverRatio,
      },
    },
  };

  const revalidated = validateTemplateDocument(draftDocument);
  if (!revalidated.ok) {
    return {
      ok: false,
      error: "Merged template document failed validation.",
      issues: revalidated.issues,
    };
  }

  const [existingTemplate] = await db
    .select()
    .from(dbSchema.templates)
    .where(eq(dbSchema.templates.slug, validMeta.slug))
    .limit(1);

  if (existingTemplate) {
    const existingVersions = await db
      .select({ id: dbSchema.templateVersions.id })
      .from(dbSchema.templateVersions)
      .where(eq(dbSchema.templateVersions.templateId, existingTemplate.id));

    if (existingVersions.length > 0) {
      const versionIds = existingVersions.map((v) => v.id);
      const [usage] = await db
        .select({ total: count() })
        .from(dbSchema.projects)
        .where(inArray(dbSchema.projects.templateVersionId, versionIds));

      if ((usage?.total ?? 0) > 0) {
        return {
          ok: false,
          error: "Template slug is already in use by active projects.",
          issues: [
            {
              path: "metadata.slug",
              message: `Slug '${validMeta.slug}' is already used by ${usage?.total} project(s). Choose a unique slug or upload a new version on the template detail page.`,
            },
          ],
        };
      }
    }
  }

  const category = await resolveOrCreateCategory(validMeta.category);
  const changelog = validMeta.changelog?.trim() || "Initial draft import (v1.0.0)";

  const [savedTemplate] = await db
    .insert(dbSchema.templates)
    .values({
      slug: validMeta.slug,
      name: validMeta.name,
      type: validMeta.type,
      categoryId: category.id,
      tier: validMeta.tier,
      status: "draft",
      coverUrl: validMeta.coverUrl,
    })
    .onConflictDoUpdate({
      target: dbSchema.templates.slug,
      set: {
        name: validMeta.name,
        type: validMeta.type,
        categoryId: category.id,
        tier: validMeta.tier,
        status: "draft",
        coverUrl: validMeta.coverUrl,
        updatedAt: new Date(),
      },
    })
    .returning();

  if (!savedTemplate) {
    return {
      ok: false,
      error: "Failed to persist template draft.",
      issues: [{ path: "root", message: "Database did not return saved template record." }],
    };
  }

  const [savedVersion] = await db
    .insert(dbSchema.templateVersions)
    .values({
      templateId: savedTemplate.id,
      version: "1.0.0",
      data: revalidated.data as unknown as Record<string, unknown>,
      changelog,
      publishedAt: null,
    })
    .onConflictDoUpdate({
      target: [dbSchema.templateVersions.templateId, dbSchema.templateVersions.version],
      set: {
        data: revalidated.data as unknown as Record<string, unknown>,
        changelog,
        publishedAt: null,
      },
    })
    .returning();

  if (!savedVersion) {
    return {
      ok: false,
      error: "Failed to persist template version 1.0.0.",
      issues: [{ path: "root", message: "Database did not return saved version record." }],
    };
  }

  await db
    .update(dbSchema.templates)
    .set({
      currentVersionId: savedVersion.id,
      status: "draft",
      updatedAt: new Date(),
    })
    .where(eq(dbSchema.templates.id, savedTemplate.id));

  await recordAdminAuditLog(actorId, "template.draft_saved", {
    templateId: savedTemplate.id,
    versionId: savedVersion.id,
    slug: validMeta.slug,
    version: "1.0.0",
    tier: validMeta.tier,
    type: validMeta.type,
    category: category.name,
  });

  return {
    ok: true,
    templateId: savedTemplate.id,
    versionId: savedVersion.id,
    slug: savedTemplate.slug,
    version: "1.0.0",
    status: "draft",
  };
}

export async function listAdminTemplates(): Promise<AdminTemplateSummary[]> {
  const rows = await db
    .select({
      template: dbSchema.templates,
      category: dbSchema.categories,
    })
    .from(dbSchema.templates)
    .leftJoin(dbSchema.categories, eq(dbSchema.templates.categoryId, dbSchema.categories.id))
    .orderBy(desc(dbSchema.templates.updatedAt));

  if (rows.length === 0) {
    return [];
  }

  const allVersions = await db.select().from(dbSchema.templateVersions);
  const versionById = new Map(allVersions.map((v) => [v.id, v]));
  const versionIdsByTemplate = new Map<string, string[]>();
  for (const v of allVersions) {
    const arr = versionIdsByTemplate.get(v.templateId) ?? [];
    arr.push(v.id);
    versionIdsByTemplate.set(v.templateId, arr);
  }

  const allProjects = await db
    .select({ templateVersionId: dbSchema.projects.templateVersionId })
    .from(dbSchema.projects);
  const projectCountByVersion = new Map<string, number>();
  for (const p of allProjects) {
    projectCountByVersion.set(
      p.templateVersionId,
      (projectCountByVersion.get(p.templateVersionId) ?? 0) + 1,
    );
  }

  return rows.map(({ template, category }) => {
    const currentVer = template.currentVersionId
      ? versionById.get(template.currentVersionId)
      : allVersions.find((v) => v.templateId === template.id);

    let sectionCount = 0;
    let slotCount = 0;
    if (currentVer?.data && typeof currentVer.data === "object") {
      const rawDoc = currentVer.data as {
        template?: { slots?: Record<string, unknown> };
        puck?: { content?: unknown[] };
      };
      sectionCount = Array.isArray(rawDoc.puck?.content) ? rawDoc.puck.content.length : 0;
      slotCount =
        rawDoc.template?.slots && typeof rawDoc.template.slots === "object"
          ? Object.keys(rawDoc.template.slots).length
          : 0;
    }

    const tplVersionIds = versionIdsByTemplate.get(template.id) ?? [];
    const projectCount = tplVersionIds.reduce(
      (sum, vid) => sum + (projectCountByVersion.get(vid) ?? 0),
      0,
    );

    return {
      id: template.id,
      slug: template.slug,
      name: template.name,
      type: template.type,
      tier: template.tier,
      status: template.status,
      coverUrl: template.coverUrl,
      categoryName: category?.name ?? null,
      categorySlug: category?.slug ?? null,
      currentVersion: currentVer?.version ?? null,
      sectionCount,
      slotCount,
      projectCount,
      updatedAtIso: template.updatedAt.toISOString(),
    };
  });
}

export async function getAdminTemplateDetail(
  templateId: string,
): Promise<AdminTemplateDetail | null> {
  const [row] = await db
    .select({
      template: dbSchema.templates,
      category: dbSchema.categories,
    })
    .from(dbSchema.templates)
    .leftJoin(dbSchema.categories, eq(dbSchema.templates.categoryId, dbSchema.categories.id))
    .where(eq(dbSchema.templates.id, templateId))
    .limit(1);

  if (!row) {
    return null;
  }

  const versionRows = await db
    .select()
    .from(dbSchema.templateVersions)
    .where(eq(dbSchema.templateVersions.templateId, templateId));

  const projectCountByVersion = new Map<string, number>();
  const usedInProjects: AdminTemplateUsageProject[] = [];
  if (versionRows.length > 0) {
    const versionIds = versionRows.map((v) => v.id);
    const verStringById = new Map(versionRows.map((v) => [v.id, v.version]));

    const pinnedProjects = await db
      .select({
        project: dbSchema.projects,
        ownerName: dbSchema.users.name,
      })
      .from(dbSchema.projects)
      .leftJoin(dbSchema.users, eq(dbSchema.projects.ownerId, dbSchema.users.id))
      .where(inArray(dbSchema.projects.templateVersionId, versionIds))
      .orderBy(desc(dbSchema.projects.updatedAt));

    for (const p of pinnedProjects) {
      projectCountByVersion.set(
        p.project.templateVersionId,
        (projectCountByVersion.get(p.project.templateVersionId) ?? 0) + 1,
      );
      if (usedInProjects.length < 25) {
        usedInProjects.push({
          id: p.project.id,
          name: p.project.name,
          slug: p.project.slug,
          visibility: p.project.visibility,
          ownerName: p.ownerName ?? "Unknown author",
          version: verStringById.get(p.project.templateVersionId) ?? "1.0.0",
          updatedAtIso: p.project.updatedAt.toISOString(),
        });
      }
    }
  }

  const sortedVersions = [...versionRows]
    .sort((a, b) => compareSemver(b.version, a.version))
    .map((ver) => {
      const parsed = validateTemplateDocument(ver.data);
      return {
        id: ver.id,
        version: ver.version,
        changelog: ver.changelog,
        publishedAtIso: ver.publishedAt ? ver.publishedAt.toISOString() : null,
        createdAtIso: ver.createdAt.toISOString(),
        pinnedProjectCount: projectCountByVersion.get(ver.id) ?? 0,
        document: parsed.ok ? parsed.data : null,
        rawJson: JSON.stringify(ver.data, null, 2),
      };
    });

  const currentVer = row.template.currentVersionId
    ? sortedVersions.find((v) => v.id === row.template.currentVersionId)
    : sortedVersions[0];

  const totalProjectCount = sortedVersions.reduce((acc, v) => acc + v.pinnedProjectCount, 0);

  return {
    id: row.template.id,
    slug: row.template.slug,
    name: row.template.name,
    type: row.template.type,
    tier: row.template.tier,
    status: row.template.status,
    coverUrl: row.template.coverUrl,
    categoryName: row.category?.name ?? null,
    categorySlug: row.category?.slug ?? null,
    currentVersionId: row.template.currentVersionId,
    currentVersion: currentVer?.version ?? null,
    totalProjectCount,
    versions: sortedVersions,
    usedInProjects,
  };
}

export interface CreateTemplateVersionInput {
  actorId: string | null;
  templateId: string;
  version: string;
  changelog: string;
  rawJson: string;
  publishImmediately?: boolean;
}

export async function createNewTemplateVersion({
  actorId,
  templateId,
  version,
  changelog,
  rawJson,
  publishImmediately = false,
}: CreateTemplateVersionInput): Promise<CreateTemplateVersionResult> {
  const semverCheck = semverSchema.safeParse(version);
  if (!semverCheck.success) {
    return {
      ok: false,
      error: "Invalid semantic version.",
      issues: [
        {
          path: "version",
          message: semverCheck.error.issues[0]?.message ?? "Invalid semver format.",
        },
      ],
    };
  }

  const [tpl] = await db
    .select({
      template: dbSchema.templates,
      category: dbSchema.categories,
    })
    .from(dbSchema.templates)
    .leftJoin(dbSchema.categories, eq(dbSchema.templates.categoryId, dbSchema.categories.id))
    .where(eq(dbSchema.templates.id, templateId))
    .limit(1);

  if (!tpl) {
    return {
      ok: false,
      error: "Template not found.",
      issues: [{ path: "templateId", message: "Target template does not exist." }],
    };
  }

  const existingVersions = await db
    .select({ version: dbSchema.templateVersions.version })
    .from(dbSchema.templateVersions)
    .where(eq(dbSchema.templateVersions.templateId, templateId));

  const cleanVersion = semverCheck.data;
  for (const existing of existingVersions) {
    if (compareSemver(cleanVersion, existing.version) <= 0) {
      return {
        ok: false,
        error: "New version must be strictly greater than existing versions.",
        issues: [
          {
            path: "version",
            message: `Version '${cleanVersion}' must be higher than existing version '${existing.version}'.`,
          },
        ],
      };
    }
  }

  const parsedJson = parseAndValidateTemplateJson(rawJson);
  if (!parsedJson.ok) {
    return {
      ok: false,
      error: "Template JSON failed validation.",
      issues: parsedJson.issues,
    };
  }

  const nextStatus = publishImmediately ? "published" : tpl.template.status;
  const versionDocument: TemplateDocument = {
    ...parsedJson.data,
    template: {
      ...parsedJson.data.template,
      name: tpl.template.name,
      slug: tpl.template.slug,
      type: tpl.template.type,
      version: cleanVersion,
      status: publishImmediately ? "published" : "draft",
      category: tpl.category?.name ?? parsedJson.data.template.category,
      tier: tpl.template.tier,
      cover: {
        src: tpl.template.coverUrl ?? parsedJson.data.template.cover.src,
        ratio: parsedJson.data.template.cover.ratio,
      },
    },
  };

  const revalidated = validateTemplateDocument(versionDocument);
  if (!revalidated.ok) {
    return {
      ok: false,
      error: "Version document failed schema validation.",
      issues: revalidated.issues,
    };
  }

  const now = new Date();
  const [insertedVersion] = await db
    .insert(dbSchema.templateVersions)
    .values({
      templateId,
      version: cleanVersion,
      data: revalidated.data as unknown as Record<string, unknown>,
      changelog: changelog.trim() || `Release v${cleanVersion}`,
      publishedAt: publishImmediately ? now : null,
    })
    .returning();

  if (!insertedVersion) {
    return {
      ok: false,
      error: "Failed to save new template version.",
      issues: [{ path: "root", message: "Database did not return version record." }],
    };
  }

  if (publishImmediately) {
    await db
      .update(dbSchema.templates)
      .set({
        currentVersionId: insertedVersion.id,
        status: "published",
        updatedAt: now,
      })
      .where(eq(dbSchema.templates.id, templateId));

    await notifyTemplateVersionPublished({
      templateId,
      templateName: tpl.template.name,
      version: cleanVersion,
    }).catch(() => undefined);
  } else {
    await db
      .update(dbSchema.templates)
      .set({ updatedAt: now })
      .where(eq(dbSchema.templates.id, templateId));
  }

  await recordAdminAuditLog(actorId, "template.version_created", {
    templateId,
    versionId: insertedVersion.id,
    version: cleanVersion,
    publishImmediately,
    changelog: insertedVersion.changelog,
  });

  return {
    ok: true,
    versionId: insertedVersion.id,
    version: cleanVersion,
    status: nextStatus,
  };
}

export async function publishTemplateVersion({
  actorId,
  templateId,
  versionId,
}: {
  actorId: string | null;
  templateId: string;
  versionId: string;
}): Promise<TemplateLifecycleActionResult> {
  const [versionRow] = await db
    .select()
    .from(dbSchema.templateVersions)
    .where(
      and(
        eq(dbSchema.templateVersions.id, versionId),
        eq(dbSchema.templateVersions.templateId, templateId),
      ),
    )
    .limit(1);

  if (!versionRow) {
    return { ok: false, error: "Template version not found for this template." };
  }

  const now = new Date();
  await db
    .update(dbSchema.templateVersions)
    .set({
      publishedAt: versionRow.publishedAt ?? now,
    })
    .where(eq(dbSchema.templateVersions.id, versionId));

  await db
    .update(dbSchema.templates)
    .set({
      currentVersionId: versionId,
      status: "published",
      updatedAt: now,
    })
    .where(eq(dbSchema.templates.id, templateId));

  const [tplRow] = await db
    .select({ name: dbSchema.templates.name })
    .from(dbSchema.templates)
    .where(eq(dbSchema.templates.id, templateId))
    .limit(1);

  if (tplRow) {
    await notifyTemplateVersionPublished({
      templateId,
      templateName: tplRow.name,
      version: versionRow.version,
    }).catch(() => undefined);
  }

  await recordAdminAuditLog(actorId, "template.published", {
    templateId,
    versionId,
    version: versionRow.version,
  });

  return {
    ok: true,
    status: "published",
    currentVersionId: versionId,
  };
}

export async function archiveTemplate({
  actorId,
  templateId,
}: {
  actorId: string | null;
  templateId: string;
}): Promise<TemplateLifecycleActionResult> {
  const [tpl] = await db
    .select()
    .from(dbSchema.templates)
    .where(eq(dbSchema.templates.id, templateId))
    .limit(1);

  if (!tpl) {
    return { ok: false, error: "Template not found." };
  }

  await db
    .update(dbSchema.templates)
    .set({
      status: "archived",
      updatedAt: new Date(),
    })
    .where(eq(dbSchema.templates.id, templateId));

  await recordAdminAuditLog(actorId, "template.archived", {
    templateId,
    slug: tpl.slug,
  });

  return {
    ok: true,
    status: "archived",
    currentVersionId: tpl.currentVersionId,
  };
}

export async function unarchiveTemplateToDraft({
  actorId,
  templateId,
}: {
  actorId: string | null;
  templateId: string;
}): Promise<TemplateLifecycleActionResult> {
  const [tpl] = await db
    .select()
    .from(dbSchema.templates)
    .where(eq(dbSchema.templates.id, templateId))
    .limit(1);

  if (!tpl) {
    return { ok: false, error: "Template not found." };
  }

  await db
    .update(dbSchema.templates)
    .set({
      status: "draft",
      updatedAt: new Date(),
    })
    .where(eq(dbSchema.templates.id, templateId));

  await recordAdminAuditLog(actorId, "template.unarchived", {
    templateId,
    slug: tpl.slug,
  });

  return {
    ok: true,
    status: "draft",
    currentVersionId: tpl.currentVersionId,
  };
}

export async function deleteAdminTemplate({
  actorId,
  templateId,
  confirmName,
}: {
  actorId: string | null;
  templateId: string;
  confirmName: string;
}): Promise<DeleteTemplateActionResult> {
  const [tpl] = await db
    .select()
    .from(dbSchema.templates)
    .where(eq(dbSchema.templates.id, templateId))
    .limit(1);

  if (!tpl) {
    return { ok: false, error: "Template not found." };
  }

  if (confirmName.trim() !== tpl.name.trim()) {
    return {
      ok: false,
      error: `Type "${tpl.name}" exactly to confirm deletion.`,
    };
  }

  const versionRows = await db
    .select({ id: dbSchema.templateVersions.id })
    .from(dbSchema.templateVersions)
    .where(eq(dbSchema.templateVersions.templateId, templateId));

  let pinnedProjectCount = 0;
  if (versionRows.length > 0) {
    const [usage] = await db
      .select({ total: count() })
      .from(dbSchema.projects)
      .where(
        inArray(
          dbSchema.projects.templateVersionId,
          versionRows.map((v) => v.id),
        ),
      );
    pinnedProjectCount = usage?.total ?? 0;
  }

  if (pinnedProjectCount > 0) {
    await db
      .update(dbSchema.templates)
      .set({
        status: "archived",
        updatedAt: new Date(),
      })
      .where(eq(dbSchema.templates.id, templateId));

    await recordAdminAuditLog(actorId, "template.retired", {
      templateId,
      slug: tpl.slug,
      name: tpl.name,
      pinnedProjectCount,
    });

    return { ok: true, mode: "retired_archived" };
  }

  await db
    .update(dbSchema.templates)
    .set({ currentVersionId: null })
    .where(eq(dbSchema.templates.id, templateId));

  await db.delete(dbSchema.templates).where(eq(dbSchema.templates.id, templateId));

  await recordAdminAuditLog(actorId, "template.deleted", {
    templateId,
    slug: tpl.slug,
    name: tpl.name,
  });

  return { ok: true, mode: "deleted" };
}

export interface LibraryFilterInput {
  type?: ProjectType;
  categorySlug?: string;
  tier?: TemplateTier;
}

export async function listPublishedLibraryTemplates(
  filters: LibraryFilterInput = {},
): Promise<PublishedTemplateItem[]> {
  const conditions = [eq(dbSchema.templates.status, "published")];
  if (filters.type) {
    conditions.push(eq(dbSchema.templates.type, filters.type));
  }
  if (filters.tier) {
    conditions.push(eq(dbSchema.templates.tier, filters.tier));
  }

  const rows = await db
    .select({
      template: dbSchema.templates,
      category: dbSchema.categories,
      version: dbSchema.templateVersions,
    })
    .from(dbSchema.templates)
    .innerJoin(
      dbSchema.templateVersions,
      eq(dbSchema.templates.currentVersionId, dbSchema.templateVersions.id),
    )
    .leftJoin(dbSchema.categories, eq(dbSchema.templates.categoryId, dbSchema.categories.id))
    .where(and(...conditions))
    .orderBy(desc(dbSchema.templates.updatedAt));

  const items: PublishedTemplateItem[] = [];
  for (const row of rows) {
    if (filters.categorySlug && row.category?.slug !== filters.categorySlug) {
      continue;
    }

    const parsed = validateTemplateDocument(row.version.data);
    if (!parsed.ok) {
      continue;
    }

    items.push({
      id: row.template.id,
      versionId: row.version.id,
      slug: row.template.slug,
      name: row.template.name,
      type: row.template.type,
      tier: row.template.tier,
      coverUrl: row.template.coverUrl,
      categoryName: row.category?.name ?? null,
      categorySlug: row.category?.slug ?? null,
      version: row.version.version,
      sectionCount: parsed.data.puck.content.length,
      slotCount: Object.keys(parsed.data.template.slots).length,
      document: parsed.data,
    });
  }

  return items;
}
