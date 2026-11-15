// @vitest-environment node
import { randomUUID } from "node:crypto";
import { createDbConnection, eq, exportsTable, projects, templateVersions, usageReservations, users } from "@casefolio/db";
import { describe, expect, it } from "vitest";
import { isNonRetryableExportError, processExportJob, resolveExportWorkerConcurrency } from "./queue";

describe("Export worker retry & failure semantics (B6)", () => {
  it("parses and bounds EXPORT_WORKER_CONCURRENCY safely", () => {
    expect(resolveExportWorkerConcurrency(undefined)).toBe(1);
    expect(resolveExportWorkerConcurrency(4)).toBe(4);
    expect(resolveExportWorkerConcurrency(99)).toBe(16);
    expect(resolveExportWorkerConcurrency(0)).toBe(1);
  });

  it("classifies non-retryable ceiling errors accurately", () => {
    expect(isNonRetryableExportError(new Error("Rendered canvas exceeds maximum megapixel limit"))).toBe(true);
    expect(isNonRetryableExportError(new Error("net::ERR_CONNECTION_RESET"))).toBe(false);
  });

  it("rethrows transient errors while retries remain (keeping reservation) and finalizes on last attempt", async () => {
    const dbUrl = process.env.DATABASE_URL ?? "postgresql://localhost:5433/casefolio";
    const conn = createDbConnection(dbUrl);
    const suffix = randomUUID().slice(0, 8);

    const [user] = await conn.db
      .insert(users)
      .values({
        email: `worker-retry-${suffix}@example.com`,
        name: "Worker Retry Tester",
        emailVerified: true,
        plan: "pro",
        onboardingCompletedAt: new Date(),
      })
      .returning();

    const [tplVer] = await conn.db.select().from(templateVersions).limit(1);

    try {
      const [proj] = await conn.db
        .insert(projects)
        .values({
          ownerId: user!.id,
          templateVersionId: tplVer!.id,
          name: "Retry Test Case Study",
          type: "web",
          puckData: { content: [], root: { props: { title: "Retry Test Case Study" } } },
          theme: {},
        })
        .returning();

      const [expRow] = await conn.db
        .insert(exportsTable)
        .values({
          projectId: proj!.id,
          requestedByUserId: user!.id,
          format: "pdf",
          status: "queued",
        })
        .returning();

      const finishedEvents: string[] = [];

      // Attempt 1 (retryCount = 0 < retryLimit = 2): rethrows, status stays queued, no failed notification
      await expect(
        processExportJob(
          {
            exportId: expRow!.id,
            projectId: proj!.id,
            format: "pdf",
            requestedByUserId: user!.id,
          },
          {
            db: conn.db,
            appUrl: "http://localhost:3000",
            signingSecret: "worker-retry-test-secret-32-characters-min",
            retryCount: 0,
            retryLimit: 2,
            renderFn: async () => {
              throw new Error("Chromium page crashed transiently");
            },
            onExportFinished: async (ev) => {
              finishedEvents.push(ev.status);
            },
          },
        ),
      ).rejects.toThrow(/Chromium page crashed transiently/);

      const [afterFirstAttempt] = await conn.db
        .select()
        .from(exportsTable)
        .where(eq(exportsTable.id, expRow!.id));
      expect(afterFirstAttempt?.status).toBe("queued");
      expect(finishedEvents).toHaveLength(0);

      // Final attempt (retryCount = 2 === retryLimit = 2): marks failed, emits failed notification, and rethrows
      await expect(
        processExportJob(
          {
            exportId: expRow!.id,
            projectId: proj!.id,
            format: "pdf",
            requestedByUserId: user!.id,
          },
          {
            db: conn.db,
            appUrl: "http://localhost:3000",
            signingSecret: "worker-retry-test-secret-32-characters-min",
            retryCount: 2,
            retryLimit: 2,
            renderFn: async () => {
              throw new Error("Chromium page crashed transiently");
            },
            onExportFinished: async (ev) => {
              finishedEvents.push(ev.status);
            },
          },
        ),
      ).rejects.toThrow(/Chromium page crashed transiently/);

      const [afterFinalAttempt] = await conn.db
        .select()
        .from(exportsTable)
        .where(eq(exportsTable.id, expRow!.id));
      expect(afterFinalAttempt?.status).toBe("failed");
      expect(finishedEvents).toEqual(["failed"]);
      void usageReservations;
    } finally {
      await conn.db.delete(users).where(eq(users.id, user!.id));
      await conn.pool.end();
    }
  });
});
