import {
  and,
  eq,
  inArray,
  normalizeMembershipRole,
  type CanonicalMembershipRole,
  type MembershipRole,
  type UserRole,
} from "@casefolio/db";
import { forbidden } from "next/navigation";
import { requireSession, type AuthenticatedContext } from "@/lib/auth/session";
import { db, dbSchema } from "@/lib/db";

export function hasAdminRole(role: string | null | undefined): role is "admin" | "superadmin" {
  return role === "admin" || role === "superadmin";
}

export function isSuperAdminRole(role: string | null | undefined): role is "superadmin" {
  return role === "superadmin";
}

export function isOrganizationOwner(role: MembershipRole | string | null | undefined): boolean {
  return role === "owner";
}

export function isOrganizationAdminOrOwner(
  role: MembershipRole | string | null | undefined,
): boolean {
  if (!role) return false;
  const canonical = normalizeMembershipRole(role);
  return canonical === "owner" || canonical === "admin";
}

export function canEditInOrganization(role: MembershipRole | string | null | undefined): boolean {
  return role === "owner" || role === "admin" || role === "member" || role === "editor";
}

export function canPublishSharedInOrganization(
  role: MembershipRole | string | null | undefined,
): boolean {
  return isOrganizationAdminOrOwner(role);
}

export async function requireRole(
  allowedRoles: readonly UserRole[],
  callbackPath = "/dashboard",
): Promise<AuthenticatedContext> {
  const ctx = await requireSession(callbackPath);
  if (!allowedRoles.includes(ctx.user.role)) {
    forbidden();
  }
  return ctx;
}

export async function requireAdmin(callbackPath = "/admin"): Promise<AuthenticatedContext> {
  const ctx = await requireSession(callbackPath);
  if (!hasAdminRole(ctx.user.role)) {
    forbidden();
  }
  return ctx;
}

export async function requireSuperAdmin(
  callbackPath = "/admin/settings",
): Promise<AuthenticatedContext> {
  const ctx = await requireSession(callbackPath);
  if (!isSuperAdminRole(ctx.user.role)) {
    forbidden();
  }
  return ctx;
}

export interface OrgMembershipContext extends AuthenticatedContext {
  organization: typeof dbSchema.organizations.$inferSelect;
  membership: typeof dbSchema.memberships.$inferSelect;
  canonicalRole: CanonicalMembershipRole;
}

export async function requireOrgMembership(
  orgId: string,
  allowedRoles: readonly MembershipRole[] = ["owner", "admin", "member", "editor", "viewer"],
  callbackPath = "/account/team",
): Promise<OrgMembershipContext> {
  const ctx = await requireSession(callbackPath);

  const [row] = await db
    .select({
      organization: dbSchema.organizations,
      membership: dbSchema.memberships,
    })
    .from(dbSchema.memberships)
    .innerJoin(
      dbSchema.organizations,
      eq(dbSchema.memberships.orgId, dbSchema.organizations.id),
    )
    .where(
      and(
        eq(dbSchema.memberships.orgId, orgId),
        eq(dbSchema.memberships.userId, ctx.user.id),
        inArray(dbSchema.memberships.role, [...allowedRoles]),
      ),
    )
    .limit(1);

  if (!row) {
    forbidden();
  }

  return {
    ...ctx,
    organization: row.organization,
    membership: row.membership,
    canonicalRole: normalizeMembershipRole(row.membership.role),
  };
}
