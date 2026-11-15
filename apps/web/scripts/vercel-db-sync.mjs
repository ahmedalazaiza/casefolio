import { execSync } from "node:child_process";

/**
 * Preview-only opt-in migration runner (`B3` / `S8` compliant):
 * - NEVER runs `db:seed`.
 * - Hard-refused on `VERCEL_ENV === "production"` (production requires `CONFIRM_DB_HOST=... pnpm db:migrate:remote`).
 * - Runs expand-only Drizzle schema migrations ONLY on Vercel Preview when `ALLOW_PREVIEW_DB_MIGRATE=1` is explicitly set.
 */
if (
  process.env.VERCEL === "1" &&
  process.env.VERCEL_ENV === "preview" &&
  process.env.ALLOW_PREVIEW_DB_MIGRATE === "1" &&
  Boolean(process.env.DATABASE_URL)
) {
  console.info("[vercel-db-sync] Applying expand-only schema migrations to Vercel Preview database...");
  execSync("pnpm --filter @casefolio/db db:migrate", {
    stdio: "inherit",
  });
  console.info("[vercel-db-sync] Preview schema migrations completed.");
} else {
  console.info(
    "[vercel-db-sync] Skipped automatic DB sync (production and un-flagged builds require explicit `pnpm db:migrate:remote`).",
  );
}
