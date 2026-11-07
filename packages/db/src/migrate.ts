import { existsSync, readFileSync } from "node:fs";
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
  if (!err || typeof err !== "object") return false;
  const record = err as { code?: unknown; cause?: unknown };
  const codes = new Set(["42P07", "42701", "42710"]);
  if (typeof record.code === "string" && codes.has(record.code)) return true;
  if (record.cause && typeof record.cause === "object") {
    const causeCode = (record.cause as { code?: unknown }).code;
    if (typeof causeCode === "string" && codes.has(causeCode)) return true;
  }
  return false;
}

async function applyIncrementalStatementsIdempotently(db: Database): Promise<void> {
  const migration0001 = resolve(MIGRATIONS_FOLDER, "0001_luxuriant_talisman.sql");
  if (!existsSync(migration0001)) return;

  const rawSql = readFileSync(migration0001, "utf-8");
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

export async function runMigrations(dbInstance?: Database): Promise<void> {
  const execute = async (db: Database) => {
    try {
      await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    } catch (err) {
      if (isDuplicateSchemaObjectError(err)) {
        // Fallback when base tables already existed via `drizzle-kit push` prior to migration journal tracking
        await applyIncrementalStatementsIdempotently(db);
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
