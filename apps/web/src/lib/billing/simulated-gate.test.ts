// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { completeSandboxCheckoutForUser, prepareCheckoutSessionForUser } from "@/lib/billing/service";

const actor = { id: "user_gate_test", email: "gate@example.com", name: "Gate" };
const input = { plan: "pro", interval: "monthly" };

describe("simulated billing opt-in gate (B2)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("refuses the simulator without ALLOW_SIMULATED_BILLING", async () => {
    vi.stubEnv("ALLOW_SIMULATED_BILLING", "");
    const res = await completeSandboxCheckoutForUser(actor, input);
    expect(res).toMatchObject({ ok: false, code: "SANDBOX_ONLY" });
  });

  it("refuses the simulator when VERCEL_ENV=production even with the flag", async () => {
    vi.stubEnv("ALLOW_SIMULATED_BILLING", "1");
    vi.stubEnv("VERCEL_ENV", "production");
    const res = await completeSandboxCheckoutForUser(actor, input);
    expect(res).toMatchObject({ ok: false, code: "SANDBOX_ONLY" });
  });

  it("does not offer a simulated checkout session without the opt-in", async () => {
    vi.stubEnv("ALLOW_SIMULATED_BILLING", "");
    const res = await prepareCheckoutSessionForUser(actor, input);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("BILLING_NOT_CONFIGURED");
  });
});
