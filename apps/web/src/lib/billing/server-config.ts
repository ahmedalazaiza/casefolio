import { env } from "@/env";
import type { BillingInterval, PaidPlanTier } from "@/lib/billing/plans";

const PLACEHOLDER_TOKEN_PATTERNS = [
  "your_",
  "placeholder",
  "example",
  "dummy",
  "replace-",
  "dev_",
];

export function resolveServerPaddlePriceId(
  plan: PaidPlanTier,
  interval: BillingInterval,
): string {
  if (plan === "pro") {
    return interval === "yearly"
      ? env.PADDLE_PRICE_PRO_YEARLY
      : env.PADDLE_PRICE_PRO_MONTHLY;
  }
  return interval === "yearly"
    ? env.PADDLE_PRICE_TEAM_YEARLY
    : env.PADDLE_PRICE_TEAM_MONTHLY;
}

/**
 * Maps a Paddle price id to a Casefolio plan using **exact** matches against the four
 * configured `PADDLE_PRICE_*` ids only.
 *
 * There is intentionally no fuzzy / substring fallback: an unknown price id must never be
 * guessed into a paid plan (a random Paddle id can contain "pro" or "team"). Callers treat
 * `null` as "not one of our products" and must not grant entitlements.
 */
export function resolvePlanFromServerPriceId(
  priceId: string | null | undefined,
): { plan: PaidPlanTier; interval: BillingInterval } | null {
  if (!priceId) return null;
  const trimmed = priceId.trim();
  if (!trimmed) return null;

  if (trimmed === env.PADDLE_PRICE_PRO_MONTHLY) {
    return { plan: "pro", interval: "monthly" };
  }
  if (trimmed === env.PADDLE_PRICE_PRO_YEARLY) {
    return { plan: "pro", interval: "yearly" };
  }
  if (trimmed === env.PADDLE_PRICE_TEAM_MONTHLY) {
    return { plan: "team", interval: "monthly" };
  }
  if (trimmed === env.PADDLE_PRICE_TEAM_YEARLY) {
    return { plan: "team", interval: "yearly" };
  }

  return null;
}

export function isRealPaddleTokenConfigured(token = env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN): boolean {
  const normalized = token.trim().toLowerCase();
  if (!normalized.startsWith("test_") && !normalized.startsWith("live_")) {
    return false;
  }
  if (normalized.length < 24) {
    return false;
  }
  return !PLACEHOLDER_TOKEN_PATTERNS.some((pat) => normalized.includes(pat));
}

export function isRealPaddleApiKeyConfigured(apiKey = env.PADDLE_API_KEY): boolean {
  const normalized = apiKey.trim().toLowerCase();
  if (!normalized.startsWith("pdl_")) {
    return false;
  }
  if (normalized.length < 30) {
    return false;
  }
  return !PLACEHOLDER_TOKEN_PATTERNS.some((pat) => normalized.includes(pat));
}

export function isRealPaddlePriceId(priceId: string): boolean {
  return /^pri_01[a-z0-9]{20,}$/i.test(priceId.trim());
}

export function isPaddleOverlayLiveReady(priceId: string): boolean {
  return isRealPaddleTokenConfigured() && isRealPaddlePriceId(priceId);
}

export interface BillingConfigStatus {
  /** `true` when real money can safely flow through this deployment. */
  productionReady: boolean;
  environment: "sandbox" | "production";
  /** Human-readable reasons the deployment is not production-ready (empty when ready). */
  problems: string[];
}

/**
 * Validates that the Paddle configuration is internally consistent for the declared
 * `PADDLE_ENV`. Sandbox deployments may legitimately run with placeholder ids (the app then
 * uses the signed local simulator), but production must never silently fall back to it.
 */
export function getBillingConfigStatus(): BillingConfigStatus {
  const problems: string[] = [];
  const token = env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN.trim().toLowerCase();
  const apiKey = env.PADDLE_API_KEY.trim().toLowerCase();

  if (!isRealPaddleTokenConfigured()) {
    problems.push("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN is missing or a placeholder.");
  }
  if (!isRealPaddleApiKeyConfigured()) {
    problems.push("PADDLE_API_KEY is missing or a placeholder.");
  }

  const priceIds: Array<[string, string]> = [
    ["PADDLE_PRICE_PRO_MONTHLY", env.PADDLE_PRICE_PRO_MONTHLY],
    ["PADDLE_PRICE_PRO_YEARLY", env.PADDLE_PRICE_PRO_YEARLY],
    ["PADDLE_PRICE_TEAM_MONTHLY", env.PADDLE_PRICE_TEAM_MONTHLY],
    ["PADDLE_PRICE_TEAM_YEARLY", env.PADDLE_PRICE_TEAM_YEARLY],
  ];
  for (const [name, value] of priceIds) {
    if (!isRealPaddlePriceId(value)) {
      problems.push(`${name} is not a real Paddle price id (expected pri_01…).`);
    }
  }
  if (new Set(priceIds.map(([, value]) => value.trim())).size !== priceIds.length) {
    problems.push("PADDLE_PRICE_* ids must be four distinct prices.");
  }

  if (env.PADDLE_ENV === "production") {
    if (!token.startsWith("live_")) {
      problems.push("PADDLE_ENV=production requires a live_ client token.");
    }
    if (apiKey.includes("_sdbx_")) {
      problems.push("PADDLE_ENV=production cannot use a sandbox API key.");
    }
  } else {
    if (token.startsWith("live_")) {
      problems.push("PADDLE_ENV=sandbox must not use a live_ client token.");
    }
    if (apiKey.includes("_live_")) {
      problems.push("PADDLE_ENV=sandbox must not use a live API key.");
    }
  }

  return {
    productionReady: problems.length === 0,
    environment: env.PADDLE_ENV,
    problems,
  };
}

export function getPaddleApiBaseUrl(): string {
  return env.PADDLE_ENV === "production"
    ? "https://api.paddle.com"
    : "https://sandbox-api.paddle.com";
}
