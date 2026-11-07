import { execSync } from "node:child_process";

/**
 * Runs idempotent Drizzle migrations, tenancy backfill, and starter/pro template seeding
 * automatically during Vercel builds (where Root Directory is `apps/web`).
 */
if (process.env.VERCEL && process.env.DATABASE_URL) {
  console.log("[vercel-db-sync] Syncing database schema, backfill, and templates...");
  execSync("pnpm --filter @casefolio/db db:migrate && pnpm --filter @casefolio/db db:seed", {
    stdio: "inherit",
  });
  console.log("[vercel-db-sync] Database sync completed.");
}
