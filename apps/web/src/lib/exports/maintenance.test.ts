// @vitest-environment node
import { randomUUID } from "node:crypto";
import { eq } from "@casefolio/db";
import { describe, expect, it } from "vitest";
import { db, dbSchema } from "@/lib/db";
import { runExportMaintenance } from "@/lib/exports/maintenance";
import { enqueueProjectExportForUser } from "@/lib/exports/service";
import { ensurePersonalWorkspaceForUser } from "@/lib/entitlements/server";

describe("Export maintenance sweeper & retention purge (B6)", () => {
  it("fails stale queued exports (>15m), releases quota reservations, and purges expired R2 blobs", async () => {
    const suffix = randomUUID().slice(0, 8);
    const [user] = await db
      .insert(dbSchema.users)
      .values({
        email: `export-maint-${suffix}@example.com`,
        name: "Export Maint Tester",
        emailVerified: true,
        plan: "pro",
        onboardingCompletedAt: new Date(),
      })
      .returning();

    const [tplVer] = await db.select().from(dbSchema.templateVersions).limit(1);
    expect(tplVer).toBeDefined();

    try {
      const ws = await ensurePersonalWorkspaceForUser(user!.id);
      const [proj] = await db
        .insert(dbSchema.projects)
        .values({
          ownerId: user!.id,
          workspaceId: ws.workspaceId,
          spaceId: ws.defaultSpaceId,
          createdByUserId: user!.id,
          templateVersionId: tplVer!.id,
          name: "Stale Export Project",
          type: "web",
          puckData: { content: [], root: { props: { title: "Stale Export Project" } } },
          theme: {},
        })
        .returning();

      const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000);
      const enqueued = await enqueueProjectExportForUser(
        { projectId: proj!.id, format: "pdf" },
        { id: user!.id, role: "user", plan: "pro" },
        {
          now: twentyMinsAgo,
          enqueueJobFn: async () => undefined,
        },
      );
      expect(enqueued.ok).toBe(true);
      if (!enqueued.ok) return;

      // Backdate createdAt to simulate a job stuck for 20 minutes
      await db
        .update(dbSchema.exportsTable)
        .set({ createdAt: twentyMinsAgo })
        .where(eq(dbSchema.exportsTable.id, enqueued.exportJob.id));

      // Also insert an expired completed export holding an r2Key
      const expiredKey = `exports/${proj!.id}/expired-${suffix}.pdf`;
      const [expiredExport] = await db
        .insert(dbSchema.exportsTable)
        .values({
          projectId: proj!.id,
          workspaceId: ws.workspaceId,
          requestedByUserId: user!.id,
          format: "pdf",
          status: "completed",
          r2Key: expiredKey,
          bytes: 1024,
          expiresAt: new Date(Date.now() - 60_000),
        })
        .returning();

      const deletedKeys: string[] = [];
      const maint = await runExportMaintenance({
        deleteBlobFn: async (key) => {
          deletedKeys.push(key);
        },
      });

      expect(maint.staleExportsFailed).toBeGreaterThanOrEqual(1);
      expect(maint.reservationsReleased).toBeGreaterThanOrEqual(1);
      expect(maint.expiredBlobsPurged).toBeGreaterThanOrEqual(1);
      expect(deletedKeys).toContain(expiredKey);

      const [afterStale] = await db
        .select()
        .from(dbSchema.exportsTable)
        .where(eq(dbSchema.exportsTable.id, enqueued.exportJob.id));
      expect(afterStale?.status).toBe("failed");

      const [reservation] = await db
        .select()
        .from(dbSchema.usageReservations)
        .where(eq(dbSchema.usageReservations.jobId, `export:${enqueued.exportJob.id}`));
      expect(reservation?.status).toBe("released");

      const [afterExpired] = await db
        .select()
        .from(dbSchema.exportsTable)
        .where(eq(dbSchema.exportsTable.id, expiredExport!.id));
      expect(afterExpired?.r2Key).toBeNull();
    } finally {
      await db.delete(dbSchema.users).where(eq(dbSchema.users.id, user!.id));
    }
  });
});
