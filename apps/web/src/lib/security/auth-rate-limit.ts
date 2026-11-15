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

/**
 * Resolve the client IP without trusting client-controlled headers.
 *
 * - On Vercel the platform sets `x-vercel-forwarded-for` (not spoofable) and rewrites `x-forwarded-for`.
 * - A self-hosted reverse proxy can opt in with `TRUSTED_PROXY_HEADER` (e.g. `cf-connecting-ip` ONLY when
 *   the app is really behind Cloudflare and direct access is blocked).
 * - Otherwise fall back to the right-most `x-forwarded-for` hop (the one appended by our own proxy).
 * `cf-connecting-ip` / `x-real-ip` are never trusted by default: any visitor can send them.
 */
export function extractClientIp(headers: Headers): string {
  const first = (value: string | null): string | undefined =>
    value
      ?.split(",")
      .map((part) => part.trim())
      .find(Boolean);

  const vercelIp = first(headers.get("x-vercel-forwarded-for"));
  if (vercelIp && process.env.VERCEL) return vercelIp;

  const trustedHeader = process.env.TRUSTED_PROXY_HEADER?.trim().toLowerCase();
  if (trustedHeader) {
    const trusted = first(headers.get(trustedHeader));
    if (trusted) return trusted;
  }

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (hops.length > 0) {
      // On Vercel XFF is rewritten with the real client first; elsewhere our proxy appends last.
      return process.env.VERCEL ? hops[0]! : hops[hops.length - 1]!;
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

