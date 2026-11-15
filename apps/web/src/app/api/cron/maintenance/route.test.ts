// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/cron/maintenance/route";

describe("/api/cron/maintenance route", () => {
  const originalSecret = process.env.CRON_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalSecret;
    }
  });

  it("fails closed with 503 when CRON_SECRET is unset or shorter than 16 chars", async () => {
    delete process.env.CRON_SECRET;
    const resUnset = await GET(new Request("http://localhost:3000/api/cron/maintenance"));
    expect(resUnset.status).toBe(503);

    process.env.CRON_SECRET = "too-short";
    const resShort = await GET(
      new Request("http://localhost:3000/api/cron/maintenance", {
        headers: { Authorization: "Bearer too-short" },
      }),
    );
    expect(resShort.status).toBe(503);
  });

  it("rejects missing or invalid Bearer tokens with 401", async () => {
    process.env.CRON_SECRET = "cron_secret_production_test_token_12345";

    const missingRes = await GET(new Request("http://localhost:3000/api/cron/maintenance"));
    expect(missingRes.status).toBe(401);

    const wrongRes = await POST(
      new Request("http://localhost:3000/api/cron/maintenance", {
        method: "POST",
        headers: { Authorization: "Bearer wrong_secret_production_test_token_00000" },
      }),
    );
    expect(wrongRes.status).toBe(401);
  });

  it("executes all retention and sweeper jobs when authorized with CRON_SECRET", async () => {
    const secret = "cron_secret_production_test_token_12345";
    process.env.CRON_SECRET = secret;

    const res = await GET(
      new Request("http://localhost:3000/api/cron/maintenance", {
        headers: { Authorization: `Bearer ${secret}` },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      accountDeletions: { processed: number };
      recoverySpaces: { purgedSpaces: number };
      exportsMaintenance: { staleExportsFailed: number };
      supportTickets: { claimed: number; delivered: number; stillQueued: number };
      prunedPageViews: number;
      prunedRateLimits: number;
    };
    expect(body.ok).toBe(true);
    expect(typeof body.accountDeletions.processed).toBe("number");
    expect(typeof body.recoverySpaces.purgedSpaces).toBe("number");
    expect(typeof body.exportsMaintenance.staleExportsFailed).toBe("number");
    expect(typeof body.supportTickets.claimed).toBe("number");
    expect(typeof body.prunedPageViews).toBe("number");
    expect(typeof body.prunedRateLimits).toBe("number");
  });
});
