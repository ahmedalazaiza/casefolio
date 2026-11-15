import {
  and,
  eq,
  inArray,
  isNotNull,
  lt,
  lte,
  sql,
  type UsageMeterKey,
} from "@casefolio/db";
import { db, dbSchema } from "@/lib/db";
import { deleteStoredObject } from "@/lib/storage/r2";

export const STALE_EXPORT_MAX_AGE_MS = 15 * 60 * 1000;

export interface ExportMaintenanceResult {
  staleExportsFailed: number;
  reservationsReleased: number;
  expiredBlobsPurged: number;
}

async function releaseExportReservationIfHeld(jobId: string, now: Date): Promise<boolean> {
  return db.transaction(async (tx) => {
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
    if (!row || row.status !== "reserved") {
      return false;
    }

    const amount = Number(row.amount);
    await tx
      .update(dbSchema.usageReservations)
      .set({ status: "released", updatedAt: now })
      .where(eq(dbSchema.usageReservations.jobId, jobId));

    await tx.execute(sql`
      UPDATE usage_buckets
      SET
        reserved_value = GREATEST(0, reserved_value - ${amount}),
        updated_at = ${now}
      WHERE workspace_id = ${row.workspace_id}
        AND calendar_month = ${row.calendar_month}
        AND meter = ${row.meter}
    `);

    return true;
  });
}

/**
 * Sweeps stuck `queued`/`processing` export jobs (>15m old) so users never see perpetual spinners
 * or leaked monthly export quota reservations, and purges R2 blobs for exports past `expiresAt`.
 */
export async function runExportMaintenance(options?: {
  now?: Date;
  staleMaxAgeMs?: number;
  batchLimit?: number;
  deleteBlobFn?: (r2Key: string) => Promise<void>;
}): Promise<ExportMaintenanceResult> {
  const now = options?.now ?? new Date();
  const staleCutoff = new Date(now.getTime() - (options?.staleMaxAgeMs ?? STALE_EXPORT_MAX_AGE_MS));
  const batchLimit = Math.max(1, Math.min(200, Math.trunc(options?.batchLimit ?? 100)));
  const deleteBlob = options?.deleteBlobFn ?? ((key: string) => deleteStoredObject(key));

  // 1. Fail stale queued/processing jobs and release their quota reservations
  const staleRows = await db
    .select({ id: dbSchema.exportsTable.id })
    .from(dbSchema.exportsTable)
    .where(
      and(
        inArray(dbSchema.exportsTable.status, ["queued", "processing"]),
        lte(dbSchema.exportsTable.createdAt, staleCutoff),
      ),
    )
    .limit(batchLimit);

  let staleExportsFailed = 0;
  let reservationsReleased = 0;

  for (const stale of staleRows) {
    const [updated] = await db
      .update(dbSchema.exportsTable)
      .set({
        status: "failed",
        r2Key: null,
        error: "Export timed out before completion. Your export quota has been restored — please try again.",
      })
      .where(
        and(
          eq(dbSchema.exportsTable.id, stale.id),
          inArray(dbSchema.exportsTable.status, ["queued", "processing"]),
        ),
      )
      .returning({ id: dbSchema.exportsTable.id });

    if (updated) {
      staleExportsFailed += 1;
      const released = await releaseExportReservationIfHeld(`export:${stale.id}`, now);
      if (released) {
        reservationsReleased += 1;
      }
    }
  }

  // 2. Delete R2 storage artifacts for exports whose retention window (`expiresAt`) has elapsed
  const expiredRows = await db
    .select({
      id: dbSchema.exportsTable.id,
      r2Key: dbSchema.exportsTable.r2Key,
    })
    .from(dbSchema.exportsTable)
    .where(
      and(
        isNotNull(dbSchema.exportsTable.r2Key),
        isNotNull(dbSchema.exportsTable.expiresAt),
        lt(dbSchema.exportsTable.expiresAt, now),
      ),
    )
    .limit(batchLimit);

  let expiredBlobsPurged = 0;
  for (const exp of expiredRows) {
    if (!exp.r2Key) continue;
    try {
      await deleteBlob(exp.r2Key);
      await db
        .update(dbSchema.exportsTable)
        .set({ r2Key: null })
        .where(eq(dbSchema.exportsTable.id, exp.id));
      expiredBlobsPurged += 1;
    } catch {
      // Leave r2Key intact so the next maintenance run retries blob deletion
    }
  }

  return {
    staleExportsFailed,
    reservationsReleased,
    expiredBlobsPurged,
  };
}
