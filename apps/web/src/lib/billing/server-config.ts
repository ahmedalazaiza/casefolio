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
  if (plan === "plus") {
    return interval === "yearly"
      ? env.PADDLE_PRICE_PLUS_YEARLY
      : env.PADDLE_PRICE_PLUS_MONTHLY;
  }
  return interval === "yearly"
    ? env.PADDLE_PRICE_TEAM_YEARLY
    : env.PADDLE_PRICE_TEAM_MONTHLY;
}

/**
 * Maps a Paddle price id to a Casefolio plan using **exact** matches against the six
 * configured `PADDLE_PRICE_*` ids only.
 *
 * There is intentionally no fuzzy / substring fallback: an unknown price id must never be
 * guessed into a paid plan (a random Paddle id can contain "pro", "team", or "plus"). Callers treat
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
  if (trimmed === env.PADDLE_PRICE_PLUS_MONTHLY) {
    return { plan: "plus", interval: "monthly" };
  }
  if (trimmed === env.PADDLE_PRICE_PLUS_YEARLY) {
    return { plan: "plus", interval: "yearly" };
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

export interface BillingConfigInput {
  PADDLE_ENV?: string;
  NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?: string;
  PADDLE_API_KEY?: string;
  PADDLE_PRICE_PRO_MONTHLY?: string;
  PADDLE_PRICE_PRO_YEARLY?: string;
  PADDLE_PRICE_TEAM_MONTHLY?: string;
  PADDLE_PRICE_TEAM_YEARLY?: string;
  PADDLE_PRICE_PLUS_MONTHLY?: string;
  PADDLE_PRICE_PLUS_YEARLY?: string;
}

/**
 * Validates that the Paddle configuration is internally consistent for the declared
 * `PADDLE_ENV`. Sandbox deployments may legitimately run with placeholder ids (the app then
 * uses the signed local simulator), but production must never silently fall back to it.
 * Pure: takes the values explicitly so `/api/health` and tests can reuse it.
 */
export function evaluateBillingConfig(input: BillingConfigInput): BillingConfigStatus {
  const problems: string[] = [];
  const environment: "sandbox" | "production" =
    input.PADDLE_ENV === "production" ? "production" : "sandbox";
  const rawToken = input.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? "";
  const rawApiKey = input.PADDLE_API_KEY ?? "";
  const token = rawToken.trim().toLowerCase();
  const apiKey = rawApiKey.trim().toLowerCase();

  if (!isRealPaddleTokenConfigured(rawToken)) {
    problems.push("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN is missing or a placeholder.");
  }
  if (!isRealPaddleApiKeyConfigured(rawApiKey)) {
    problems.push("PADDLE_API_KEY is missing or a placeholder.");
  }

  const priceIds: Array<[string, string]> = [
    ["PADDLE_PRICE_PRO_MONTHLY", input.PADDLE_PRICE_PRO_MONTHLY ?? ""],
    ["PADDLE_PRICE_PRO_YEARLY", input.PADDLE_PRICE_PRO_YEARLY ?? ""],
    ["PADDLE_PRICE_TEAM_MONTHLY", input.PADDLE_PRICE_TEAM_MONTHLY ?? ""],
    ["PADDLE_PRICE_TEAM_YEARLY", input.PADDLE_PRICE_TEAM_YEARLY ?? ""],
    ["PADDLE_PRICE_PLUS_MONTHLY", input.PADDLE_PRICE_PLUS_MONTHLY ?? ""],
    ["PADDLE_PRICE_PLUS_YEARLY", input.PADDLE_PRICE_PLUS_YEARLY ?? ""],
  ];
  for (const [name, value] of priceIds) {
    if (!isRealPaddlePriceId(value)) {
      problems.push(`${name} is not a real Paddle price id (expected pri_01…).`);
    }
  }
  if (new Set(priceIds.map(([, value]) => value.trim())).size !== priceIds.length) {
    problems.push("PADDLE_PRICE_* ids must be six distinct prices.");
  }

  if (environment === "production") {
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

  return { productionReady: problems.length === 0, environment, problems };
}

export function getBillingConfigStatus(): BillingConfigStatus {
  return evaluateBillingConfig({
    PADDLE_ENV: env.PADDLE_ENV,
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
    PADDLE_API_KEY: env.PADDLE_API_KEY,
    PADDLE_PRICE_PRO_MONTHLY: env.PADDLE_PRICE_PRO_MONTHLY,
    PADDLE_PRICE_PRO_YEARLY: env.PADDLE_PRICE_PRO_YEARLY,
    PADDLE_PRICE_TEAM_MONTHLY: env.PADDLE_PRICE_TEAM_MONTHLY,
    PADDLE_PRICE_TEAM_YEARLY: env.PADDLE_PRICE_TEAM_YEARLY,
    PADDLE_PRICE_PLUS_MONTHLY: env.PADDLE_PRICE_PLUS_MONTHLY,
    PADDLE_PRICE_PLUS_YEARLY: env.PADDLE_PRICE_PLUS_YEARLY,
  });
}

export function getPaddleApiBaseUrl(): string {
  return env.PADDLE_ENV === "production"
    ? "https://api.paddle.com"
    : "https://sandbox-api.paddle.com";
}
