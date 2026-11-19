import { and, desc, eq, gt, inArray, normalizeMembershipRole } from "@casefolio/db";
import type { Metadata } from "next";
import {
  TeamWorkspaceClient,
  type IncomingOwnerTransferSummary,
  type IncomingTeamInvitation,
  type InspectedInvitationNotice,
  type TeamInvitationHistoryItem,
  type TeamOrganizationSummary,
} from "@/app/(app)/account/team/team-workspace-client";
import { AccountSettingsShell } from "@/components/account/account-settings-shell";
import { requireSession } from "@/lib/auth/session";
import { getTeamBillingSeatOverviewForUser } from "@/lib/billing/service";
import { db, dbSchema } from "@/lib/db";
import {
  ensureTeamWorkspaceForOrganization,
  resolveEffectivePlanForUser,
  resolveWorkspaceEntitlementState,
} from "@/lib/entitlements/server";
import {
  hashInvitationToken,
  normalizeInviteEmail,
} from "@/lib/entitlements/team-invitations";

export const metadata: Metadata = {
  title: "Team Workspace — Casefolio",
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function maskEmailAddress(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  if (!domain) return "***";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

function deriveInvitationStatus(
  inv: typeof dbSchema.invitations.$inferSelect,
  now: Date,
): TeamInvitationHistoryItem["status"] {
  if (inv.status === "accepted" || inv.acceptedAt !== null) {
    return "accepted";
  }
  if (inv.status === "canceled" || inv.revokedAt !== null) {
    return "canceled";
  }
  if (inv.expiresAt.getTime() <= now.getTime()) {
    return "expired";
  }
  return "pending";
}

export default async function AccountTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ invitationId?: string; token?: string }>;
}) {
  const { invitationId, token } = await searchParams;
  const callbackQuery = new URLSearchParams();
  if (invitationId) callbackQuery.set("invitationId", invitationId);
  if (token) callbackQuery.set("token", token);
  const callbackPath =
    callbackQuery.size > 0
      ? `/account/team?${callbackQuery.toString()}`
      : "/account/team";

  const { user, session } = await requireSession(callbackPath);
  const now = new Date();

  const userMemberships = await db
    .select({
      membership: dbSchema.memberships,
      organization: dbSchema.organizations,
    })
    .from(dbSchema.memberships)
    .innerJoin(dbSchema.organizations, eq(dbSchema.memberships.orgId, dbSchema.organizations.id))
    .where(eq(dbSchema.memberships.userId, user.id));

  const orgIds = userMemberships.map((row) => row.organization.id);
  const normalizedUserEmail = normalizeInviteEmail(user.email);

  const [
    allOrgMembers,
    allOrgInvites,
    incomingInviteRows,
    effectivePlan,
    orgTransferRows,
    incomingTransferRows,
    highlightedRowList,
  ] = await Promise.all([
    orgIds.length > 0
      ? db
          .select({
            membership: dbSchema.memberships,
            memberUser: dbSchema.users,
          })
          .from(dbSchema.memberships)
          .innerJoin(dbSchema.users, eq(dbSchema.memberships.userId, dbSchema.users.id))
          .where(inArray(dbSchema.memberships.orgId, orgIds))
      : Promise.resolve([]),
    orgIds.length > 0
      ? db
          .select()
          .from(dbSchema.invitations)
          .where(inArray(dbSchema.invitations.organizationId, orgIds))
          .orderBy(desc(dbSchema.invitations.createdAt))
      : Promise.resolve([]),
    db
      .select({
        invitation: dbSchema.invitations,
        organization: dbSchema.organizations,
        inviter: dbSchema.users,
      })
      .from(dbSchema.invitations)
      .innerJoin(
        dbSchema.organizations,
        eq(dbSchema.invitations.organizationId, dbSchema.organizations.id),
      )
      .innerJoin(dbSchema.users, eq(dbSchema.invitations.inviterId, dbSchema.users.id))
      .where(
        and(
          eq(dbSchema.invitations.email, normalizedUserEmail),
          eq(dbSchema.invitations.status, "pending"),
          gt(dbSchema.invitations.expiresAt, now),
        ),
      ),
    resolveEffectivePlanForUser(user.id),
    orgIds.length > 0
      ? db
          .select({
            transfer: dbSchema.ownerTransferRequests,
            targetUser: dbSchema.users,
          })
          .from(dbSchema.ownerTransferRequests)
          .innerJoin(
            dbSchema.users,
            eq(dbSchema.ownerTransferRequests.toMemberUserId, dbSchema.users.id),
          )
          .where(
            and(
              inArray(dbSchema.ownerTransferRequests.organizationId, orgIds),
              eq(dbSchema.ownerTransferRequests.status, "pending"),
              gt(dbSchema.ownerTransferRequests.expiresAt, now),
            ),
          )
      : Promise.resolve([]),
    db
      .select({
        transfer: dbSchema.ownerTransferRequests,
        organization: dbSchema.organizations,
        fromOwner: dbSchema.users,
      })
      .from(dbSchema.ownerTransferRequests)
      .innerJoin(
        dbSchema.organizations,
        eq(dbSchema.ownerTransferRequests.organizationId, dbSchema.organizations.id),
      )
      .innerJoin(
        dbSchema.users,
        eq(dbSchema.ownerTransferRequests.fromOwnerUserId, dbSchema.users.id),
      )
      .where(
        and(
          eq(dbSchema.ownerTransferRequests.toMemberUserId, user.id),
          eq(dbSchema.ownerTransferRequests.status, "pending"),
          gt(dbSchema.ownerTransferRequests.expiresAt, now),
        ),
      ),
    invitationId && UUID_REGEX.test(invitationId)
      ? db
          .select({
            invitation: dbSchema.invitations,
            organization: dbSchema.organizations,
            inviter: dbSchema.users,
          })
          .from(dbSchema.invitations)
          .innerJoin(
            dbSchema.organizations,
            eq(dbSchema.invitations.organizationId, dbSchema.organizations.id),
          )
          .innerJoin(dbSchema.users, eq(dbSchema.invitations.inviterId, dbSchema.users.id))
          .where(eq(dbSchema.invitations.id, invitationId))
          .limit(1)
      : Promise.resolve([]),
  ]);

  const orgEntitlementMap = new Map<
    string,
    {
      plan: "free" | "pro" | "team" | "plus";
      paidSeats: number;
      renewalSeats: number | null;
      hasActiveTeamPlan: boolean;
      interval: "monthly" | "yearly";
      subscriptionStatus: string;
      currentPeriodEndIso: string | null;
      isLockedForQuantityChange: boolean;
      lockReason: string | null;
    }
  >();

  await Promise.all(
    userMemberships.map(async (row) => {
      const ws = await ensureTeamWorkspaceForOrganization(row.organization.id, user.id);
      const [state, seatOverview] = await Promise.all([
        resolveWorkspaceEntitlementState(ws.workspaceId, now),
        getTeamBillingSeatOverviewForUser(user.id, row.organization.id, now),
      ]);
      const isTeamOrPlus = state?.plan === "team" || state?.plan === "plus";
      orgEntitlementMap.set(row.organization.id, {
        plan: state?.plan ?? "free",
        paidSeats: isTeamOrPlus ? state.paidSeats : row.organization.seats,
        renewalSeats: state?.plan === "team" ? state.renewalQuantity : null,
        hasActiveTeamPlan: Boolean(isTeamOrPlus && state?.lifecycle.grantsPaidAccess),
        interval: seatOverview?.interval ?? "monthly",
        subscriptionStatus: seatOverview?.status ?? "free",
        currentPeriodEndIso: seatOverview?.currentPeriodEndIso ?? null,
        isLockedForQuantityChange: seatOverview?.isLockedForQuantityChange ?? false,
        lockReason: seatOverview?.lockReason ?? null,
      });
    }),
  );

  const organizations: TeamOrganizationSummary[] = userMemberships.map((row) => {
    const ent = orgEntitlementMap.get(row.organization.id);
    const pendingTransferRow = orgTransferRows.find(
      (tr) => tr.transfer.organizationId === row.organization.id,
    );

    return {
      id: row.organization.id,
      name: row.organization.name,
      slug: row.organization.slug,
      seats: row.organization.seats,
      plan: ent?.plan ?? "free",
      paidSeats: ent?.paidSeats ?? row.organization.seats,
      renewalSeats: ent?.renewalSeats ?? null,
      hasActiveTeamPlan: ent?.hasActiveTeamPlan ?? false,
      billingInterval: ent?.interval ?? "monthly",
      subscriptionStatus: ent?.subscriptionStatus ?? "free",
      currentPeriodEndIso: ent?.currentPeriodEndIso ?? null,
      isLockedForQuantityChange: ent?.isLockedForQuantityChange ?? false,
      lockReason: ent?.lockReason ?? null,
      myRole: normalizeMembershipRole(row.membership.role),
      pendingTransfer: pendingTransferRow
        ? {
            id: pendingTransferRow.transfer.id,
            toMemberUserId: pendingTransferRow.transfer.toMemberUserId,
            toMemberName: pendingTransferRow.targetUser.name,
            expiresAtIso: pendingTransferRow.transfer.expiresAt.toISOString(),
          }
        : null,
      members: allOrgMembers
        .filter((m) => m.membership.orgId === row.organization.id)
        .map((m) => ({
          membershipId: m.membership.id,
          userId: m.memberUser.id,
          name: m.memberUser.name,
          email: m.memberUser.email,
          role: normalizeMembershipRole(m.membership.role),
        })),
      invitations: allOrgInvites
        .filter((inv) => inv.organizationId === row.organization.id)
        .map((inv) => ({
          id: inv.id,
          email: inv.email,
          role: normalizeMembershipRole(inv.role),
          status: deriveInvitationStatus(inv, now),
          createdAtIso: inv.createdAt.toISOString(),
          expiresAtIso: inv.expiresAt.toISOString(),
          acceptedAtIso: inv.acceptedAt ? inv.acceptedAt.toISOString() : null,
          revokedAtIso: inv.revokedAt ? inv.revokedAt.toISOString() : null,
          resentAtIso: inv.resentAt ? inv.resentAt.toISOString() : null,
          resentCount: inv.resentCount,
        })),
    };
  });

  const incomingInvitations: IncomingTeamInvitation[] = incomingInviteRows
    .filter((row) => row.invitation.revokedAt === null)
    .map((row) => ({
      id: row.invitation.id,
      organizationName: row.organization.name,
      inviterName: row.inviter.name,
      role: normalizeMembershipRole(row.invitation.role),
    }));

  let inspectedInvitation: InspectedInvitationNotice | null = null;
  if (invitationId && !incomingInvitations.some((item) => item.id === invitationId)) {
    const highlighted = highlightedRowList[0];
    if (!highlighted) {
      inspectedInvitation = { state: "not_found" };
    } else {
      const inv = highlighted.invitation;
      const derived = deriveInvitationStatus(inv, now);
      const tokenMatches = Boolean(
        token && inv.tokenHash && hashInvitationToken(token) === inv.tokenHash,
      );
      const isOrgMember = orgIds.includes(highlighted.organization.id);
      const isSameEmail = normalizeInviteEmail(inv.email) === normalizedUserEmail;
      const displayInvitedEmail =
        tokenMatches || isOrgMember || isSameEmail
          ? inv.email
          : maskEmailAddress(inv.email);

      if (derived === "accepted") {
        inspectedInvitation = {
          state: "accepted",
          organizationId: highlighted.organization.id,
          organizationName: highlighted.organization.name,
          invitedEmail: displayInvitedEmail,
        };
      } else if (derived === "canceled") {
        inspectedInvitation = {
          state: "canceled",
          organizationName: highlighted.organization.name,
          invitedEmail: displayInvitedEmail,
        };
      } else if (derived === "expired") {
        inspectedInvitation = {
          state: "expired",
          organizationName: highlighted.organization.name,
          inviterName: highlighted.inviter.name,
          invitedEmail: displayInvitedEmail,
          expiresAtIso: inv.expiresAt.toISOString(),
        };
      } else if (!isSameEmail) {
        inspectedInvitation = {
          state: "email_mismatch",
          organizationName: highlighted.organization.name,
          inviterName: highlighted.inviter.name,
          invitedEmail: displayInvitedEmail,
          role: normalizeMembershipRole(inv.role),
        };
      }
    }
  }

  const incomingTransfers: IncomingOwnerTransferSummary[] = incomingTransferRows.map((row) => ({
    id: row.transfer.id,
    organizationId: row.organization.id,
    organizationName: row.organization.name,
    fromOwnerName: row.fromOwner.name,
    expiresAtIso: row.transfer.expiresAt.toISOString(),
  }));

  return (
    <AccountSettingsShell activeTab="team">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-foreground type-heading-m">Team &amp; invites</h2>
          <p className="text-muted-foreground type-body-s">
            Manage Casefolio Teams seats ($5.99/seat/mo · 2 months free on annual), Shared Spaces,
            invitations, and member roles.
          </p>
        </div>

        <TeamWorkspaceClient
          currentUserId={user.id}
          currentUserEmail={user.email}
          userPlan={effectivePlan}
          activeOrganizationId={session.activeOrganizationId ?? null}
          organizations={organizations}
          incomingInvitations={incomingInvitations}
          incomingTransfers={incomingTransfers}
          inspectedInvitation={inspectedInvitation}
          highlightedInvitationId={invitationId}
          invitationToken={token}
        />
      </div>
    </AccountSettingsShell>
  );
}
