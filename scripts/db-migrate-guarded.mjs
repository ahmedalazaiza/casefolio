#!/usr/bin/env node
// Guarded database migration for remote databases.
//
//   CONFIRM_DB_HOST=<host in DATABASE_URL> pnpm db:migrate:remote [--seed]
//
// - Local hosts (localhost / 127.0.0.1 / ::1) run without confirmation.
// - Any other host requires CONFIRM_DB_HOST to equal the DATABASE_URL host exactly.
// - Seeding (--seed) on a non-local host additionally requires ALLOW_REMOTE_SEED=1.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * Pure decision function (unit-tested). Returns { ok, reason, host, local }.
 */
export function evaluateMigrationGuard({ databaseUrl, confirmDbHost, allowRemoteSeed, seed }) {
  if (!databaseUrl) return { ok: false, reason: "DATABASE_URL is not set.", host: null, local: false };
  let host;
  try {
    host = new URL(databaseUrl).hostname.toLowerCase();
  } catch {
    return { ok: false, reason: "DATABASE_URL is not a valid URL.", host: null, local: false };
  }
  if (!host) return { ok: false, reason: "DATABASE_URL has no host.", host: null, local: false };
  const local = LOCAL_HOSTS.has(host);
  if (!local) {
    if ((confirmDbHost ?? "").trim().toLowerCase() !== host) {
      return {
        ok: false,
        reason: `Refusing to touch remote database host "${host}". Re-run with CONFIRM_DB_HOST=${host} to confirm.`,
        host,
        local,
      };
    }
    if (seed && allowRemoteSeed !== "1") {
      return {
        ok: false,
        reason: `Refusing to seed remote database host "${host}". Set ALLOW_REMOTE_SEED=1 if you really intend to.`,
        host,
        local,
      };
    }
  }
  return { ok: true, reason: "", host, local };
}

function run(args) {
  const res = spawnSync("pnpm", args, { stdio: "inherit", env: process.env });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

const isEntrypoint = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);

if (isEntrypoint) {
  if (!process.env.DATABASE_URL) {
    for (const candidate of [resolve(process.cwd(), ".env")]) {
      if (existsSync(candidate)) process.loadEnvFile(candidate);
    }
  }
  const seed = process.argv.includes("--seed");
  const verdict = evaluateMigrationGuard({
    databaseUrl: process.env.DATABASE_URL,
    confirmDbHost: process.env.CONFIRM_DB_HOST,
    allowRemoteSeed: process.env.ALLOW_REMOTE_SEED,
    seed,
  });
  if (!verdict.ok) {
    console.error(`db-migrate-guarded: ${verdict.reason}`);
    process.exit(1);
  }
  console.log(`db-migrate-guarded: migrating host "${verdict.host}" (${verdict.local ? "local" : "remote, confirmed"}).`);
  run(["db:migrate"]);
  if (seed) run(["db:seed"]);
}
