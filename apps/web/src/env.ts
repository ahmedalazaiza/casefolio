import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const SERVER_ENV_SCHEMA = {
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

export const CLIENT_ENV_SCHEMA = {
  NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: z.string().min(1),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
} as const;

export const REQUIRED_ENV_KEYS = [
  ...Object.keys(SERVER_ENV_SCHEMA),
  ...Object.keys(CLIENT_ENV_SCHEMA),
] as const;

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
    cachedEnv = createValidatedEnv(process.env);
  }
  return cachedEnv;
}

export const env = new Proxy({} as ReturnType<typeof createValidatedEnv>, {
  get(_target, prop: string) {
    return getEnv()[prop as keyof ReturnType<typeof createValidatedEnv>];
  },
});
