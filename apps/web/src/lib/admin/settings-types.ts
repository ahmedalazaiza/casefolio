import type { UserRole } from "@casefolio/db";
import { z } from "zod";

export const ADMIN_SETTINGS_TABS = ["team", "permissions", "platform", "audit"] as const;
export type AdminSettingsTab = (typeof ADMIN_SETTINGS_TABS)[number];

export const AUDIT_ACTION_CATEGORIES = [
  "all",
  "templates",
  "categories",
  "users",
  "moderation",
  "settings",
] as const;
export type AuditActionCategory = (typeof AUDIT_ACTION_CATEGORIES)[number];

export const platformSettingsSchema = z.object({
  newSignupsOpen: z.boolean(),
  requireEmailVerification: z.boolean(),
  maintenanceMode: z.boolean(),
});

export type PlatformSettings = z.infer<typeof platformSettingsSchema>;

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  newSignupsOpen: true,
  requireEmailVerification: true,
  maintenanceMode: false,
};

export function checkPlatformAuthGate(args: {
  path: string;
  platform: PlatformSettings;
  targetUserRole?: UserRole | null;
}): { allowed: true } | { allowed: false; message: string } {
  if (args.path === "/sign-up/email") {
    if (args.platform.maintenanceMode) {
      return {
        allowed: false,
        message: "Casefolio is currently in maintenance mode. Please try again shortly.",
      };
    }
    if (!args.platform.newSignupsOpen) {
      return {
        allowed: false,
        message: "New sign-ups are currently closed.",
      };
    }
  }

  const signInPaths = new Set([
    "/sign-in/email",
    "/sign-in/magic-link",
    "/sign-in/email-otp",
    "/email-otp/send-verification-otp",
  ]);

  if (
    signInPaths.has(args.path) &&
    args.platform.maintenanceMode &&
    args.targetUserRole &&
    args.targetUserRole !== "admin" &&
    args.targetUserRole !== "superadmin"
  ) {
    return {
      allowed: false,
      message: "Casefolio is currently in maintenance mode. Please try again shortly.",
    };
  }

  return { allowed: true };
}

export const adminSettingsPatchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update_role"),
    userId: z.string().uuid("Invalid user ID."),
    role: z.enum(["user", "admin", "superadmin"]),
  }),
  z.object({
    action: z.literal("promote_by_email"),
    email: z.string().trim().email("Enter a valid email address."),
    role: z.enum(["admin", "superadmin"]),
  }),
  z.object({
    action: z.literal("update_platform"),
    settings: platformSettingsSchema,
  }),
]);

export interface AdminTeamMember {
  id: string;
  name: string;
  email: string;
  role: "admin" | "superadmin";
  emailVerified: boolean;
  lastActiveIso: string;
}

export interface AdminAuditLogItem {
  id: string;
  actorId: string | null;
  actorName: string;
  actorRole: UserRole | "system";
  action: string;
  category: Exclude<AuditActionCategory, "all">;
  meta: Record<string, unknown>;
  atIso: string;
}

export interface AdminSettingsOverview {
  team: AdminTeamMember[];
  platform: PlatformSettings;
  auditLogs: AdminAuditLogItem[];
}

export interface PermissionMatrixRow {
  permission: string;
  superadmin: boolean;
  admin: boolean;
  user: boolean;
}

export const PERMISSION_MATRIX_ROWS: readonly PermissionMatrixRow[] = [
  {
    permission: "Upload & publish templates",
    superadmin: true,
    admin: true,
    user: false,
  },
  {
    permission: "Moderate case studies",
    superadmin: true,
    admin: true,
    user: false,
  },
  {
    permission: "Manage users & plans",
    superadmin: true,
    admin: true,
    user: false,
  },
  {
    permission: "Superadmin roles & platform maintenance",
    superadmin: true,
    admin: false,
    user: false,
  },
] as const;

export function classifyAuditAction(action: string): Exclude<AuditActionCategory, "all"> {
  if (action.startsWith("template.")) return "templates";
  if (action.startsWith("admin.category.")) return "categories";
  if (action.startsWith("admin.user.") || action.startsWith("admin.subscription.")) {
    return "users";
  }
  if (action.startsWith("admin.moderation.")) return "moderation";
  return "settings";
}

export function formatAuditLogSummary(
  action: string,
  meta: Record<string, unknown>,
): string {
  switch (action) {
    case "template.draft_saved":
      return `Saved template draft${meta.slug ? ` (${String(meta.slug)})` : ""}`;
    case "template.version_created":
      return `Created template version ${String(meta.version ?? "")}`.trim();
    case "template.published":
      return `Published template version ${String(meta.version ?? "")}`.trim();
    case "template.archived":
      return "Archived template";
    case "template.unarchived":
      return "Restored template to draft";
    case "template.retired":
      return `Retired template (${String(meta.pinnedProjectCount ?? 0)} pinned projects)`;
    case "template.deleted":
      return `Deleted unused template${meta.slug ? ` (${String(meta.slug)})` : ""}`;
    case "admin.category.created":
      return `Created category "${String(meta.name ?? meta.slug ?? "")}"`;
    case "admin.category.updated":
      return `Updated category "${String(meta.name ?? meta.slug ?? "")}"`;
    case "admin.category.reordered":
      return `Reordered category (${String(meta.direction ?? "sort")})`;
    case "admin.category.deleted":
      return `Deleted category "${String(meta.name ?? meta.slug ?? "")}"`;
    case "admin.user.suspended":
      return `Suspended user (${String(meta.targetUserId ?? "").slice(0, 8)})`;
    case "admin.user.unsuspended":
      return `Reactivated user (${String(meta.targetUserId ?? "").slice(0, 8)})`;
    case "admin.subscription.synced":
      return `Synced Paddle subscription (${String(meta.source ?? "mirror")} · ${String(meta.status ?? "")})`;
    case "admin.moderation.takedown":
      return `Took down case study "${String(meta.projectName ?? meta.slug ?? "")}"`;
    case "admin.moderation.dismissed":
      return `Dismissed reports on "${String(meta.projectName ?? meta.projectId ?? "")}"`;
    case "admin.moderation.bulk_dismissed":
      return `Bulk-dismissed ${String(meta.dismissedReportCount ?? 0)} open reports`;
    case "admin.role.updated":
      return `Changed role ${String(meta.previousRole ?? "user")} → ${String(meta.nextRole ?? "admin")}`;
    case "admin.platform_settings.updated":
      return `Sign-ups: ${meta.newSignupsOpen ? "open" : "closed"} · Email verify: ${meta.requireEmailVerification ? "on" : "off"} · Maintenance: ${meta.maintenanceMode ? "on" : "off"}`;
    default:
      return action;
  }
}

export function filterAuditLogs(
  logs: readonly AdminAuditLogItem[],
  args: { category: AuditActionCategory; searchQuery: string },
): AdminAuditLogItem[] {
  const q = args.searchQuery.trim().toLowerCase();
  return logs.filter((item) => {
    if (args.category !== "all" && item.category !== args.category) {
      return false;
    }
    if (q) {
      const summary = formatAuditLogSummary(item.action, item.meta);
      const hay = `${item.action} ${item.actorName} ${summary}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function escapeCsvCell(value: string): string {
  const formulaPrefixNeutralized = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(formulaPrefixNeutralized)) {
    return `"${formulaPrefixNeutralized.replace(/"/g, '""')}"`;
  }
  return formulaPrefixNeutralized;
}

export function serializeAuditLogsCsv(logs: readonly AdminAuditLogItem[]): string {
  const lines = [
    ["Timestamp", "Actor", "Action", "Category", "Summary"].map(escapeCsvCell).join(","),
  ];
  for (const log of logs) {
    lines.push(
      [
        log.atIso,
        log.actorName,
        log.action,
        log.category,
        formatAuditLogSummary(log.action, log.meta),
      ]
        .map(escapeCsvCell)
        .join(","),
    );
  }
  return lines.join("\n");
}
