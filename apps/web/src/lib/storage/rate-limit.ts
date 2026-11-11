interface RateLimitBucket {
  timestamps: number[];
  windowMs: number;
}

const MAX_UPLOAD_RATE_BUCKETS = 10_000;
const uploadRateBuckets = new Map<string, RateLimitBucket>();

function pruneUploadRateBuckets(nowMs: number): void {
  if (uploadRateBuckets.size < MAX_UPLOAD_RATE_BUCKETS) {
    return;
  }
  for (const [key, entry] of uploadRateBuckets.entries()) {
    const cutoff = nowMs - entry.windowMs;
    const active = entry.timestamps.filter((ts) => ts > cutoff);
    if (active.length === 0) {
      uploadRateBuckets.delete(key);
    } else {
      entry.timestamps = active;
    }
  }
  while (uploadRateBuckets.size >= MAX_UPLOAD_RATE_BUCKETS) {
    const oldestKey = uploadRateBuckets.keys().next().value;
    if (oldestKey === undefined) break;
    uploadRateBuckets.delete(oldestKey);
  }
}

export interface RateLimitCheckResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Sliding-window rate limiter for upload endpoints (02-RULES.md §5).
 */
export function consumeUploadRateLimit(
  actorKey: string,
  limit = 30,
  windowMs = 60_000,
  nowMs = Date.now(),
): RateLimitCheckResult {
  pruneUploadRateBuckets(nowMs);
  const cutoff = nowMs - windowMs;
  const bucket = uploadRateBuckets.get(actorKey) ?? { timestamps: [], windowMs };
  bucket.windowMs = windowMs;
  bucket.timestamps = bucket.timestamps.filter((ts) => ts > cutoff);

  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0] ?? nowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - nowMs) / 1000));
    uploadRateBuckets.delete(actorKey);
    uploadRateBuckets.set(actorKey, bucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  bucket.timestamps.push(nowMs);
  uploadRateBuckets.delete(actorKey);
  uploadRateBuckets.set(actorKey, bucket);

  return {
    allowed: true,
    remaining: Math.max(0, limit - bucket.timestamps.length),
    retryAfterSeconds: 0,
  };
}

export function resetUploadRateLimitsForTests(): void {
  uploadRateBuckets.clear();
}

