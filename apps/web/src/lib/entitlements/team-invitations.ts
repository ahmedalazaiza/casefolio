import { and, count, eq } from "@casefolio/db";
import { inviteTeamMemberSchema } from "@/lib/auth/schemas";
import { auth } from "@/lib/auth/server";
import { db, dbSchema } from "@/lib/db";
import { evaluateEntitlement } from "@/lib/entitlements";
import { resolveEffectivePlanForOrganization } from "@/lib/entitlements/server";
import { notifyTeamInviteIfExistingUser } from "@/lib/notifications/service";

export type InviteTeamMemberResult =
  | {
      ok: true;
      invitationId: string;
      email: string;
      role: "editor" | "viewer";
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
        | "INVITATION_FAILED";
      error: string;
    };

export async function createGatedTeamInvitation({
  actorUserId,
  rawInput,
  requestHeaders,
}: {
  actorUserId: string;
  rawInput: unknown;
  requestHeaders: Headers;
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

  const [orgRow] = await db
    .select({
      organization: dbSchema.organizations,
      membership: dbSchema.memberships,
    })
    .from(dbSchema.organizations)
    .innerJoin(
      dbSchema.memberships,
      and(
        eq(dbSchema.memberships.orgId, dbSchema.organizations.id),
        eq(dbSchema.memberships.userId, actorUserId),
      ),
    )
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

  if (orgRow.membership.role !== "owner" && orgRow.membership.role !== "editor") {
    return {
      ok: false,
      status: 403,
      code: "FORBIDDEN",
      error: "Only workspace owners and editors can invite members.",
    };
  }

  const [effectivePlan, memberCountRows, pendingInviteRows] = await Promise.all([
    resolveEffectivePlanForOrganization(orgRow.organization.id, actorUserId),
    db
      .select({ total: count() })
      .from(dbSchema.memberships)
      .where(eq(dbSchema.memberships.orgId, orgRow.organization.id)),
    db
      .select({ total: count() })
      .from(dbSchema.invitations)
      .where(
        and(
          eq(dbSchema.invitations.organizationId, orgRow.organization.id),
          eq(dbSchema.invitations.status, "pending"),
        ),
      ),
  ]);

  const seatsUsed =
    Number(memberCountRows[0]?.total ?? 0) + Number(pendingInviteRows[0]?.total ?? 0);

  const seatDecision = evaluateEntitlement(effectivePlan, "team_seats", {
    seatsUsed,
    seatsLimit: orgRow.organization.seats,
  });

  if (!seatDecision.allowed) {
    return {
      ok: false,
      status: 403,
      code:
        seatDecision.code === "TEAM_SEAT_LIMIT_REACHED"
          ? "TEAM_SEAT_LIMIT_REACHED"
          : "TEAM_PLAN_REQUIRED",
      error: seatDecision.message,
    };
  }

  try {
    const invitation = await auth.api.createInvitation({
      body: {
        organizationId: valid.organizationId,
        email: valid.email,
        role: valid.role,
      },
      headers: requestHeaders,
    });

    await notifyTeamInviteIfExistingUser({
      invitedEmail: invitation.email,
      organizationName: orgRow.organization.name,
      role: valid.role,
      invitationId: invitation.id,
      sendEmail: false,
    }).catch(() => undefined);

    return {
      ok: true,
      invitationId: invitation.id,
      email: invitation.email,
      role: valid.role,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not send invitation.";
    return {
      ok: false,
      status: 400,
      code: "INVITATION_FAILED",
      error: message,
    };
  }
}
