import {
  and,
  createDbConnection,
  eq,
  exportsTable,
  memberships,
  notifications,
  projects,
  spaces,
  sql,
  usageReservations,
  workspaces,
  type Database,
  type UsageMeterKey,
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
const EXPORT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export interface ExportQueueJobPayload {
  exportId: string;
  projectId: string;
  format: ExportFormat;
  appUrl?: string;
  workspaceId?: string | null;
  requestedByUserId?: string | null;
  scale?: 1 | 2;
  maxMegapixels?: number;
  maxPdfPages?: number;
  timeoutMs?: number;
  reservationJobId?: string;
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

async function commitWorkerExportReservation(
  db: Database,
  jobId: string,
  now: Date = new Date(),
): Promise<void> {
  await db.transaction(async (tx) => {
    const lockedRes = await tx.execute<{
      job_id: string;
      workspace_id: string;
      calendar_month: string;
      meter: UsageMeterKey;
      amount: string | number;
      status: string;
    }>(sql`
      SELECT job_id, workspace_id, calendar_month, meter, amount, status
      FROM usage_reservations
      WHERE job_id = ${jobId}
      FOR UPDATE
    `);

    const row = lockedRes.rows[0];
    if (!row || row.status === "committed" || row.status === "released") {
      return;
    }

    const amount = Number(row.amount);
    await tx
      .update(usageReservations)
      .set({ status: "committed", updatedAt: now })
      .where(eq(usageReservations.jobId, jobId));

    await tx.execute(sql`
      UPDATE usage_buckets
      SET
        used_value = used_value + ${amount},
        reserved_value = GREATEST(0, reserved_value - ${amount}),
        updated_at = ${now}
      WHERE workspace_id = ${row.workspace_id}
        AND calendar_month = ${row.calendar_month}
        AND meter = ${row.meter}
    `);
  });
}

async function releaseWorkerExportReservation(
  db: Database,
  jobId: string,
  now: Date = new Date(),
): Promise<void> {
  await db.transaction(async (tx) => {
    const locked = await tx.execute<{
      job_id: string;
      workspace_id: string;
      calendar_month: string;
      meter: UsageMeterKey;
      amount: string | number;
      status: string;
    }>(sql`
      SELECT job_id, workspace_id, calendar_month, meter, amount, status
      FROM usage_reservations
      WHERE job_id = ${jobId}
      FOR UPDATE
    `);

    const row = locked.rows[0];
    if (!row || row.status === "released" || row.status === "committed") {
      return;
    }

    const amount = Number(row.amount);
    await tx
      .update(usageReservations)
      .set({ status: "released", updatedAt: now })
      .where(eq(usageReservations.jobId, jobId));

    await tx.execute(sql`
      UPDATE usage_buckets
      SET
        reserved_value = GREATEST(0, reserved_value - ${amount}),
        updated_at = ${now}
      WHERE workspace_id = ${row.workspace_id}
        AND calendar_month = ${row.calendar_month}
        AND meter = ${row.meter}
    `);
  });
}

/**
 * Re-verifies requester identity, workspace membership, and space ACL at execution AND delivery
 * (`Spec §10.7`: a worker system identity is not blanket permission; member removal or space
 * privatization during a running job prevents delivery).
 */
async function verifyWorkerExportAcl(
  db: Database,
  exportId: string,
  projectId: string,
  fallbackRequesterId?: string | null,
): Promise<{
  allowed: boolean;
  reason?: string;
  requesterId?: string;
  exportRow?: typeof exportsTable.$inferSelect;
}> {
  const [[exportRow], [projectRow]] = await Promise.all([
    db.select().from(exportsTable).where(eq(exportsTable.id, exportId)).limit(1),
    db.select().from(projects).where(eq(projects.id, projectId)).limit(1),
  ]);

  if (!exportRow || !projectRow || exportRow.projectId !== projectRow.id) {
    return { allowed: false, reason: "Export job or target project no longer exists." };
  }

  if (projectRow.archivedAt !== null) {
    return { allowed: false, reason: "Project was archived before export completed." };
  }

  const requesterId =
    exportRow.requestedByUserId ?? fallbackRequesterId ?? projectRow.ownerId;

  if (projectRow.workspaceId && projectRow.spaceId) {
    const [[workspace], [space]] = await Promise.all([
      db.select().from(workspaces).where(eq(workspaces.id, projectRow.workspaceId)).limit(1),
      db.select().from(spaces).where(eq(spaces.id, projectRow.spaceId)).limit(1),
    ]);

    if (!workspace || !space || space.workspaceId !== workspace.id) {
      return { allowed: false, reason: "Workspace or space boundary is invalid." };
    }

    if (workspace.frozenAt !== null || space.recoveryState !== "active") {
      return {
        allowed: false,
        reason: "Workspace or space entered read-only/recovery state before delivery.",
      };
    }

    if (workspace.kind === "personal") {
      if (workspace.personalOwnerId !== requesterId || space.controllerUserId !== requesterId) {
        return { allowed: false, reason: "Requester no longer controls personal space." };
      }
    } else if (workspace.kind === "team") {
      if (!workspace.organizationId) {
        return { allowed: false, reason: "Team workspace organization is missing." };
      }
      const [membership] = await db
        .select({ id: memberships.id })
        .from(memberships)
        .where(
          and(
            eq(memberships.orgId, workspace.organizationId),
            eq(memberships.userId, requesterId),
          ),
        )
        .limit(1);

      if (!membership) {
        return {
          allowed: false,
          reason: "Requester membership was revoked before export delivery.",
        };
      }

      if (space.visibility === "private" && space.controllerUserId !== requesterId) {
        return {
          allowed: false,
          reason: "Space visibility changed to private before export delivery.",
        };
      }
    }
  }

  return {
    allowed: true,
    requesterId,
    exportRow,
  };
}

async function recordStandaloneWorkerNotification(
  db: Database,
  event: ExportFinishedEvent,
  recipientUserId?: string,
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
        : `Case study ${formatLabel} export could not complete.`;

    await db.insert(notifications).values({
      userId: recipientUserId ?? projectRow.ownerId,
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

function isLoopbackHost(hostname: string): boolean {
  const clean = hostname.toLowerCase();
  return clean === "localhost" || clean === "127.0.0.1" || clean === "[::1]";
}

function resolveTrustedWorkerAppUrl(
  payloadAppUrl: string | undefined,
  configuredAppUrl: string,
): string {
  const cleanConfigured = configuredAppUrl.replace(/\/+$/, "");
  if (!payloadAppUrl) {
    return cleanConfigured;
  }

  try {
    const parsedConfigured = new URL(cleanConfigured);
    const parsedPayload = new URL(payloadAppUrl.replace(/\/+$/, ""));
    if (parsedPayload.origin === parsedConfigured.origin) {
      return parsedPayload.origin;
    }
    // Allow 127.0.0.1 <-> localhost equivalence ONLY on the exact same configured port in local/test runs
    const configuredPort = parsedConfigured.port || (parsedConfigured.protocol === "https:" ? "443" : "80");
    const payloadPort = parsedPayload.port || (parsedPayload.protocol === "https:" ? "443" : "80");
    if (
      parsedPayload.protocol === parsedConfigured.protocol &&
      configuredPort === payloadPort &&
      isLoopbackHost(parsedConfigured.hostname) &&
      isLoopbackHost(parsedPayload.hostname)
    ) {
      return parsedPayload.origin;
    }
  } catch {
    // Fall back to configured worker appUrl
  }

  return cleanConfigured;
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
  const appUrl = resolveTrustedWorkerAppUrl(payload.appUrl, deps.appUrl);
  const reservationJobId = payload.reservationJobId ?? `export:${payload.exportId}`;

  // 1. Pre-execution ACL & membership check (`Spec §10.7`)
  const preAcl = await verifyWorkerExportAcl(
    deps.db,
    payload.exportId,
    payload.projectId,
    payload.requestedByUserId,
  );
  if (!preAcl.allowed) {
    const safeReason = preAcl.reason ?? "Export authorization revoked before execution.";
    await deps.db
      .update(exportsTable)
      .set({
        status: "failed",
        r2Key: null,
        error: safeReason,
      })
      .where(eq(exportsTable.id, payload.exportId));
    await releaseWorkerExportReservation(deps.db, reservationJobId).catch(() => undefined);
    return {
      status: "failed",
      error: safeReason,
    };
  }

  await deps.db
    .update(exportsTable)
    .set({
      status: "processing",
      error: null,
    })
    .where(eq(exportsTable.id, payload.exportId));

  try {
    const resolvedScale: 1 | 2 =
      payload.scale ?? (preAcl.exportRow?.scale === 2 ? 2 : 1);

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
      scale: resolvedScale,
      maxMegapixels: payload.maxMegapixels,
      maxPdfPages: payload.maxPdfPages,
      timeoutMs: payload.timeoutMs,
    });

    // 2. Post-render / pre-delivery ACL & membership recheck (`Spec §10.7`)
    const postAcl = await verifyWorkerExportAcl(
      deps.db,
      payload.exportId,
      payload.projectId,
      payload.requestedByUserId,
    );
    if (!postAcl.allowed) {
      const safeReason = postAcl.reason ?? "Export authorization revoked before delivery.";
      await deps.db
        .update(exportsTable)
        .set({
          status: "failed",
          r2Key: null,
          error: safeReason,
        })
        .where(eq(exportsTable.id, payload.exportId));
      await releaseWorkerExportReservation(deps.db, reservationJobId).catch(() => undefined);
      return {
        status: "failed",
        error: safeReason,
      };
    }

    const r2Key = buildExportStorageKey(payload.projectId, payload.exportId, payload.format);
    await storeFn({
      r2Key,
      bytes: rendered.bytes,
      contentType: rendered.contentType,
    });

    const now = new Date();
    const expiresAt =
      postAcl.exportRow?.expiresAt ?? new Date(now.getTime() + EXPORT_RETENTION_MS);

    await deps.db
      .update(exportsTable)
      .set({
        status: "completed",
        r2Key,
        bytes: rendered.bytes.byteLength,
        expiresAt,
        error: null,
      })
      .where(eq(exportsTable.id, payload.exportId));

    await commitWorkerExportReservation(deps.db, reservationJobId, now);

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
      await recordStandaloneWorkerNotification(deps.db, finishedEvent, postAcl.requesterId);
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
        r2Key: null,
        error: safeError,
      })
      .where(eq(exportsTable.id, payload.exportId));

    await releaseWorkerExportReservation(deps.db, reservationJobId).catch(() => undefined);

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
      await recordStandaloneWorkerNotification(deps.db, failedEvent, preAcl.requesterId);
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
