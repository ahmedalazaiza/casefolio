import { consumeUploadRateLimit, resetUploadRateLimitsForTests } from "@/lib/storage/rate-limit";

const RATE_LIMITED_AUTH_PREFIXES = [
  "/api/auth/sign-in",
  "/api/auth/sign-up",
  "/api/auth/forget-password",
  "/api/auth/reset-password",
  "/api/auth/request-password-reset",
  "/api/auth/email-otp",
  "/api/auth/magic-link",
] as const;

/**
 * Coarse, per-instance flood guard in front of Better Auth. The precise, per-endpoint limits live in
 * Better Auth's durable `rate_limits` storage (see `auth/server.ts`); this ceiling only has to stop
 * raw floods without throttling many real users that share one office/school/carrier IP.
 */
export const DEFAULT_AUTH_RATE_LIMIT_PER_MIN = 150;

export function extractClientIp(headers: Headers): string {
  const cfIp = headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (hops.length > 0) {
      return hops[hops.length - 1]!;
    }
  }
  return "127.0.0.1";
}

export function isSensitiveAuthMutationPath(pathname: string): boolean {
  const normalized = pathname.toLowerCase();
  return RATE_LIMITED_AUTH_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function checkAuthEndpointRateLimit(
  request: Request,
  limitPerMinute = DEFAULT_AUTH_RATE_LIMIT_PER_MIN,
): {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
} {
  const url = new URL(request.url);
  if (!isSensitiveAuthMutationPath(url.pathname)) {
    return {
      allowed: true,
      retryAfterSeconds: 0,
      remaining: limitPerMinute,
    };
  }

  const clientIp = extractClientIp(request.headers);
  return consumeUploadRateLimit(`auth:${clientIp}`, limitPerMinute, 60_000);
}

export function resetAuthRateLimitsForTests(): void {
  resetUploadRateLimitsForTests();
}

