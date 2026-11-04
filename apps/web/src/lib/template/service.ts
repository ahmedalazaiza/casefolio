import {
  asc,
  count,
  desc,
  eq,
  inArray,
  type ProjectType,
  type TemplateStatus,
  type TemplateTier,
} from "@casefolio/db";
import { db, dbSchema } from "@/lib/db";
import {
  parseAndValidateTemplateJson,
  wizardMetadataInputSchema,
  type SaveTemplateDraftResult,
  type WizardMetadataInput,
} from "@/lib/template/parse";
import { validateTemplateDocument, type TemplateDocument } from "@/lib/template/schema";

export { wizardMetadataInputSchema, type SaveTemplateDraftResult, type WizardMetadataInput };

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

export interface AdminTemplateSummary {
  id: string;
  slug: string;
  name: string;
  type: ProjectType;
  tier: TemplateTier;
  status: TemplateStatus;
  coverUrl: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  currentVersion: string | null;
  sectionCount: number;
  slotCount: number;
  projectCount: number;
  updatedAt: Date;
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
      updatedAt: template.updatedAt,
    };
  });
}
