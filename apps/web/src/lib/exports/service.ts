import {
  and,
  count,
  desc,
  eq,
  gte,
  type PlanTier,
  type UserRole,
} from "@casefolio/db";
import {
  enqueueExportJobToPgBoss,
  startPgBossExportConsumer,
  type ExportQueueJobPayload,
  type ExportWorkerConsumerHandle,
} from "@casefolio/worker";
import { PgBoss } from "pg-boss";
import { env } from "@/env";
import { db, dbSchema } from "@/lib/db";
import { can, evaluateEntitlement, type EntitlementFeature } from "@/lib/entitlements";
import { resolveEffectivePlanForUser } from "@/lib/entitlements/server";
import {
  createExportInputSchema,
  FREE_MONTHLY_EXPORT_LIMIT,
  type EnqueueExportResult,
  type ExportFormatOption,
  type ExportHistoryItem,
  type ProjectExportsOverviewPayload,
} from "@/lib/exports/types";
import { resolvePublicAppBaseUrl } from "@/lib/projects/publish";
import { slugifyProjectName } from "@/lib/projects/types";
import { readStoredObjectBytes } from "@/lib/storage/r2";
import { consumeUploadRateLimit } from "@/lib/storage/rate-limit";

export interface ExportActor {
  id: string;
  role: UserRole;
  plan?: PlanTier;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const globalForExportQueue = globalThis as unknown as {
  casefolioBossPublisherPromise?: Promise<PgBoss> | null;
  casefolioEmbeddedExportConsumerPromise?: Promise<ExportWorkerConsumerHandle> | null;
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

  // In production when an external worker URL is configured in another cluster, pg-boss polls DB directly.
  // In local dev / CI single-server environments, spin up an embedded pg-boss consumer automatically.
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

  if (!globalForExportQueue.casefolioEmbeddedExportConsumerPromise) {
    globalForExportQueue.casefolioEmbeddedExportConsumerPromise = startPgBossExportConsumer({
      databaseUrl: env.DATABASE_URL,
      appUrl,
      db,
      signingSecret: env.EXPORT_SIGNING_SECRET,
      pollingIntervalSeconds: 0.5,
    }).catch((err) => {
      globalForExportQueue.casefolioEmbeddedExportConsumerPromise = null;
      throw err;
    });
  }

  const consumer = await globalForExportQueue.casefolioEmbeddedExportConsumerPromise;
  consumer.boss.notifyWorker(consumer.workerId);
}

export async function shutdownExportQueueForTests(): Promise<void> {
  if (globalForExportQueue.casefolioEmbeddedExportConsumerPromise) {
    const handle = await globalForExportQueue.casefolioEmbeddedExportConsumerPromise.catch(
      () => null,
    );
    globalForExportQueue.casefolioEmbeddedExportConsumerPromise = null;
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
): ExportHistoryItem {
  return {
    id: row.id,
    projectId: row.projectId,
    format: row.format,
    status: row.status,
    r2Key: row.r2Key ?? null,
    error: row.error ?? null,
    createdAtIso: row.createdAt.toISOString(),
    downloadUrl:
      row.status === "completed" && row.r2Key ? `/api/exports/${row.id}/download` : null,
  };
}

async function canActorAccessProjectExports(
  project: { ownerId: string; orgId: string | null },
  actor: ExportActor,
  requireEdit = false,
): Promise<boolean> {
  if (
    project.ownerId === actor.id ||
    actor.role === "admin" ||
    actor.role === "superadmin"
  ) {
    return true;
  }

  if (project.orgId) {
    const [membership] = await db
      .select({ role: dbSchema.memberships.role })
      .from(dbSchema.memberships)
      .where(
        and(
          eq(dbSchema.memberships.orgId, project.orgId),
          eq(dbSchema.memberships.userId, actor.id),
        ),
      )
      .limit(1);

    if (!membership) return false;
    if (!requireEdit) return true;
    return membership.role === "owner" || membership.role === "editor";
  }

  return false;
}

function exportFormatToEntitlementFeature(format: ExportFormatOption): EntitlementFeature {
  if (format === "pdf") return "export_pdf";
  if (format === "behance") return "export_behance";
  return "export_png";
}

export function isExportFormatAllowedOnPlan(
  plan: PlanTier,
  format: ExportFormatOption,
): boolean {
  return can(plan, exportFormatToEntitlementFeature(format));
}

export function doesPlanIncludeExportWatermark(plan: PlanTier): boolean {
  return !can(plan, "remove_watermark");
}

async function countOwnerMonthlyExports(ownerId: string, now = new Date()): Promise<number> {
  const startOfUtcMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));

  const [row] = await db
    .select({ total: count() })
    .from(dbSchema.exportsTable)
    .innerJoin(dbSchema.projects, eq(dbSchema.exportsTable.projectId, dbSchema.projects.id))
    .where(
      and(
        eq(dbSchema.projects.ownerId, ownerId),
        gte(dbSchema.exportsTable.createdAt, startOfUtcMonth),
      ),
    );

  return Number(row?.total ?? 0);
}

export async function enqueueProjectExportForUser(
  rawInput: unknown,
  actor: ExportActor,
  options?: {
    appUrl?: string;
    enqueueJobFn?: (payload: ExportQueueJobPayload) => Promise<void>;
  },
): Promise<EnqueueExportResult> {
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

  const [projectRow] = await db
    .select({
      project: dbSchema.projects,
      ownerPlan: dbSchema.users.plan,
    })
    .from(dbSchema.projects)
    .innerJoin(dbSchema.users, eq(dbSchema.projects.ownerId, dbSchema.users.id))
    .where(eq(dbSchema.projects.id, valid.projectId))
    .limit(1);

  if (!projectRow) {
    return {
      ok: false,
      code: "NOT_FOUND",
      error: "Project not found.",
    };
  }

  const canExport = await canActorAccessProjectExports(projectRow.project, actor, true);
  if (!canExport) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "You do not have permission to export this project.",
    };
  }

  const ownerPlan = await resolveEffectivePlanForUser(projectRow.project.ownerId);
  if (!isExportFormatAllowedOnPlan(ownerPlan, valid.format)) {
    const formatLabel = valid.format === "pdf" ? "PDF Case Study" : "Behance 1400px Slices";
    return {
      ok: false,
      code: "PLAN_UPGRADE_REQUIRED",
      error: `${formatLabel} export requires a Pro or Team plan. Free plan supports PNG Long exports.`,
    };
  }

  const usedThisMonth = await countOwnerMonthlyExports(projectRow.project.ownerId);
  const quotaEntitlement = evaluateEntitlement(
    ownerPlan,
    exportFormatToEntitlementFeature(valid.format),
    { monthlyExportsCount: usedThisMonth },
  );
  if (!quotaEntitlement.allowed) {
    return {
      ok: false,
      code: "EXPORT_LIMIT_REACHED",
      error: quotaEntitlement.message,
    };
  }

  const [created] = await db
    .insert(dbSchema.exportsTable)
    .values({
      projectId: projectRow.project.id,
      format: valid.format,
      status: "queued",
    })
    .returning();

  if (!created) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: "Failed to create export job.",
    };
  }

  const appUrl = options?.appUrl ?? resolvePublicAppBaseUrl();
  const jobPayload: ExportQueueJobPayload = {
    exportId: created.id,
    projectId: projectRow.project.id,
    format: valid.format,
    appUrl,
  };

  if (options?.enqueueJobFn) {
    await options.enqueueJobFn(jobPayload);
  } else {
    const boss = await getPgBossPublisher();
    await enqueueExportJobToPgBoss(boss, jobPayload);
    await ensureExportQueueConsumerActive(appUrl).catch((err) => {
      console.error("[exports] embedded worker wakeup warning:", err);
    });
  }

  return {
    ok: true,
    exportJob: serializeExportRow(created),
    hasWatermark: doesPlanIncludeExportWatermark(ownerPlan),
    monthlyExportsUsed: usedThisMonth + 1,
    monthlyExportsLimit: ownerPlan === "free" ? FREE_MONTHLY_EXPORT_LIMIT : null,
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

  const [row] = await db
    .select({
      project: dbSchema.projects,
      templateName: dbSchema.templates.name,
      ownerPlan: dbSchema.users.plan,
    })
    .from(dbSchema.projects)
    .innerJoin(
      dbSchema.templateVersions,
      eq(dbSchema.projects.templateVersionId, dbSchema.templateVersions.id),
    )
    .innerJoin(dbSchema.templates, eq(dbSchema.templateVersions.templateId, dbSchema.templates.id))
    .innerJoin(dbSchema.users, eq(dbSchema.projects.ownerId, dbSchema.users.id))
    .where(eq(dbSchema.projects.id, projectId))
    .limit(1);

  if (!row) {
    return { status: "not_found" };
  }

  const allowed = await canActorAccessProjectExports(row.project, actor, false);
  if (!allowed) {
    return { status: "forbidden" };
  }

  const [historyRows, usedThisMonth, resolvedOwnerPlan] = await Promise.all([
    db
      .select()
      .from(dbSchema.exportsTable)
      .where(eq(dbSchema.exportsTable.projectId, row.project.id))
      .orderBy(desc(dbSchema.exportsTable.createdAt))
      .limit(50),
    countOwnerMonthlyExports(row.project.ownerId),
    resolveEffectivePlanForUser(row.project.ownerId),
  ]);

  const isPublished =
    (row.project.visibility === "public" || row.project.visibility === "unlisted") &&
    row.project.publishedAt !== null &&
    Boolean(row.project.slug);

  return {
    status: "ok",
    overview: {
      projectId: row.project.id,
      projectName: row.project.name,
      templateName: row.templateName,
      slug: row.project.slug,
      isPublished,
      ownerPlan: resolvedOwnerPlan,
      hasWatermark: doesPlanIncludeExportWatermark(resolvedOwnerPlan),
      monthlyExportsUsed: usedThisMonth,
      monthlyExportsLimit: resolvedOwnerPlan === "free" ? FREE_MONTHLY_EXPORT_LIMIT : null,
      exports: historyRows.map(serializeExportRow),
    },
  };
}

export async function getExportJobForUser(
  exportId: string,
  actor: ExportActor,
): Promise<
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "ok"; exportJob: ExportHistoryItem }
> {
  if (!UUID_REGEX.test(exportId)) {
    return { status: "not_found" };
  }

  const [row] = await db
    .select({
      exportJob: dbSchema.exportsTable,
      project: {
        ownerId: dbSchema.projects.ownerId,
        orgId: dbSchema.projects.orgId,
      },
    })
    .from(dbSchema.exportsTable)
    .innerJoin(dbSchema.projects, eq(dbSchema.exportsTable.projectId, dbSchema.projects.id))
    .where(eq(dbSchema.exportsTable.id, exportId))
    .limit(1);

  if (!row) {
    return { status: "not_found" };
  }

  const allowed = await canActorAccessProjectExports(row.project, actor, false);
  if (!allowed) {
    return { status: "forbidden" };
  }

  return {
    status: "ok",
    exportJob: serializeExportRow(row.exportJob),
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

  const [row] = await db
    .select({
      exportJob: dbSchema.exportsTable,
      project: {
        name: dbSchema.projects.name,
        ownerId: dbSchema.projects.ownerId,
        orgId: dbSchema.projects.orgId,
      },
    })
    .from(dbSchema.exportsTable)
    .innerJoin(dbSchema.projects, eq(dbSchema.exportsTable.projectId, dbSchema.projects.id))
    .where(eq(dbSchema.exportsTable.id, exportId))
    .limit(1);

  if (!row) {
    return { status: "not_found" };
  }

  const allowed = await canActorAccessProjectExports(row.project, actor, false);
  if (!allowed) {
    return { status: "forbidden" };
  }

  if (row.exportJob.status !== "completed" || !row.exportJob.r2Key) {
    return {
      status: "not_ready",
      jobStatus: row.exportJob.status,
    };
  }

  const bytes = await readStoredObjectBytes(row.exportJob.r2Key);
  if (!bytes) {
    return { status: "not_found" };
  }

  const safeProjectSlug = slugifyProjectName(row.project.name);
  const format = row.exportJob.format;
  const contentType =
    format === "pdf"
      ? "application/pdf"
      : format === "behance"
        ? "application/zip"
        : "image/png";
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

