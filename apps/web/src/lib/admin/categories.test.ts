// @vitest-environment node
import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "@casefolio/db";
import { afterAll, describe, expect, it } from "vitest";
import {
  createAdminCategory,
  deleteAdminCategory,
  getAdminCategoriesOverview,
  reorderAdminCategories,
  updateAdminCategory,
} from "@/lib/admin/categories";
import { db, dbSchema } from "@/lib/db";
import { listTemplateCategories } from "@/lib/template/service";

describe("admin categories CRUD, ordering & library filter sync (C-903)", () => {
  const cleanupUserIds: string[] = [];
  const cleanupCategoryIds: string[] = [];
  const cleanupTemplateIds: string[] = [];

  afterAll(async () => {
    if (cleanupTemplateIds.length > 0) {
      await db.delete(dbSchema.templates).where(inArray(dbSchema.templates.id, cleanupTemplateIds));
    }
    if (cleanupCategoryIds.length > 0) {
      await db
        .delete(dbSchema.categories)
        .where(inArray(dbSchema.categories.id, cleanupCategoryIds));
    }
    if (cleanupUserIds.length > 0) {
      await db.delete(dbSchema.users).where(inArray(dbSchema.users.id, cleanupUserIds));
    }
  });

  it("supports create, update, reorder, delete protection, audit logs, and library filter ordering", async () => {
    const suffix = randomUUID().slice(0, 8);
    const [admin] = await db
      .insert(dbSchema.users)
      .values({
        email: `c903-admin-${suffix}@casefolio.test`,
        name: "C903 Admin",
        role: "admin",
        emailVerified: true,
      })
      .returning();
    if (!admin) throw new Error("Failed to seed admin");
    cleanupUserIds.push(admin.id);

    const catARes = await createAdminCategory({
      actorId: admin.id,
      name: `Alpha ${suffix}`,
      sort: 500,
    });
    expect(catARes.ok).toBe(true);
    if (!catARes.ok || !catARes.category) return;
    cleanupCategoryIds.push(catARes.category.id);

    const catBRes = await createAdminCategory({
      actorId: admin.id,
      name: `Beta ${suffix}`,
      sort: 510,
    });
    expect(catBRes.ok).toBe(true);
    if (!catBRes.ok || !catBRes.category) return;
    cleanupCategoryIds.push(catBRes.category.id);

    // Duplicate slug rejected
    const dupRes = await createAdminCategory({
      actorId: admin.id,
      name: `Alpha ${suffix}`,
    });
    expect(dupRes.ok).toBe(false);

    // Verify listTemplateCategories (used by /templates library) includes both in sort order
    const libBefore = await listTemplateCategories();
    const idxABefore = libBefore.findIndex((c) => c.id === catARes.category!.id);
    const idxBBefore = libBefore.findIndex((c) => c.id === catBRes.category!.id);
    expect(idxABefore).toBeGreaterThanOrEqual(0);
    expect(idxBBefore).toBeGreaterThan(idxABefore);

    // Reorder Beta before Alpha
    const reorderRes = await reorderAdminCategories({
      actorId: admin.id,
      orderedIds: [catBRes.category.id, catARes.category.id],
    });
    expect(reorderRes.ok).toBe(true);

    const libAfter = await listTemplateCategories();
    const idxAAfter = libAfter.findIndex((c) => c.id === catARes.category!.id);
    const idxBAfter = libAfter.findIndex((c) => c.id === catBRes.category!.id);
    expect(idxBAfter).toBeLessThan(idxAAfter);

    // Update Alpha name & slug
    const updateRes = await updateAdminCategory({
      actorId: admin.id,
      id: catARes.category.id,
      name: `Alpha Renamed ${suffix}`,
      slug: `alpha-renamed-${suffix}`,
      sort: 20,
    });
    expect(updateRes.ok).toBe(true);

    // Link an active draft template to Alpha and verify delete protection
    const [tpl] = await db
      .insert(dbSchema.templates)
      .values({
        slug: `c903-tpl-${suffix}`,
        name: "C903 Linked Template",
        type: "web",
        categoryId: catARes.category.id,
        tier: "free",
        status: "draft",
      })
      .returning();
    if (tpl) cleanupTemplateIds.push(tpl.id);

    const blockedDelete = await deleteAdminCategory({
      actorId: admin.id,
      id: catARes.category.id,
    });
    expect(blockedDelete.ok).toBe(false);

    // Delete unused Beta succeeds
    const delBeta = await deleteAdminCategory({
      actorId: admin.id,
      id: catBRes.category.id,
    });
    expect(delBeta.ok).toBe(true);

    const overview = await getAdminCategoriesOverview();
    expect(overview.types).toHaveLength(3);
    expect(overview.categories.some((c) => c.id === catARes.category!.id)).toBe(true);
    expect(overview.categories.some((c) => c.id === catBRes.category!.id)).toBe(false);

    // Verify all 4 category audit log actions exist for actor
    const logs = await db
      .select({ action: dbSchema.auditLogs.action })
      .from(dbSchema.auditLogs)
      .where(and(eq(dbSchema.auditLogs.actorId, admin.id)))
      .orderBy(desc(dbSchema.auditLogs.at));

    const actions = new Set(logs.map((l) => l.action));
    expect(actions.has("admin.category.created")).toBe(true);
    expect(actions.has("admin.category.reordered")).toBe(true);
    expect(actions.has("admin.category.updated")).toBe(true);
    expect(actions.has("admin.category.deleted")).toBe(true);
  });
});
