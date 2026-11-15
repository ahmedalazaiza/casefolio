import { desc, eq, inArray, max, sql, type UserRole } from "@casefolio/db";
import {
  classifyAuditAction,
  DEFAULT_PLATFORM_SETTINGS,
  platformSettingsSchema,
  type AdminAuditLogItem,
  type AdminSettingsOverview,
  type AdminTeamMember,
  type PlatformSettings,
} from "@/lib/admin/settings-types";
import { db, dbSchema } from "@/lib/db";
import { sendAdminRoleChangedEmail } from "@/lib/email";
import { recordAdminAuditLog } from "@/lib/template/service";

export const PLATFORM_SETTINGS_AUDIT_ACTION = "admin.platform_settings.updated";
export const PLATFORM_SETTINGS_ROW_KEY = "platform";

export const INELIGIBLE_ADMIN_PROMOTION_ERROR =
  "Account is not eligible for administrator promotion (must exist with a verified email address).";

export async function getPlatformSettings(): Promise<PlatformSettings> {
  const [stored] = await db
    .select({ value: dbSchema.platformSettings.value })
    .from(dbSchema.platformSettings)
    .where(eq(dbSchema.platformSettings.key, PLATFORM_SETTINGS_ROW_KEY))
    .limit(1);

  if (stored) {
    const parsedStored = platformSettingsSchema.safeParse(stored.value);
    if (parsedStored.success) {
      return parsedStored.data;
    }
  }

  const [latestAudit] = await db
    .select({ meta: dbSchema.auditLogs.meta })
    .from(dbSchema.auditLogs)
    .where(eq(dbSchema.auditLogs.action, PLATFORM_SETTINGS_AUDIT_ACTION))
    .orderBy(desc(dbSchema.auditLogs.at))
    .limit(1);

  if (!latestAudit) {
    return { ...DEFAULT_PLATFORM_SETTINGS };
  }

  const parsedLegacy = platformSettingsSchema.safeParse(latestAudit.meta);
  if (!parsedLegacy.success) {
    return { ...DEFAULT_PLATFORM_SETTINGS };
  }

  return parsedLegacy.data;
}

export async function updatePlatformSettings(args: {
  actorId: string;
  actorRole: "admin" | "superadmin";
  settings: PlatformSettings;
}): Promise<{ ok: true; settings: PlatformSettings } | { ok: false; error: string }> {
  if (args.actorRole !== "superadmin") {
    return {
      ok: false,
      error: "Only a superadmin can modify platform security and availability settings.",
    };
  }

  const current = await getPlatformSettings();
  const validated = platformSettingsSchema.parse(args.settings);
  const now = new Date();

  await db
    .insert(dbSchema.platformSettings)
    .values({
      key: PLATFORM_SETTINGS_ROW_KEY,
      value: validated,
      updatedBy: args.actorId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: dbSchema.platformSettings.key,
      set: {
        value: validated,
        updatedBy: args.actorId,
        updatedAt: now,
      },
    });

  await recordAdminAuditLog(args.actorId, PLATFORM_SETTINGS_AUDIT_ACTION, {
    previous: current,
    next: validated,
    newSignupsOpen: validated.newSignupsOpen,
    requireEmailVerification: validated.requireEmailVerification,
    maintenanceMode: validated.maintenanceMode,
  });

  return { ok: true, settings: validated };
}

export async function updateAdminUserRole(args: {
  actorId: string;
  actorRole: "admin" | "superadmin";
  targetUserId: string;
  nextRole: UserRole;
}): Promise<{ ok: true; role: UserRole } | { ok: false; error: string }> {
  if (args.actorId === args.targetUserId) {
    return { ok: false, error: "You cannot change your own admin role." };
  }

  if (args.actorRole !== "superadmin") {
    return {
      ok: false,
      error: "Only a superadmin can grant or modify administrator roles.",
    };
  }

  const now = new Date();
  const txOutcome = await db.transaction(async (tx) => {
    // Lock target row + all current admin/superadmin rows to prevent concurrent last-superadmin demotion races
    const lockedRes = await tx.execute<{
      id: string;
      role: UserRole;
      email: string;
      name: string;
      email_verified: boolean;
    }>(sql`
      SELECT id, role, email, name, email_verified
      FROM users
      WHERE id = ${args.targetUserId} OR role IN ('admin', 'superadmin')
      FOR UPDATE
    `);

    const rows = lockedRes.rows;
    const target = rows.find((r) => r.id === args.targetUserId);
    if (!target) {
      return { ok: false as const, error: "User not found." };
    }

    if (target.role === args.nextRole) {
      return {
        ok: true as const,
        noop: true as const,
        role: target.role,
        target,
      };
    }

    if (
      (args.nextRole === "admin" || args.nextRole === "superadmin") &&
      !target.email_verified
    ) {
      return {
        ok: false as const,
        error: INELIGIBLE_ADMIN_PROMOTION_ERROR,
      };
    }

    const adminRows = rows.filter((r) => r.role === "admin" || r.role === "superadmin");
    const superadminRows = rows.filter((r) => r.role === "superadmin");

    if (target.role === "superadmin" && args.nextRole !== "superadmin" && superadminRows.length <= 1) {
      return {
        ok: false as const,
        error: "Cannot demote or remove the last superadmin.",
      };
    }

    if (
      (target.role === "admin" || target.role === "superadmin") &&
      args.nextRole === "user" &&
      adminRows.length <= 1
    ) {
      return {
        ok: false as const,
        error: "Cannot remove the last administrator.",
      };
    }

    await tx
      .update(dbSchema.users)
      .set({
        role: args.nextRole,
        updatedAt: now,
      })
      .where(eq(dbSchema.users.id, target.id));

    // Immediately revoke all existing sessions on privilege change so demotions/promotions take effect instantly
    await tx.delete(dbSchema.sessions).where(eq(dbSchema.sessions.userId, target.id));

    return {
      ok: true as const,
      noop: false as const,
      role: args.nextRole,
      target,
    };
  });

  if (!txOutcome.ok) {
    return { ok: false, error: txOutcome.error };
  }

  if (txOutcome.noop) {
    return { ok: true, role: txOutcome.role };
  }

  await recordAdminAuditLog(args.actorId, "admin.role.updated", {
    targetUserId: txOutcome.target.id,
    previousRole: txOutcome.target.role,
    nextRole: args.nextRole,
  });

  await sendAdminRoleChangedEmail({
    to: txOutcome.target.email,
    name: txOutcome.target.name,
    previousRole: txOutcome.target.role,
    nextRole: args.nextRole,
  }).catch(() => undefined);

  return { ok: true, role: args.nextRole };
}

export async function promoteAdminByEmail(args: {
  actorId: string;
  actorRole: "admin" | "superadmin";
  email: string;
  role: "admin" | "superadmin";
}): Promise<{ ok: true; userId: string; role: UserRole } | { ok: false; error: string }> {
  if (args.actorRole !== "superadmin") {
    return {
      ok: false,
      error: "Only a superadmin can grant administrator roles.",
    };
  }

  const normalizedEmail = args.email.trim().toLowerCase();
  const [target] = await db
    .select({
      id: dbSchema.users.id,
      emailVerified: dbSchema.users.emailVerified,
    })
    .from(dbSchema.users)
    .where(sql`lower(${dbSchema.users.email}) = ${normalizedEmail}`)
    .limit(1);

  if (!target || !target.emailVerified) {
    return {
      ok: false,
      error: INELIGIBLE_ADMIN_PROMOTION_ERROR,
    };
  }

  const res = await updateAdminUserRole({
    actorId: args.actorId,
    actorRole: args.actorRole,
    targetUserId: target.id,
    nextRole: args.role,
  });

  if (!res.ok) {
    return res;
  }

  return { ok: true, userId: target.id, role: res.role };
}

export async function listAdminTeamMembers(): Promise<AdminTeamMember[]> {
  const adminRows = await db
    .select()
    .from(dbSchema.users)
    .where(inArray(dbSchema.users.role, ["admin", "superadmin"]))
    .orderBy(desc(dbSchema.users.createdAt));

  if (adminRows.length === 0) {
    return [];
  }

  const adminIds = adminRows.map((u) => u.id);
  const sessionRows = await db
    .select({
      userId: dbSchema.sessions.userId,
      lastUpdatedAt: max(dbSchema.sessions.updatedAt),
    })
    .from(dbSchema.sessions)
    .where(inArray(dbSchema.sessions.userId, adminIds))
    .groupBy(dbSchema.sessions.userId);

  const latestSessionMs = new Map<string, number>();
  for (const s of sessionRows) {
    if (s.lastUpdatedAt) {
      latestSessionMs.set(s.userId, new Date(s.lastUpdatedAt).getTime());
    }
  }

  return adminRows
    .map((u) => {
      const activeMs = Math.max(u.updatedAt.getTime(), latestSessionMs.get(u.id) ?? 0);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: (u.role === "superadmin" ? "superadmin" : "admin") as "admin" | "superadmin",
        emailVerified: u.emailVerified,
        lastActiveIso: new Date(activeMs).toISOString(),
      };
    })
    .sort((a, b) => {
      if (a.role === "superadmin" && b.role !== "superadmin") return -1;
      if (b.role === "superadmin" && a.role !== "superadmin") return 1;
      return a.name.localeCompare(b.name);
    });
}

export async function listAdminAuditLogs(
  optionsOrLimit: number | { limit?: number; offset?: number } = 200,
): Promise<AdminAuditLogItem[]> {
  const rawLimit = typeof optionsOrLimit === "number" ? optionsOrLimit : (optionsOrLimit.limit ?? 200);
  const rawOffset = typeof optionsOrLimit === "number" ? 0 : (optionsOrLimit.offset ?? 0);
  const safeLimit = Math.max(1, Math.min(500, Math.trunc(rawLimit)));
  const safeOffset = Math.max(0, Math.trunc(rawOffset));

  const rows = await db
    .select({
      log: dbSchema.auditLogs,
      actor: {
        id: dbSchema.users.id,
        name: dbSchema.users.name,
        role: dbSchema.users.role,
      },
    })
    .from(dbSchema.auditLogs)
    .leftJoin(dbSchema.users, eq(dbSchema.auditLogs.actorId, dbSchema.users.id))
    .orderBy(desc(dbSchema.auditLogs.at))
    .limit(safeLimit)
    .offset(safeOffset);

  return rows.map((row) => ({
    id: row.log.id,
    actorId: row.log.actorId,
    actorName: row.actor?.name ?? "System",
    actorRole: row.actor?.role ?? "system",
    action: row.log.action,
    category: classifyAuditAction(row.log.action),
    meta: row.log.meta ?? {},
    atIso: row.log.at.toISOString(),
  }));
}

export async function getAdminSettingsOverview(): Promise<AdminSettingsOverview> {
  const [team, platform, auditLogs] = await Promise.all([
    listAdminTeamMembers(),
    getPlatformSettings(),
    listAdminAuditLogs(200),
  ]);

  return {
    team,
    platform,
    auditLogs,
  };
}
