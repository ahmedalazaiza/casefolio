// @vitest-environment node
import { describe, expect, it } from "vitest";
import { evaluateMigrationGuard } from "../scripts/db-migrate-guarded.mjs";

const REMOTE = "postgresql://u:p@ep-cool-123.neon.tech/casefolio?sslmode=require";

describe("guarded remote migration (B3/S8)", () => {
  it("allows local hosts without confirmation", () => {
    const v = evaluateMigrationGuard({
      databaseUrl: "postgresql://localhost:5433/casefolio_a3",
      confirmDbHost: undefined,
      allowRemoteSeed: undefined,
      seed: true,
    });
    expect(v.ok).toBe(true);
    expect(v.local).toBe(true);
  });

  it("refuses a remote host without CONFIRM_DB_HOST", () => {
    const v = evaluateMigrationGuard({ databaseUrl: REMOTE, confirmDbHost: undefined, allowRemoteSeed: undefined, seed: false });
    expect(v.ok).toBe(false);
    expect(v.reason).toContain("CONFIRM_DB_HOST=ep-cool-123.neon.tech");
  });

  it("refuses a mismatching confirmation host", () => {
    const v = evaluateMigrationGuard({ databaseUrl: REMOTE, confirmDbHost: "other.neon.tech", allowRemoteSeed: undefined, seed: false });
    expect(v.ok).toBe(false);
  });

  it("accepts a matching confirmation for migrations", () => {
    const v = evaluateMigrationGuard({ databaseUrl: REMOTE, confirmDbHost: "ep-cool-123.neon.tech", allowRemoteSeed: undefined, seed: false });
    expect(v.ok).toBe(true);
    expect(v.local).toBe(false);
  });

  it("refuses remote seeds unless ALLOW_REMOTE_SEED=1", () => {
    const base = { databaseUrl: REMOTE, confirmDbHost: "ep-cool-123.neon.tech", seed: true };
    expect(evaluateMigrationGuard({ ...base, allowRemoteSeed: undefined }).ok).toBe(false);
    expect(evaluateMigrationGuard({ ...base, allowRemoteSeed: "true" }).ok).toBe(false);
    expect(evaluateMigrationGuard({ ...base, allowRemoteSeed: "1" }).ok).toBe(true);
  });

  it("refuses missing or malformed DATABASE_URL", () => {
    expect(evaluateMigrationGuard({ databaseUrl: undefined, confirmDbHost: "x", allowRemoteSeed: "1", seed: false }).ok).toBe(false);
    expect(evaluateMigrationGuard({ databaseUrl: "nope", confirmDbHost: "x", allowRemoteSeed: "1", seed: false }).ok).toBe(false);
  });
});

describe("vercel.json release safety", () => {
  it("builds only the web app (no migrate/seed) and schedules both crons", async () => {
    const { readFileSync } = await import("node:fs");
    const cfg = JSON.parse(readFileSync("vercel.json", "utf-8")) as {
      buildCommand: string;
      crons: { path: string; schedule: string }[];
    };
    expect(cfg.buildCommand).toBe("pnpm --filter @casefolio/web build");
    expect(cfg.buildCommand).not.toMatch(/db:migrate|db:seed/);
    expect(cfg.crons).toContainEqual({ path: "/api/cron/billing-reconcile", schedule: "0 4 * * *" });
    expect(cfg.crons).toContainEqual({ path: "/api/cron/maintenance", schedule: "30 3 * * *" });
  });
});
