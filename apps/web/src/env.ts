import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const REQUIRED_SERVER_ENV_SCHEMA = {
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(16),
  BETTER_AUTH_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
  CF_IMAGES_ACCOUNT_HASH: z.string().min(1),
  CF_IMAGES_API_TOKEN: z.string().min(1),
  PADDLE_API_KEY: z.string().min(1),
  PADDLE_WEBHOOK_SECRET: z.string().min(1),
  PADDLE_ENV: z.enum(["sandbox", "production"]),
  PADDLE_PRICE_PRO_MONTHLY: z.string().min(1),
  PADDLE_PRICE_PRO_YEARLY: z.string().min(1),
  PADDLE_PRICE_TEAM_MONTHLY: z.string().min(1),
  PADDLE_PRICE_TEAM_YEARLY: z.string().min(1),
  EXPORT_WORKER_URL: z.string().url(),
  EXPORT_SIGNING_SECRET: z.string().min(16),
  SENTRY_DSN: z.string().url(),
} as const;

export const SERVER_ENV_SCHEMA = {
  ...REQUIRED_SERVER_ENV_SCHEMA,
  PADDLE_PRICE_PLUS_MONTHLY: z.string().min(1).default("pri_plus_monthly_id"),
  PADDLE_PRICE_PLUS_YEARLY: z.string().min(1).default("pri_plus_yearly_id"),
  EMAIL_DOMAIN: z.string().min(3).default("casefolio.com"),
  EMAIL_FROM_ADMIN: z.string().min(3).optional(),
  EMAIL_FROM_SECURITY: z.string().min(3).optional(),
  EMAIL_FROM_WELCOME: z.string().min(3).optional(),
  EMAIL_FROM_TEAM: z.string().min(3).optional(),
  EMAIL_FROM_BILLING: z.string().min(3).optional(),
  EMAIL_FROM_NOTIFICATIONS: z.string().min(3).optional(),
  EMAIL_FROM_SUPPORT: z.string().min(3).optional(),
  ADMIN_ALERT_EMAIL: z.string().email().default("admin@casefolio.com"),
  SUPPORT_INBOX_EMAIL: z.string().email().default("support@casefolio.com"),
  ALLOW_SIMULATED_BILLING: z.string().optional(),
  EXPORT_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(1),
} as const;

export const CLIENT_ENV_SCHEMA = {
  NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: z.string().min(1),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
} as const;

export const REQUIRED_ENV_KEYS = [
  ...Object.keys(REQUIRED_SERVER_ENV_SCHEMA),
  ...Object.keys(CLIENT_ENV_SCHEMA),
] as const;

/**
 * True only when the local signed billing simulator may run: explicit opt-in AND never in a
 * production deployment (Vercel production or Paddle production).
 */
export function isSimulatedBillingAllowed(
  source: Record<string, string | undefined> = process.env,
): boolean {
  if (source.VERCEL_ENV === "production" || source.PADDLE_ENV === "production") return false;
  return source.ALLOW_SIMULATED_BILLING === "1";
}

/**
 * Throws a clear error when a *production deployment* is configured with sandbox/simulated
 * billing. Staging (preview) and local environments are never affected.
 */
export function assertProductionBillingEnvironment(
  source: Record<string, string | undefined> = process.env,
): void {
  if (source.VERCEL_ENV !== "production") return;
  const problems: string[] = [];
  if (source.PADDLE_ENV !== "production") problems.push("PADDLE_ENV must be 'production'");
  const placeholders = Object.entries(source)
    .filter(([key, value]) => key.startsWith("PADDLE_PRICE_") && /^pri_.*_id$/.test(value ?? ""))
    .map(([key]) => key);
  if (placeholders.length > 0) {
    problems.push(`placeholder Paddle price ids in ${placeholders.join(", ")}`);
  }
  if (source.ALLOW_SIMULATED_BILLING) problems.push("ALLOW_SIMULATED_BILLING must be unset");
  if (problems.length > 0) {
    throw new Error(`Unsafe billing configuration for a production deployment: ${problems.join("; ")}.`);
  }
}

export function createValidatedEnv(
  source: Record<string, string | undefined>,
  options?: { isServer?: boolean; skipValidation?: boolean },
) {
  return createEnv({
    server: SERVER_ENV_SCHEMA,
    client: CLIENT_ENV_SCHEMA,
    runtimeEnv: {
      DATABASE_URL: source.DATABASE_URL,
      BETTER_AUTH_SECRET: source.BETTER_AUTH_SECRET,
      BETTER_AUTH_URL: source.BETTER_AUTH_URL,
      GOOGLE_CLIENT_ID: source.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: source.GOOGLE_CLIENT_SECRET,
      RESEND_API_KEY: source.RESEND_API_KEY,
      R2_ACCOUNT_ID: source.R2_ACCOUNT_ID,
      R2_ACCESS_KEY_ID: source.R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY: source.R2_SECRET_ACCESS_KEY,
      R2_BUCKET: source.R2_BUCKET,
      CF_IMAGES_ACCOUNT_HASH: source.CF_IMAGES_ACCOUNT_HASH,
      CF_IMAGES_API_TOKEN: source.CF_IMAGES_API_TOKEN,
      NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: source.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
      PADDLE_API_KEY: source.PADDLE_API_KEY,
      PADDLE_WEBHOOK_SECRET: source.PADDLE_WEBHOOK_SECRET,
      PADDLE_ENV: source.PADDLE_ENV,
      PADDLE_PRICE_PRO_MONTHLY: source.PADDLE_PRICE_PRO_MONTHLY,
      PADDLE_PRICE_PRO_YEARLY: source.PADDLE_PRICE_PRO_YEARLY,
      PADDLE_PRICE_TEAM_MONTHLY: source.PADDLE_PRICE_TEAM_MONTHLY,
      PADDLE_PRICE_TEAM_YEARLY: source.PADDLE_PRICE_TEAM_YEARLY,
      PADDLE_PRICE_PLUS_MONTHLY: source.PADDLE_PRICE_PLUS_MONTHLY,
      PADDLE_PRICE_PLUS_YEARLY: source.PADDLE_PRICE_PLUS_YEARLY,
      EMAIL_DOMAIN: source.EMAIL_DOMAIN,
      EMAIL_FROM_ADMIN: source.EMAIL_FROM_ADMIN,
      EMAIL_FROM_SECURITY: source.EMAIL_FROM_SECURITY,
      EMAIL_FROM_WELCOME: source.EMAIL_FROM_WELCOME,
      EMAIL_FROM_TEAM: source.EMAIL_FROM_TEAM,
      EMAIL_FROM_BILLING: source.EMAIL_FROM_BILLING,
      EMAIL_FROM_NOTIFICATIONS: source.EMAIL_FROM_NOTIFICATIONS,
      EMAIL_FROM_SUPPORT: source.EMAIL_FROM_SUPPORT,
      ADMIN_ALERT_EMAIL: source.ADMIN_ALERT_EMAIL,
      SUPPORT_INBOX_EMAIL: source.SUPPORT_INBOX_EMAIL,
      ALLOW_SIMULATED_BILLING: source.ALLOW_SIMULATED_BILLING,
      EXPORT_WORKER_CONCURRENCY: source.EXPORT_WORKER_CONCURRENCY,
      EXPORT_WORKER_URL: source.EXPORT_WORKER_URL,
      EXPORT_SIGNING_SECRET: source.EXPORT_SIGNING_SECRET,
      NEXT_PUBLIC_POSTHOG_KEY: source.NEXT_PUBLIC_POSTHOG_KEY,
      NEXT_PUBLIC_POSTHOG_HOST: source.NEXT_PUBLIC_POSTHOG_HOST,
      SENTRY_DSN: source.SENTRY_DSN,
      NEXT_PUBLIC_APP_URL: source.NEXT_PUBLIC_APP_URL,
    },
    isServer: options?.isServer ?? typeof window === "undefined",
    skipValidation: options?.skipValidation ?? Boolean(source.SKIP_ENV_VALIDATION),
    emptyStringAsUndefined: true,
  });
}

let cachedEnv: ReturnType<typeof createValidatedEnv> | null = null;

export function getEnv() {
  if (!cachedEnv) {
    assertProductionBillingEnvironment(process.env);
    cachedEnv = createValidatedEnv(process.env);
  }
  return cachedEnv;
}

export const env = new Proxy({} as ReturnType<typeof createValidatedEnv>, {
  get(_target, prop: string) {
    return getEnv()[prop as keyof ReturnType<typeof createValidatedEnv>];
  },
});
