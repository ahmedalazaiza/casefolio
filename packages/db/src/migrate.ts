import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDbConnection, type Database } from "./client";

const currentDir = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_FOLDER = resolve(currentDir, "../migrations");

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
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

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
