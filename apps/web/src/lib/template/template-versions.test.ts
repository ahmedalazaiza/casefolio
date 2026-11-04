// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "@casefolio/db";
import { describe, expect, it } from "vitest";
import { db, dbSchema } from "@/lib/db";
import { compareSemver, suggestNextMinorSemver } from "@/lib/template/semver";
import {
  archiveTemplate,
  createNewTemplateVersion,
  listPublishedLibraryTemplates,
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

describe("Template versions, project pinning & archive lifecycle (C-304)", () => {
  it("compares semantic versions accurately and suggests next minor bump", () => {
    expect(compareSemver("1.1.0", "1.0.0")).toBeGreaterThan(0);
    expect(compareSemver("1.0.0", "1.0.0")).toBe(0);
    expect(compareSemver("0.9.9", "1.0.0")).toBeLessThan(0);
    expect(suggestNextMinorSemver("1.0.0")).toBe("1.1.0");
  });

  it("publishing a new version (1.1.0) does not alter existing projects pinned to 1.0.0, and archiving hides from library", async () => {
    const rawOrbit = readOrbitJson();
    const slug = `c304-pin-${Date.now()}`;
    const testEmail = `c304-owner-${Date.now()}@casefolio.test`;

    let createdUserId: string | null = null;
    let createdProjectId: string | null = null;

    try {
      const [owner] = await db
        .insert(dbSchema.users)
        .values({
          email: testEmail,
          name: "Pinning Tester",
          emailVerified: true,
        })
        .returning({ id: dbSchema.users.id });
      createdUserId = owner!.id;

      // 1. Create v1.0.0 draft and publish it
      const draftRes = await saveTemplateDraftFromWizard({
        actorId: createdUserId,
        rawJson: rawOrbit,
        metadata: {
          name: "Pinning Template",
          slug,
          type: "mobile",
          category: "Fintech",
          tier: "free",
          coverUrl: "https://cdn.casefolio.app/templates/orbit/cover.png",
          coverRatio: "4:3",
        },
      });
      expect(draftRes.ok).toBe(true);
      if (!draftRes.ok) return;

      const pubV1 = await publishTemplateVersion({
        actorId: createdUserId,
        templateId: draftRes.templateId,
        versionId: draftRes.versionId,
      });
      expect(pubV1.ok).toBe(true);

      // 2. Create a user project pinned to v1.0.0
      const parsedOrbit = JSON.parse(rawOrbit) as {
        template: { theme: Record<string, unknown> };
        puck: {
          root: Record<string, unknown>;
          content: Array<{ props: { title?: string } }>;
          zones: Record<string, unknown>;
        };
      };
      const originalHeroTitle = parsedOrbit.puck.content[0]?.props.title;

      const [projectRow] = await db
        .insert(dbSchema.projects)
        .values({
          ownerId: createdUserId,
          templateVersionId: draftRes.versionId,
          name: "User Pinned Case Study",
          type: "mobile",
          puckData: parsedOrbit.puck,
          theme: parsedOrbit.template.theme,
        })
        .returning();
      createdProjectId = projectRow!.id;

      // 3. Reject lower/equal semver bump
      const downgradeAttempt = await createNewTemplateVersion({
        actorId: createdUserId,
        templateId: draftRes.templateId,
        version: "1.0.0",
        changelog: "Duplicate version attempt",
        rawJson: rawOrbit,
      });
      expect(downgradeAttempt.ok).toBe(false);

      // 4. Create & publish v1.1.0 with modified Hero title
      const v11Payload = JSON.parse(rawOrbit) as typeof parsedOrbit;
      v11Payload.puck.content[0]!.props.title = "Updated v1.1 Template Title";

      const v11Res = await createNewTemplateVersion({
        actorId: createdUserId,
        templateId: draftRes.templateId,
        version: "1.1.0",
        changelog: "Updated hero copy for 1.1.0",
        rawJson: JSON.stringify(v11Payload),
        publishImmediately: true,
      });
      expect(v11Res.ok).toBe(true);
      if (!v11Res.ok) return;

      // Verify existing project is STILL pinned to v1.0.0 with original puckData
      const [reloadedProject] = await db
        .select()
        .from(dbSchema.projects)
        .where(eq(dbSchema.projects.id, createdProjectId));

      expect(reloadedProject?.templateVersionId).toBe(draftRes.versionId);
      const reloadedPuck = reloadedProject?.puckData as typeof parsedOrbit.puck;
      expect(reloadedPuck.content[0]?.props.title).toBe(originalHeroTitle);

      // Verify library serves v1.1.0 while published
      const publishedList = await listPublishedLibraryTemplates();
      const inLibrary = publishedList.find((item) => item.slug === slug);
      expect(inLibrary).toBeDefined();
      expect(inLibrary?.version).toBe("1.1.0");

      // 5. Archive template -> hidden from user library, existing project still works
      const archRes = await archiveTemplate({
        actorId: createdUserId,
        templateId: draftRes.templateId,
      });
      expect(archRes.ok).toBe(true);

      const afterArchiveList = await listPublishedLibraryTemplates();
      expect(afterArchiveList.find((item) => item.slug === slug)).toBeUndefined();
    } finally {
      if (createdProjectId) {
        await db.delete(dbSchema.projects).where(eq(dbSchema.projects.id, createdProjectId));
      }
      await db.delete(dbSchema.templates).where(eq(dbSchema.templates.slug, slug));
      if (createdUserId) {
        await db.delete(dbSchema.users).where(eq(dbSchema.users.id, createdUserId));
      }
    }
  });
});
