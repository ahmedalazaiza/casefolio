import * as dbSchema from "@casefolio/db";
import { createDbConnection, type Database } from "@casefolio/db";
import { env } from "@/env";

const globalForDb = globalThis as unknown as {
  casefolioDb?: Database;
};

export const db: Database =
  globalForDb.casefolioDb ?? createDbConnection(env.DATABASE_URL).db;

if (process.env.NODE_ENV !== "production") {
  globalForDb.casefolioDb = db;
}

export { dbSchema };
