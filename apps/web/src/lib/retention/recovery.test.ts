// @vitest-environment node
import { randomUUID } from "node:crypto";
import { eq } from "@casefolio/db";
import { afterEach, describe, expect, it } from "vitest";
import { db, dbSchema } from "@/lib/db";
import { purgeExpiredRecoverySpaces } from "@/lib/retention/recovery";
import { authorizeSpaceAccess } from "@/lib/workspaces/acl";
import { listRecoverySpacesForUser } from "@/lib/workspaces/service";

const createdUserIds: string[] = [];
const createdOrgIds: string[] = [];

afterEach(async () => {
  for (const orgId of createdOrgIds.splice(0, createdOrgIds.length)) {
    await db.delete(dbSchema.organizations).where(eq(dbSchema.organizations.id, orgId)).catch(() => undefined);
  }
  for (const userId of createdUserIds.splice(0, createdUserIds.length)) {
    await db.delete(dbSchema.users).where(eq(dbSchema.users.id, userId)).catch(() => undefined);
  }
});

describe("Recovery vault 90-day retention enforcement & purge (S11, N11)", () => {
  it("denies access after recoveryUntil and purges expired recovery spaces while keeping active ones", async () => {
    const now = new Date("2026-11-15T12:00:00.000Z");
    const [departedUser] = await db
      .insert(dbSchema.users)
      .values({
        email: `rec-${randomUUID()}@example.com`,
        emailVerified: true,
        name: "Departed Member",
      })
      .returning();
    createdUserIds.push(departedUser!.id);

    const [org] = await db
      .insert(dbSchema.organizations)
      .values({
        name: "Recovery Test Studio",
        slug: `rec-studio-${randomUUID().slice(0, 8)}`,
        seats: 3,
      })
      .returning();
    createdOrgIds.push(org!.id);

    const [ws] = await db
      .insert(dbSchema.workspaces)
      .values({
        kind: "team",
        organizationId: org!.id,
        name: org!.name,
        slug: org!.slug,
      })
      .returning();

    const [expiredSpace] = await db
      .insert(dbSchema.spaces)
      .values({
        workspaceId: ws!.id,
        name: "Expired Private Drafts",
        slug: `exp-${randomUUID().slice(0, 6)}`,
        visibility: "private",
        controllerUserId: departedUser!.id,
        recoveryState: "frozen_member_departed",
        departedAt: new Date("2026-08-01T12:00:00.000Z"),
        recoveryUntil: new Date("2026-10-30T12:00:00.000Z"),
      })
      .returning();

    const [activeRecoverySpace] = await db
      .insert(dbSchema.spaces)
      .values({
        workspaceId: ws!.id,
        name: "Active Recovery Drafts",
        slug: `act-${randomUUID().slice(0, 6)}`,
        visibility: "private",
        controllerUserId: departedUser!.id,
        recoveryState: "frozen_member_departed",
        departedAt: new Date("2026-11-01T12:00:00.000Z"),
        recoveryUntil: new Date("2027-01-30T12:00:00.000Z"),
      })
      .returning();

    // S11: Expired recovery space returns 404 even to controllerUserId
    const expiredAcl = await authorizeSpaceAccess(
      expiredSpace!.id,
      departedUser!.id,
      "read",
      now,
    );
    expect(expiredAcl).toMatchObject({
      ok: false,
      status: 404,
      code: "NOT_FOUND",
    });

    // Unexpired recovery space remains readable by controllerUserId
    const activeAcl = await authorizeSpaceAccess(
      activeRecoverySpace!.id,
      departedUser!.id,
      "read",
      now,
    );
    expect(activeAcl.ok).toBe(true);

    const listedBeforePurge = await listRecoverySpacesForUser(departedUser!.id, now);
    expect(listedBeforePurge.map((b) => b.spaceId)).toEqual([activeRecoverySpace!.id]);

    // N11: Scheduled purge deletes expired space and preserves unexpired recovery space
    const purged = await purgeExpiredRecoverySpaces(now);
    expect(purged.purgedSpaces).toBeGreaterThanOrEqual(1);

    const [expiredCheck] = await db
      .select({ id: dbSchema.spaces.id })
      .from(dbSchema.spaces)
      .where(eq(dbSchema.spaces.id, expiredSpace!.id));
    expect(expiredCheck).toBeUndefined();

    const [activeCheck] = await db
      .select({ id: dbSchema.spaces.id })
      .from(dbSchema.spaces)
      .where(eq(dbSchema.spaces.id, activeRecoverySpace!.id));
    expect(activeCheck?.id).toBe(activeRecoverySpace!.id);
  });
});

