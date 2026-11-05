// @vitest-environment node
import { inArray } from "@casefolio/db";
import { afterAll, describe, expect, it } from "vitest";
import {
  getAdminSettingsOverview,
  getPlatformSettings,
  listAdminAuditLogs,
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
  if (createdUserIds.length > 0) {
    await db
      .delete(dbSchema.auditLogs)
      .where(inArray(dbSchema.auditLogs.actorId, createdUserIds));
    await db.delete(dbSchema.users).where(inArray(dbSchema.users.id, createdUserIds));
  }
});

describe("Admin settings, roles & audit log service (C-906)", () => {
  it("manages admin/superadmin roles with safety guards, persists platform feature flags, and records every admin mutation in audit_logs", async () => {
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

    if (!superAdmin || !regularAdmin || !candidateUser) {
      throw new Error("Failed to seed C-906 test users");
    }
    createdUserIds.push(superAdmin.id, regularAdmin.id, candidateUser.id);

    // 1. Self-demotion guard
    const selfChange = await updateAdminUserRole({
      actorId: superAdmin.id,
      actorRole: "superadmin",
      targetUserId: superAdmin.id,
      nextRole: "user",
    });
    expect(selfChange.ok).toBe(false);

    // 2. Non-superadmin cannot grant or modify superadmin
    const unauthorizedSuper = await updateAdminUserRole({
      actorId: regularAdmin.id,
      actorRole: "admin",
      targetUserId: candidateUser.id,
      nextRole: "superadmin",
    });
    expect(unauthorizedSuper.ok).toBe(false);

    const modifySuperByAdmin = await updateAdminUserRole({
      actorId: regularAdmin.id,
      actorRole: "admin",
      targetUserId: superAdmin.id,
      nextRole: "admin",
    });
    expect(modifySuperByAdmin.ok).toBe(false);

    // 3. Promote candidate by email -> admin, then superadmin -> superadmin, then demote -> user
    const promoted = await promoteAdminByEmail({
      actorId: regularAdmin.id,
      actorRole: "admin",
      email: candidateUser.email,
      role: "admin",
    });
    expect(promoted).toEqual({ ok: true, userId: candidateUser.id, role: "admin" });

    const elevated = await updateAdminUserRole({
      actorId: superAdmin.id,
      actorRole: "superadmin",
      targetUserId: candidateUser.id,
      nextRole: "superadmin",
    });
    expect(elevated).toEqual({ ok: true, role: "superadmin" });

    const demoted = await updateAdminUserRole({
      actorId: superAdmin.id,
      actorRole: "superadmin",
      targetUserId: candidateUser.id,
      nextRole: "user",
    });
    expect(demoted).toEqual({ ok: true, role: "user" });

    // 4. Platform feature flags: non-superadmin cannot toggle maintenanceMode
    const deniedMaint = await updatePlatformSettings({
      actorId: regularAdmin.id,
      actorRole: "admin",
      settings: {
        newSignupsOpen: true,
        requireEmailVerification: true,
        maintenanceMode: true,
      },
    });
    expect(deniedMaint.ok).toBe(false);

    // Update requireEmailVerification safely (keeping newSignupsOpen: true for parallel test workers)
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

    const readBack = await getPlatformSettings();
    expect(readBack.requireEmailVerification).toBe(false);

    // Restore default platform settings
    await updatePlatformSettings({
      actorId: superAdmin.id,
      actorRole: "superadmin",
      settings: DEFAULT_PLATFORM_SETTINGS,
    });

    // 5. Verify checkPlatformAuthGate enforces closed sign-ups and maintenance mode
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

    // 6. Verify every mutation appears in listAdminAuditLogs & getAdminSettingsOverview
    const overview = await getAdminSettingsOverview();
    expect(overview.team.some((m) => m.id === superAdmin.id)).toBe(true);

    const auditLogs = await listAdminAuditLogs(100);
    const ourLogs = auditLogs.filter(
      (l) => l.actorId === superAdmin.id || l.actorId === regularAdmin.id,
    );
    const actions = ourLogs.map((l) => l.action);
    expect(actions).toContain("admin.role.updated");
    expect(actions).toContain("admin.platform_settings.updated");

    const filteredSettings = filterAuditLogs(ourLogs, {
      category: "settings",
      searchQuery: "role",
    });
    expect(filteredSettings.length).toBeGreaterThanOrEqual(1);

    const csv = serializeAuditLogsCsv(filteredSettings);
    expect(csv).toContain("admin.role.updated");
  });
});
