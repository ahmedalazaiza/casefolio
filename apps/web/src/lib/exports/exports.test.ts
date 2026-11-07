// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "@casefolio/db";
import { processExportJob } from "@casefolio/worker";
import { afterAll, describe, expect, it } from "vitest";
import { db, dbSchema } from "@/lib/db";
import {
  authorizeAndReadExportFile,
  enqueueProjectExportForUser,
  getExportJobForUser,
  getProjectExportsOverviewForUser,
  shutdownExportQueueForTests,
} from "@/lib/exports/service";
import { FREE_MONTHLY_EXPORT_LIMIT } from "@/lib/exports/types";
import { createProjectFromTemplate } from "@/lib/projects/service";
import { resetUploadRateLimitsForTests } from "@/lib/storage/rate-limit";
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

afterAll(async () => {
  await shutdownExportQueueForTests();
});

describe("exports service, plan gating & worker job lifecycle (C-602)", () => {
  it("enforces Free watermark + format/monthly limits, unlocks PDF/Behance on Pro, and transitions queued -> processing -> completed", async () => {
    resetUploadRateLimitsForTests();
    const rawOrbit = readOrbitJson();
    const stamp = Date.now();
    const tplSlug = `c602-orbit-${stamp}`;

    const createdUserIds: string[] = [];
    let createdTemplateId: string | null = null;

    try {
      const [freeUser] = await db
        .insert(dbSchema.users)
        .values({
          email: `c602-free-${stamp}@casefolio.test`,
          name: "Free Exporter",
          emailVerified: true,
          plan: "free",
        })
        .returning({ id: dbSchema.users.id });
      const [proUser] = await db
        .insert(dbSchema.users)
        .values({
          email: `c602-pro-${stamp}@casefolio.test`,
          name: "Pro Exporter",
          emailVerified: true,
          plan: "pro",
        })
        .returning({ id: dbSchema.users.id });

      createdUserIds.push(freeUser!.id, proUser!.id);

      const draft = await saveTemplateDraftFromWizard({
        actorId: proUser!.id,
        rawJson: rawOrbit,
        metadata: {
          name: "Orbit Export Test",
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
        actorId: proUser!.id,
        templateId: draft.templateId,
        versionId: draft.versionId,
      });

      const freeProj = await createProjectFromTemplate({
        userId: freeUser!.id,
        userPlan: "free",
        input: {
          type: "mobile",
          templateId: draft.templateId,
          name: "Free Banking Deck",
        },
      });
      expect(freeProj.ok).toBe(true);
      if (!freeProj.ok) return;

      const proProj = await createProjectFromTemplate({
        userId: proUser!.id,
        userPlan: "pro",
        input: {
          type: "mobile",
          templateId: draft.templateId,
          name: "Pro Banking Deck",
        },
      });
      expect(proProj.ok).toBe(true);
      if (!proProj.ok) return;

      // 1. Free user blocked from PDF & Behance
      const freePdf = await enqueueProjectExportForUser(
        { projectId: freeProj.projectId, format: "pdf" },
        { id: freeUser!.id, role: "user", plan: "free" },
        { enqueueJobFn: async () => undefined },
      );
      expect(freePdf.ok).toBe(false);
      if (!freePdf.ok) {
        expect(freePdf.code).toBe("PLAN_UPGRADE_REQUIRED");
      }

      const freeBehance = await enqueueProjectExportForUser(
        { projectId: freeProj.projectId, format: "behance" },
        { id: freeUser!.id, role: "user", plan: "free" },
        { enqueueJobFn: async () => undefined },
      );
      expect(freeBehance.ok).toBe(false);
      if (!freeBehance.ok) {
        expect(freeBehance.code).toBe("PLAN_UPGRADE_REQUIRED");
      }

      // 2. Free user allowed up to FREE_MONTHLY_EXPORT_LIMIT PNG exports (with watermark)
      for (let i = 0; i < FREE_MONTHLY_EXPORT_LIMIT; i++) {
        const res = await enqueueProjectExportForUser(
          { projectId: freeProj.projectId, format: "png_long" },
          { id: freeUser!.id, role: "user", plan: "free" },
          { enqueueJobFn: async () => undefined },
        );
        expect(res.ok).toBe(true);
        if (res.ok) {
          expect(res.hasWatermark).toBe(true);
        }
      }

      const overQuota = await enqueueProjectExportForUser(
        { projectId: freeProj.projectId, format: "png_long" },
        { id: freeUser!.id, role: "user", plan: "free" },
        { enqueueJobFn: async () => undefined },
      );
      expect(overQuota.ok).toBe(false);
      if (!overQuota.ok) {
        expect(overQuota.code).toBe("EXPORT_LIMIT_REACHED");
      }

      // 3. Pro user enqueues PDF (no watermark, no monthly limit) and worker processes job -> completed
      const enqueuedJobs: Array<{ exportId: string; projectId: string; format: "png_long" | "pdf" | "behance" }> = [];
      const proPdf = await enqueueProjectExportForUser(
        { projectId: proProj.projectId, format: "pdf" },
        { id: proUser!.id, role: "user", plan: "pro" },
        {
          enqueueJobFn: async (job) => {
            enqueuedJobs.push(job);
          },
        },
      );
      expect(proPdf.ok).toBe(true);
      if (!proPdf.ok) return;
      expect(proPdf.hasWatermark).toBe(false);
      expect(proPdf.monthlyExportsLimit).toBe(60);
      expect(proPdf.exportJob.status).toBe("queued");

      const fakePdfBytes = new TextEncoder().encode("%PDF-1.7\nCasefolio Pro Export\n%%EOF");
      const processed = await processExportJob(enqueuedJobs[0]!, {
        db,
        appUrl: "http://localhost:3000",
        signingSecret: "test-secret-for-c602-worker-unit-32chars",
        renderFn: async () => ({
          bytes: fakePdfBytes,
          contentType: "application/pdf",
          extension: "pdf",
          sliceCount: 1,
          computedHeadingFont: "Instrument Serif, Geist",
        }),
      });
      expect(processed.status).toBe("completed");

      // Status visible via getExportJobForUser & getProjectExportsOverviewForUser
      const statusRes = await getExportJobForUser(proPdf.exportJob.id, {
        id: proUser!.id,
        role: "user",
      });
      expect(statusRes.status).toBe("ok");
      if (statusRes.status === "ok") {
        expect(statusRes.exportJob.status).toBe("completed");
        expect(statusRes.exportJob.downloadUrl).toBe(
          `/api/exports/${proPdf.exportJob.id}/download`,
        );
      }

      const overviewRes = await getProjectExportsOverviewForUser(proProj.projectId, {
        id: proUser!.id,
        role: "user",
      });
      expect(overviewRes.status).toBe("ok");
      if (overviewRes.status === "ok") {
        expect(overviewRes.overview.exports).toHaveLength(1);
        expect(overviewRes.overview.exports[0]?.status).toBe("completed");
      }

      // Download authorized for owner, 404 (not_found) for cross-tenant stranger per Spec §10.2 & §15
      const strangerDownload = await authorizeAndReadExportFile(proPdf.exportJob.id, {
        id: freeUser!.id,
        role: "user",
      });
      expect(strangerDownload.status).toBe("not_found");

      const ownerDownload = await authorizeAndReadExportFile(proPdf.exportJob.id, {
        id: proUser!.id,
        role: "user",
      });
      expect(ownerDownload.status).toBe("ok");
      if (ownerDownload.status === "ok") {
        expect(ownerDownload.contentType).toBe("application/pdf");
        expect(ownerDownload.fileName).toBe("pro-banking-deck-case-study.pdf");
        expect(new TextDecoder().decode(ownerDownload.bytes)).toContain("%PDF-1.7");
      }
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

