import {
  createDbConnection,
  eq,
  exportsTable,
  notifications,
  projects,
  type Database,
} from "@casefolio/db";
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

export interface ExportFinishedEvent {
  exportId: string;
  projectId: string;
  format: ExportFormat;
  status: "completed" | "failed";
  appUrl: string;
  error?: string;
}

export interface ProcessExportJobDependencies {
  db: Database;
  appUrl: string;
  signingSecret?: string;
  renderFn?: (input: RenderExportInput) => Promise<RenderedExportArtifact>;
  storeFn?: typeof storeRenderedExportArtifact;
  onExportFinished?: (event: ExportFinishedEvent) => Promise<void>;
}

async function recordStandaloneWorkerNotification(
  db: Database,
  event: ExportFinishedEvent,
): Promise<void> {
  try {
    const [projectRow] = await db
      .select({
        id: projects.id,
        name: projects.name,
        ownerId: projects.ownerId,
      })
      .from(projects)
      .where(eq(projects.id, event.projectId))
      .limit(1);

    if (!projectRow) return;

    const formatLabel =
      event.format === "pdf"
        ? "PDF"
        : event.format === "behance"
          ? "Behance slices"
          : "PNG";

    const kind = event.status === "completed" ? "export_ready" : "export_failed";
    const title = event.status === "completed" ? "Export ready" : "Export failed";
    const message =
      event.status === "completed"
        ? `“${projectRow.name}” ${formatLabel} is ready to download.`
        : `“${projectRow.name}” couldn’t render. Retry from Exports.`;

    await db.insert(notifications).values({
      userId: projectRow.ownerId,
      kind,
      payload: {
        title,
        message,
        href: `/projects/${projectRow.id}/exports`,
        exportId: event.exportId,
        projectId: projectRow.id,
        format: event.format,
      },
    });
  } catch {
    // Non-fatal notification insert fallback
  }
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

    const finishedEvent: ExportFinishedEvent = {
      exportId: payload.exportId,
      projectId: payload.projectId,
      format: payload.format,
      status: "completed",
      appUrl,
    };
    if (deps.onExportFinished) {
      await deps.onExportFinished(finishedEvent).catch(() => undefined);
    } else {
      await recordStandaloneWorkerNotification(deps.db, finishedEvent);
    }

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

    const failedEvent: ExportFinishedEvent = {
      exportId: payload.exportId,
      projectId: payload.projectId,
      format: payload.format,
      status: "failed",
      appUrl,
      error: safeError,
    };
    if (deps.onExportFinished) {
      await deps.onExportFinished(failedEvent).catch(() => undefined);
    } else {
      await recordStandaloneWorkerNotification(deps.db, failedEvent);
    }

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
  onExportFinished?: (event: ExportFinishedEvent) => Promise<void>;
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
          onExportFinished: options.onExportFinished,
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
