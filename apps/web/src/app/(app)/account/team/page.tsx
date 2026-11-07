import { and, eq, gt, inArray, normalizeMembershipRole } from "@casefolio/db";
import type { Metadata } from "next";
import {
  TeamWorkspaceClient,
  type IncomingOwnerTransferSummary,
  type IncomingTeamInvitation,
  type TeamOrganizationSummary,
} from "@/app/(app)/account/team/team-workspace-client";
import { AccountSettingsShell } from "@/components/account/account-settings-shell";
import { requireSession } from "@/lib/auth/session";
import { db, dbSchema } from "@/lib/db";
import {
  ensureTeamWorkspaceForOrganization,
  resolveEffectivePlanForUser,
  resolveWorkspaceEntitlementState,
} from "@/lib/entitlements/server";
import { normalizeInviteEmail } from "@/lib/entitlements/team-invitations";

export const metadata: Metadata = {
  title: "Team Workspace — Casefolio",
};

export default async function AccountTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ invitationId?: string; token?: string }>;
}) {
  const { user, session } = await requireSession("/account/team");
  const { invitationId, token } = await searchParams;
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
    allOrgPendingInvites,
    incomingInviteRows,
    effectivePlan,
    orgTransferRows,
    incomingTransferRows,
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
          .where(
            and(
              inArray(dbSchema.invitations.organizationId, orgIds),
              eq(dbSchema.invitations.status, "pending"),
              gt(dbSchema.invitations.expiresAt, now),
            ),
          )
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
  ]);

  const orgEntitlementMap = new Map<
    string,
    { paidSeats: number; renewalSeats: number | null; hasActiveTeamPlan: boolean }
  >();

  await Promise.all(
    userMemberships.map(async (row) => {
      const ws = await ensureTeamWorkspaceForOrganization(row.organization.id, user.id);
      const state = await resolveWorkspaceEntitlementState(ws.workspaceId, now);
      orgEntitlementMap.set(row.organization.id, {
        paidSeats: state?.plan === "team" ? state.paidSeats : row.organization.seats,
        renewalSeats: state?.plan === "team" ? state.renewalQuantity : null,
        hasActiveTeamPlan: state?.plan === "team" && state.lifecycle.grantsPaidAccess,
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
      paidSeats: ent?.paidSeats ?? row.organization.seats,
      renewalSeats: ent?.renewalSeats ?? null,
      hasActiveTeamPlan: ent?.hasActiveTeamPlan ?? false,
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
      invitations: allOrgPendingInvites
        .filter((inv) => inv.organizationId === row.organization.id)
        .map((inv) => ({
          id: inv.id,
          email: inv.email,
          role: normalizeMembershipRole(inv.role),
          status: inv.status,
          expiresAtIso: inv.expiresAt.toISOString(),
        })),
    };
  });

  const incomingInvitations: IncomingTeamInvitation[] = incomingInviteRows.map((row) => ({
    id: row.invitation.id,
    organizationName: row.organization.name,
    inviterName: row.inviter.name,
    role: normalizeMembershipRole(row.invitation.role),
  }));

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
            Manage team seats, Shared Spaces, and per-member Private Spaces across your studio
            workspaces.
          </p>
        </div>

        <TeamWorkspaceClient
          currentUserId={user.id}
          userPlan={effectivePlan}
          activeOrganizationId={session.activeOrganizationId ?? null}
          organizations={organizations}
          incomingInvitations={incomingInvitations}
          incomingTransfers={incomingTransfers}
          highlightedInvitationId={invitationId}
          invitationToken={token}
        />
      </div>
    </AccountSettingsShell>
  );
}
