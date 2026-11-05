import { createDbConnection, eq, exportsTable, type Database } from "@casefolio/db";
import { PgBoss, type Job } from "pg-boss";
import {
  renderExportWithPlaywright,
  type ExportFormat,
  type RenderedExportArtifact,
  type RenderExportInput,
} from "./renderer";
import { storeRenderedExportArtifact } from "./storage";
import { signExportRenderToken } from "./token";

export const EXPORT_QUEUE_NAME = "casefolio-exports" as const;

export interface ExportQueueJobPayload {
  exportId: string;
  projectId: string;
  format: ExportFormat;
  appUrl?: string;
}

export interface ProcessExportJobDependencies {
  db: Database;
  appUrl: string;
  signingSecret?: string;
  renderFn?: (input: RenderExportInput) => Promise<RenderedExportArtifact>;
  storeFn?: typeof storeRenderedExportArtifact;
}

export function buildExportStorageKey(
  projectId: string,
  exportId: string,
  format: ExportFormat,
): string {
  const ext = format === "pdf" ? "pdf" : format === "behance" ? "zip" : "png";
  return `exports/${projectId}/${exportId}.${ext}`;
}

export async function processExportJob(
  payload: ExportQueueJobPayload,
  deps: ProcessExportJobDependencies,
): Promise<{
  status: "completed" | "failed";
  r2Key?: string;
  error?: string;
  computedHeadingFont?: string;
}> {
  const renderFn = deps.renderFn ?? renderExportWithPlaywright;
  const storeFn = deps.storeFn ?? storeRenderedExportArtifact;
  const appUrl = (payload.appUrl || deps.appUrl).replace(/\/+$/, "");

  await deps.db
    .update(exportsTable)
    .set({
      status: "processing",
      error: null,
    })
    .where(eq(exportsTable.id, payload.exportId));

  try {
    const renderToken = signExportRenderToken(
      {
        exportId: payload.exportId,
        projectId: payload.projectId,
      },
      deps.signingSecret,
    );

    const rendered = await renderFn({
      exportId: payload.exportId,
      projectId: payload.projectId,
      format: payload.format,
      appUrl,
      renderToken,
    });

    const r2Key = buildExportStorageKey(payload.projectId, payload.exportId, payload.format);
    await storeFn({
      r2Key,
      bytes: rendered.bytes,
      contentType: rendered.contentType,
    });

    await deps.db
      .update(exportsTable)
      .set({
        status: "completed",
        r2Key,
        error: null,
      })
      .where(eq(exportsTable.id, payload.exportId));

    return {
      status: "completed",
      r2Key,
      computedHeadingFont: rendered.computedHeadingFont,
    };
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : "Export rendering failed.";
    const safeError = rawMessage.slice(0, 500);

    await deps.db
      .update(exportsTable)
      .set({
        status: "failed",
        error: safeError,
      })
      .where(eq(exportsTable.id, payload.exportId));

    return {
      status: "failed",
      error: safeError,
    };
  }
}

export interface ExportWorkerConsumerHandle {
  boss: PgBoss;
  workerId: string;
  stop: () => Promise<void>;
}

export async function startPgBossExportConsumer(options: {
  databaseUrl: string;
  appUrl: string;
  db?: Database;
  signingSecret?: string;
  renderFn?: (input: RenderExportInput) => Promise<RenderedExportArtifact>;
  storeFn?: typeof storeRenderedExportArtifact;
  pollingIntervalSeconds?: number;
}): Promise<ExportWorkerConsumerHandle> {
  const ownedDb = !options.db ? createDbConnection(options.databaseUrl) : null;
  const db = options.db ?? ownedDb!.db;

  const boss = new PgBoss({
    connectionString: options.databaseUrl,
    max: 4,
  });

  await boss.start();
  await boss.createQueue(EXPORT_QUEUE_NAME).catch(() => {
    // Queue already exists
  });

  const workerId = await boss.work<ExportQueueJobPayload>(
    EXPORT_QUEUE_NAME,
    {
      pollingIntervalSeconds: options.pollingIntervalSeconds ?? 0.5,
      batchSize: 1,
    },
    async (jobs: Job<ExportQueueJobPayload>[]) => {
      for (const job of jobs) {
        await processExportJob(job.data, {
          db,
          appUrl: options.appUrl,
          signingSecret: options.signingSecret,
          renderFn: options.renderFn,
          storeFn: options.storeFn,
        });
      }
    },
  );

  return {
    boss,
    workerId,
    stop: async () => {
      await boss.stop({ graceful: true, timeout: 5_000 });
      if (ownedDb) {
        await ownedDb.pool.end();
      }
    },
  };
}

export async function enqueueExportJobToPgBoss(
  boss: PgBoss,
  payload: ExportQueueJobPayload,
): Promise<string | null> {
  await boss.createQueue(EXPORT_QUEUE_NAME).catch(() => {
    // Queue already exists
  });

  return boss.send(EXPORT_QUEUE_NAME, payload, {
    retryLimit: 2,
    retryDelay: 3,
    expireInSeconds: 180,
  });
}
