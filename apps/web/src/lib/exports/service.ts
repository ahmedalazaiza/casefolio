import { randomUUID } from "node:crypto";
import { and, desc, eq, gt, isNotNull, type PlanTier, type UserRole } from "@casefolio/db";
import {
  enqueueExportJobToPgBoss,
  startPgBossExportConsumer,
  type ExportQueueJobPayload,
  type ExportWorkerConsumerHandle,
} from "@casefolio/worker";
import { signExportRenderToken } from "@casefolio/worker/token";
import { PgBoss } from "pg-boss";
import { env } from "@/env";
import { trackServerProductEvent } from "@/lib/analytics/posthog";
import { formatResetDateIstanbul } from "@/lib/billing/plans";
import { db, dbSchema } from "@/lib/db";
import { can, type EntitlementFeature } from "@/lib/entitlements";
import {
  createExportInputSchema,
  type EnqueueExportResult,
  type ExportFormatOption,
  type ExportHistoryItem,
  type ProjectExportsOverviewPayload,
} from "@/lib/exports/types";
import { notifyExportFinished } from "@/lib/notifications/service";
import { resolvePublicAppBaseUrl } from "@/lib/projects/publish";
import { slugifyProjectName } from "@/lib/projects/types";
import { sanitizeErrorForLogging } from "@/lib/security/redact";
import { readStoredObjectBytes, writeStoredObject } from "@/lib/storage/r2";
import { consumeUploadRateLimit } from "@/lib/storage/rate-limit";
import {
  commitWorkspaceReservation,
  getWorkspaceMonthlyMeterUsage,
  releaseWorkspaceReservation,
  reserveWorkspaceMeter,
} from "@/lib/usage/meter";
import { authorizeProjectAccess } from "@/lib/workspaces/acl";

export interface ExportActor {
  id: string;
  role: UserRole;
  plan?: PlanTier;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EXPORT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

const globalForExportQueue = globalThis as unknown as {
  casefolioBossPublisherPromise?: Promise<PgBoss> | null;
  casefolioEmbeddedExportConsumerV2Promise?: Promise<ExportWorkerConsumerHandle> | null;
};

async function getPgBossPublisher(): Promise<PgBoss> {
  if (!globalForExportQueue.casefolioBossPublisherPromise) {
    globalForExportQueue.casefolioBossPublisherPromise = (async () => {
      const boss = new PgBoss({
        connectionString: env.DATABASE_URL,
        max: 2,
      });
      await boss.start();
      return boss;
    })().catch((err) => {
      globalForExportQueue.casefolioBossPublisherPromise = null;
      throw err;
    });
  }
  return globalForExportQueue.casefolioBossPublisherPromise;
}

async function tryWakeExternalWorker(workerBaseUrl: string): Promise<boolean> {
  const cleanUrl = workerBaseUrl.replace(/\/+$/, "");
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 350);
    const res = await fetch(`${cleanUrl}/wake`, {
      method: "POST",
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureExportQueueConsumerActive(appUrl: string): Promise<void> {
  const externalWoken = await tryWakeExternalWorker(env.EXPORT_WORKER_URL);
  if (externalWoken) {
    return;
  }

  if (
    process.env.NODE_ENV === "production" &&
    process.env.CASEFOLIO_ENABLE_EMBEDDED_WORKER !== "1" &&
    !env.EXPORT_WORKER_URL.includes("localhost") &&
    !env.EXPORT_WORKER_URL.includes("127.0.0.1")
  ) {
    return;
  }

  if (process.env.CASEFOLIO_DISABLE_EMBEDDED_WORKER === "1") {
    return;
  }

  if (!globalForExportQueue.casefolioEmbeddedExportConsumerV2Promise) {
    globalForExportQueue.casefolioEmbeddedExportConsumerV2Promise = startPgBossExportConsumer({
      databaseUrl: env.DATABASE_URL,
      appUrl,
      db,
      signingSecret: env.EXPORT_SIGNING_SECRET,
      onExportFinished: notifyExportFinished,
      pollingIntervalSeconds: 0.5,
    }).catch((err) => {
      globalForExportQueue.casefolioEmbeddedExportConsumerV2Promise = null;
      throw err;
    });
  }

  const consumer = await globalForExportQueue.casefolioEmbeddedExportConsumerV2Promise;
  consumer.boss.notifyWorker(consumer.workerId);
}

export async function shutdownExportQueueForTests(): Promise<void> {
  if (globalForExportQueue.casefolioEmbeddedExportConsumerV2Promise) {
    const handle = await globalForExportQueue.casefolioEmbeddedExportConsumerV2Promise.catch(
      () => null,
    );
    globalForExportQueue.casefolioEmbeddedExportConsumerV2Promise = null;
    if (handle) {
      await handle.stop();
    }
  }

  if (globalForExportQueue.casefolioBossPublisherPromise) {
    const boss = await globalForExportQueue.casefolioBossPublisherPromise.catch(() => null);
    globalForExportQueue.casefolioBossPublisherPromise = null;
    if (boss) {
      await boss.stop({ graceful: true, timeout: 3_000 });
    }
  }
}

function serializeExportRow(
  row: typeof dbSchema.exportsTable.$inferSelect,
  now: Date = new Date(),
): ExportHistoryItem {
  let renderUrl: string | null = null;
  if (row.status === "queued") {
    const token = signExportRenderToken(
      {
        exportId: row.id,
        projectId: row.projectId,
        ttlMs: 10 * 60 * 1000,
      },
      env.EXPORT_SIGNING_SECRET,
    );
    renderUrl = `/export/${encodeURIComponent(row.id)}?token=${encodeURIComponent(token)}`;
  }

  const isExpired = Boolean(row.expiresAt && row.expiresAt.getTime() <= now.getTime());

  return {
    id: row.id,
    projectId: row.projectId,
    format: row.format,
    status: row.status,
    scale: row.scale,
    projectRevision: row.projectRevision,
    hasWatermark: row.hasWatermark,
    r2Key: row.r2Key ?? null,
    error: row.error ?? null,
    createdAtIso: row.createdAt.toISOString(),
    expiresAtIso: row.expiresAt ? row.expiresAt.toISOString() : null,
    downloadUrl:
      row.status === "completed" && row.r2Key && !isExpired
        ? `/api/exports/${row.id}/download`
        : null,
    renderUrl,
  };
}

function exportFormatToEntitlementFeature(format: ExportFormatOption): EntitlementFeature {
  if (format === "pdf") return "export_pdf";
  if (format === "behance") return "export_behance";
  return "export_png";
}

export function isExportFormatAllowedOnPlan(plan: PlanTier, format: ExportFormatOption): boolean {
  return can(plan, exportFormatToEntitlementFeature(format));
}

export function doesPlanIncludeExportWatermark(plan: PlanTier): boolean {
  return !can(plan, "remove_watermark");
}

export function buildExportCacheKey(args: {
  workspaceId: string;
  projectId: string;
  projectRevision: number;
  format: ExportFormatOption;
  scale: 1 | 2;
  templateVersionId: string;
  hasWatermark: boolean;
  aclVersion: number;
}): string {
  return [
    args.workspaceId,
    args.projectId,
    `r${args.projectRevision}`,
    args.format,
    `s${args.scale}`,
    `tv:${args.templateVersionId}`,
    `wm:${args.hasWatermark ? 1 : 0}`,
    `acl:${args.aclVersion}`,
  ].join("|");
}

export async function enqueueProjectExportForUser(
  rawInput: unknown,
  actor: ExportActor,
  options?: {
    appUrl?: string;
    enqueueJobFn?: (payload: ExportQueueJobPayload) => Promise<void>;
    now?: Date;
  },
): Promise<EnqueueExportResult> {
  const now = options?.now ?? new Date();
  const rate = consumeUploadRateLimit(`export:${actor.id}`, 15, 60_000);
  if (!rate.allowed) {
    return {
      ok: false,
      code: "RATE_LIMITED",
      error: `Too many export requests. Please retry in ${rate.retryAfterSeconds}s.`,
    };
  }

  const parsed = createExportInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: parsed.error.issues[0]?.message ?? "Invalid export parameters.",
    };
  }

  const valid = parsed.data;
  if (!UUID_REGEX.test(valid.projectId)) {
    return {
      ok: false,
      code: "NOT_FOUND",
      error: "Project not found.",
    };
  }

  // Workspace + Space ACL enforcement (`404` on cross-tenant OR private-from-Owner/Admin)
  const auth = await authorizeProjectAccess(valid.projectId, actor.id, "export_aesthetic", now);
  if (!auth.ok) {
    if (auth.status === 404) {
      return {
        ok: false,
        code: "NOT_FOUND",
        error: "Project not found.",
      };
    }
    if (auth.code === "WORKSPACE_FROZEN") {
      return {
        ok: false,
        code: "PAST_DUE_READ_ONLY",
        error: auth.error,
      };
    }
    return {
      ok: false,
      code: "FORBIDDEN",
      error: auth.error,
    };
  }

  const workspacePlan = auth.entitlement.plan;
  const quotas = auth.entitlement.quotas;

  if (!isExportFormatAllowedOnPlan(workspacePlan, valid.format)) {
    const formatLabel = valid.format === "pdf" ? "PDF Case Study" : "Behance Image Pack";
    return {
      ok: false,
      code: "PLAN_UPGRADE_REQUIRED",
      error: `${formatLabel} export requires a Pro or Teams plan. Free plan supports branded 1× PNG exports up to 1,440px.`,
    };
  }

  if (valid.format === "png_long" && valid.scale === 2 && !can(workspacePlan, "export_png_2x")) {
    return {
      ok: false,
      code: "PLAN_UPGRADE_REQUIRED",
      error: "2× PNG exports (2,880px) require a Pro or Teams plan. Free plan supports 1× PNG up to 1,440px.",
    };
  }

  const resolvedScale: 1 | 2 =
    valid.format === "png_long"
      ? workspacePlan === "free"
        ? 1
        : (valid.scale ?? 2)
      : 1;

  const hasWatermark = doesPlanIncludeExportWatermark(workspacePlan);
  const cacheKey = buildExportCacheKey({
    workspaceId: auth.workspace.id,
    projectId: auth.project.id,
    projectRevision: auth.project.revision,
    format: valid.format,
    scale: resolvedScale,
    templateVersionId: auth.project.templateVersionId,
    hasWatermark,
    aclVersion: auth.space.aclVersion,
  });

  // Reuse an unexpired completed artifact with the identical cache key without consuming quota (`Spec §5.4`)
  const [cachedRow] = await db
    .select()
    .from(dbSchema.exportsTable)
    .where(
      and(
        eq(dbSchema.exportsTable.workspaceId, auth.workspace.id),
        eq(dbSchema.exportsTable.projectId, auth.project.id),
        eq(dbSchema.exportsTable.cacheKey, cacheKey),
        eq(dbSchema.exportsTable.status, "completed"),
        isNotNull(dbSchema.exportsTable.r2Key),
        gt(dbSchema.exportsTable.expiresAt, now),
      ),
    )
    .orderBy(desc(dbSchema.exportsTable.createdAt))
    .limit(1);

  if (cachedRow?.r2Key) {
    const existingBytes = await readStoredObjectBytes(cachedRow.r2Key);
    if (existingBytes) {
      const meter = await getWorkspaceMonthlyMeterUsage(auth.workspace.id, "exports", now);
      return {
        ok: true,
        exportJob: serializeExportRow(cachedRow, now),
        reusedCachedArtifact: true,
        hasWatermark,
        monthlyExportsUsed: meter.total,
        monthlyExportsLimit: quotas.monthlyExportsLimit,
      };
    }
  }

  const exportId = randomUUID();
  const reservationJobId = `export:${exportId}`;
  const reservation = await reserveWorkspaceMeter({
    workspaceId: auth.workspace.id,
    meter: "exports",
    amount: 1,
    limit: quotas.monthlyExportsLimit,
    jobId: reservationJobId,
    isPaid: auth.entitlement.plan !== "free",
    graceUsedAt: auth.workspace.graceUsedAt,
    graceExpiresAt: auth.workspace.graceExpiresAt,
    cacheKey,
    now,
  });

  if (!reservation.ok) {
    return {
      ok: false,
      code: "EXPORT_LIMIT_REACHED",
      error: `Monthly export limit reached (${reservation.used}/${quotas.monthlyExportsLimit}). Resets ${formatResetDateIstanbul(now)} (Europe/Istanbul).`,
    };
  }

  const expiresAt = new Date(now.getTime() + EXPORT_RETENTION_MS);

  const [created] = await db
    .insert(dbSchema.exportsTable)
    .values({
      id: exportId,
      projectId: auth.project.id,
      workspaceId: auth.workspace.id,
      requestedByUserId: actor.id,
      format: valid.format,
      status: "queued",
      projectRevision: auth.project.revision,
      scale: resolvedScale,
      hasWatermark,
      cacheKey,
      expiresAt,
      createdAt: now,
    })
    .returning();

  if (!created) {
    await releaseWorkspaceReservation(reservationJobId, now).catch(() => undefined);
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: "Failed to create export job.",
    };
  }

  const appUrl = options?.appUrl ?? resolvePublicAppBaseUrl();
  const jobPayload: ExportQueueJobPayload = {
    exportId: created.id,
    projectId: auth.project.id,
    format: valid.format,
    appUrl,
    workspaceId: auth.workspace.id,
    requestedByUserId: actor.id,
    scale: resolvedScale,
    maxMegapixels: quotas.maxExportMegapixels,
    maxPdfPages: quotas.maxPdfPages > 0 ? quotas.maxPdfPages : 60,
    timeoutMs: quotas.exportTimeoutSeconds * 1000,
    reservationJobId,
  };

  try {
    if (options?.enqueueJobFn) {
      await options.enqueueJobFn(jobPayload);
    } else {
      const boss = await getPgBossPublisher();
      await enqueueExportJobToPgBoss(boss, jobPayload);
      await ensureExportQueueConsumerActive(appUrl).catch((err) => {
        const safeErr = sanitizeErrorForLogging(err);
        console.error("[exports] embedded worker wakeup warning:", safeErr.message);
      });
    }
  } catch (err) {
    await db
      .update(dbSchema.exportsTable)
      .set({
        status: "failed",
        error: "Failed to enqueue export job.",
      })
      .where(eq(dbSchema.exportsTable.id, created.id))
      .catch(() => undefined);
    await releaseWorkspaceReservation(reservationJobId, now).catch(() => undefined);
    throw err;
  }

  // Privacy rule (`Spec §10.8`): never send project titles or tokens to PostHog
  await trackServerProductEvent({
    event: "exported",
    distinctId: actor.id,
    properties: {
      exportId: created.id,
      format: valid.format,
      scale: resolvedScale,
      plan: workspacePlan,
    },
  });

  return {
    ok: true,
    exportJob: serializeExportRow(created, now),
    reusedCachedArtifact: false,
    hasWatermark,
    monthlyExportsUsed: reservation.usedAfterReserve,
    monthlyExportsLimit: quotas.monthlyExportsLimit,
  };
}

export async function getProjectExportsOverviewForUser(
  projectId: string,
  actor: ExportActor,
): Promise<
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "ok"; overview: ProjectExportsOverviewPayload }
> {
  if (!UUID_REGEX.test(projectId)) {
    return { status: "not_found" };
  }

  const auth = await authorizeProjectAccess(projectId, actor.id, "read");
  if (!auth.ok) {
    return { status: auth.status === 404 ? "not_found" : "forbidden" };
  }

  const [[tplRow], historyRows, meter] = await Promise.all([
    db
      .select({ templateName: dbSchema.templates.name })
      .from(dbSchema.templateVersions)
      .innerJoin(
        dbSchema.templates,
        eq(dbSchema.templateVersions.templateId, dbSchema.templates.id),
      )
      .where(eq(dbSchema.templateVersions.id, auth.project.templateVersionId))
      .limit(1),
    db
      .select()
      .from(dbSchema.exportsTable)
      .where(eq(dbSchema.exportsTable.projectId, auth.project.id))
      .orderBy(desc(dbSchema.exportsTable.createdAt))
      .limit(50),
    getWorkspaceMonthlyMeterUsage(auth.workspace.id, "exports"),
  ]);

  const isPublished =
    (auth.project.visibility === "public" || auth.project.visibility === "unlisted") &&
    auth.project.publishedAt !== null &&
    Boolean(auth.project.slug);

  const plan = auth.entitlement.plan;

  return {
    status: "ok",
    overview: {
      projectId: auth.project.id,
      projectName: auth.project.name,
      templateName: tplRow?.templateName ?? "Template",
      slug: auth.project.slug,
      isPublished,
      ownerPlan: plan,
      hasWatermark: doesPlanIncludeExportWatermark(plan),
      monthlyExportsUsed: meter.total,
      monthlyExportsLimit: auth.entitlement.quotas.monthlyExportsLimit,
      exports: historyRows.map((r) => serializeExportRow(r)),
    },
  };
}

export async function getExportJobForUser(
  exportId: string,
  actor: ExportActor,
): Promise<
  { status: "not_found" } | { status: "forbidden" } | { status: "ok"; exportJob: ExportHistoryItem }
> {
  if (!UUID_REGEX.test(exportId)) {
    return { status: "not_found" };
  }

  const [exportJob] = await db
    .select()
    .from(dbSchema.exportsTable)
    .where(eq(dbSchema.exportsTable.id, exportId))
    .limit(1);

  if (!exportJob) {
    return { status: "not_found" };
  }

  const auth = await authorizeProjectAccess(exportJob.projectId, actor.id, "read");
  if (!auth.ok) {
    return { status: auth.status === 404 ? "not_found" : "forbidden" };
  }

  if (exportJob.status === "completed" || exportJob.status === "failed") {
    await notifyExportFinished({
      exportId: exportJob.id,
      projectId: exportJob.projectId,
      format: exportJob.format,
      status: exportJob.status,
      error: exportJob.error ?? undefined,
    }).catch(() => undefined);
  }

  return {
    status: "ok",
    exportJob: serializeExportRow(exportJob),
  };
}

export async function authorizeAndReadExportFile(
  exportId: string,
  actor: ExportActor,
): Promise<
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "not_ready"; jobStatus: string }
  | {
      status: "ok";
      bytes: Uint8Array;
      contentType: string;
      fileName: string;
    }
> {
  if (!UUID_REGEX.test(exportId)) {
    return { status: "not_found" };
  }

  const [exportJob] = await db
    .select()
    .from(dbSchema.exportsTable)
    .where(eq(dbSchema.exportsTable.id, exportId))
    .limit(1);

  if (!exportJob) {
    return { status: "not_found" };
  }

  const auth = await authorizeProjectAccess(exportJob.projectId, actor.id, "read");
  if (!auth.ok) {
    return { status: auth.status === 404 ? "not_found" : "forbidden" };
  }

  if (exportJob.expiresAt && exportJob.expiresAt.getTime() <= Date.now()) {
    return { status: "not_found" };
  }

  if (exportJob.status !== "completed" || !exportJob.r2Key) {
    return {
      status: "not_ready",
      jobStatus: exportJob.status,
    };
  }

  const bytes = await readStoredObjectBytes(exportJob.r2Key);
  if (!bytes) {
    return { status: "not_found" };
  }

  const safeProjectSlug = slugifyProjectName(auth.project.name);
  const format = exportJob.format;
  const contentType =
    format === "pdf" ? "application/pdf" : format === "behance" ? "application/zip" : "image/png";
  const ext = format === "pdf" ? "pdf" : format === "behance" ? "zip" : "png";
  const suffix =
    format === "behance" ? "behance-slices" : format === "pdf" ? "case-study" : "png-long";

  return {
    status: "ok",
    bytes,
    contentType,
    fileName: `${safeProjectSlug}-${suffix}.${ext}`,
  };
}

const MAX_CLIENT_EXPORT_BYTES = 35 * 1024 * 1024; // 35 MiB

function hasValidExportBinaryHeader(format: ExportFormatOption, bytes: Uint8Array): boolean {
  if (bytes.byteLength < 8) return false;
  if (format === "png_long") {
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }
  if (format === "pdf") {
    return (
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46 &&
      bytes[4] === 0x2d
    );
  }
  if (format === "behance") {
    return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  }
  return false;
}

export async function completeQueuedExportFromClient(
  exportId: string,
  bytes: Uint8Array,
  actor: ExportActor,
): Promise<
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "invalid_payload"; error: string }
  | { status: "ok"; exportJob: ExportHistoryItem }
> {
  if (!UUID_REGEX.test(exportId)) {
    return { status: "not_found" };
  }

  if (bytes.byteLength === 0 || bytes.byteLength > MAX_CLIENT_EXPORT_BYTES) {
    return {
      status: "invalid_payload",
      error: "Rendered export payload size is invalid.",
    };
  }

  const [exportJob] = await db
    .select()
    .from(dbSchema.exportsTable)
    .where(eq(dbSchema.exportsTable.id, exportId))
    .limit(1);

  if (!exportJob) {
    return { status: "not_found" };
  }

  const auth = await authorizeProjectAccess(exportJob.projectId, actor.id, "export_aesthetic");
  if (!auth.ok) {
    return { status: auth.status === 404 ? "not_found" : "forbidden" };
  }

  if (exportJob.status === "completed" && exportJob.r2Key) {
    return {
      status: "ok",
      exportJob: serializeExportRow(exportJob),
    };
  }

  const format = exportJob.format;
  if (!hasValidExportBinaryHeader(format, bytes)) {
    return {
      status: "invalid_payload",
      error: `Binary payload header does not match expected ${format} format.`,
    };
  }

  const ext = format === "pdf" ? "pdf" : format === "behance" ? "zip" : "png";
  const contentType =
    format === "pdf" ? "application/pdf" : format === "behance" ? "application/zip" : "image/png";
  const r2Key = `exports/${auth.project.id}/${exportJob.id}.${ext}`;
  const now = new Date();
  const expiresAt = exportJob.expiresAt ?? new Date(now.getTime() + EXPORT_RETENTION_MS);

  await writeStoredObject(r2Key, bytes, {
    contentType,
    cacheControl: "private, no-store, max-age=0",
  });

  const [updated] = await db
    .update(dbSchema.exportsTable)
    .set({
      status: "completed",
      r2Key,
      bytes: bytes.byteLength,
      expiresAt,
      error: null,
    })
    .where(eq(dbSchema.exportsTable.id, exportId))
    .returning();

  await commitWorkspaceReservation(`export:${exportId}`, now).catch(() => undefined);

  const finalRow = updated ?? {
    ...exportJob,
    status: "completed" as const,
    r2Key,
    bytes: bytes.byteLength,
    expiresAt,
    error: null,
  };

  await notifyExportFinished({
    exportId: finalRow.id,
    projectId: finalRow.projectId,
    format: finalRow.format,
    status: "completed",
  }).catch(() => undefined);

  return {
    status: "ok",
    exportJob: serializeExportRow(finalRow, now),
  };
}
