import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { backfillBusinessTenancy } from "./backfill";
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

function isDuplicateSchemaObjectError(err: unknown): boolean {
  const codes = new Set(["42P07", "42701", "42710"]);
  let current: unknown = err;
  for (let depth = 0; depth < 6 && current && typeof current === "object"; depth += 1) {
    const rec = current as { code?: unknown; message?: unknown; cause?: unknown };
    if (typeof rec.code === "string" && codes.has(rec.code)) return true;
    if (typeof rec.message === "string" && /already exists/i.test(rec.message)) return true;
    current = rec.cause;
  }
  return false;
}

async function applySqlMigrationsIdempotently(db: Database): Promise<void> {
  if (!existsSync(MIGRATIONS_FOLDER)) return;

  const sqlFiles = readdirSync(MIGRATIONS_FOLDER)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const fileName of sqlFiles) {
    const rawSql = readFileSync(resolve(MIGRATIONS_FOLDER, fileName), "utf-8");
    const statements = rawSql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      try {
        await db.execute(sql.raw(stmt));
      } catch (err) {
        if (isDuplicateSchemaObjectError(err)) {
          continue;
        }
        throw err;
      }
    }
  }
}

export async function runMigrations(dbInstance?: Database): Promise<void> {
  const execute = async (db: Database) => {
    try {
      await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    } catch (err) {
      if (isDuplicateSchemaObjectError(err)) {
        // Reconcile statement-by-statement when baseline tables were initialized via drizzle-kit push
        await applySqlMigrationsIdempotently(db);
      } else {
        throw err;
      }
    }
    await backfillBusinessTenancy(db);
  };

  if (dbInstance) {
    await execute(dbInstance);
    return;
  }

  const { db, pool } = createDbConnection();
  try {
    await execute(db);
  } finally {
    await pool.end();
  }
}

const isEntrypoint =
  process.argv[1] !== undefined && process.argv[1].endsWith("migrate.ts");

if (isEntrypoint) {
  runMigrations()
    .then(() => {
      console.log("Database migrations and tenancy backfill applied cleanly.");
    })
    .catch((err: unknown) => {
      console.error("Database migration failed:", err);
      process.exit(1);
    });
}
