// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "@casefolio/db";
import { describe, expect, it } from "vitest";
import OpenGraphImage from "@/app/p/[slug]/opengraph-image";
import { generateMetadata } from "@/app/p/[slug]/page";
import { db, dbSchema } from "@/lib/db";
import {
  checkProjectSlugAvailability,
  getProjectShareSettingsForUser,
  getPublishedProjectBySlug,
  normalizeProjectSlug,
  publishProjectForUser,
  unpublishProjectForUser,
} from "@/lib/projects/publish";
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

describe("publish & public share page service (C-601)", () => {
  it("normalizes slugs, blocks reserved slugs, enforces uniqueness, generates Satori OG images, and returns null (404) on unpublish", async () => {
    expect(normalizeProjectSlug("  Orbit Mobile Banking!! 2026  ")).toBe(
      "orbit-mobile-banking-2026",
    );

    const reservedCheck = await checkProjectSlugAvailability("dashboard");
    expect(reservedCheck.available).toBe(false);

    const rawOrbit = readOrbitJson();
    const stamp = Date.now();
    const tplSlug = `c601-orbit-${stamp}`;
    const customSlug = `orbit-case-${stamp}`;

    const createdUserIds: string[] = [];
    let createdTemplateId: string | null = null;

    try {
      const [owner] = await db
        .insert(dbSchema.users)
        .values({
          email: `c601-owner-${stamp}@casefolio.test`,
          name: "Amina Al-Farsi",
          emailVerified: true,
          plan: "free",
        })
        .returning({ id: dbSchema.users.id });
      const [stranger] = await db
        .insert(dbSchema.users)
        .values({
          email: `c601-stranger-${stamp}@casefolio.test`,
          name: "Stranger User",
          emailVerified: true,
          plan: "pro",
        })
        .returning({ id: dbSchema.users.id });

      createdUserIds.push(owner!.id, stranger!.id);

      const draft = await saveTemplateDraftFromWizard({
        actorId: owner!.id,
        rawJson: rawOrbit,
        metadata: {
          name: "Orbit Publish Test",
          slug: tplSlug,
          type: "mobile",
          category: "Fintech",
          tier: "free",
          coverUrl: "https://cdn.casefolio.app/templates/orbit/cover.png",
          coverRatio: "4:3",
        },
      });
      expect(draft.ok).toBe(true);
      if (!draft.ok) return;
      createdTemplateId = draft.templateId;

      await publishTemplateVersion({
        actorId: owner!.id,
        templateId: draft.templateId,
        versionId: draft.versionId,
      });

      const firstProject = await createProjectFromTemplate({
        userId: owner!.id,
        userPlan: "free",
        input: {
          type: "mobile",
          templateId: draft.templateId,
          name: "Orbit Banking Redesign",
        },
      });
      expect(firstProject.ok).toBe(true);
      if (!firstProject.ok) return;

      const secondProject = await createProjectFromTemplate({
        userId: stranger!.id,
        userPlan: "pro",
        input: {
          type: "mobile",
          templateId: draft.templateId,
          name: "Competitor Project",
        },
      });
      expect(secondProject.ok).toBe(true);
      if (!secondProject.ok) return;

      // Before publishing, public lookup & OG image must return null / 404
      expect(await getPublishedProjectBySlug(customSlug)).toBeNull();
      const privateOg = await OpenGraphImage({ params: Promise.resolve({ slug: customSlug }) });
      expect(privateOg.status).toBe(404);

      // Reserved slug rejected
      const reservedRes = await publishProjectForUser(
        {
          projectId: firstProject.projectId,
          slug: "admin",
          visibility: "public",
        },
        { id: owner!.id, role: "user" },
      );
      expect(reservedRes.ok).toBe(false);
      if (!reservedRes.ok) {
        expect(reservedRes.code).toBe("SLUG_RESERVED");
      }

      // Cross-tenant stranger receives NOT_FOUND (404 per Spec §10.2 & §15) when probing owner's project
      const forbiddenRes = await publishProjectForUser(
        {
          projectId: firstProject.projectId,
          slug: customSlug,
          visibility: "public",
        },
        { id: stranger!.id, role: "user" },
      );
      expect(forbiddenRes.ok).toBe(false);
      if (!forbiddenRes.ok) {
        expect(forbiddenRes.code).toBe("NOT_FOUND");
      }

      // Owner publishes as public
      const pubRes = await publishProjectForUser(
        {
          projectId: firstProject.projectId,
          slug: customSlug,
          visibility: "public",
        },
        { id: owner!.id, role: "user" },
      );
      expect(pubRes.ok).toBe(true);
      if (!pubRes.ok) return;
      expect(pubRes.slug).toBe(customSlug);
      expect(pubRes.publicPath).toBe(`/p/${customSlug}`);

      // Public lookup succeeds in < 2s and returns owner plan + metadata
      const startMs = performance.now();
      const livePayload = await getPublishedProjectBySlug(customSlug);
      const elapsedMs = performance.now() - startMs;
      expect(elapsedMs).toBeLessThan(2000);
      expect(livePayload).not.toBeNull();
      expect(livePayload?.project.visibility).toBe("public");
      expect(livePayload?.owner.plan).toBe("free");

      // Public metadata allows indexing
      const publicMeta = await generateMetadata({
        params: Promise.resolve({ slug: customSlug }),
      });
      expect(publicMeta.robots).toMatchObject({ index: true, follow: true });

      // Satori OpenGraph image returns 200 image/png with PNG magic bytes
      const liveOg = await OpenGraphImage({ params: Promise.resolve({ slug: customSlug }) });
      expect(liveOg.status).toBe(200);
      expect(liveOg.headers.get("content-type")).toContain("image/png");
      const ogBytes = new Uint8Array(await liveOg.arrayBuffer());
      expect(ogBytes.byteLength).toBeGreaterThan(1000);
      expect(Array.from(ogBytes.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);

      // Another project cannot claim the same slug
      const duplicateRes = await publishProjectForUser(
        {
          projectId: secondProject.projectId,
          slug: customSlug,
          visibility: "public",
        },
        { id: stranger!.id, role: "user" },
      );
      expect(duplicateRes.ok).toBe(false);
      if (!duplicateRes.ok) {
        expect(duplicateRes.code).toBe("SLUG_TAKEN");
      }

      // Same project CAN update visibility to unlisted keeping its own slug
      const unlistedRes = await publishProjectForUser(
        {
          projectId: firstProject.projectId,
          slug: customSlug,
          visibility: "unlisted",
        },
        { id: owner!.id, role: "user" },
      );
      expect(unlistedRes.ok).toBe(true);

      const unlistedMeta = await generateMetadata({
        params: Promise.resolve({ slug: customSlug }),
      });
      expect(unlistedMeta.robots).toMatchObject({ index: false, follow: false });

      // Share settings reflect live unlisted state
      const settingsAccess = await getProjectShareSettingsForUser(firstProject.projectId, {
        id: owner!.id,
        role: "user",
      });
      expect(settingsAccess.status).toBe("ok");
      if (settingsAccess.status === "ok") {
        expect(settingsAccess.settings.isPublished).toBe(true);
        expect(settingsAccess.settings.visibility).toBe("unlisted");
      }

      // Unpublishing immediately makes getPublishedProjectBySlug return null (404) & OG return 404
      const unpubRes = await unpublishProjectForUser(firstProject.projectId, {
        id: owner!.id,
        role: "user",
      });
      expect(unpubRes.ok).toBe(true);

      expect(await getPublishedProjectBySlug(customSlug)).toBeNull();
      const postUnpubOg = await OpenGraphImage({ params: Promise.resolve({ slug: customSlug }) });
      expect(postUnpubOg.status).toBe(404);
    } finally {
      for (const uid of createdUserIds) {
        await db.delete(dbSchema.users).where(eq(dbSchema.users.id, uid));
      }
      if (createdTemplateId) {
        await db.delete(dbSchema.templates).where(eq(dbSchema.templates.id, createdTemplateId));
      }
    }
  });
});

