import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { loadWorkspaceEnv } from "./env-loader";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

export function createDbConnection(connectionString?: string): {
  db: Database;
  pool: Pool;
} {
  loadWorkspaceEnv();
  const url = connectionString ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required to initialize the PostgreSQL connection.");
  }

  const pool = new Pool({ connectionString: url });
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
