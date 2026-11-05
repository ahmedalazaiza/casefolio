// @vitest-environment node
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { and, desc, eq, inArray } from "@casefolio/db";
import { afterAll, describe, expect, it } from "vitest";
import { db, dbSchema } from "@/lib/db";
import {
  deleteAdminTemplate,
  getAdminTemplateDetail,
  publishTemplateVersion,
  saveTemplateDraftFromWizard,
} from "@/lib/template/service";

function readOrbitJson(): string {
  for (const candidate of [
    resolve(process.cwd(), "reference/template.example.json"),
    resolve(process.cwd(), "../../reference/template.example.json"),
  ]) {
    if (existsSync(candidate)) {
      return readFileSync(candidate, "utf-8");
    }
  }
  throw new Error("Missing reference/template.example.json");
}

describe("admin templates detail usage & deletion audit logs (C-902)", () => {
  const cleanupUserIds: string[] = [];
  const cleanupTemplateIds: string[] = [];

  afterAll(async () => {
    if (cleanupUserIds.length > 0) {
      await db.delete(dbSchema.users).where(inArray(dbSchema.users.id, cleanupUserIds));
    }
    if (cleanupTemplateIds.length > 0) {
      await db.delete(dbSchema.templates).where(inArray(dbSchema.templates.id, cleanupTemplateIds));
    }
  });

  it("returns usedInProjects in detail, retires used templates safely, and deletes unused templates with audit log", async () => {
    const suffix = randomUUID().slice(0, 8);
    const rawOrbit = readOrbitJson();

    const [adminUser] = await db
      .insert(dbSchema.users)
      .values({
        email: `c902-admin-${suffix}@casefolio.test`,
        name: "C902 Admin",
        role: "admin",
        emailVerified: true,
      })
      .returning();
    if (!adminUser) throw new Error("Failed to seed admin");
    cleanupUserIds.push(adminUser.id);

    // 1. Unused template -> deleted + template.deleted audit log
    const unusedDraft = await saveTemplateDraftFromWizard({
      actorId: adminUser.id,
      rawJson: rawOrbit,
      metadata: {
        name: `Unused Atlas ${suffix}`,
        slug: `unused-atlas-${suffix}`,
        type: "web",
        category: "Fintech",
        tier: "pro",
        coverUrl: "https://cdn.casefolio.app/templates/orbit/cover.png",
        coverRatio: "4:3",
      },
    });
    expect(unusedDraft.ok).toBe(true);
    if (!unusedDraft.ok) return;

    const wrongConfirm = await deleteAdminTemplate({
      actorId: adminUser.id,
      templateId: unusedDraft.templateId,
      confirmName: "Wrong Name",
    });
    expect(wrongConfirm.ok).toBe(false);

    const deleteRes = await deleteAdminTemplate({
      actorId: adminUser.id,
      templateId: unusedDraft.templateId,
      confirmName: `Unused Atlas ${suffix}`,
    });
    expect(deleteRes).toEqual({ ok: true, mode: "deleted" });
    expect(await getAdminTemplateDetail(unusedDraft.templateId)).toBeNull();

    const [deletedAudit] = await db
      .select()
      .from(dbSchema.auditLogs)
      .where(
        and(
          eq(dbSchema.auditLogs.actorId, adminUser.id),
          eq(dbSchema.auditLogs.action, "template.deleted"),
        ),
      )
      .orderBy(desc(dbSchema.auditLogs.at))
      .limit(1);
    expect(deletedAudit?.meta).toMatchObject({ slug: `unused-atlas-${suffix}` });

    // 2. Used template -> usedInProjects populated + delete retires to archived + template.retired audit log
    const usedDraft = await saveTemplateDraftFromWizard({
      actorId: adminUser.id,
      rawJson: rawOrbit,
      metadata: {
        name: `Used Orbit ${suffix}`,
        slug: `used-orbit-${suffix}`,
        type: "mobile",
        category: "Fintech",
        tier: "free",
        coverUrl: "https://cdn.casefolio.app/templates/orbit/cover.png",
        coverRatio: "4:3",
      },
    });
    expect(usedDraft.ok).toBe(true);
    if (!usedDraft.ok) return;
    cleanupTemplateIds.push(usedDraft.templateId);

    await publishTemplateVersion({
      actorId: adminUser.id,
      templateId: usedDraft.templateId,
      versionId: usedDraft.versionId,
    });

    const [proj] = await db
      .insert(dbSchema.projects)
      .values({
        ownerId: adminUser.id,
        templateVersionId: usedDraft.versionId,
        name: `Pinned Study ${suffix}`,
        type: "mobile",
        puckData: {},
        theme: {},
        visibility: "public",
        slug: `pinned-${suffix}`,
      })
      .returning();

    const detail = await getAdminTemplateDetail(usedDraft.templateId);
    expect(detail?.totalProjectCount).toBe(1);
    expect(detail?.usedInProjects?.[0]?.name).toBe(`Pinned Study ${suffix}`);

    const retireRes = await deleteAdminTemplate({
      actorId: adminUser.id,
      templateId: usedDraft.templateId,
      confirmName: `Used Orbit ${suffix}`,
    });
    expect(retireRes).toEqual({ ok: true, mode: "retired_archived" });

    const afterRetire = await getAdminTemplateDetail(usedDraft.templateId);
    expect(afterRetire?.status).toBe("archived");

    if (proj) {
      await db.delete(dbSchema.projects).where(eq(dbSchema.projects.id, proj.id));
    }
  });
});
