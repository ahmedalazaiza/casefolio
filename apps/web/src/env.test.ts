import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createValidatedEnv, REQUIRED_ENV_KEYS } from "./env";

const VALID_TEST_ENV: Record<string, string> = {
  DATABASE_URL: "postgresql://localhost:5433/casefolio",
  BETTER_AUTH_SECRET: "test-better-auth-secret-32-characters-long",
  BETTER_AUTH_URL: "http://localhost:3000",
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
  RESEND_API_KEY: "re_test_123",
  R2_ACCOUNT_ID: "r2-account",
  R2_ACCESS_KEY_ID: "r2-key",
  R2_SECRET_ACCESS_KEY: "r2-secret",
  R2_BUCKET: "casefolio-bucket",
  CF_IMAGES_ACCOUNT_HASH: "cf-hash",
  CF_IMAGES_API_TOKEN: "cf-token",
  NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "test_paddle_token",
  PADDLE_API_KEY: "pdl_sdbx_apikey_test",
  PADDLE_WEBHOOK_SECRET: "pdl_ntfset_test",
  PADDLE_ENV: "sandbox",
  PADDLE_PRICE_PRO_MONTHLY: "pri_pro_m",
  PADDLE_PRICE_PRO_YEARLY: "pri_pro_y",
  PADDLE_PRICE_TEAM_MONTHLY: "pri_team_m",
  PADDLE_PRICE_TEAM_YEARLY: "pri_team_y",
  EXPORT_WORKER_URL: "http://localhost:4000",
  EXPORT_SIGNING_SECRET: "test-export-signing-secret-32-chars",
  NEXT_PUBLIC_POSTHOG_KEY: "phc_test",
  NEXT_PUBLIC_POSTHOG_HOST: "https://us.i.posthog.com",
  SENTRY_DSN: "https://public@example.ingest.sentry.io/1",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
};

describe("env validation & .env.example completeness (C-004)", () => {
  it("validates a complete, well-formed environment", () => {
    const parsed = createValidatedEnv(VALID_TEST_ENV, { isServer: true });
    expect(parsed.DATABASE_URL).toBe("postgresql://localhost:5433/casefolio");
    expect(parsed.PADDLE_ENV).toBe("sandbox");
    expect(parsed.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
  });

  it("fails fast when any required server or client variable is missing", () => {
    for (const key of REQUIRED_ENV_KEYS) {
      const broken = { ...VALID_TEST_ENV, [key]: "" };
      expect(
        () => createValidatedEnv(broken, { isServer: true }),
        `Expected missing ${key} to fail fast`,
      ).toThrow();
    }
  });

  it("fails fast on malformed URLs or invalid enum values", () => {
    expect(() =>
      createValidatedEnv({ ...VALID_TEST_ENV, DATABASE_URL: "not-a-url" }, { isServer: true }),
    ).toThrow();

    expect(() =>
      createValidatedEnv({ ...VALID_TEST_ENV, PADDLE_ENV: "invalid" }, { isServer: true }),
    ).toThrow();

    expect(() =>
      createValidatedEnv({ ...VALID_TEST_ENV, BETTER_AUTH_SECRET: "short" }, { isServer: true }),
    ).toThrow();
  });

  it("ships a complete .env.example covering all 26 MASTER-SHEET variables", () => {
    const examplePath = resolve(process.cwd(), ".env.example");
    const raw = readFileSync(examplePath, "utf-8");
    const definedKeys = new Set(
      raw
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => line.split("=")[0]?.trim() ?? ""),
    );

    expect(REQUIRED_ENV_KEYS).toHaveLength(26);
    for (const key of REQUIRED_ENV_KEYS) {
      expect(definedKeys.has(key), `Missing ${key} in .env.example`).toBe(true);
    }
  });
});

