// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "@casefolio/db";
import { describe, expect, it } from "vitest";
import { db, dbSchema } from "@/lib/db";
import { createProjectFromTemplate, getProjectEditorAccess } from "@/lib/projects/service";
import {
  createNewTemplateVersion,
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

describe("createProjectFromTemplate (C-401)", () => {
  it("creates a project pinned to currentVersionId, copies puck/theme data, and enforces Free plan limits + Pro template gating", async () => {
    const rawOrbit = readOrbitJson();
    const stamp = Date.now();
    const freeSlug = `c401-free-${stamp}`;
    const proSlug = `c401-pro-${stamp}`;
    const userEmail = `c401-user-${stamp}@casefolio.test`;

    let createdUserId: string | null = null;
    const createdTemplateIds: string[] = [];

    try {
      const [user] = await db
        .insert(dbSchema.users)
        .values({
          email: userEmail,
          name: "Wizard Creator",
          emailVerified: true,
          plan: "free",
        })
        .returning({ id: dbSchema.users.id });
      createdUserId = user!.id;

      // Publish a Free template (v1.0.0)
      const freeDraft = await saveTemplateDraftFromWizard({
        actorId: createdUserId,
        rawJson: rawOrbit,
        metadata: {
          name: "Free Orbit",
          slug: freeSlug,
          type: "mobile",
          category: "Fintech",
          tier: "free",
          coverUrl: "https://cdn.casefolio.app/templates/orbit/cover.png",
          coverRatio: "4:3",
        },
      });
      expect(freeDraft.ok).toBe(true);
      if (!freeDraft.ok) return;
      createdTemplateIds.push(freeDraft.templateId);

      await publishTemplateVersion({
        actorId: createdUserId,
        templateId: freeDraft.templateId,
        versionId: freeDraft.versionId,
      });

      // Publish a Pro template (v1.0.0)
      const proDraft = await saveTemplateDraftFromWizard({
        actorId: createdUserId,
        rawJson: rawOrbit,
        metadata: {
          name: "Pro Nova",
          slug: proSlug,
          type: "mobile",
          category: "Fintech",
          tier: "pro",
          coverUrl: "https://cdn.casefolio.app/templates/orbit/cover.png",
          coverRatio: "4:3",
        },
      });
      expect(proDraft.ok).toBe(true);
      if (!proDraft.ok) return;
      createdTemplateIds.push(proDraft.templateId);

      await publishTemplateVersion({
        actorId: createdUserId,
        templateId: proDraft.templateId,
        versionId: proDraft.versionId,
      });

      // 1. Free user blocked from Pro template server-side
      const proBlocked = await createProjectFromTemplate({
        userId: createdUserId,
        userPlan: "free",
        input: {
          type: "mobile",
          templateId: proDraft.templateId,
          name: "Attempted Pro Project",
        },
      });
      expect(proBlocked).toMatchObject({
        ok: false,
        code: "PRO_TEMPLATE_LOCKED",
      });

      // 2. Free user creates Project #1 from Free template (pinned to v1.0.0)
      const created1 = await createProjectFromTemplate({
        userId: createdUserId,
        userPlan: "free",
        input: {
          type: "mobile",
          templateId: freeDraft.templateId,
          name: "Mosaed — Smart debt management",
          description: "Calm money app for tracking personal debts.",
          client: "Mosaed",
          role: "Lead designer",
          year: "2026",
        },
      });
      expect(created1.ok).toBe(true);
      if (!created1.ok) return;
      expect(created1.templateVersionId).toBe(freeDraft.versionId);

      const [projectRow] = await db
        .select()
        .from(dbSchema.projects)
        .where(eq(dbSchema.projects.id, created1.projectId));
      expect(projectRow).toBeDefined();
      expect(projectRow?.templateVersionId).toBe(freeDraft.versionId);

      const puck = projectRow?.puckData as {
        root: { props: { title: string } };
        content: Array<{ type: string; props: Record<string, unknown> }>;
      };
      expect(puck.root.props.title).toBe("Mosaed — Smart debt management");
      expect(puck.content[0]?.props.title).toBe("Mosaed — Smart debt management");
      expect(puck.content[0]?.props.subtitle).toBe(
        "Calm money app for tracking personal debts.",
      );

      // Bump template to v1.1.0 and confirm Project #1 stays pinned to v1.0.0
      const v11 = await createNewTemplateVersion({
        actorId: createdUserId,
        templateId: freeDraft.templateId,
        version: "1.1.0",
        changelog: "Bump test",
        rawJson: rawOrbit,
        publishImmediately: true,
      });
      expect(v11.ok).toBe(true);

      const [recheckedProject1] = await db
        .select()
        .from(dbSchema.projects)
        .where(eq(dbSchema.projects.id, created1.projectId));
      expect(recheckedProject1?.templateVersionId).toBe(freeDraft.versionId);

      // 3. Free user creates Project #2 (now pinned to v1.1.0)
      const created2 = await createProjectFromTemplate({
        userId: createdUserId,
        userPlan: "free",
        input: {
          type: "mobile",
          templateId: freeDraft.templateId,
          name: "Second Free Case Study",
        },
      });
      expect(created2.ok).toBe(true);
      if (created2.ok && v11.ok) {
        expect(created2.templateVersionId).toBe(v11.versionId);
      }

      // 4. Free user blocked on Project #3 (FREE_PROJECT_LIMIT = 2)
      const limitBlocked = await createProjectFromTemplate({
        userId: createdUserId,
        userPlan: "free",
        input: {
          type: "mobile",
          templateId: freeDraft.templateId,
          name: "Third Project Over Limit",
        },
      });
      expect(limitBlocked).toMatchObject({
        ok: false,
        code: "PLAN_LIMIT_REACHED",
      });

      // 5. Upgrading to Pro unlocks both unlimited projects and Pro templates
      const proSuccess = await createProjectFromTemplate({
        userId: createdUserId,
        userPlan: "pro",
        input: {
          type: "mobile",
          templateId: proDraft.templateId,
          name: "Pro Case Study Unlocked",
        },
      });
      expect(proSuccess.ok).toBe(true);

      // 6. Editor authorization check: owner gets ok, stranger gets forbidden, unknown ID gets not_found
      const ownerAccess = await getProjectEditorAccess(created1.projectId, {
        id: createdUserId,
        role: "user",
      });
      expect(ownerAccess.status).toBe("ok");

      const strangerAccess = await getProjectEditorAccess(created1.projectId, {
        id: "00000000-0000-4000-8000-000000000001",
        role: "user",
      });
      expect(strangerAccess.status).toBe("forbidden");

      const missingAccess = await getProjectEditorAccess(
        "00000000-0000-4000-8000-000000000099",
        { id: createdUserId, role: "user" },
      );
      expect(missingAccess.status).toBe("not_found");
    } finally {
      if (createdUserId) {
        await db.delete(dbSchema.projects).where(eq(dbSchema.projects.ownerId, createdUserId));
      }
      for (const tplId of createdTemplateIds) {
        await db.delete(dbSchema.templates).where(eq(dbSchema.templates.id, tplId));
      }
      if (createdUserId) {
        await db.delete(dbSchema.users).where(eq(dbSchema.users.id, createdUserId));
      }
    }
  });
});
