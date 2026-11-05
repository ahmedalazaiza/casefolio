import { desc, eq, ilike, inArray, type UserRole } from "@casefolio/db";
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
import { recordAdminAuditLog } from "@/lib/template/service";

export const PLATFORM_SETTINGS_AUDIT_ACTION = "admin.platform_settings.updated";

export async function getPlatformSettings(): Promise<PlatformSettings> {
  const [latest] = await db
    .select({ meta: dbSchema.auditLogs.meta })
    .from(dbSchema.auditLogs)
    .where(eq(dbSchema.auditLogs.action, PLATFORM_SETTINGS_AUDIT_ACTION))
    .orderBy(desc(dbSchema.auditLogs.at))
    .limit(1);

  if (!latest) {
    return { ...DEFAULT_PLATFORM_SETTINGS };
  }

  const parsed = platformSettingsSchema.safeParse(latest.meta);
  if (!parsed.success) {
    return { ...DEFAULT_PLATFORM_SETTINGS };
  }

  return parsed.data;
}

export async function updatePlatformSettings(args: {
  actorId: string;
  actorRole: "admin" | "superadmin";
  settings: PlatformSettings;
}): Promise<{ ok: true; settings: PlatformSettings } | { ok: false; error: string }> {
  const current = await getPlatformSettings();

  if (current.maintenanceMode !== args.settings.maintenanceMode && args.actorRole !== "superadmin") {
    return {
      ok: false,
      error: "Only a superadmin can toggle platform maintenance mode.",
    };
  }

  const validated = platformSettingsSchema.parse(args.settings);
  await recordAdminAuditLog(args.actorId, PLATFORM_SETTINGS_AUDIT_ACTION, {
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

  const [target] = await db
    .select()
    .from(dbSchema.users)
    .where(eq(dbSchema.users.id, args.targetUserId))
    .limit(1);

  if (!target) {
    return { ok: false, error: "User not found." };
  }

  if (
    (target.role === "superadmin" || args.nextRole === "superadmin") &&
    args.actorRole !== "superadmin"
  ) {
    return {
      ok: false,
      error: "Only a superadmin can grant or modify superadmin privileges.",
    };
  }

  if (target.role === args.nextRole) {
    return { ok: true, role: target.role };
  }

  // Ensure we never demote the last admin/superadmin
  if (
    (target.role === "admin" || target.role === "superadmin") &&
    args.nextRole === "user"
  ) {
    const admins = await db
      .select({ id: dbSchema.users.id })
      .from(dbSchema.users)
      .where(inArray(dbSchema.users.role, ["admin", "superadmin"]));

    if (admins.length <= 1) {
      return {
        ok: false,
        error: "Cannot remove the last administrator.",
      };
    }
  }

  await db
    .update(dbSchema.users)
    .set({
      role: args.nextRole,
      updatedAt: new Date(),
    })
    .where(eq(dbSchema.users.id, target.id));

  await recordAdminAuditLog(args.actorId, "admin.role.updated", {
    targetUserId: target.id,
    previousRole: target.role,
    nextRole: args.nextRole,
  });

  return { ok: true, role: args.nextRole };
}

export async function promoteAdminByEmail(args: {
  actorId: string;
  actorRole: "admin" | "superadmin";
  email: string;
  role: "admin" | "superadmin";
}): Promise<{ ok: true; userId: string; role: UserRole } | { ok: false; error: string }> {
  const normalizedEmail = args.email.trim().toLowerCase();
  const [target] = await db
    .select()
    .from(dbSchema.users)
    .where(ilike(dbSchema.users.email, normalizedEmail))
    .limit(1);

  if (!target) {
    return {
      ok: false,
      error: "No Casefolio account found with that email address.",
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
  const [adminRows, sessionRows] = await Promise.all([
    db
      .select()
      .from(dbSchema.users)
      .where(inArray(dbSchema.users.role, ["admin", "superadmin"]))
      .orderBy(desc(dbSchema.users.createdAt)),
    db
      .select({
        userId: dbSchema.sessions.userId,
        updatedAt: dbSchema.sessions.updatedAt,
      })
      .from(dbSchema.sessions),
  ]);

  const latestSessionMs = new Map<string, number>();
  for (const s of sessionRows) {
    const prev = latestSessionMs.get(s.userId) ?? 0;
    if (s.updatedAt.getTime() > prev) {
      latestSessionMs.set(s.userId, s.updatedAt.getTime());
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

export async function listAdminAuditLogs(limit = 200): Promise<AdminAuditLogItem[]> {
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
    .limit(limit);

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
