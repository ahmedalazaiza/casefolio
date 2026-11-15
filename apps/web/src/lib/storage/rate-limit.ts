interface RateLimitBucket {
  timestamps: number[];
  windowMs: number;
}

const MAX_UPLOAD_RATE_BUCKETS = 10_000;
let uploadRateBuckets: Record<string, RateLimitBucket | undefined> = Object.create(
  null,
) as Record<string, RateLimitBucket | undefined>;
let uploadBucketOrder: string[] = [];

function pruneUploadRateBuckets(nowMs: number): void {
  if (uploadBucketOrder.length < MAX_UPLOAD_RATE_BUCKETS) {
    return;
  }
  const nextOrder: string[] = [];
  for (const key of uploadBucketOrder) {
    const entry = uploadRateBuckets[key];
    if (!entry) continue;
    const cutoff = nowMs - entry.windowMs;
    const active = entry.timestamps.filter((ts) => ts > cutoff);
    if (active.length === 0) {
      delete uploadRateBuckets[key];
    } else {
      entry.timestamps = active;
      nextOrder.push(key);
    }
  }
  while (nextOrder.length >= MAX_UPLOAD_RATE_BUCKETS) {
    const oldestKey = nextOrder.shift();
    if (oldestKey === undefined) break;
    delete uploadRateBuckets[oldestKey];
  }
  uploadBucketOrder = nextOrder;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Synchronous sliding-window fallback limiter (`consumeSharedRateLimit` in
 * `@/lib/security/shared-rate-limit` is the primary Postgres-backed shared limiter across
 * serverless instances; this local store acts only as a graceful fallback if the DB is unavailable).
 */
export function consumeUploadRateLimit(
  actorKey: string,
  limit = 30,
  windowMs = 60_000,
  nowMs = Date.now(),
): RateLimitCheckResult {
  pruneUploadRateBuckets(nowMs);
  const cutoff = nowMs - windowMs;
  let bucket = uploadRateBuckets[actorKey];
  if (!bucket) {
    bucket = { timestamps: [], windowMs };
    uploadRateBuckets[actorKey] = bucket;
    uploadBucketOrder.push(actorKey);
  }
  bucket.windowMs = windowMs;
  bucket.timestamps = bucket.timestamps.filter((ts) => ts > cutoff);

  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0] ?? nowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - nowMs) / 1000));
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  bucket.timestamps.push(nowMs);
  return {
    allowed: true,
    remaining: Math.max(0, limit - bucket.timestamps.length),
    retryAfterSeconds: 0,
  };
}

export function resetUploadRateLimitsForTests(): void {
  uploadRateBuckets = Object.create(null) as Record<string, RateLimitBucket | undefined>;
  uploadBucketOrder = [];
}
