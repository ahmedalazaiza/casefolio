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

export function resolvePlanFromServerPriceId(
  priceId: string | null | undefined,
): { plan: PaidPlanTier; interval: BillingInterval } | null {
  if (!priceId) return null;
  const trimmed = priceId.trim();

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

  const lower = trimmed.toLowerCase();
  if (lower.includes("team") && lower.includes("year")) {
    return { plan: "team", interval: "yearly" };
  }
  if (lower.includes("team")) {
    return { plan: "team", interval: "monthly" };
  }
  if (lower.includes("pro") && lower.includes("year")) {
    return { plan: "pro", interval: "yearly" };
  }
  if (lower.includes("pro")) {
    return { plan: "pro", interval: "monthly" };
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

export function getPaddleApiBaseUrl(): string {
  return env.PADDLE_ENV === "production"
    ? "https://api.paddle.com"
    : "https://sandbox-api.paddle.com";
}
