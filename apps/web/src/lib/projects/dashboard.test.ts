// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "@casefolio/db";
import { describe, expect, it } from "vitest";
import { db, dbSchema } from "@/lib/db";
import {
  deleteProjectForUser,
  duplicateProjectForUser,
  listDashboardProjectsForUser,
  renameProjectForUser,
} from "@/lib/projects/dashboard";
import { createProjectFromTemplate } from "@/lib/projects/service";
import { publishTemplateVersion, saveTemplateDraftFromWizard } from "@/lib/template/service";

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

describe("Dashboard project management service (C-1004)", () => {
  it("renames without altering public slug, enforces Free quota on duplicate, blocks cross-user mutations, and deletes with confirmation", async () => {
    const rawOrbit = readOrbitJson();
    const stamp = Date.now();
    const tplSlug = `c1004-orbit-${stamp}`;

    let ownerId: string | null = null;
    let strangerId: string | null = null;
    let templateId: string | null = null;

    try {
      const [owner] = await db
        .insert(dbSchema.users)
        .values({
          email: `c1004-owner-${stamp}@casefolio.test`,
          name: "Owner Designer",
          emailVerified: true,
          plan: "free",
        })
        .returning({ id: dbSchema.users.id });
      ownerId = owner!.id;

      const [stranger] = await db
        .insert(dbSchema.users)
        .values({
          email: `c1004-stranger-${stamp}@casefolio.test`,
          name: "Stranger User",
          emailVerified: true,
          plan: "pro",
        })
        .returning({ id: dbSchema.users.id });
      strangerId = stranger!.id;

      const draftTpl = await saveTemplateDraftFromWizard({
        actorId: ownerId,
        rawJson: rawOrbit,
        metadata: {
          name: "Orbit Dashboard",
          slug: tplSlug,
          type: "mobile",
          category: "Fintech",
          tier: "free",
          coverUrl: "https://cdn.casefolio.app/templates/orbit/cover.png",
          coverRatio: "4:3",
        },
      });
      expect(draftTpl.ok).toBe(true);
      if (!draftTpl.ok) return;
      templateId = draftTpl.templateId;

      await publishTemplateVersion({
        actorId: ownerId,
        templateId,
        versionId: draftTpl.versionId,
      });

      // 1. Create initial project
      const created = await createProjectFromTemplate({
        userId: ownerId,
        userPlan: "free",
        input: {
          type: "mobile",
          templateId,
          name: "Mosaed — Debt app",
          client: "Mosaed",
          role: "Lead Designer",
          year: "2026",
          description: "Calm debt management mobile app.",
        },
      });
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const customSlug = `mosaed-debt-${stamp}`;
      await db
        .update(dbSchema.projects)
        .set({
          slug: customSlug,
          visibility: "public",
          publishedAt: new Date(),
        })
        .where(eq(dbSchema.projects.id, created.projectId));

      // 2. Rename preserves custom public slug
      const renamed = await renameProjectForUser(
        {
          projectId: created.projectId,
          name: "Mosaed — Smart Debt v2",
        },
        { id: ownerId, role: "user" },
      );
      expect(renamed.ok).toBe(true);

      const listedAfterRename = await listDashboardProjectsForUser(ownerId);
      expect(listedAfterRename[0]?.name).toBe("Mosaed — Smart Debt v2");
      expect(listedAfterRename[0]?.slug).toBe(customSlug);

      // 3. 2nd Case Study via duplicate on Free plan is blocked by `can()` (FREE_PROJECT_LIMIT = 1)
      const dupBlocked = await duplicateProjectForUser(
        { projectId: created.projectId },
        { id: ownerId, role: "user" },
        "free",
      );
      expect(dupBlocked.ok).toBe(false);
      if (!dupBlocked.ok) {
        expect(dupBlocked.code).toBe("PLAN_LIMIT_REACHED");
      }

      // 4. Upgrading owner to Pro unlocks duplicate and resets copy to private draft
      await db
        .update(dbSchema.users)
        .set({ plan: "pro" })
        .where(eq(dbSchema.users.id, ownerId));

      const dup1 = await duplicateProjectForUser(
        { projectId: created.projectId },
        { id: ownerId, role: "user" },
        "pro",
      );
      expect(dup1.ok).toBe(true);
      if (!dup1.ok) return;
      expect(dup1.project.name).toBe("Mosaed — Smart Debt v2 (Copy)");
      expect(dup1.project.visibility).toBe("private");
      expect(dup1.project.slug).toBeNull();

      // 5. Cross-tenant stranger receives NOT_FOUND (404 per Spec §10.2 & §15) when probing rename
      const forbiddenRename = await renameProjectForUser(
        { projectId: created.projectId, name: "Hacked" },
        { id: strangerId, role: "user" },
      );
      expect(forbiddenRename.ok).toBe(false);
      if (!forbiddenRename.ok) {
        expect(forbiddenRename.code).toBe("NOT_FOUND");
      }

      // 6. Delete rejects wrong confirmation string, then deletes on exact match
      const wrongConfirm = await deleteProjectForUser(
        {
          projectId: dup1.project.id,
          confirmName: "wrong name",
          deleteExports: true,
        },
        { id: ownerId, role: "user" },
      );
      expect(wrongConfirm.ok).toBe(false);

      const deleted = await deleteProjectForUser(
        {
          projectId: dup1.project.id,
          confirmName: "Mosaed — Smart Debt v2 (Copy)",
          deleteExports: true,
        },
        { id: ownerId, role: "user" },
      );
      expect(deleted.ok).toBe(true);

      const remaining = await listDashboardProjectsForUser(ownerId);
      expect(remaining).toHaveLength(1);
    } finally {
      if (ownerId) {
        await db.delete(dbSchema.users).where(eq(dbSchema.users.id, ownerId));
      }
      if (strangerId) {
        await db.delete(dbSchema.users).where(eq(dbSchema.users.id, strangerId));
      }
      if (templateId) {
        await db.delete(dbSchema.templates).where(eq(dbSchema.templates.id, templateId));
      }
    }
  });
});
