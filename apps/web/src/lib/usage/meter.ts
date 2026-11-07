import { and, eq, sql, type UsageMeterKey } from "@casefolio/db";
import {
  evaluateQuotaUsage,
  getUtcCalendarMonth,
  PAID_GRACE_COOLDOWN_DAYS,
  PAID_GRACE_DURATION_DAYS,
  type QuotaEvaluationResult,
} from "@/lib/billing/plans";
import { db, dbSchema } from "@/lib/db";

export interface ReserveMeterArgs {
  workspaceId: string;
  meter: UsageMeterKey;
  amount: number;
  limit: number;
  jobId: string;
  isPaid: boolean;
  graceUsedAt?: Date | null;
  graceExpiresAt?: Date | null;
  cacheKey?: string | null;
  now?: Date;
}

export type ReserveMeterResult =
  | {
      ok: true;
      deduplicated: boolean;
      calendarMonth: string;
      usedAfterReserve: number;
      evaluation: QuotaEvaluationResult;
    }
  | {
      ok: false;
      calendarMonth: string;
      used: number;
      evaluation: QuotaEvaluationResult;
    };

export async function getWorkspaceMonthlyMeterUsage(
  workspaceId: string,
  meter: UsageMeterKey,
  now: Date = new Date(),
): Promise<{ used: number; reserved: number; total: number; calendarMonth: string }> {
  const calendarMonth = getUtcCalendarMonth(now);
  const [bucket] = await db
    .select()
    .from(dbSchema.usageBuckets)
    .where(
      and(
        eq(dbSchema.usageBuckets.workspaceId, workspaceId),
        eq(dbSchema.usageBuckets.calendarMonth, calendarMonth),
        eq(dbSchema.usageBuckets.meter, meter),
      ),
    )
    .limit(1);

  const used = Number(bucket?.usedValue ?? 0);
  const reserved = Number(bucket?.reservedValue ?? 0);
  return {
    used,
    reserved,
    total: used + reserved,
    calendarMonth,
  };
}

/**
 * Atomically reserves `amount` against `(workspaceId, calendarMonth, meter)` with row locking
 * and `jobId` idempotency so retries never double-consume quota (`Spec §5.4`).
 */
export async function reserveWorkspaceMeter(
  args: ReserveMeterArgs,
): Promise<ReserveMeterResult> {
  const now = args.now ?? new Date();
  const calendarMonth = getUtcCalendarMonth(now);
  const amount = Math.max(0, Math.floor(args.amount));

  return db.transaction(async (tx) => {
    // Ensure bucket row exists before acquiring `FOR UPDATE` lock
    await tx
      .insert(dbSchema.usageBuckets)
      .values({
        workspaceId: args.workspaceId,
        calendarMonth,
        meter: args.meter,
        usedValue: 0,
        reservedValue: 0,
        updatedAt: now,
      })
      .onConflictDoNothing({
        target: [
          dbSchema.usageBuckets.workspaceId,
          dbSchema.usageBuckets.calendarMonth,
          dbSchema.usageBuckets.meter,
        ],
      });

    const lockedRows = await tx.execute<{
      id: string;
      used_value: string | number;
      reserved_value: string | number;
    }>(sql`
      SELECT id, used_value, reserved_value
      FROM usage_buckets
      WHERE workspace_id = ${args.workspaceId}
        AND calendar_month = ${calendarMonth}
        AND meter = ${args.meter}
      FOR UPDATE
    `);

    const bucketRow = lockedRows.rows[0];
    const used = Number(bucketRow?.used_value ?? 0);
    const reserved = Number(bucketRow?.reserved_value ?? 0);
    const currentOccupied = used + reserved;

    // Idempotency check: if `jobId` already reserved or committed, return without charging twice
    const [existingReservation] = await tx
      .select()
      .from(dbSchema.usageReservations)
      .where(eq(dbSchema.usageReservations.jobId, args.jobId))
      .limit(1);

    if (existingReservation && existingReservation.status !== "released") {
      const evaluation = evaluateQuotaUsage({
        used: currentOccupied,
        adding: 0,
        limit: args.limit,
        isPaid: args.isPaid,
        graceUsedAt: args.graceUsedAt,
        graceExpiresAt: args.graceExpiresAt,
        now,
      });
      return {
        ok: true,
        deduplicated: true,
        calendarMonth,
        usedAfterReserve: currentOccupied,
        evaluation,
      };
    }

    const evaluation = evaluateQuotaUsage({
      used: currentOccupied,
      adding: amount,
      limit: args.limit,
      isPaid: args.isPaid,
      graceUsedAt: args.graceUsedAt,
      graceExpiresAt: args.graceExpiresAt,
      now,
    });

    if (!evaluation.allowed) {
      return {
        ok: false,
        calendarMonth,
        used: currentOccupied,
        evaluation,
      };
    }

    if (existingReservation) {
      await tx
        .update(dbSchema.usageReservations)
        .set({
          status: "reserved",
          amount,
          cacheKey: args.cacheKey ?? null,
          updatedAt: now,
        })
        .where(eq(dbSchema.usageReservations.jobId, args.jobId));
    } else {
      await tx.insert(dbSchema.usageReservations).values({
        jobId: args.jobId,
        workspaceId: args.workspaceId,
        calendarMonth,
        meter: args.meter,
        amount,
        status: "reserved",
        cacheKey: args.cacheKey ?? null,
        createdAt: now,
        updatedAt: now,
      });
    }

    await tx
      .update(dbSchema.usageBuckets)
      .set({
        reservedValue: reserved + amount,
        updatedAt: now,
      })
      .where(
        and(
          eq(dbSchema.usageBuckets.workspaceId, args.workspaceId),
          eq(dbSchema.usageBuckets.calendarMonth, calendarMonth),
          eq(dbSchema.usageBuckets.meter, args.meter),
        ),
      );

    return {
      ok: true,
      deduplicated: false,
      calendarMonth,
      usedAfterReserve: currentOccupied + amount,
      evaluation,
    };
  });
}

export async function commitWorkspaceReservation(
  jobId: string,
  now: Date = new Date(),
): Promise<{ committed: boolean }> {
  return db.transaction(async (tx) => {
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
    if (!row) {
      return { committed: false };
    }
    if (row.status === "committed") {
      return { committed: true };
    }
    if (row.status === "released") {
      return { committed: false };
    }

    const amount = Number(row.amount);

    await tx
      .update(dbSchema.usageReservations)
      .set({ status: "committed", updatedAt: now })
      .where(eq(dbSchema.usageReservations.jobId, jobId));

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

    return { committed: true };
  });
}

export async function releaseWorkspaceReservation(
  jobId: string,
  now: Date = new Date(),
): Promise<{ released: boolean }> {
  return db.transaction(async (tx) => {
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
    if (!row) {
      return { released: false };
    }
    if (row.status === "released") {
      return { released: true };
    }
    if (row.status === "committed") {
      return { released: false };
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

    return { released: true };
  });
}

/**
 * Records direct bandwidth delivery against `bandwidth_bytes` and reports whether public media
 * delivery is still within the workspace's monthly bandwidth ceiling (`Spec §5.7`).
 */
export async function recordAndCheckWorkspaceBandwidth(args: {
  workspaceId: string;
  bytes: number;
  limit: number;
  isPaid: boolean;
  graceUsedAt?: Date | null;
  graceExpiresAt?: Date | null;
  now?: Date;
}): Promise<{ allowed: boolean; usedAfter: number }> {
  const now = args.now ?? new Date();
  const calendarMonth = getUtcCalendarMonth(now);
  const bytes = Math.max(0, Math.floor(args.bytes));

  const current = await getWorkspaceMonthlyMeterUsage(
    args.workspaceId,
    "bandwidth_bytes",
    now,
  );
  const evalCheck = evaluateQuotaUsage({
    used: current.total,
    adding: bytes,
    limit: args.limit,
    isPaid: args.isPaid,
    graceUsedAt: args.graceUsedAt,
    graceExpiresAt: args.graceExpiresAt,
    now,
  });

  if (!evalCheck.allowed) {
    return { allowed: false, usedAfter: current.total };
  }

  await db
    .insert(dbSchema.usageBuckets)
    .values({
      workspaceId: args.workspaceId,
      calendarMonth,
      meter: "bandwidth_bytes",
      usedValue: bytes,
      reservedValue: 0,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        dbSchema.usageBuckets.workspaceId,
        dbSchema.usageBuckets.calendarMonth,
        dbSchema.usageBuckets.meter,
      ],
      set: {
        usedValue: sql`${dbSchema.usageBuckets.usedValue} + ${bytes}`,
        updatedAt: now,
      },
    });

  return { allowed: true, usedAfter: current.total + bytes };
}

/**
 * Activates the once-per-12-months paid workspace grace window (`7 days` or `120%` usage, Spec §5.7).
 */
export async function activatePaidWorkspaceGrace(args: {
  workspaceId: string;
  actorUserId: string;
  isPaid: boolean;
  now?: Date;
}): Promise<{ ok: true; graceExpiresAtIso: string } | { ok: false; error: string }> {
  if (!args.isPaid) {
    return {
      ok: false,
      error: "Quota grace is available on paid Pro and Teams workspaces only.",
    };
  }

  const now = args.now ?? new Date();
  const [ws] = await db
    .select()
    .from(dbSchema.workspaces)
    .where(eq(dbSchema.workspaces.id, args.workspaceId))
    .limit(1);

  if (!ws) {
    return { ok: false, error: "Workspace not found." };
  }

  if (ws.graceUsedAt) {
    const cooldownMs = PAID_GRACE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
    if (now.getTime() - ws.graceUsedAt.getTime() < cooldownMs) {
      return {
        ok: false,
        error: "Paid workspace quota grace has already been used within the last 12 months.",
      };
    }
  }

  const graceExpiresAt = new Date(
    now.getTime() + PAID_GRACE_DURATION_DAYS * 24 * 60 * 60 * 1000,
  );

  await db
    .update(dbSchema.workspaces)
    .set({
      graceUsedAt: now,
      graceExpiresAt,
      updatedAt: now,
    })
    .where(eq(dbSchema.workspaces.id, args.workspaceId));

  await db.insert(dbSchema.auditLogs).values({
    actorId: args.actorUserId,
    action: "workspace.grace_activated",
    meta: {
      workspaceId: args.workspaceId,
      graceExpiresAtIso: graceExpiresAt.toISOString(),
    },
    at: now,
  });

  return {
    ok: true,
    graceExpiresAtIso: graceExpiresAt.toISOString(),
  };
}

