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

export const DEFAULT_AUTH_RATE_LIMIT_PER_MIN = 45;

export function extractClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
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
