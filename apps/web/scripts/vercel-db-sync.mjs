import { execSync } from "node:child_process";

/**
 * Expand-only Drizzle schema migration runner for Vercel deployments (`B3` / `S8` compliant):
 * - NEVER runs `db:seed`.
 * - Runs idempotent Drizzle schema migrations (`0000..0007`) on Vercel Preview & Production when `DATABASE_URL` is present
 *   (unless `SKIP_VERCEL_DB_MIGRATE=1` is explicitly set).
 */
if (
  process.env.VERCEL === "1" &&
  process.env.SKIP_VERCEL_DB_MIGRATE !== "1" &&
  Boolean(process.env.DATABASE_URL)
) {
  console.info(
    `[vercel-db-sync] Applying expand-only schema migrations to Vercel (${process.env.VERCEL_ENV ?? "unknown"}) database...`,
  );
  execSync("pnpm --filter @casefolio/db db:migrate", {
    stdio: "inherit",
  });
  console.info("[vercel-db-sync] Schema migrations completed.");
} else {
  console.info("[vercel-db-sync] Skipped automatic DB sync.");
}
