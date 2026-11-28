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

  it("supports reassign-and-delete while protecting deployed (published) categories unless explicitly confirmed", async () => {
    const suffix = randomUUID().slice(0, 8);
    const [admin] = await db
      .insert(dbSchema.users)
      .values({
        email: `c903-cat-reassign-${suffix}@casefolio.test`,
        name: "C903 Reassign Admin",
        role: "admin",
        emailVerified: true,
      })
      .returning();
    if (!admin) throw new Error("Failed to seed admin");
    cleanupUserIds.push(admin.id);

    const catLive = await createAdminCategory({
      actorId: admin.id,
      name: `Deployed ${suffix}`,
      sort: 600,
    });
    const catTarget = await createAdminCategory({
      actorId: admin.id,
      name: `Destination ${suffix}`,
      sort: 610,
    });
    expect(catLive.ok && catTarget.ok).toBe(true);
    if (!catLive.ok || !catLive.category || !catTarget.ok || !catTarget.category) return;
    cleanupCategoryIds.push(catLive.category.id, catTarget.category.id);

    const [pubTpl] = await db
      .insert(dbSchema.templates)
      .values({
        slug: `c903-pub-${suffix}`,
        name: "Deployed Template",
        type: "mobile",
        categoryId: catLive.category.id,
        tier: "free",
        status: "published",
      })
      .returning();
    if (pubTpl) cleanupTemplateIds.push(pubTpl.id);

    // Without explicit allowPublishedReassign confirmation, deployed category cannot be removed even with reassign target
    const protectedRes = await deleteAdminCategory({
      actorId: admin.id,
      id: catLive.category.id,
      reassignToCategoryId: catTarget.category.id,
    });
    expect(protectedRes.ok).toBe(false);
    if (!protectedRes.ok) {
      expect(protectedRes.code).toBe("DEPLOYED_CATEGORY_PROTECTED");
    }

    // With explicit confirmation, template moves to destination category and old category is deleted
    const confirmedRes = await deleteAdminCategory({
      actorId: admin.id,
      id: catLive.category.id,
      reassignToCategoryId: catTarget.category.id,
      allowPublishedReassign: true,
    });
    expect(confirmedRes.ok).toBe(true);
    if (confirmedRes.ok) {
      expect(confirmedRes.reassignedCount).toBe(1);
    }

    const [movedTpl] = await db
      .select({ categoryId: dbSchema.templates.categoryId })
      .from(dbSchema.templates)
      .where(eq(dbSchema.templates.id, pubTpl!.id))
      .limit(1);
    expect(movedTpl?.categoryId).toBe(catTarget.category.id);
  });
});
