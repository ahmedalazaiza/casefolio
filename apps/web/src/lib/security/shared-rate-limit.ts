import { sql } from "@casefolio/db";
import { db } from "@/lib/db";
import { consumeUploadRateLimit, type RateLimitCheckResult } from "@/lib/storage/rate-limit";

/**
 * Database-backed fixed-window limiter shared by every serverless instance.
 *
 * Use it for anonymous or abuse-prone endpoints (support form, reports, exports, invitation resend,
 * admin email, ...). The in-memory `consumeUploadRateLimit` is per-instance and only a best-effort
 * second line of defence. One atomic UPSERT per call; on a database error we degrade to the in-memory
 * limiter instead of failing open or taking the endpoint down.
 */
export async function consumeSharedRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  nowMs = Date.now(),
): Promise<RateLimitCheckResult> {
  const boundedKey = key.slice(0, 200);
  try {
    const result = await db.execute<{ count: number; window_start: string | number }>(sql`
      INSERT INTO app_rate_limits ("key", "count", "window_start")
      VALUES (${boundedKey}, 1, ${nowMs})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN app_rate_limits."window_start" <= ${nowMs - windowMs}
                       THEN 1 ELSE app_rate_limits."count" + 1 END,
        "window_start" = CASE WHEN app_rate_limits."window_start" <= ${nowMs - windowMs}
                              THEN ${nowMs} ELSE app_rate_limits."window_start" END
      RETURNING "count", "window_start"
    `);
    const row = result.rows[0];
    if (!row) return consumeUploadRateLimit(boundedKey, limit, windowMs, nowMs);

    const count = Number(row.count);
    const windowStart = Number(row.window_start);
    if (count > limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((windowStart + windowMs - nowMs) / 1000)),
      };
    }
    return { allowed: true, remaining: Math.max(0, limit - count), retryAfterSeconds: 0 };
  } catch {
    return consumeUploadRateLimit(boundedKey, limit, windowMs, nowMs);
  }
}

/** Housekeeping: drop windows that expired long ago (called from the maintenance cron). */
export async function pruneSharedRateLimits(olderThanMs = 24 * 60 * 60 * 1000): Promise<number> {
  const cutoff = Date.now() - olderThanMs;
  const result = await db.execute(sql`DELETE FROM app_rate_limits WHERE "window_start" < ${cutoff}`);
  return result.rowCount ?? 0;
}
