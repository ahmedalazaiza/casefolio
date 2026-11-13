import { createHash, randomBytes } from "node:crypto";
import {
  and,
  eq,
  gt,
  inArray,
  isNull,
  normalizeMembershipRole,
  sql,
  type CanonicalMembershipRole,
} from "@casefolio/db";
import { env } from "@/env";
import { sendTeamInvitationEmail } from "@/lib/auth/email";
import { inviteTeamMemberSchema } from "@/lib/auth/schemas";
import {
  PLUS_INCLUDED_SEATS,
  TEAMS_MAX_SELF_SERVE_SEATS,
} from "@/lib/billing/plans";
import { db, dbSchema } from "@/lib/db";
import {
  ensureTeamWorkspaceForOrganization,
  resolveWorkspaceEntitlementState,
} from "@/lib/entitlements/server";
import { notifyTeamInviteIfExistingUser } from "@/lib/notifications/service";
import { releaseWorkspaceReservation } from "@/lib/usage/meter";
import { revokeUserWorkspaceLeases } from "@/lib/workspaces/leases";

export const INVITATION_TTL_DAYS = 7;
export const RECOVERY_RETENTION_DAYS = 90;

/**
 * Normalizes an invitation email (`Spec §7.6`): trims and lowercases WITHOUT stripping `.` or `+`.
 */
export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function generateOpaqueInvitationToken(): string {
  return `cf_inv_${randomBytes(24).toString("hex")}`;
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type InviteTeamMemberResult =
  | {
      ok: true;
      invitationId: string;
      invitationToken: string;
      email: string;
      role: "admin" | "member";
      expiresAtIso: string;
    }
  | {
      ok: false;
      status: number;
      code:
        | "VALIDATION_ERROR"
        | "NOT_FOUND"
        | "FORBIDDEN"
        | "TEAM_PLAN_REQUIRED"
        | "TEAM_SEAT_LIMIT_REACHED"
        | "PLUS_PLAN_REQUIRED"
        | "WORKSPACE_PAST_DUE_OR_FROZEN"
        | "ALREADY_MEMBER"
        | "INVITATION_FAILED";
      error: string;
    };

export interface TeamSeatOccupancySnapshot {
  paidSeats: number;
  renewalQuantity: number | null;
  admissionCeiling: number;
  activeMembers: number;
  reservedInvites: number;
  occupiedSeats: number;
  availableSeats: number;
}

export async function getTeamSeatOccupancy(
  organizationId: string,
  now: Date = new Date(),
): Promise<TeamSeatOccupancySnapshot> {
  const ensured = await ensureTeamWorkspaceForOrganization(organizationId);
  const ent = await resolveWorkspaceEntitlementState(ensured.workspaceId, now);

  const [memberRows, pendingRows] = await Promise.all([
    db
      .select({ id: dbSchema.memberships.id })
      .from(dbSchema.memberships)
      .where(eq(dbSchema.memberships.orgId, organizationId)),
    db
      .select({ id: dbSchema.invitations.id, email: dbSchema.invitations.email })
      .from(dbSchema.invitations)
      .where(
        and(
          eq(dbSchema.invitations.organizationId, organizationId),
          eq(dbSchema.invitations.status, "pending"),
          isNull(dbSchema.invitations.revokedAt),
          gt(dbSchema.invitations.expiresAt, now),
        ),
      ),
  ]);

  const distinctPendingEmails = new Set(pendingRows.map((r) => normalizeInviteEmail(r.email)));
  const activeMembers = memberRows.length;
  const reservedInvites = distinctPendingEmails.size;
  const occupiedSeats = activeMembers + reservedInvites;
  const paidSeats = ent?.paidSeats ?? 1;
  const renewalQuantity = ent?.renewalQuantity ?? null;
  const admissionCeiling = ent?.admissionCeiling ?? 1;

  return {
    paidSeats,
    renewalQuantity,
    admissionCeiling,
    activeMembers,
    reservedInvites,
    occupiedSeats,
    availableSeats: Math.max(0, admissionCeiling - occupiedSeats),
  };
}

/**
 * Creates a single-use 7-day seat-reserving team invitation under a PostgreSQL `FOR UPDATE`
 * workspace row lock so concurrent requests racing for the last seat strictly serialize (`Spec §7.3-7.7 & §15`).
 *
 * Entering an email NEVER triggers an automatic seat purchase.
 */
export async function createGatedTeamInvitation({
  actorUserId,
  rawInput,
  now = new Date(),
}: {
  actorUserId: string;
  rawInput: unknown;
  requestHeaders?: Headers;
  now?: Date;
}): Promise<InviteTeamMemberResult> {
  const parsed = inviteTeamMemberSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      code: "VALIDATION_ERROR",
      error: parsed.error.issues[0]?.message ?? "Invalid invitation parameters.",
    };
  }

  const valid = parsed.data;
  const normalizedEmail = normalizeInviteEmail(valid.email);

  const [orgRow] = await db
    .select({
      organization: dbSchema.organizations,
      membership: dbSchema.memberships,
      inviterName: dbSchema.users.name,
    })
    .from(dbSchema.organizations)
    .innerJoin(
      dbSchema.memberships,
      and(
        eq(dbSchema.memberships.orgId, dbSchema.organizations.id),
        eq(dbSchema.memberships.userId, actorUserId),
      ),
    )
    .innerJoin(dbSchema.users, eq(dbSchema.users.id, actorUserId))
    .where(eq(dbSchema.organizations.id, valid.organizationId))
    .limit(1);

  if (!orgRow) {
    return {
      ok: false,
      status: 404,
      code: "NOT_FOUND",
      error: "Team workspace not found.",
    };
  }

  const actorRole: CanonicalMembershipRole = normalizeMembershipRole(orgRow.membership.role);

  if (actorRole === "member") {
    return {
      ok: false,
      status: 403,
      code: "FORBIDDEN",
      error: "Only workspace Owners and Admins can invite members.",
    };
  }

  // `Spec §7.7`: An Admin manages Members only, not another Admin or Owner
  if (actorRole === "admin" && valid.role !== "member") {
    return {
      ok: false,
      status: 403,
      code: "FORBIDDEN",
      error: "Workspace Admins can invite Members only. Ask the Owner to invite an Admin.",
    };
  }

  const ensured = await ensureTeamWorkspaceForOrganization(valid.organizationId, actorUserId);
  const ent = await resolveWorkspaceEntitlementState(ensured.workspaceId, now);

  if (!ent || (ent.plan !== "team" && ent.plan !== "plus")) {
    return {
      ok: false,
      status: 403,
      code: "TEAM_PLAN_REQUIRED",
      error: "Collaborative team seats require an active Casefolio Team or Plus subscription.",
    };
  }

  if (ent.isFrozen || ent.lifecycle.isPastDueInGrace) {
    return {
      ok: false,
      status: 403,
      code: "WORKSPACE_PAST_DUE_OR_FROZEN",
      error: "New invitations are paused while a workspace payment is past due or frozen.",
    };
  }

  const opaqueToken = generateOpaqueInvitationToken();
  const tokenHash = hashInvitationToken(opaqueToken);
  const expiresAt = new Date(now.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

  const txResult = await db.transaction(async (tx): Promise<InviteTeamMemberResult> => {
    // Acquire exclusive row lock on the workspace row to serialize concurrent seat allocations
    await tx.execute(sql`
      SELECT id FROM workspaces WHERE id = ${ensured.workspaceId} FOR UPDATE
    `);

    const existingMemberRows = await tx
      .select({ email: dbSchema.users.email })
      .from(dbSchema.memberships)
      .innerJoin(dbSchema.users, eq(dbSchema.memberships.userId, dbSchema.users.id))
      .where(eq(dbSchema.memberships.orgId, valid.organizationId));

    if (existingMemberRows.some((m) => normalizeInviteEmail(m.email) === normalizedEmail)) {
      return {
        ok: false,
        status: 409,
        code: "ALREADY_MEMBER",
        error: "That user is already an active member of this team workspace.",
      };
    }

    const activePendingInvites = await tx
      .select()
      .from(dbSchema.invitations)
      .where(
        and(
          eq(dbSchema.invitations.organizationId, valid.organizationId),
          eq(dbSchema.invitations.status, "pending"),
          isNull(dbSchema.invitations.revokedAt),
          gt(dbSchema.invitations.expiresAt, now),
        ),
      );

    // Exclude same-email invites so re-inviting/resending replaces the old link without reserving twice (`Spec §7.5`)
    const otherPendingEmails = new Set(
      activePendingInvites
        .filter((inv) => normalizeInviteEmail(inv.email) !== normalizedEmail)
        .map((inv) => normalizeInviteEmail(inv.email)),
    );

    const occupiedExcludingThisEmail = existingMemberRows.length + otherPendingEmails.size;
    if (occupiedExcludingThisEmail >= ent.admissionCeiling) {
      if (ent.plan === "team" && ent.admissionCeiling >= TEAMS_MAX_SELF_SERVE_SEATS) {
        return {
          ok: false,
          status: 403,
          code: "PLUS_PLAN_REQUIRED",
          error: `Team plan supports up to ${TEAMS_MAX_SELF_SERVE_SEATS} seats. Upgrade to Casefolio Plus ($99/mo or $79/mo billed annually) to invite up to ${PLUS_INCLUDED_SEATS} team members.`,
        };
      }
      return {
        ok: false,
        status: 403,
        code: "TEAM_SEAT_LIMIT_REACHED",
        error:
          ent.renewalQuantity !== null && ent.renewalQuantity < ent.paidSeats
            ? `Admissions are capped at your scheduled renewal seat target (${ent.admissionCeiling}). Cancel the pending seat decrease or purchase another seat first.`
            : ent.plan === "plus"
              ? `All ${PLUS_INCLUDED_SEATS} team seats included in Casefolio Plus are occupied or reserved.`
              : `All ${ent.paidSeats} paid team seats are occupied or reserved. Purchase an additional seat (up to ${TEAMS_MAX_SELF_SERVE_SEATS}) or upgrade to Plus.`,
      };
    }

    const matchingOldInvites = activePendingInvites.filter(
      (inv) => normalizeInviteEmail(inv.email) === normalizedEmail,
    );

    if (matchingOldInvites.length > 0) {
      const oldIds = matchingOldInvites.map((i) => i.id);
      await tx
        .update(dbSchema.invitations)
        .set({ status: "canceled", revokedAt: now })
        .where(inArray(dbSchema.invitations.id, oldIds));

      await tx
        .update(dbSchema.seatReservations)
        .set({ status: "revoked", updatedAt: now })
        .where(inArray(dbSchema.seatReservations.invitationId, oldIds));
    }

    const [inserted] = await tx
      .insert(dbSchema.invitations)
      .values({
        organizationId: valid.organizationId,
        email: normalizedEmail,
        role: valid.role,
        status: "pending",
        expiresAt,
        inviterId: actorUserId,
        tokenHash,
        resentCount: matchingOldInvites.length > 0 ? (matchingOldInvites[0]?.resentCount ?? 0) + 1 : 0,
        resentAt: matchingOldInvites.length > 0 ? now : null,
        createdAt: now,
      })
      .returning();

    await tx.insert(dbSchema.seatReservations).values({
      invitationId: inserted!.id,
      workspaceId: ensured.workspaceId,
      organizationId: valid.organizationId,
      normalizedEmail,
      role: valid.role,
      status: "active",
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });

    return {
      ok: true,
      invitationId: inserted!.id,
      invitationToken: opaqueToken,
      email: normalizedEmail,
      role: valid.role,
      expiresAtIso: expiresAt.toISOString(),
    };
  });

  if (!txResult.ok) {
    return txResult;
  }

  // Deliver mail via mail sink / Resend without ever logging `opaqueToken` (`Spec §7.6 & §7.9`)
  const acceptUrl = `${env.NEXT_PUBLIC_APP_URL}/account/team?invitationId=${encodeURIComponent(txResult.invitationId)}&token=${encodeURIComponent(opaqueToken)}`;
  await sendTeamInvitationEmail({
    email: txResult.email,
    organizationName: orgRow.organization.name,
    inviterName: orgRow.inviterName,
    acceptUrl,
    role: txResult.role,
  }).catch(() => undefined);

  await notifyTeamInviteIfExistingUser({
    invitedEmail: txResult.email,
    organizationName: orgRow.organization.name,
    role: txResult.role,
    invitationId: txResult.invitationId,
    sendEmail: false,
  }).catch(() => undefined);

  return txResult;
}

export async function resendTeamInvitation(args: {
  actorUserId: string;
  invitationId: string;
  now?: Date;
}): Promise<
  | { ok: true; invitationId: string; invitationToken: string; expiresAtIso: string }
  | { ok: false; status: 403 | 404 | 409; code: string; error: string }
> {
  const now = args.now ?? new Date();
  const [inv] = await db
    .select()
    .from(dbSchema.invitations)
    .where(eq(dbSchema.invitations.id, args.invitationId))
    .limit(1);

  if (!inv) {
    return { ok: false, status: 404, code: "NOT_FOUND", error: "Invitation not found." };
  }

  const [mem] = await db
    .select({
      role: dbSchema.memberships.role,
      orgName: dbSchema.organizations.name,
      inviterName: dbSchema.users.name,
    })
    .from(dbSchema.memberships)
    .innerJoin(
      dbSchema.organizations,
      eq(dbSchema.memberships.orgId, dbSchema.organizations.id),
    )
    .innerJoin(dbSchema.users, eq(dbSchema.users.id, args.actorUserId))
    .where(
      and(
        eq(dbSchema.memberships.orgId, inv.organizationId),
        eq(dbSchema.memberships.userId, args.actorUserId),
      ),
    )
    .limit(1);

  if (!mem) {
    return { ok: false, status: 404, code: "NOT_FOUND", error: "Invitation not found." };
  }

  const actorRole = normalizeMembershipRole(mem.role);
  const invRole = normalizeMembershipRole(inv.role);

  if (actorRole === "member" || (actorRole === "admin" && invRole !== "member")) {
    return {
      ok: false,
      status: 403,
      code: "FORBIDDEN",
      error: "Insufficient permission to resend this invitation.",
    };
  }

  if (inv.status !== "pending" || inv.revokedAt !== null) {
    return {
      ok: false,
      status: 409,
      code: "INVITATION_NOT_PENDING",
      error: "Only pending invitations can be resent.",
    };
  }

  const newToken = generateOpaqueInvitationToken();
  const newTokenHash = hashInvitationToken(newToken);
  const expiresAt = new Date(now.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db
    .update(dbSchema.invitations)
    .set({
      tokenHash: newTokenHash,
      expiresAt,
      resentCount: inv.resentCount + 1,
      resentAt: now,
    })
    .where(eq(dbSchema.invitations.id, inv.id));

  await db
    .update(dbSchema.seatReservations)
    .set({
      expiresAt,
      status: "active",
      updatedAt: now,
    })
    .where(eq(dbSchema.seatReservations.invitationId, inv.id));

  const acceptUrl = `${env.NEXT_PUBLIC_APP_URL}/account/team?invitationId=${encodeURIComponent(inv.id)}&token=${encodeURIComponent(newToken)}`;
  await sendTeamInvitationEmail({
    email: inv.email,
    organizationName: mem.orgName,
    inviterName: mem.inviterName,
    acceptUrl,
    role: invRole,
  }).catch(() => undefined);

  return {
    ok: true,
    invitationId: inv.id,
    invitationToken: newToken,
    expiresAtIso: expiresAt.toISOString(),
  };
}

export async function revokeTeamInvitation(args: {
  actorUserId: string;
  invitationId: string;
  now?: Date;
}): Promise<
  | { ok: true; invitationId: string }
  | { ok: false; status: 403 | 404; code: string; error: string }
> {
  const now = args.now ?? new Date();
  const [inv] = await db
    .select()
    .from(dbSchema.invitations)
    .where(eq(dbSchema.invitations.id, args.invitationId))
    .limit(1);

  if (!inv) {
    return { ok: false, status: 404, code: "NOT_FOUND", error: "Invitation not found." };
  }

  const [mem] = await db
    .select({ role: dbSchema.memberships.role })
    .from(dbSchema.memberships)
    .where(
      and(
        eq(dbSchema.memberships.orgId, inv.organizationId),
        eq(dbSchema.memberships.userId, args.actorUserId),
      ),
    )
    .limit(1);

  if (!mem) {
    return { ok: false, status: 404, code: "NOT_FOUND", error: "Invitation not found." };
  }

  const actorRole = normalizeMembershipRole(mem.role);
  const invRole = normalizeMembershipRole(inv.role);

  if (actorRole === "member" || (actorRole === "admin" && invRole !== "member")) {
    return {
      ok: false,
      status: 403,
      code: "FORBIDDEN",
      error: "Insufficient permission to revoke this invitation.",
    };
  }

  await db
    .update(dbSchema.invitations)
    .set({ status: "canceled", revokedAt: now })
    .where(eq(dbSchema.invitations.id, inv.id));

  await db
    .update(dbSchema.seatReservations)
    .set({ status: "revoked", updatedAt: now })
    .where(eq(dbSchema.seatReservations.invitationId, inv.id));

  return { ok: true, invitationId: inv.id };
}

/**
 * Accepts a team invitation (`Spec §7.4-7.6 & §15`).
 * Enforces verified email, exact normalized email match (without stripping `.` or `+`),
 * token/status/expiry validation, replay rejection, and admission-ceiling locking.
 */
export async function acceptTeamInvitation(args: {
  actorUserId: string;
  invitationId?: string;
  token?: string;
  now?: Date;
}): Promise<
  | {
      ok: true;
      organizationId: string;
      workspaceId: string;
      privateSpaceId: string | null;
      role: "admin" | "member";
    }
  | {
      ok: false;
      status: 400 | 403 | 404 | 409 | 410;
      code:
        | "NOT_FOUND"
        | "EMAIL_NOT_VERIFIED"
        | "EMAIL_MISMATCH"
        | "INVALID_TOKEN"
        | "INVITATION_ALREADY_ACCEPTED"
        | "INVITATION_REVOKED"
        | "INVITATION_EXPIRED"
        | "TEAM_SEAT_LIMIT_REACHED";
      error: string;
    }
> {
  const now = args.now ?? new Date();
  if (!args.invitationId && !args.token) {
    return {
      ok: false,
      status: 404,
      code: "NOT_FOUND",
      error: "Invitation not found.",
    };
  }

  const [actorUser] = await db
    .select()
    .from(dbSchema.users)
    .where(eq(dbSchema.users.id, args.actorUserId))
    .limit(1);

  if (!actorUser) {
    return { ok: false, status: 404, code: "NOT_FOUND", error: "User not found." };
  }

  if (!actorUser.emailVerified) {
    return {
      ok: false,
      status: 403,
      code: "EMAIL_NOT_VERIFIED",
      error: "Verify your email address before accepting a team invitation.",
    };
  }

  let inv: typeof dbSchema.invitations.$inferSelect | undefined;
  if (args.invitationId) {
    const [found] = await db
      .select()
      .from(dbSchema.invitations)
      .where(eq(dbSchema.invitations.id, args.invitationId))
      .limit(1);
    inv = found;
  } else if (args.token) {
    const hash = hashInvitationToken(args.token);
    const [found] = await db
      .select()
      .from(dbSchema.invitations)
      .where(eq(dbSchema.invitations.tokenHash, hash))
      .limit(1);
    inv = found;
  }

  if (!inv) {
    return { ok: false, status: 404, code: "NOT_FOUND", error: "Invitation not found." };
  }

  // If the invitation has an opaque tokenHash AND caller supplied a token, require exact match
  if (inv.tokenHash && args.token && hashInvitationToken(args.token) !== inv.tokenHash) {
    return {
      ok: false,
      status: 410,
      code: "INVALID_TOKEN",
      error: "This invitation link was superseded by a newer link or is invalid.",
    };
  }

  if (normalizeInviteEmail(actorUser.email) !== normalizeInviteEmail(inv.email)) {
    return {
      ok: false,
      status: 403,
      code: "EMAIL_MISMATCH",
      error: "Sign in with the exact email address this invitation was sent to.",
    };
  }

  if (inv.status === "accepted" || inv.acceptedAt !== null) {
    return {
      ok: false,
      status: 409,
      code: "INVITATION_ALREADY_ACCEPTED",
      error: "This single-use invitation has already been accepted.",
    };
  }

  if (inv.status !== "pending" || inv.revokedAt !== null) {
    return {
      ok: false,
      status: 410,
      code: "INVITATION_REVOKED",
      error: "This invitation was revoked by the workspace administrator.",
    };
  }

  if (inv.expiresAt.getTime() <= now.getTime()) {
    return {
      ok: false,
      status: 410,
      code: "INVITATION_EXPIRED",
      error: "This invitation has expired after 7 days.",
    };
  }

  const ensuredBefore = await ensureTeamWorkspaceForOrganization(inv.organizationId);
  const ent = await resolveWorkspaceEntitlementState(ensuredBefore.workspaceId, now);
  if (!ent || (ent.plan !== "team" && ent.plan !== "plus") || ent.isFrozen) {
    return {
      ok: false,
      status: 403,
      code: "TEAM_SEAT_LIMIT_REACHED",
      error: "This team workspace does not currently have active seat capacity.",
    };
  }

  const assignedRole: "admin" | "member" =
    normalizeMembershipRole(inv.role) === "admin" ? "admin" : "member";

  const txOutcome = await db.transaction(async (tx) => {
    await tx.execute(sql`
      SELECT id FROM workspaces WHERE id = ${ensuredBefore.workspaceId} FOR UPDATE
    `);

    const lockedInvRows = await tx.execute<{
      id: string;
      status: string;
      revoked_at: Date | null;
      accepted_at: Date | null;
      expires_at: Date | string;
    }>(sql`
      SELECT id, status, revoked_at, accepted_at, expires_at
      FROM invitations
      WHERE id = ${inv.id}
      FOR UPDATE
    `);

    const lockedInv = lockedInvRows.rows[0];
    if (!lockedInv || lockedInv.status === "accepted" || lockedInv.accepted_at !== null) {
      return {
        ok: false as const,
        status: 409 as const,
        code: "INVITATION_ALREADY_ACCEPTED" as const,
        error: "This single-use invitation has already been accepted.",
      };
    }

    if (lockedInv.status !== "pending" || lockedInv.revoked_at !== null) {
      return {
        ok: false as const,
        status: 410 as const,
        code: "INVITATION_REVOKED" as const,
        error: "This invitation has been revoked.",
      };
    }

    const activeMembers = await tx
      .select({ id: dbSchema.memberships.id, userId: dbSchema.memberships.userId })
      .from(dbSchema.memberships)
      .where(eq(dbSchema.memberships.orgId, inv.organizationId));

    const alreadyMember = activeMembers.some((m) => m.userId === args.actorUserId);
    if (!alreadyMember && activeMembers.length >= ent.admissionCeiling) {
      return {
        ok: false as const,
        status: 403 as const,
        code: "TEAM_SEAT_LIMIT_REACHED" as const,
        error: "All available seats in this team workspace are currently filled.",
      };
    }

    if (!alreadyMember) {
      await tx.insert(dbSchema.memberships).values({
        userId: args.actorUserId,
        orgId: inv.organizationId,
        role: assignedRole,
        createdAt: now,
      });
    }

    await tx
      .update(dbSchema.invitations)
      .set({
        status: "accepted",
        acceptedAt: now,
      })
      .where(eq(dbSchema.invitations.id, inv.id));

    await tx
      .update(dbSchema.seatReservations)
      .set({
        status: "consumed",
        updatedAt: now,
      })
      .where(eq(dbSchema.seatReservations.invitationId, inv.id));

    return { ok: true as const };
  });

  if (!txOutcome.ok) {
    return txOutcome;
  }

  // Provision the member's own private space in the team workspace (personal content stays untouched!)
  // Also restore any previously departed recovery spaces owned by this member if rejoining (`Spec §11.3`)
  const ensured = await ensureTeamWorkspaceForOrganization(inv.organizationId, args.actorUserId);

  return {
    ok: true,
    organizationId: inv.organizationId,
    workspaceId: ensured.workspaceId,
    privateSpaceId: ensured.memberPrivateSpaceId,
    role: assignedRole,
  };
}

/**
 * Executes all post-departure privacy & recovery invariants (`Spec §11.1-11.4`):
 * - Clears `sessions.activeOrganizationId`
 * - Revokes edit leases held by `departedUserId`
 * - Cancels in-flight queued/processing exports requested by `departedUserId` & releases quota reservations
 * - Transfers orphaned `shared` space controller to the Workspace Owner with audit record
 * - Withdraws public snapshots originating from `departedUserId`'s `private` spaces
 * - Freezes `departedUserId`'s `private` spaces to `frozen_member_departed` (`>= 90 days` `recoveryUntil`),
 *   completely hidden (`404`) from the team!
 */
export async function executeMemberDepartureSideEffects(args: {
  organizationId: string;
  departedUserId: string;
  actorUserId: string;
  now?: Date;
}): Promise<void> {
  const now = args.now ?? new Date();
  const [ws] = await db
    .select()
    .from(dbSchema.workspaces)
    .where(eq(dbSchema.workspaces.organizationId, args.organizationId))
    .limit(1);

  await db
    .update(dbSchema.sessions)
    .set({ activeOrganizationId: null, updatedAt: now })
    .where(
      and(
        eq(dbSchema.sessions.userId, args.departedUserId),
        eq(dbSchema.sessions.activeOrganizationId, args.organizationId),
      ),
    );

  if (!ws) {
    return;
  }

  await revokeUserWorkspaceLeases({
    workspaceId: ws.id,
    userId: args.departedUserId,
  });

  // Cancel any in-flight export jobs requested by `departedUserId` in this team workspace (`Spec §10.7 & §15`)
  const inFlightExports = await db
    .select({ id: dbSchema.exportsTable.id })
    .from(dbSchema.exportsTable)
    .where(
      and(
        eq(dbSchema.exportsTable.workspaceId, ws.id),
        eq(dbSchema.exportsTable.requestedByUserId, args.departedUserId),
        inArray(dbSchema.exportsTable.status, ["queued", "processing"]),
      ),
    );

  if (inFlightExports.length > 0) {
    const expIds = inFlightExports.map((e) => e.id);
    await db
      .update(dbSchema.exportsTable)
      .set({
        status: "failed",
        error: "Team membership ended before export delivery.",
      })
      .where(inArray(dbSchema.exportsTable.id, expIds));

    for (const expId of expIds) {
      await releaseWorkspaceReservation(`export:${expId}`, now);
    }
  }

  const [ownerMember] = await db
    .select({ userId: dbSchema.memberships.userId })
    .from(dbSchema.memberships)
    .where(
      and(
        eq(dbSchema.memberships.orgId, args.organizationId),
        eq(dbSchema.memberships.role, "owner"),
      ),
    )
    .limit(1);

  // 1. Orphaned `shared` spaces controlled by departed member transfer to Owner (`Spec §11.1`)
  if (ownerMember) {
    const orphanedSharedSpaces = await db
      .select({ id: dbSchema.spaces.id, aclVersion: dbSchema.spaces.aclVersion })
      .from(dbSchema.spaces)
      .where(
        and(
          eq(dbSchema.spaces.workspaceId, ws.id),
          eq(dbSchema.spaces.visibility, "shared"),
          eq(dbSchema.spaces.controllerUserId, args.departedUserId),
        ),
      );

    for (const sp of orphanedSharedSpaces) {
      await db
        .update(dbSchema.spaces)
        .set({
          controllerUserId: ownerMember.userId,
          aclVersion: sp.aclVersion + 1,
          updatedAt: now,
        })
        .where(eq(dbSchema.spaces.id, sp.id));

      await db.insert(dbSchema.auditLogs).values({
        actorId: args.actorUserId,
        action: "space.controller_transferred_on_departure",
        meta: {
          workspaceId: ws.id,
          spaceId: sp.id,
          newControllerUserId: ownerMember.userId,
        },
        at: now,
      });
    }
  }

  // 2. Private spaces of departed member enter `frozen_member_departed` recovery (`Spec §11.2-11.4`)
  const departedPrivateSpaces = await db
    .select({ id: dbSchema.spaces.id, aclVersion: dbSchema.spaces.aclVersion })
    .from(dbSchema.spaces)
    .where(
      and(
        eq(dbSchema.spaces.workspaceId, ws.id),
        eq(dbSchema.spaces.visibility, "private"),
        eq(dbSchema.spaces.controllerUserId, args.departedUserId),
      ),
    );

  if (departedPrivateSpaces.length > 0) {
    const privSpaceIds = departedPrivateSpaces.map((s) => s.id);
    const privProjects = await db
      .select({ id: dbSchema.projects.id })
      .from(dbSchema.projects)
      .where(inArray(dbSchema.projects.spaceId, privSpaceIds));

    if (privProjects.length > 0) {
      const privProjectIds = privProjects.map((p) => p.id);
      // Withdraw public snapshots originating from departed member's private spaces (`Spec §11.3`)
      await db
        .update(dbSchema.projects)
        .set({
          visibility: "private",
          publishedAt: null,
          updatedAt: now,
        })
        .where(inArray(dbSchema.projects.id, privProjectIds));

      await db
        .delete(dbSchema.publishedSnapshots)
        .where(inArray(dbSchema.publishedSnapshots.projectId, privProjectIds));
    }

    const recoveryUntil = new Date(
      now.getTime() + RECOVERY_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );

    for (const sp of departedPrivateSpaces) {
      await db
        .update(dbSchema.spaces)
        .set({
          recoveryState: "frozen_member_departed",
          departedAt: now,
          recoveryUntil,
          aclVersion: sp.aclVersion + 1,
          updatedAt: now,
        })
        .where(eq(dbSchema.spaces.id, sp.id));
    }
  }
}

/**
 * Removes a member from a team (or lets a non-owner member leave) without seizing private content
 * and without automatically altering the team's paid seat count (`Spec §8 & §11`).
 */
export async function removeTeamMemberWithRecovery(args: {
  actorUserId: string;
  organizationId: string;
  targetUserId: string;
  now?: Date;
}): Promise<
  | { ok: true; removedUserId: string }
  | { ok: false; status: 400 | 403 | 404; code: string; error: string }
> {
  const now = args.now ?? new Date();
  const membershipsInOrg = await db
    .select()
    .from(dbSchema.memberships)
    .where(eq(dbSchema.memberships.orgId, args.organizationId));

  const actorMembership = membershipsInOrg.find((m) => m.userId === args.actorUserId);
  const targetMembership = membershipsInOrg.find((m) => m.userId === args.targetUserId);

  if (!actorMembership || !targetMembership) {
    return { ok: false, status: 404, code: "NOT_FOUND", error: "Member not found." };
  }

  const actorRole = normalizeMembershipRole(actorMembership.role);
  const targetRole = normalizeMembershipRole(targetMembership.role);

  if (targetRole === "owner") {
    return {
      ok: false,
      status: 400,
      code: "OWNER_CANNOT_LEAVE",
      error:
        "The workspace Owner cannot leave or be removed before transferring ownership to another accepted member.",
    };
  }

  const isSelfLeave = args.actorUserId === args.targetUserId;
  if (!isSelfLeave) {
    if (actorRole === "member") {
      return {
        ok: false,
        status: 403,
        code: "FORBIDDEN",
        error: "Members cannot remove other teammates.",
      };
    }
    if (actorRole === "admin" && targetRole !== "member") {
      return {
        ok: false,
        status: 403,
        code: "FORBIDDEN",
        error: "Workspace Admins can remove Members only, not other Admins or the Owner.",
      };
    }
  }

  await db
    .delete(dbSchema.memberships)
    .where(
      and(
        eq(dbSchema.memberships.orgId, args.organizationId),
        eq(dbSchema.memberships.userId, args.targetUserId),
      ),
    );

  await executeMemberDepartureSideEffects({
    organizationId: args.organizationId,
    departedUserId: args.targetUserId,
    actorUserId: args.actorUserId,
    now,
  });

  await db.insert(dbSchema.auditLogs).values({
    actorId: args.actorUserId,
    action: isSelfLeave ? "team.member.left" : "team.member.removed",
    meta: {
      organizationId: args.organizationId,
      removedUserId: args.targetUserId,
    },
    at: now,
  });

  return { ok: true, removedUserId: args.targetUserId };
}

export async function updateTeamMemberRole(args: {
  actorUserId: string;
  organizationId: string;
  targetUserId: string;
  newRole: "admin" | "member";
  now?: Date;
}): Promise<
  | { ok: true; userId: string; role: "admin" | "member" }
  | { ok: false; status: 400 | 403 | 404; code: string; error: string }
> {
  const now = args.now ?? new Date();
  const rows = await db
    .select()
    .from(dbSchema.memberships)
    .where(eq(dbSchema.memberships.orgId, args.organizationId));

  const actor = rows.find((r) => r.userId === args.actorUserId);
  const target = rows.find((r) => r.userId === args.targetUserId);

  if (!actor || !target) {
    return { ok: false, status: 404, code: "NOT_FOUND", error: "Member not found." };
  }

  if (normalizeMembershipRole(actor.role) !== "owner") {
    return {
      ok: false,
      status: 403,
      code: "FORBIDDEN",
      error: "Only the workspace Owner can change member roles.",
    };
  }

  if (normalizeMembershipRole(target.role) === "owner") {
    return {
      ok: false,
      status: 400,
      code: "USE_OWNER_TRANSFER",
      error: "Use Ownership Transfer to transfer the Owner role.",
    };
  }

  await db
    .update(dbSchema.memberships)
    .set({ role: args.newRole })
    .where(eq(dbSchema.memberships.id, target.id));

  await db.insert(dbSchema.auditLogs).values({
    actorId: args.actorUserId,
    action: "team.member.role_updated",
    meta: {
      organizationId: args.organizationId,
      targetUserId: args.targetUserId,
      newRole: args.newRole,
    },
    at: now,
  });

  return { ok: true, userId: args.targetUserId, role: args.newRole };
}

/**
 * Initiates an explicit Owner transfer request (`Spec §7.7 & §11.5`).
 * Requires Owner authority + reauthentication confirmation, and recipient acceptance before switching.
 */
export async function requestOwnerTransfer(args: {
  actorUserId: string;
  organizationId: string;
  targetMemberUserId: string;
  reauthenticated: boolean;
  now?: Date;
}): Promise<
  | { ok: true; transferRequestId: string; expiresAtIso: string }
  | { ok: false; status: 400 | 403 | 404; code: string; error: string }
> {
  const now = args.now ?? new Date();
  if (!args.reauthenticated) {
    return {
      ok: false,
      status: 400,
      code: "REAUTH_REQUIRED",
      error: "Confirm reauthentication before initiating workspace ownership transfer.",
    };
  }

  if (args.actorUserId === args.targetMemberUserId) {
    return {
      ok: false,
      status: 400,
      code: "VALIDATION_ERROR",
      error: "Select another active team member to receive ownership.",
    };
  }

  const rows = await db
    .select()
    .from(dbSchema.memberships)
    .where(eq(dbSchema.memberships.orgId, args.organizationId));

  const actor = rows.find((r) => r.userId === args.actorUserId);
  const target = rows.find((r) => r.userId === args.targetMemberUserId);

  if (!actor || normalizeMembershipRole(actor.role) !== "owner") {
    return {
      ok: false,
      status: 403,
      code: "FORBIDDEN",
      error: "Only the current workspace Owner can initiate an ownership transfer.",
    };
  }

  if (!target) {
    return {
      ok: false,
      status: 404,
      code: "NOT_FOUND",
      error: "Target user is not an active member of this workspace.",
    };
  }

  const ensured = await ensureTeamWorkspaceForOrganization(args.organizationId, args.actorUserId);
  await db
    .update(dbSchema.ownerTransferRequests)
    .set({ status: "canceled" })
    .where(
      and(
        eq(dbSchema.ownerTransferRequests.organizationId, args.organizationId),
        eq(dbSchema.ownerTransferRequests.status, "pending"),
      ),
    );

  const OWNER_TRANSFER_TTL_HOURS = 48;
  const expiresAt = new Date(now.getTime() + OWNER_TRANSFER_TTL_HOURS * 60 * 60 * 1000);
  const [reqRow] = await db
    .insert(dbSchema.ownerTransferRequests)
    .values({
      organizationId: args.organizationId,
      workspaceId: ensured.workspaceId,
      fromOwnerUserId: args.actorUserId,
      toMemberUserId: args.targetMemberUserId,
      status: "pending",
      expiresAt,
      createdAt: now,
    })
    .returning();

  return {
    ok: true,
    transferRequestId: reqRow!.id,
    expiresAtIso: expiresAt.toISOString(),
  };
}

export async function acceptOwnerTransfer(args: {
  actorUserId: string;
  transferRequestId: string;
  reauthenticated: boolean;
  now?: Date;
}): Promise<
  | { ok: true; organizationId: string; newOwnerUserId: string }
  | { ok: false; status: 400 | 403 | 404 | 410; code: string; error: string }
> {
  const now = args.now ?? new Date();
  if (!args.reauthenticated) {
    return {
      ok: false,
      status: 400,
      code: "REAUTH_REQUIRED",
      error: "Confirm reauthentication before accepting workspace ownership.",
    };
  }

  const [reqRow] = await db
    .select()
    .from(dbSchema.ownerTransferRequests)
    .where(eq(dbSchema.ownerTransferRequests.id, args.transferRequestId))
    .limit(1);

  if (!reqRow) {
    return { ok: false, status: 404, code: "NOT_FOUND", error: "Transfer request not found." };
  }

  if (reqRow.toMemberUserId !== args.actorUserId) {
    return {
      ok: false,
      status: 403,
      code: "FORBIDDEN",
      error: "Only the designated recipient can accept this ownership transfer.",
    };
  }

  if (reqRow.status !== "pending" || reqRow.expiresAt.getTime() <= now.getTime()) {
    return {
      ok: false,
      status: 410,
      code: "TRANSFER_EXPIRED",
      error: "This ownership transfer request is no longer active.",
    };
  }

  const outcome = await db.transaction(async (tx) => {
    const members = await tx
      .select()
      .from(dbSchema.memberships)
      .where(eq(dbSchema.memberships.orgId, reqRow.organizationId));

    const currentOwner = members.find((m) => normalizeMembershipRole(m.role) === "owner");
    const recipient = members.find((m) => m.userId === args.actorUserId);

    if (!currentOwner || !recipient || currentOwner.userId !== reqRow.fromOwnerUserId) {
      return {
        ok: false as const,
        status: 400 as const,
        code: "INVALID_TRANSFER_STATE",
        error: "Workspace membership changed; request a new ownership transfer.",
      };
    }

    await tx
      .update(dbSchema.memberships)
      .set({ role: "admin" })
      .where(eq(dbSchema.memberships.id, currentOwner.id));

    await tx
      .update(dbSchema.memberships)
      .set({ role: "owner" })
      .where(eq(dbSchema.memberships.id, recipient.id));

    await tx
      .update(dbSchema.spaces)
      .set({ controllerUserId: args.actorUserId, updatedAt: now })
      .where(
        and(
          eq(dbSchema.spaces.workspaceId, reqRow.workspaceId),
          eq(dbSchema.spaces.visibility, "shared"),
          eq(dbSchema.spaces.isDefault, true),
        ),
      );

    await tx
      .update(dbSchema.ownerTransferRequests)
      .set({ status: "accepted", acceptedAt: now })
      .where(eq(dbSchema.ownerTransferRequests.id, reqRow.id));

    await tx.insert(dbSchema.auditLogs).values({
      actorId: args.actorUserId,
      action: "team.ownership.transferred",
      meta: {
        organizationId: reqRow.organizationId,
        previousOwnerUserId: currentOwner.userId,
        newOwnerUserId: args.actorUserId,
      },
      at: now,
    });

    return { ok: true as const };
  });

  if (!outcome.ok) {
    return outcome;
  }

  return {
    ok: true,
    organizationId: reqRow.organizationId,
    newOwnerUserId: args.actorUserId,
  };
}
