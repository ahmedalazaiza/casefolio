import { and, eq, inArray, isNotNull, lte } from "@casefolio/db";
import { db, dbSchema } from "@/lib/db";
import { deleteStoredObject } from "@/lib/storage/r2";

export interface PurgeExpiredRecoveryResult {
  purgedSpaces: number;
  purgedProjects: number;
  purgedObjects: number;
}

/**
 * Purges departed-member recovery spaces (`frozen_member_departed`) whose 90-day
 * `recoveryUntil` retention window has elapsed (`S11` & `N11`), including their
 * projects, DB rows, and R2/local storage blobs.
 */
export async function purgeExpiredRecoverySpaces(
  now: Date = new Date(),
): Promise<PurgeExpiredRecoveryResult> {
  const expiredSpaces = await db
    .select({
      id: dbSchema.spaces.id,
      workspaceId: dbSchema.spaces.workspaceId,
    })
    .from(dbSchema.spaces)
    .where(
      and(
        eq(dbSchema.spaces.recoveryState, "frozen_member_departed"),
        isNotNull(dbSchema.spaces.recoveryUntil),
        lte(dbSchema.spaces.recoveryUntil, now),
      ),
    )
    .limit(100);

  if (expiredSpaces.length === 0) {
    return {
      purgedSpaces: 0,
      purgedProjects: 0,
      purgedObjects: 0,
    };
  }

  const spaceIds = expiredSpaces.map((s) => s.id);
  const expiredProjects = await db
    .select({ id: dbSchema.projects.id })
    .from(dbSchema.projects)
    .where(inArray(dbSchema.projects.spaceId, spaceIds));

  const projectIds = expiredProjects.map((p) => p.id);
  let r2Keys: string[] = [];

  if (projectIds.length > 0) {
    const [assetRows, exportRows] = await Promise.all([
      db
        .select({ r2Key: dbSchema.assets.r2Key })
        .from(dbSchema.assets)
        .where(inArray(dbSchema.assets.projectId, projectIds)),
      db
        .select({ r2Key: dbSchema.exportsTable.r2Key })
        .from(dbSchema.exportsTable)
        .where(inArray(dbSchema.exportsTable.projectId, projectIds)),
    ]);

    r2Keys = [
      ...assetRows.map((a) => a.r2Key),
      ...exportRows.map((e) => e.r2Key).filter((k): k is string => Boolean(k)),
    ];
  }

  await db.transaction(async (tx) => {
    await tx.delete(dbSchema.spaces).where(inArray(dbSchema.spaces.id, spaceIds));
    await tx.insert(dbSchema.auditLogs).values({
      actorId: null,
      action: "recovery.expired_spaces_purged",
      meta: {
        purgedSpaces: spaceIds.length,
        purgedProjects: projectIds.length,
        purgedObjects: r2Keys.length,
      },
      at: now,
    });
  });

  if (r2Keys.length > 0) {
    await Promise.all(r2Keys.map((key) => deleteStoredObject(key).catch(() => undefined)));
  }

  return {
    purgedSpaces: spaceIds.length,
    purgedProjects: projectIds.length,
    purgedObjects: r2Keys.length,
  };
}

