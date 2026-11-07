import { eq, getTableName, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  accounts,
  ALL_SCHEMA_TABLE_NAMES,
  assets,
  auditLogs,
  backfillBusinessTenancy,
  billingOperations,
  categories,
  createDbConnection,
  editLeases,
  ERD_TABLE_NAMES,
  exportsTable,
  invitations,
  memberships,
  notifications,
  organizations,
  ownerTransferRequests,
  pageViews,
  projectRevisions,
  projects,
  publishedSnapshots,
  reports,
  runMigrations,
  seatReservations,
  seedDatabase,
  sessions,
  spaces,
  subscriptions,
  SUPPORT_TABLE_NAMES,
  templates,
  templateVersions,
  usageBuckets,
  usageReservations,
  users,
  verifications,
  webhookEvents,
  workspaces,
} from "./index";

describe("@casefolio/db schema & seed (C-003)", () => {
  it("defines all 14 ERD tables and 15 business/auth/webhook support tables", () => {
    const mappedNames = [
      getTableName(users),
      getTableName(organizations),
      getTableName(memberships),
      getTableName(categories),
      getTableName(templates),
      getTableName(templateVersions),
      getTableName(projects),
      getTableName(assets),
      getTableName(exportsTable),
      getTableName(subscriptions),
      getTableName(pageViews),
      getTableName(notifications),
      getTableName(reports),
      getTableName(auditLogs),
      getTableName(sessions),
      getTableName(accounts),
      getTableName(verifications),
      getTableName(invitations),
      getTableName(webhookEvents),
      getTableName(workspaces),
      getTableName(spaces),
      getTableName(publishedSnapshots),
      getTableName(projectRevisions),
      getTableName(editLeases),
      getTableName(billingOperations),
      getTableName(seatReservations),
      getTableName(usageBuckets),
      getTableName(usageReservations),
      getTableName(ownerTransferRequests),
    ];

    expect(ERD_TABLE_NAMES).toHaveLength(14);
    expect(SUPPORT_TABLE_NAMES).toHaveLength(15);
    expect(mappedNames).toEqual([...ALL_SCHEMA_TABLE_NAMES]);
  });

  it("applies migrations, verifies all tables exist in Postgres, and seeds + backfills idempotently", async () => {
    const { db, pool } = createDbConnection();

    try {
      await runMigrations(db);
      const firstSeed = await seedDatabase(db);
      const secondSeed = await seedDatabase(db);

      expect(secondSeed).toEqual(firstSeed);

      const secondBackfill = await backfillBusinessTenancy(db);
      expect(secondBackfill.projectsLinked).toBe(0);
      expect(secondBackfill.rolesNormalized).toBe(0);

      const tableRows = await db.execute<{ table_name: string }>(sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);

      const existingTables = tableRows.rows.map((r) => r.table_name);
      for (const tableName of ALL_SCHEMA_TABLE_NAMES) {
        expect(existingTables).toContain(tableName);
      }

      const [admin] = await db
        .select()
        .from(users)
        .where(eq(users.email, "admin@casefolio.app"));
      expect(admin?.role).toBe("superadmin");

      const [orbit] = await db.select().from(templates).where(eq(templates.slug, "orbit"));
      expect(orbit?.status).toBe("published");
      expect(orbit?.currentVersionId).toBe(firstSeed.templateVersionId);
    } finally {
      await pool.end();
    }
  });
});
