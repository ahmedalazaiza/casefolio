import { asc, eq, ne } from "@casefolio/db";
import {
  createCategorySchema,
  deleteCategorySchema,
  reorderCategoriesSchema,
  slugifyCategory,
  updateCategorySchema,
  type AdminCategoriesOverview,
  type AdminCategoryItem,
  type AdminTypeSummaryItem,
} from "@/lib/admin/categories-types";
import { db, dbSchema } from "@/lib/db";
import { recordAdminAuditLog } from "@/lib/template/service";

export type CategoryMutationResult =
  | { ok: true; category?: AdminCategoryItem }
  | { ok: false; error: string };

export async function getAdminCategoriesOverview(): Promise<AdminCategoriesOverview> {
  const [categoryRows, templateRows, projectRows] = await Promise.all([
    db
      .select()
      .from(dbSchema.categories)
      .orderBy(asc(dbSchema.categories.sort), asc(dbSchema.categories.name)),
    db
      .select({
        id: dbSchema.templates.id,
        type: dbSchema.templates.type,
        status: dbSchema.templates.status,
        categoryId: dbSchema.templates.categoryId,
      })
      .from(dbSchema.templates),
    db
      .select({
        id: dbSchema.projects.id,
        type: dbSchema.projects.type,
      })
      .from(dbSchema.projects),
  ]);

  const tplCountByCat = new Map<string, number>();
  const pubTplCountByCat = new Map<string, number>();
  const tplCountByType = new Map<string, number>();

  for (const tpl of templateRows) {
    tplCountByType.set(tpl.type, (tplCountByType.get(tpl.type) ?? 0) + 1);
    if (tpl.categoryId) {
      tplCountByCat.set(tpl.categoryId, (tplCountByCat.get(tpl.categoryId) ?? 0) + 1);
      if (tpl.status === "published") {
        pubTplCountByCat.set(tpl.categoryId, (pubTplCountByCat.get(tpl.categoryId) ?? 0) + 1);
      }
    }
  }

  const projCountByType = new Map<string, number>();
  for (const proj of projectRows) {
    projCountByType.set(proj.type, (projCountByType.get(proj.type) ?? 0) + 1);
  }

  const types: AdminTypeSummaryItem[] = [
    {
      type: "mobile",
      label: "Mobile app",
      description: "Phone frames, app-store style story",
      templateCount: tplCountByType.get("mobile") ?? 0,
      projectCount: projCountByType.get("mobile") ?? 0,
      order: 1,
    },
    {
      type: "web",
      label: "Website",
      description: "Browser frames, long-scroll pages",
      templateCount: tplCountByType.get("web") ?? 0,
      projectCount: projCountByType.get("web") ?? 0,
      order: 2,
    },
    {
      type: "both",
      label: "Mobile + Web",
      description: "Mixed device showcase",
      templateCount: tplCountByType.get("both") ?? 0,
      projectCount: projCountByType.get("both") ?? 0,
      order: 3,
    },
  ];

  const categories: AdminCategoryItem[] = categoryRows.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    sort: c.sort,
    templateCount: tplCountByCat.get(c.id) ?? 0,
    publishedTemplateCount: pubTplCountByCat.get(c.id) ?? 0,
    createdAtIso: c.createdAt.toISOString(),
  }));

  return { types, categories };
}

export async function createAdminCategory(args: {
  actorId: string | null;
  name: string;
  slug?: string;
  sort?: number;
}): Promise<CategoryMutationResult> {
  const computedSlug = args.slug?.trim() ? args.slug.trim() : slugifyCategory(args.name);
  const parsed = createCategorySchema.safeParse({
    name: args.name,
    slug: computedSlug,
    sort: args.sort,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid category input.",
    };
  }

  const finalSlug = parsed.data.slug ?? slugifyCategory(parsed.data.name);
  if (!finalSlug) {
    return { ok: false, error: "Category slug cannot be empty." };
  }

  const [existing] = await db
    .select({ id: dbSchema.categories.id })
    .from(dbSchema.categories)
    .where(eq(dbSchema.categories.slug, finalSlug))
    .limit(1);

  if (existing) {
    return { ok: false, error: `Category slug "${finalSlug}" already exists.` };
  }

  let nextSort = parsed.data.sort;
  if (nextSort === undefined) {
    const all = await db.select({ sort: dbSchema.categories.sort }).from(dbSchema.categories);
    const maxSort = all.reduce((m, row) => Math.max(m, row.sort), 0);
    nextSort = all.length === 0 ? 10 : maxSort + 10;
  }

  const [inserted] = await db
    .insert(dbSchema.categories)
    .values({
      name: parsed.data.name,
      slug: finalSlug,
      sort: nextSort,
    })
    .returning();

  if (!inserted) {
    return { ok: false, error: "Failed to create category." };
  }

  await recordAdminAuditLog(args.actorId, "admin.category.created", {
    categoryId: inserted.id,
    name: inserted.name,
    slug: inserted.slug,
    sort: inserted.sort,
  });

  return {
    ok: true,
    category: {
      id: inserted.id,
      name: inserted.name,
      slug: inserted.slug,
      sort: inserted.sort,
      templateCount: 0,
      publishedTemplateCount: 0,
      createdAtIso: inserted.createdAt.toISOString(),
    },
  };
}

export async function updateAdminCategory(args: {
  actorId: string | null;
  id: string;
  name: string;
  slug: string;
  sort: number;
}): Promise<CategoryMutationResult> {
  const parsed = updateCategorySchema.safeParse(args);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid category update input.",
    };
  }

  const [target] = await db
    .select()
    .from(dbSchema.categories)
    .where(eq(dbSchema.categories.id, parsed.data.id))
    .limit(1);

  if (!target) {
    return { ok: false, error: "Category not found." };
  }

  const [conflict] = await db
    .select({ id: dbSchema.categories.id })
    .from(dbSchema.categories)
    .where(eq(dbSchema.categories.slug, parsed.data.slug))
    .limit(1);

  if (conflict && conflict.id !== parsed.data.id) {
    return { ok: false, error: `Category slug "${parsed.data.slug}" is already used.` };
  }

  const [updated] = await db
    .update(dbSchema.categories)
    .set({
      name: parsed.data.name,
      slug: parsed.data.slug,
      sort: parsed.data.sort,
    })
    .where(eq(dbSchema.categories.id, parsed.data.id))
    .returning();

  if (!updated) {
    return { ok: false, error: "Failed to update category." };
  }

  await recordAdminAuditLog(args.actorId, "admin.category.updated", {
    categoryId: updated.id,
    previousName: target.name,
    previousSlug: target.slug,
    name: updated.name,
    slug: updated.slug,
    sort: updated.sort,
  });

  return {
    ok: true,
    category: {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      sort: updated.sort,
      templateCount: 0,
      publishedTemplateCount: 0,
      createdAtIso: updated.createdAt.toISOString(),
    },
  };
}

export async function reorderAdminCategories(args: {
  actorId: string | null;
  orderedIds: string[];
}): Promise<CategoryMutationResult> {
  const parsed = reorderCategoriesSchema.safeParse({ orderedIds: args.orderedIds });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid category ordering payload.",
    };
  }

  const uniqueIds = Array.from(new Set(parsed.data.orderedIds));
  for (let idx = 0; idx < uniqueIds.length; idx++) {
    const id = uniqueIds[idx]!;
    await db
      .update(dbSchema.categories)
      .set({ sort: (idx + 1) * 10 })
      .where(eq(dbSchema.categories.id, id));
  }

  // Push any omitted categories after the ordered set deterministically
  const remaining = await db
    .select({ id: dbSchema.categories.id })
    .from(dbSchema.categories)
    .orderBy(asc(dbSchema.categories.sort), asc(dbSchema.categories.name));

  let tailIndex = uniqueIds.length + 1;
  for (const row of remaining) {
    if (!uniqueIds.includes(row.id)) {
      await db
        .update(dbSchema.categories)
        .set({ sort: tailIndex * 10 })
        .where(andNotEmpty(row.id));
      tailIndex += 1;
    }
  }

  await recordAdminAuditLog(args.actorId, "admin.category.reordered", {
    orderedIds: uniqueIds,
  });

  return { ok: true };
}

function andNotEmpty(id: string) {
  return eq(dbSchema.categories.id, id);
}

export async function deleteAdminCategory(args: {
  actorId: string | null;
  id: string;
}): Promise<CategoryMutationResult> {
  const parsed = deleteCategorySchema.safeParse({ id: args.id });
  if (!parsed.success) {
    return { ok: false, error: "Invalid category ID." };
  }

  const [target] = await db
    .select()
    .from(dbSchema.categories)
    .where(eq(dbSchema.categories.id, parsed.data.id))
    .limit(1);

  if (!target) {
    return { ok: false, error: "Category not found." };
  }

  const linkedTemplates = await db
    .select({ id: dbSchema.templates.id, status: dbSchema.templates.status })
    .from(dbSchema.templates)
    .where(eq(dbSchema.templates.categoryId, parsed.data.id));

  const activeTemplates = linkedTemplates.filter((t) => t.status !== "archived");
  if (activeTemplates.length > 0) {
    return {
      ok: false,
      error: `Cannot delete "${target.name}" while ${activeTemplates.length} active template(s) reference it.`,
    };
  }

  await db
    .delete(dbSchema.categories)
    .where(eq(dbSchema.categories.id, parsed.data.id));

  // Keep unused import guard clean
  void ne;

  await recordAdminAuditLog(args.actorId, "admin.category.deleted", {
    categoryId: target.id,
    name: target.name,
    slug: target.slug,
  });

  return { ok: true };
}
