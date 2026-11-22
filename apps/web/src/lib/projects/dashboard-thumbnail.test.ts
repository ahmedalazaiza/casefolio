// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "@casefolio/db";
import { describe, expect, it } from "vitest";
import { db, dbSchema } from "@/lib/db";
import { listDashboardProjectsForUser } from "@/lib/projects/dashboard";
import { createProjectFromTemplate } from "@/lib/projects/service";
import { resolveThumbnailFromMockupSrc } from "@/lib/template/cover-url";
import { publishTemplateVersion, saveTemplateDraftFromWizard } from "@/lib/template/service";

function readTemplateJson(): string {
  for (const candidate of [
    resolve(process.cwd(), "reference/template.example.json"),
    resolve(process.cwd(), "../../reference/template.example.json"),
  ]) {
    if (existsSync(candidate)) return readFileSync(candidate, "utf-8");
  }
  throw new Error("Missing reference/template.example.json");
}

describe("resolveThumbnailFromMockupSrc", () => {
  it("prefers user-uploaded project assets and otherwise falls back to the template cover", () => {
    expect(resolveThumbnailFromMockupSrc("/cdn/images/a.png", "/cdn/covers/c.png", "orbit")).toBe(
      "/cdn/images/a.png",
    );
    expect(
      resolveThumbnailFromMockupSrc(" /api/assets/abc ", "/cdn/covers/c.png", "orbit"),
    ).toBe("/api/assets/abc");
    expect(
      resolveThumbnailFromMockupSrc(
        "https://cdn.casefolio.app/cdn/images/a.png",
        "/cdn/covers/c.png",
        "orbit",
      ),
    ).toBe("/cdn/covers/c.png");
    expect(resolveThumbnailFromMockupSrc(null, "/cdn/covers/c.png", "orbit")).toBe(
      "/cdn/covers/c.png",
    );
  });
});

describe("Dashboard list resolves thumbnails in SQL without loading puck_data", () => {
  it("returns the uploaded mockup URL, and falls back to the template cover for placeholders", async () => {
    const stamp = Date.now();
    let ownerId: string | null = null;
    let templateId: string | null = null;

    try {
      const [owner] = await db
        .insert(dbSchema.users)
        .values({
          email: `perf-thumb-${stamp}@casefolio.test`,
          name: "Perf Thumb",
          emailVerified: true,
          plan: "pro",
        })
        .returning({ id: dbSchema.users.id });
      ownerId = owner!.id;

      const draft = await saveTemplateDraftFromWizard({
        actorId: ownerId,
        rawJson: readTemplateJson(),
        metadata: {
          name: "Perf Thumb Template",
          slug: `perf-thumb-${stamp}`,
          type: "mobile",
          category: "Fintech",
          tier: "free",
          coverUrl: "/cdn/covers/perf-thumb-cover.png",
          coverRatio: "4:3",
        },
      });
      expect(draft.ok).toBe(true);
      if (!draft.ok) return;
      templateId = draft.templateId;
      await publishTemplateVersion({ actorId: ownerId, templateId, versionId: draft.versionId });

      const created = await createProjectFromTemplate({
        userId: ownerId,
        userPlan: "pro",
        input: { type: "mobile", templateId, name: "Thumb project", year: "2026" },
      });
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      await db
        .update(dbSchema.projects)
        .set({
          puckData: { content: [{ props: { mockup: { src: "/cdn/images/uploaded.png" } } }] },
        })
        .where(eq(dbSchema.projects.id, created.projectId));

      const uploaded = await listDashboardProjectsForUser(ownerId, null, { includeArchived: true });
      expect(uploaded.find((p) => p.id === created.projectId)?.thumbnailUrl).toBe(
        "/cdn/images/uploaded.png",
      );

      await db
        .update(dbSchema.projects)
        .set({
          puckData: {
            content: [
              { props: { mockup: { src: "https://cdn.casefolio.app/cdn/images/placeholder.png" } } },
              { props: { mockup: { src: 42 } } },
            ],
          },
        })
        .where(eq(dbSchema.projects.id, created.projectId));

      const fallback = await listDashboardProjectsForUser(ownerId, null, { includeArchived: true });
      expect(fallback.find((p) => p.id === created.projectId)?.thumbnailUrl).toBe(
        "/cdn/covers/perf-thumb-cover.png",
      );
    } finally {
      if (ownerId) {
        await db.delete(dbSchema.users).where(eq(dbSchema.users.id, ownerId));
      }
      if (templateId) {
        await db.delete(dbSchema.templates).where(eq(dbSchema.templates.id, templateId));
      }
    }
  });
});
