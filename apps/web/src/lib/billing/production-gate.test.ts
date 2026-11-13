// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type * as EnvModule from "@/env";

vi.mock("@/env", async (importOriginal) => {
  const actual = await importOriginal<typeof EnvModule>();
  const overrides: Record<string, string> = {
    PADDLE_ENV: "production",
    // Placeholder (non-"pri_01…") price ids + sandbox-style token: a mis-deployed production build.
    PADDLE_PRICE_PRO_MONTHLY: "pri_ci_pro_monthly",
    PADDLE_PRICE_PRO_YEARLY: "pri_ci_pro_yearly",
    PADDLE_PRICE_TEAM_MONTHLY: "pri_ci_team_monthly",
    PADDLE_PRICE_TEAM_YEARLY: "pri_ci_team_yearly",
    PADDLE_PRICE_PLUS_MONTHLY: "pri_ci_plus_monthly",
    PADDLE_PRICE_PLUS_YEARLY: "pri_ci_plus_yearly",
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "test_ci_paddle_token",
  };
  return {
    ...actual,
    env: new Proxy({} as typeof actual.env, {
      get: (_target, prop: string) => overrides[prop] ?? actual.env[prop as keyof typeof actual.env],
    }),
  };
});

describe("production billing safety gate (P0-5)", () => {
  it("never offers the local simulator in production: a misconfigured deployment fails loudly", async () => {
    const { prepareCheckoutSessionForUser, completeSandboxCheckoutForUser } = await import(
      "@/lib/billing/service"
    );

    const actor = { id: crypto.randomUUID(), email: "prod-gate@casefolio.test", name: "Prod Gate" };

    const prepared = await prepareCheckoutSessionForUser(actor, { plan: "pro", interval: "monthly" });
    expect(prepared).toMatchObject({ ok: false, code: "BILLING_NOT_CONFIGURED" });

    const simulated = await completeSandboxCheckoutForUser(actor, { plan: "pro", interval: "monthly" });
    expect(simulated).toMatchObject({ ok: false, code: "SANDBOX_ONLY" });
  });

  it("reports every configuration problem for the declared environment", async () => {
    const { getBillingConfigStatus } = await import("@/lib/billing/server-config");
    const status = getBillingConfigStatus();
    expect(status.environment).toBe("production");
    expect(status.productionReady).toBe(false);
    expect(status.problems.join("\n")).toMatch(/PADDLE_PRICE_PRO_MONTHLY/);
    expect(status.problems.join("\n")).toMatch(/live_ client token/);
  });
});

describe("evaluateBillingConfig (pure, shared with /api/health)", () => {
  const realPrices = {
    PADDLE_PRICE_PRO_MONTHLY: "pri_01hproMonthly0000000000000",
    PADDLE_PRICE_PRO_YEARLY: "pri_01hproYearly00000000000000",
    PADDLE_PRICE_TEAM_MONTHLY: "pri_01hteamMonthly000000000000",
    PADDLE_PRICE_TEAM_YEARLY: "pri_01hteamYearly0000000000000",
    PADDLE_PRICE_PLUS_MONTHLY: "pri_01hplusMonthly000000000000",
    PADDLE_PRICE_PLUS_YEARLY: "pri_01hplusYearly0000000000000",
  };

  it("accepts a consistent sandbox configuration", async () => {
    const { evaluateBillingConfig } = await import("@/lib/billing/server-config");
    const status = evaluateBillingConfig({
      PADDLE_ENV: "sandbox",
      NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "test_0123456789abcdef01234567",
      PADDLE_API_KEY: "pdl_sdbx_apikey_0123456789abcdef0123456789",
      ...realPrices,
    });
    expect(status).toEqual({ productionReady: true, environment: "sandbox", problems: [] });
  });

  it("rejects mixing live credentials with sandbox (and vice versa) and duplicate prices", async () => {
    const { evaluateBillingConfig } = await import("@/lib/billing/server-config");
    const liveInSandbox = evaluateBillingConfig({
      PADDLE_ENV: "sandbox",
      NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "live_0123456789abcdef01234567",
      PADDLE_API_KEY: "pdl_live_apikey_0123456789abcdef0123456789",
      ...realPrices,
    });
    expect(liveInSandbox.productionReady).toBe(false);
    expect(liveInSandbox.problems.join("\n")).toMatch(/sandbox must not use a live_/);

    const sandboxInProd = evaluateBillingConfig({
      PADDLE_ENV: "production",
      NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "test_0123456789abcdef01234567",
      PADDLE_API_KEY: "pdl_sdbx_apikey_0123456789abcdef0123456789",
      ...realPrices,
    });
    expect(sandboxInProd.productionReady).toBe(false);
    expect(sandboxInProd.problems.join("\n")).toMatch(/requires a live_/);
    expect(sandboxInProd.problems.join("\n")).toMatch(/cannot use a sandbox API key/);

    const duplicated = evaluateBillingConfig({
      PADDLE_ENV: "sandbox",
      NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "test_0123456789abcdef01234567",
      PADDLE_API_KEY: "pdl_sdbx_apikey_0123456789abcdef0123456789",
      ...realPrices,
      PADDLE_PRICE_TEAM_YEARLY: realPrices.PADDLE_PRICE_PRO_YEARLY,
    });
    expect(duplicated.problems.join("\n")).toMatch(/six distinct prices/);
  });
});
