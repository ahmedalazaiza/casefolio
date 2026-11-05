import { and, eq, inArray, type MembershipRole } from "@casefolio/db";
import type { Metadata } from "next";
import Link from "next/link";
import {
  TeamWorkspaceClient,
  type IncomingTeamInvitation,
  type TeamOrganizationSummary,
} from "@/app/(app)/account/team/team-workspace-client";
import { requireSession } from "@/lib/auth/session";
import { db, dbSchema } from "@/lib/db";
import { resolveEffectivePlanForUser } from "@/lib/entitlements/server";

export const metadata: Metadata = {
  title: "Team Workspace — Casefolio",
};

export default async function AccountTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ invitationId?: string }>;
}) {
  const { user, session } = await requireSession("/account/team");
  const { invitationId } = await searchParams;

  const userMemberships = await db
    .select({
      membership: dbSchema.memberships,
      organization: dbSchema.organizations,
    })
    .from(dbSchema.memberships)
    .innerJoin(dbSchema.organizations, eq(dbSchema.memberships.orgId, dbSchema.organizations.id))
    .where(eq(dbSchema.memberships.userId, user.id));

  const orgIds = userMemberships.map((row) => row.organization.id);

  const [allOrgMembers, allOrgPendingInvites, incomingInviteRows, effectivePlan] =
    await Promise.all([
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
            eq(dbSchema.invitations.email, user.email.toLowerCase()),
            eq(dbSchema.invitations.status, "pending"),
          ),
        ),
      resolveEffectivePlanForUser(user.id),
    ]);

  const organizations: TeamOrganizationSummary[] = userMemberships.map((row) => ({
    id: row.organization.id,
    name: row.organization.name,
    slug: row.organization.slug,
    seats: row.organization.seats,
    myRole: row.membership.role as MembershipRole,
    members: allOrgMembers
      .filter((m) => m.membership.orgId === row.organization.id)
      .map((m) => ({
        membershipId: m.membership.id,
        userId: m.memberUser.id,
        name: m.memberUser.name,
        email: m.memberUser.email,
        role: m.membership.role,
      })),
    invitations: allOrgPendingInvites
      .filter((inv) => inv.organizationId === row.organization.id)
      .map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        status: inv.status,
      })),
  }));

  const incomingInvitations: IncomingTeamInvitation[] = incomingInviteRows.map((row) => ({
    id: row.invitation.id,
    organizationName: row.organization.name,
    inviterName: row.inviter.name,
    role: row.invitation.role,
  }));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <span className="text-primary type-overline">Workspace settings</span>
        <h1 className="type-display-m text-foreground">Team &amp; invites</h1>
        <p className="text-muted-foreground type-body-m">
          Create shared studio workspaces and invite editors or reviewers.
        </p>
      </div>

      <nav
        aria-label="Account sections"
        className="border-border flex flex-wrap items-center gap-2 border-b pb-3"
      >
        <Link
          href="/account"
          className="text-muted-foreground hover:text-foreground type-body-s rounded-full px-4 py-1.5 transition-colors"
        >
          Profile
        </Link>
        <Link
          href="/account/team"
          aria-current="page"
          className="border-border bg-elevated text-foreground type-body-s-strong rounded-full border px-4 py-1.5"
        >
          Team &amp; invites
        </Link>
        <Link
          href="/account/billing"
          className="text-muted-foreground hover:text-foreground type-body-s rounded-full px-4 py-1.5 transition-colors"
        >
          Billing &amp; plan
        </Link>
      </nav>

      <TeamWorkspaceClient
        userPlan={effectivePlan}
        activeOrganizationId={session.activeOrganizationId ?? null}
        organizations={organizations}
        incomingInvitations={incomingInvitations}
        highlightedInvitationId={invitationId}
      />
    </div>
  );
}

