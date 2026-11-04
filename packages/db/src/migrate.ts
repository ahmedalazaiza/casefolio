import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDbConnection, type Database } from "./client";

function resolveMigrationsFolder(): string {
  for (const candidate of [
    resolve(process.cwd(), "migrations"),
    resolve(process.cwd(), "packages/db/migrations"),
    resolve(process.cwd(), "../../packages/db/migrations"),
  ]) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return resolve(process.cwd(), "packages/db/migrations");
}

export const MIGRATIONS_FOLDER = resolveMigrationsFolder();

export async function runMigrations(dbInstance?: Database): Promise<void> {
  if (dbInstance) {
    await migrate(dbInstance, { migrationsFolder: MIGRATIONS_FOLDER });
    return;
  }

  const { db, pool } = createDbConnection();
  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await pool.end();
  }
}

const isEntrypoint =
  process.argv[1] !== undefined && process.argv[1].endsWith("migrate.ts");

if (isEntrypoint) {
  runMigrations()
    .then(() => {
      console.log("Database migrations applied cleanly.");
    })
    .catch((err: unknown) => {
      console.error("Database migration failed:", err);
      process.exit(1);
    });
}
