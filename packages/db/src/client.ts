import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { loadWorkspaceEnv } from "./env-loader";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

export interface DbPoolOptions {
  /** Max connections for this process. Serverless (Vercel) defaults to a small pool to protect Postgres. */
  max?: number;
}

function resolvePoolMax(explicit?: number): number {
  if (explicit && explicit > 0) return explicit;
  const fromEnv = Number.parseInt(process.env.DB_POOL_MAX ?? "", 10);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  // One serverless instance serves one request at a time; many instances multiply connections.
  return process.env.VERCEL ? 3 : 10;
}

export function createDbConnection(connectionString?: string, options: DbPoolOptions = {}): {
  db: Database;
  pool: Pool;
} {
  loadWorkspaceEnv();
  const url = connectionString ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required to initialize the PostgreSQL connection.");
  }

  const pool = new Pool({
    connectionString: url,
    max: resolvePoolMax(options.max),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: true,
  });
  const db = drizzle(pool, { schema });
  return { db, pool };
}

let sharedConnection: { db: Database; pool: Pool } | null = null;

export function getDb(): Database {
  if (!sharedConnection) {
    sharedConnection = createDbConnection();
  }
  return sharedConnection.db;
}

export async function closeSharedDb(): Promise<void> {
  if (sharedConnection) {
    await sharedConnection.pool.end();
    sharedConnection = null;
  }
}

