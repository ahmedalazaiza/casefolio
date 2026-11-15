// @vitest-environment node
import { eq, inArray } from "@casefolio/db";
import { afterAll, describe, expect, it } from "vitest";
import {
  getAdminSettingsOverview,
  getPlatformSettings,
  INELIGIBLE_ADMIN_PROMOTION_ERROR,
  listAdminAuditLogs,
  PLATFORM_SETTINGS_ROW_KEY,
  promoteAdminByEmail,
  updateAdminUserRole,
  updatePlatformSettings,
} from "@/lib/admin/settings";
import {
  checkPlatformAuthGate,
  DEFAULT_PLATFORM_SETTINGS,
  filterAuditLogs,
  serializeAuditLogsCsv,
} from "@/lib/admin/settings-types";
import { db, dbSchema } from "@/lib/db";

const createdUserIds: string[] = [];

afterAll(async () => {
  await db
    .update(dbSchema.platformSettings)
    .set({ value: DEFAULT_PLATFORM_SETTINGS, updatedBy: null, updatedAt: new Date() })
    .where(eq(dbSchema.platformSettings.key, PLATFORM_SETTINGS_ROW_KEY))
    .catch(() => undefined);

  if (createdUserIds.length > 0) {
    await db
      .delete(dbSchema.auditLogs)
      .where(inArray(dbSchema.auditLogs.actorId, createdUserIds));
    await db
      .delete(dbSchema.sessions)
      .where(inArray(dbSchema.sessions.userId, createdUserIds));
    await db.delete(dbSchema.users).where(inArray(dbSchema.users.id, createdUserIds));
  }
});

describe("Admin settings, roles & audit log service (C-906 + N3/N4)", () => {
  it("enforces superadmin-only role & platform mutations, persists platform_settings, blocks unverified promotion without enumeration, and revokes sessions on role change", async () => {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;

    const [superAdmin] = await db
      .insert(dbSchema.users)
      .values({
        email: `c906-super-${suffix}@casefolio.test`,
        name: "C906 Superadmin",
        role: "superadmin",
        emailVerified: true,
      })
      .returning();

    const [regularAdmin] = await db
      .insert(dbSchema.users)
      .values({
        email: `c906-admin-${suffix}@casefolio.test`,
        name: "C906 Admin",
        role: "admin",
        emailVerified: true,
      })
      .returning();

    const [candidateUser] = await db
      .insert(dbSchema.users)
      .values({
        email: `c906-candidate-${suffix}@casefolio.test`,
        name: "C906 Candidate",
        role: "user",
        emailVerified: true,
      })
      .returning();

    const [unverifiedUser] = await db
      .insert(dbSchema.users)
      .values({
        email: `c906-unverified-${suffix}@casefolio.test`,
        name: "C906 Unverified",
        role: "user",
        emailVerified: false,
      })
      .returning();

    if (!superAdmin || !regularAdmin || !candidateUser || !unverifiedUser) {
      throw new Error("Failed to seed C-906 test users");
    }
    createdUserIds.push(superAdmin.id, regularAdmin.id, candidateUser.id, unverifiedUser.id);

    // 1. Self-demotion guard
    const selfChange = await updateAdminUserRole({
      actorId: superAdmin.id,
      actorRole: "superadmin",
      targetUserId: superAdmin.id,
      nextRole: "user",
    });
    expect(selfChange.ok).toBe(false);

    // 2. Non-superadmin cannot grant or modify any admin/superadmin roles (N4)
    const unauthorizedPromote = await promoteAdminByEmail({
      actorId: regularAdmin.id,
      actorRole: "admin",
      email: candidateUser.email,
      role: "admin",
    });
    expect(unauthorizedPromote.ok).toBe(false);

    const modifySuperByAdmin = await updateAdminUserRole({
      actorId: regularAdmin.id,
      actorRole: "admin",
      targetUserId: superAdmin.id,
      nextRole: "admin",
    });
    expect(modifySuperByAdmin.ok).toBe(false);

    // 3. Unverified or nonexistent account returns identical non-enumerating error (N4)
    const unverifiedPromote = await promoteAdminByEmail({
      actorId: superAdmin.id,
      actorRole: "superadmin",
      email: unverifiedUser.email,
      role: "admin",
    });
    const missingPromote = await promoteAdminByEmail({
      actorId: superAdmin.id,
      actorRole: "superadmin",
      email: `missing-${suffix}@casefolio.test`,
      role: "admin",
    });
    expect(unverifiedPromote).toEqual({ ok: false, error: INELIGIBLE_ADMIN_PROMOTION_ERROR });
    expect(missingPromote).toEqual({ ok: false, error: INELIGIBLE_ADMIN_PROMOTION_ERROR });

    // 4. Superadmin promotes verified candidate -> admin, then -> superadmin, then demotes -> user (revoking sessions)
    const promoted = await promoteAdminByEmail({
      actorId: superAdmin.id,
      actorRole: "superadmin",
      email: candidateUser.email,
      role: "admin",
    });
    expect(promoted).toEqual({ ok: true, userId: candidateUser.id, role: "admin" });

    // Seed an active session for candidateUser and verify role change revokes it immediately
    await db.insert(dbSchema.sessions).values({
      userId: candidateUser.id,
      token: `c906-session-${suffix}`,
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    const elevated = await updateAdminUserRole({
      actorId: superAdmin.id,
      actorRole: "superadmin",
      targetUserId: candidateUser.id,
      nextRole: "superadmin",
    });
    expect(elevated).toEqual({ ok: true, role: "superadmin" });

    const sessionsAfterRoleChange = await db
      .select({ id: dbSchema.sessions.id })
      .from(dbSchema.sessions)
      .where(eq(dbSchema.sessions.userId, candidateUser.id));
    expect(sessionsAfterRoleChange).toHaveLength(0);

    const demoted = await updateAdminUserRole({
      actorId: superAdmin.id,
      actorRole: "superadmin",
      targetUserId: candidateUser.id,
      nextRole: "user",
    });
    expect(demoted).toEqual({ ok: true, role: "user" });

    // 5. Platform feature flags (N3): regular admin CANNOT weaken requireEmailVerification or toggle maintenanceMode
    const deniedAdminPlatform = await updatePlatformSettings({
      actorId: regularAdmin.id,
      actorRole: "admin",
      settings: {
        newSignupsOpen: true,
        requireEmailVerification: false,
        maintenanceMode: false,
      },
    });
    expect(deniedAdminPlatform.ok).toBe(false);

    // Superadmin updates platform_settings table and records previous + next in audit_logs
    const updatedPlatform = await updatePlatformSettings({
      actorId: superAdmin.id,
      actorRole: "superadmin",
      settings: {
        newSignupsOpen: true,
        requireEmailVerification: false,
        maintenanceMode: false,
      },
    });
    expect(updatedPlatform.ok).toBe(true);

    const [storedPlatformRow] = await db
      .select()
      .from(dbSchema.platformSettings)
      .where(eq(dbSchema.platformSettings.key, PLATFORM_SETTINGS_ROW_KEY))
      .limit(1);
    expect(storedPlatformRow?.value).toMatchObject({ requireEmailVerification: false });

    const readBack = await getPlatformSettings();
    expect(readBack.requireEmailVerification).toBe(false);

    // Restore default platform settings
    await updatePlatformSettings({
      actorId: superAdmin.id,
      actorRole: "superadmin",
      settings: DEFAULT_PLATFORM_SETTINGS,
    });

    // 6. Verify checkPlatformAuthGate enforces closed sign-ups and maintenance mode
    expect(
      checkPlatformAuthGate({
        path: "/sign-up/email",
        platform: {
          newSignupsOpen: false,
          requireEmailVerification: true,
          maintenanceMode: false,
        },
      }),
    ).toEqual({
      allowed: false,
      message: "New sign-ups are currently closed.",
    });

    expect(
      checkPlatformAuthGate({
        path: "/sign-in/email",
        platform: {
          newSignupsOpen: true,
          requireEmailVerification: true,
          maintenanceMode: true,
        },
        targetUserRole: "user",
      }).allowed,
    ).toBe(false);

    expect(
      checkPlatformAuthGate({
        path: "/sign-in/email",
        platform: {
          newSignupsOpen: true,
          requireEmailVerification: true,
          maintenanceMode: true,
        },
        targetUserRole: "superadmin",
      }).allowed,
    ).toBe(true);

    // 7. Verify every mutation appears in listAdminAuditLogs & getAdminSettingsOverview
    const overview = await getAdminSettingsOverview();
    expect(overview.team.some((m) => m.id === superAdmin.id)).toBe(true);

    const auditLogs = await listAdminAuditLogs({ limit: 100, offset: 0 });
    const ourLogs = auditLogs.filter((l) => l.actorId === superAdmin.id);
    const actions = ourLogs.map((l) => l.action);
    expect(actions).toContain("admin.role.updated");
    expect(actions).toContain("admin.platform_settings.updated");

    const platLog = ourLogs.find((l) => l.action === "admin.platform_settings.updated");
    expect(platLog?.meta).toHaveProperty("previous");
    expect(platLog?.meta).toHaveProperty("next");

    const filteredSettings = filterAuditLogs(ourLogs, {
      category: "settings",
      searchQuery: "role",
    });
    expect(filteredSettings.length).toBeGreaterThanOrEqual(1);

    const csv = serializeAuditLogsCsv(filteredSettings);
    expect(csv).toContain("admin.role.updated");
  });
});
