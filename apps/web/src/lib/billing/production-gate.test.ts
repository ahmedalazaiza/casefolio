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
