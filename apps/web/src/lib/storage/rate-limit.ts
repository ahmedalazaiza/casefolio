interface RateLimitBucket {
  timestamps: number[];
}

const uploadRateBuckets = new Map<string, RateLimitBucket>();

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
  const cutoff = nowMs - windowMs;
  const bucket = uploadRateBuckets.get(actorKey) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((ts) => ts > cutoff);

  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0] ?? nowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - nowMs) / 1000));
    uploadRateBuckets.set(actorKey, bucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  bucket.timestamps.push(nowMs);
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

