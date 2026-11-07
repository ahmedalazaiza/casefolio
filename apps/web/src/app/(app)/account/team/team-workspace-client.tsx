"use client";

import {
  ArrowRightLeft,
  Check,
  Lock,
  LogOut,
  MailPlus,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { UpgradePromptDialog } from "@/components/billing/upgrade-prompt-dialog";
import { Badge, ProBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InputField } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";
import { createOrganizationSchema, inviteTeamMemberSchema } from "@/lib/auth/schemas";
import { can, evaluateEntitlement } from "@/lib/entitlements";

export type CanonicalOrLegacyRole = "owner" | "admin" | "member" | "editor" | "viewer";

export interface TeamOrganizationSummary {
  id: string;
  name: string;
  slug: string;
  seats: number;
  paidSeats?: number;
  renewalSeats?: number | null;
  hasActiveTeamPlan?: boolean;
  myRole: CanonicalOrLegacyRole;
  pendingTransfer?: {
    id: string;
    toMemberUserId: string;
    toMemberName: string;
    expiresAtIso: string;
  } | null;
  members: Array<{
    membershipId: string;
    userId: string;
    name: string;
    email: string;
    role: string;
  }>;
  invitations: Array<{
    id: string;
    email: string;
    role: string;
    status: string;
    expiresAtIso?: string;
  }>;
}

export interface IncomingTeamInvitation {
  id: string;
  organizationName: string;
  inviterName: string;
  role: string;
}

export interface IncomingOwnerTransferSummary {
  id: string;
  organizationId: string;
  organizationName: string;
  fromOwnerName: string;
  expiresAtIso: string;
}

export interface TeamWorkspaceClientProps {
  currentUserId?: string;
  userPlan?: "free" | "pro" | "team";
  activeOrganizationId: string | null;
  organizations: TeamOrganizationSummary[];
  incomingInvitations: IncomingTeamInvitation[];
  incomingTransfers?: IncomingOwnerTransferSummary[];
  highlightedInvitationId?: string;
  invitationToken?: string;
}

function toCanonicalRole(role: string): "owner" | "admin" | "member" {
  if (role === "owner") return "owner";
  if (role === "admin" || role === "editor") return "admin";
  return "member";
}

function formatRoleLabel(role: string): string {
  const canonical = toCanonicalRole(role);
  if (canonical === "owner") return "Owner";
  if (canonical === "admin") return "Admin";
  return "Member";
}

function slugifyName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function TeamWorkspaceClient({
  currentUserId,
  userPlan = "free",
  activeOrganizationId,
  organizations,
  incomingInvitations,
  incomingTransfers = [],
  highlightedInvitationId,
  invitationToken,
}: TeamWorkspaceClientProps) {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [selectedOrgId, setSelectedOrgId] = useState<string>(
    activeOrganizationId ?? organizations[0]?.id ?? "",
  );
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [busyInvitationId, setBusyInvitationId] = useState<string | null>(null);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [memberMessage, setMemberMessage] = useState<string | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);

  const [transferTargetUserId, setTransferTargetUserId] = useState<string>("");
  const [transferReauthConfirmed, setTransferReauthConfirmed] = useState(false);
  const [acceptTransferReauth, setAcceptTransferReauth] = useState<Record<string, boolean>>({});
  const [transferBusy, setTransferBusy] = useState(false);
  const [transferNotice, setTransferNotice] = useState<string | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);

  const [teamUpgradeOpen, setTeamUpgradeOpen] = useState(false);

  const currentOrg =
    organizations.find((org) => org.id === selectedOrgId) ?? organizations[0] ?? null;
  const myCanonicalRole = currentOrg ? toCanonicalRole(currentOrg.myRole) : "member";
  const isOwner = myCanonicalRole === "owner";
  const isAdmin = myCanonicalRole === "admin";
  const canInvite = currentOrg !== null && (isOwner || isAdmin);

  useEffect(() => {
    if (!isOwner && inviteRole === "admin") {
      setInviteRole("member");
    }
  }, [isOwner, inviteRole]);

  const paidSeats = currentOrg?.paidSeats ?? currentOrg?.seats ?? 1;
  const renewalSeats = currentOrg?.renewalSeats ?? null;
  const admissionCeiling =
    renewalSeats !== null ? Math.min(paidSeats, renewalSeats) : paidSeats;
  const activeMembersCount = currentOrg ? currentOrg.members.length : 1;
  const reservedInvitesCount = currentOrg ? currentOrg.invitations.length : 0;
  const seatsUsed = activeMembersCount + reservedInvitesCount;
  const availableSeats = Math.max(0, admissionCeiling - seatsUsed);

  const effectiveOrgPlan: "free" | "pro" | "team" =
    currentOrg?.hasActiveTeamPlan || userPlan === "team" ? "team" : userPlan;

  const seatDecision = evaluateEntitlement(effectiveOrgPlan, "team_seats", {
    seatsUsed,
    seatsLimit: admissionCeiling,
  });
  const canUseTeamSeats = can(effectiveOrgPlan, "team_seats", {
    seatsUsed,
    seatsLimit: admissionCeiling,
  });

  async function handleCreateOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);

    const parsed = createOrganizationSchema.safeParse({
      name: orgName,
      slug: orgSlug || slugifyName(orgName),
    });

    if (!parsed.success) {
      setCreateError(parsed.error.issues[0]?.message ?? "Check workspace details.");
      return;
    }

    setCreating(true);
    const { data, error } = await authClient.organization.create({
      name: parsed.data.name,
      slug: parsed.data.slug,
    });
    setCreating(false);

    if (error) {
      setCreateError(error.message ?? "Could not create team workspace.");
      return;
    }

    if (data?.id) {
      setSelectedOrgId(data.id);
    }
    setOrgName("");
    setOrgSlug("");
    setSlugTouched(false);
    router.refresh();
  }

  async function handleInviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentOrg) return;

    setInviteError(null);
    setInviteStatus(null);

    const parsed = inviteTeamMemberSchema.safeParse({
      organizationId: currentOrg.id,
      email: inviteEmail,
      role: isOwner ? inviteRole : "member",
    });

    if (!parsed.success) {
      setInviteError(parsed.error.issues[0]?.message ?? "Check invitation details.");
      return;
    }

    if (!canUseTeamSeats) {
      setInviteError(seatDecision.message);
      setTeamUpgradeOpen(true);
      return;
    }

    setInviting(true);
    try {
      const response = await fetch("/api/team/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: parsed.data.organizationId,
          email: parsed.data.email,
          role: parsed.data.role,
        }),
      });
      const json = (await response.json()) as
        | { ok: true }
        | { ok: false; code?: string; error?: string };

      if (!response.ok || !json.ok) {
        const message = ("error" in json && json.error) || "Could not send invitation.";
        setInviteError(message);
        if (
          "code" in json &&
          (json.code === "TEAM_PLAN_REQUIRED" || json.code === "TEAM_SEAT_LIMIT_REACHED")
        ) {
          setTeamUpgradeOpen(true);
        }
        return;
      }
    } catch {
      setInviteError("Network error while sending invitation.");
      return;
    } finally {
      setInviting(false);
    }

    setInviteEmail("");
    setInviteStatus(
      `Invitation sent to ${parsed.data.email} (seat reserved for 7 days until accepted or revoked).`,
    );
    router.refresh();
  }

  async function handleAcceptInvitation(invitationId: string) {
    setBusyInvitationId(invitationId);
    setInviteError(null);
    try {
      const response = await fetch(`/api/team/invitations/${invitationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "accept",
          token: invitationId === highlightedInvitationId ? invitationToken : undefined,
        }),
      });
      const json = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !json.ok) {
        setInviteError(json.error ?? "Could not accept invitation.");
        return;
      }
      router.refresh();
    } catch {
      setInviteError("Network error while accepting invitation.");
    } finally {
      setBusyInvitationId(null);
    }
  }

  async function handleResendInvitation(invitationId: string) {
    setBusyInvitationId(invitationId);
    setInviteError(null);
    setInviteStatus(null);
    try {
      const response = await fetch(`/api/team/invitations/${invitationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resend" }),
      });
      const json = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !json.ok) {
        setInviteError(json.error ?? "Could not resend invitation.");
        return;
      }
      setInviteStatus("Invitation email resent with a fresh 7-day link.");
      router.refresh();
    } catch {
      setInviteError("Network error while resending invitation.");
    } finally {
      setBusyInvitationId(null);
    }
  }

  async function handleCancelInvitation(invitationId: string) {
    setBusyInvitationId(invitationId);
    setInviteError(null);
    setInviteStatus(null);
    try {
      const response = await fetch(`/api/team/invitations/${invitationId}`, {
        method: "DELETE",
      });
      const json = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !json.ok) {
        setInviteError(json.error ?? "Could not revoke invitation.");
        return;
      }
      setInviteStatus("Invitation revoked and reserved seat released.");
      router.refresh();
    } catch {
      setInviteError("Network error while revoking invitation.");
    } finally {
      setBusyInvitationId(null);
    }
  }

  async function handleChangeMemberRole(targetUserId: string, nextRole: "admin" | "member") {
    if (!currentOrg) return;
    setBusyMemberId(targetUserId);
    setMemberError(null);
    setMemberMessage(null);
    try {
      const response = await fetch("/api/team/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: currentOrg.id,
          targetUserId,
          role: nextRole,
        }),
      });
      const json = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !json.ok) {
        setMemberError(json.error ?? "Could not update member role.");
        return;
      }
      setMemberMessage(`Updated teammate role to ${formatRoleLabel(nextRole)}.`);
      router.refresh();
    } catch {
      setMemberError("Network error while updating member role.");
    } finally {
      setBusyMemberId(null);
    }
  }

  async function handleRemoveOrLeaveMember(targetUserId: string, isSelf: boolean) {
    if (!currentOrg) return;
    setBusyMemberId(targetUserId);
    setMemberError(null);
    setMemberMessage(null);
    try {
      const response = await fetch("/api/team/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: currentOrg.id,
          targetUserId,
        }),
      });
      const json = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !json.ok) {
        setMemberError(
          json.error ?? (isSelf ? "Could not leave workspace." : "Could not remove member."),
        );
        return;
      }
      setMemberMessage(
        isSelf
          ? "You left the team workspace. Any private space drafts remain accessible for 90 days in your Recovery Portal."
          : "Member removed. Their private space moved to their personal 90-day Recovery Portal (invisible to the team).",
      );
      router.refresh();
    } catch {
      setMemberError("Network error while updating membership.");
    } finally {
      setBusyMemberId(null);
    }
  }

  async function handleRequestOwnershipTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentOrg || !transferTargetUserId) return;
    setTransferBusy(true);
    setTransferError(null);
    setTransferNotice(null);
    try {
      const response = await fetch("/api/team/transfer-ownership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request",
          organizationId: currentOrg.id,
          targetMemberUserId: transferTargetUserId,
          reauthenticated: transferReauthConfirmed,
        }),
      });
      const json = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !json.ok) {
        setTransferError(json.error ?? "Could not initiate ownership transfer.");
        return;
      }
      setTransferNotice(
        "Ownership transfer requested. The recipient must confirm within 48 hours to complete the swap.",
      );
      setTransferReauthConfirmed(false);
      router.refresh();
    } catch {
      setTransferError("Network error while requesting ownership transfer.");
    } finally {
      setTransferBusy(false);
    }
  }

  async function handleAcceptOwnershipTransfer(transferRequestId: string) {
    setTransferBusy(true);
    setTransferError(null);
    setTransferNotice(null);
    try {
      const response = await fetch("/api/team/transfer-ownership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "accept",
          transferRequestId,
          reauthenticated: Boolean(acceptTransferReauth[transferRequestId]),
        }),
      });
      const json = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !json.ok) {
        setTransferError(json.error ?? "Could not accept ownership transfer.");
        return;
      }
      setTransferNotice("Workspace ownership transferred to your account.");
      router.refresh();
    } catch {
      setTransferError("Network error while accepting ownership transfer.");
    } finally {
      setTransferBusy(false);
    }
  }

  const eligibleTransferCandidates =
    currentOrg?.members.filter((m) => toCanonicalRole(m.role) !== "owner") ?? [];

  return (
    <div className="flex flex-col gap-6">
      {incomingTransfers.length > 0 && (
        <Card className="border-primary/30 bg-accent/40 flex flex-col gap-4 p-5">
          <div className="flex items-center gap-2">
            <Badge tone="accent">Ownership transfer</Badge>
            <h2 className="text-foreground type-heading-s">
              Pending workspace ownership handoff
            </h2>
          </div>
          <div className="flex flex-col gap-3">
            {incomingTransfers.map((tr) => (
              <div
                key={tr.id}
                className="border-border bg-elevated flex flex-col gap-3 rounded-xl border p-4"
              >
                <div className="flex flex-col gap-1">
                  <p className="text-foreground type-body-m-strong">{tr.organizationName}</p>
                  <p className="text-muted-foreground type-caption">
                    Requested by {tr.fromOwnerName}. Accepting makes you the sole Billing &amp;
                    Workspace Owner and transitions {tr.fromOwnerName} to Admin.
                  </p>
                </div>
                <label className="text-foreground type-caption flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(acceptTransferReauth[tr.id])}
                    onChange={(e) =>
                      setAcceptTransferReauth((prev) => ({
                        ...prev,
                        [tr.id]: e.target.checked,
                      }))
                    }
                    className="size-4 rounded"
                  />
                  I confirm my identity and accept billing &amp; workspace ownership responsibility.
                </label>
                <div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={transferBusy || !acceptTransferReauth[tr.id]}
                    onClick={() => handleAcceptOwnershipTransfer(tr.id)}
                  >
                    <ArrowRightLeft className="size-4" />
                    Accept workspace ownership
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {incomingInvitations.length > 0 && (
        <Card className="border-primary/30 bg-accent/40 flex flex-col gap-4 p-5">
          <div className="flex items-center gap-2">
            <Badge tone="accent">Pending invite</Badge>
            <h2 className="text-foreground type-heading-s">Team invitations waiting for you</h2>
          </div>
          <div className="flex flex-col gap-3">
            {incomingInvitations.map((invite) => {
              const highlighted = invite.id === highlightedInvitationId;
              return (
                <div
                  key={invite.id}
                  className="border-border bg-elevated flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex flex-col gap-0.5">
                    <p className="text-foreground type-body-m-strong">
                      {invite.organizationName}
                      {highlighted ? " · Selected from email link" : ""}
                    </p>
                    <p className="text-muted-foreground type-caption">
                      Invited by {invite.inviterName} as{" "}
                      <span className="text-foreground font-medium">
                        {formatRoleLabel(invite.role)}
                      </span>{" "}
                      · Includes a private draft space invisible to Owners &amp; Admins
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={busyInvitationId === invite.id}
                    onClick={() => handleAcceptInvitation(invite.id)}
                  >
                    <Check className="size-4" />
                    Accept invitation
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {organizations.length > 0 && currentOrg && (
        <Card className="flex flex-col gap-6 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <Users className="text-primary size-4" />
                <h2 className="text-foreground type-heading-m">{currentOrg.name}</h2>
                <Badge tone="accent">{formatRoleLabel(currentOrg.myRole)}</Badge>
              </div>
              <p className="text-muted-foreground type-caption">
                Workspace slug: <span className="font-mono">{currentOrg.slug}</span> ·{" "}
                {activeMembersCount} active + {reservedInvitesCount} pending of {paidSeats} paid{" "}
                {paidSeats === 1 ? "seat" : "seats"}
                {renewalSeats !== null && renewalSeats < paidSeats
                  ? ` (renews at ${renewalSeats})`
                  : ""}
              </p>
            </div>

            {organizations.length > 1 && (
              <label className="flex items-center gap-2">
                <span className="text-tertiary type-caption">Switch team</span>
                <select
                  aria-label="Active team workspace"
                  value={currentOrg.id}
                  onChange={async (e) => {
                    const nextId = e.target.value;
                    setSelectedOrgId(nextId);
                    await authClient.organization.setActive({ organizationId: nextId });
                    router.refresh();
                  }}
                  className="border-border bg-elevated text-foreground type-body-s h-9 rounded-md border px-3"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name} ({formatRoleLabel(org.myRole)})
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {/* Seat Accounting Pill Bar */}
          <div className="border-border/80 bg-surface/50 grid grid-cols-2 gap-3 rounded-2xl border p-4 sm:grid-cols-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-tertiary type-caption">Paid seats (S)</span>
              <span className="text-foreground type-body-m-strong">{paidSeats}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-tertiary type-caption">Active members</span>
              <span className="text-foreground type-body-m-strong">{activeMembersCount}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-tertiary type-caption">Reserved invites</span>
              <span className="text-foreground type-body-m-strong">{reservedInvitesCount}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-tertiary type-caption">Available seats</span>
              <div className="flex items-center gap-2">
                <span className="text-foreground type-body-m-strong">{availableSeats}</span>
                {isOwner && (
                  <Link
                    href="/account/billing"
                    className="text-primary type-caption underline-offset-4 hover:underline"
                  >
                    Manage seats
                  </Link>
                )}
              </div>
            </div>
          </div>

          <div className="border-border/70 bg-surface/30 flex items-start gap-2.5 rounded-xl border p-3.5">
            <ShieldCheck className="text-primary mt-0.5 size-4 shrink-0" />
            <p className="text-muted-foreground type-caption">
              <span className="text-foreground font-medium">Private Space privacy guarantee:</span>{" "}
              Every member receives Private Spaces inside this team workspace. Team Owners and
              Admins can see aggregate workspace quota totals only — never private project titles,
              content, screenshots, or slugs unless explicitly moved to a Shared Space.
            </p>
          </div>

          {/* Members Directory */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-tertiary type-overline">
                Members ({currentOrg.members.length})
              </h3>
              {currentUserId && !isOwner && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busyMemberId === currentUserId}
                  onClick={() => handleRemoveOrLeaveMember(currentUserId, true)}
                >
                  <LogOut className="size-3.5" />
                  Leave workspace
                </Button>
              )}
            </div>

            <div className="divide-border/70 border-border/80 bg-surface/40 divide-y rounded-2xl border">
              {currentOrg.members.map((member) => {
                const memberRole = toCanonicalRole(member.role);
                const isMemberOwner = memberRole === "owner";
                const isSelf = currentUserId === member.userId;
                const canChangeRole = isOwner && !isMemberOwner && !isSelf;
                const canRemoveMember =
                  !isSelf &&
                  !isMemberOwner &&
                  (isOwner || (isAdmin && memberRole === "member"));

                return (
                  <div
                    key={member.membershipId}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5"
                  >
                    <div className="flex flex-col">
                      <span className="text-foreground type-body-s-strong">
                        {member.name}
                        {isSelf ? " (you)" : ""}
                      </span>
                      <span className="text-muted-foreground type-caption">{member.email}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {canChangeRole ? (
                        <select
                          aria-label={`Role for ${member.name}`}
                          value={memberRole}
                          disabled={busyMemberId === member.userId}
                          onChange={(e) =>
                            handleChangeMemberRole(
                              member.userId,
                              e.target.value as "admin" | "member",
                            )
                          }
                          className="border-border bg-elevated text-foreground type-caption h-8 rounded-lg border px-2.5"
                        >
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                        </select>
                      ) : (
                        <Badge tone={isMemberOwner ? "accent" : "neutral"}>
                          {formatRoleLabel(member.role)}
                        </Badge>
                      )}

                      {canRemoveMember && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={busyMemberId === member.userId}
                          onClick={() => handleRemoveOrLeaveMember(member.userId, false)}
                        >
                          <UserMinus className="size-3.5" />
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {memberError && (
              <p role="alert" className="text-destructive type-caption">
                {memberError}
              </p>
            )}
            {memberMessage && (
              <p role="status" className="text-success type-caption">
                {memberMessage}
              </p>
            )}
          </div>

          {canInvite && !canUseTeamSeats && (
            <div
              data-testid="team-seats-upgrade-banner"
              className="border-border bg-surface flex flex-col justify-between gap-3 rounded-xl border p-4 sm:flex-row sm:items-center"
            >
              <div className="flex items-start gap-3">
                <Lock className="text-primary mt-0.5 size-4 shrink-0" />
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground type-body-s-strong">
                      {effectiveOrgPlan === "team"
                        ? "All paid seats are currently assigned or reserved"
                        : "Collaborative seats require Casefolio Teams"}
                    </span>
                    <ProBadge />
                  </div>
                  <p className="text-muted-foreground type-caption">{seatDecision.message}</p>
                </div>
              </div>
              {effectiveOrgPlan === "team" && isOwner ? (
                <Button asChild size="sm" data-testid="upgrade-to-team-button">
                  <Link href="/account/billing">Add paid seats</Link>
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  data-testid="upgrade-to-team-button"
                  onClick={() => setTeamUpgradeOpen(true)}
                >
                  Upgrade to Teams
                </Button>
              )}
            </div>
          )}

          {canInvite && (
            <form
              onSubmit={handleInviteMember}
              className="border-border flex flex-col gap-4 border-t pt-6"
            >
              <div className="flex flex-col gap-1">
                <h3 className="text-foreground type-body-m-strong">Invite a teammate</h3>
                <p className="text-muted-foreground type-caption">
                  Admins can invite members and publish Shared Space projects; Members collaborate on
                  Shared Space drafts and control their own Private Spaces.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-[1fr_180px_auto] sm:items-end">
                <InputField
                  label="Teammate email"
                  type="email"
                  placeholder="colleague@studio.design"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="invite-role-select" className="text-foreground type-caption">
                    Role
                  </label>
                  <select
                    id="invite-role-select"
                    value={isOwner ? inviteRole : "member"}
                    disabled={!isOwner}
                    onChange={(e) => setInviteRole(e.target.value as "admin" | "member")}
                    className="border-input bg-elevated text-foreground focus-visible:ring-ring/40 type-body-m h-11 rounded-2xl border px-3.5 outline-none focus-visible:ring-2"
                  >
                    <option value="member">Member</option>
                    {isOwner && <option value="admin">Admin</option>}
                  </select>
                </div>

                <Button type="submit" disabled={inviting}>
                  <MailPlus className="size-4" />
                  {inviting ? "Sending..." : "Send invite"}
                </Button>
              </div>

              {inviteError && (
                <p role="alert" className="text-destructive type-caption">
                  {inviteError}
                </p>
              )}
              {inviteStatus && (
                <p role="status" className="text-success type-caption">
                  {inviteStatus}
                </p>
              )}
            </form>
          )}

          {currentOrg.invitations.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-tertiary type-overline">
                Pending invitations ({currentOrg.invitations.length})
              </h3>
              <div className="divide-border border-border divide-y rounded-lg border">
                {currentOrg.invitations.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-foreground type-body-s">{inv.email}</span>
                      <Badge tone="draft">{formatRoleLabel(inv.role)}</Badge>
                      <span className="text-muted-foreground type-caption">Seat reserved</span>
                    </div>
                    {(isOwner || isAdmin) && (
                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={busyInvitationId === inv.id}
                          onClick={() => handleResendInvitation(inv.id)}
                        >
                          <RefreshCw className="size-3.5" />
                          Resend
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={busyInvitationId === inv.id}
                          onClick={() => handleCancelInvitation(inv.id)}
                        >
                          <X className="size-3.5" />
                          Revoke
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reauthenticated Owner Transfer (`Spec §6.5`) */}
          {isOwner && eligibleTransferCandidates.length > 0 && (
            <form
              onSubmit={handleRequestOwnershipTransfer}
              className="border-border flex flex-col gap-3 border-t pt-6"
            >
              <div className="flex flex-col gap-1">
                <h3 className="text-foreground type-body-m-strong">
                  Transfer workspace ownership
                </h3>
                <p className="text-muted-foreground type-caption">
                  Transfers sole Billing &amp; Workspace Owner authority to an existing member after
                  mutual confirmation. Your role becomes Admin once accepted.
                </p>
              </div>

              {currentOrg.pendingTransfer && (
                <div className="border-border bg-surface rounded-xl border p-3">
                  <p className="text-foreground type-caption">
                    Pending transfer to{" "}
                    <span className="font-medium">{currentOrg.pendingTransfer.toMemberName}</span>{" "}
                    (expires{" "}
                    {new Date(currentOrg.pendingTransfer.expiresAtIso).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                    ).
                  </p>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="owner-transfer-select" className="text-foreground type-caption">
                    New workspace Owner
                  </label>
                  <select
                    id="owner-transfer-select"
                    value={transferTargetUserId}
                    onChange={(e) => setTransferTargetUserId(e.target.value)}
                    className="border-input bg-elevated text-foreground type-body-s h-10 rounded-xl border px-3"
                  >
                    <option value="">Select an existing member...</option>
                    {eligibleTransferCandidates.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name} ({m.email})
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  type="submit"
                  variant="secondary"
                  size="sm"
                  disabled={transferBusy || !transferTargetUserId || !transferReauthConfirmed}
                >
                  <ArrowRightLeft className="size-4" />
                  Request transfer
                </Button>
              </div>

              <label className="text-muted-foreground type-caption flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={transferReauthConfirmed}
                  onChange={(e) => setTransferReauthConfirmed(e.target.checked)}
                  className="size-4 rounded"
                />
                I confirm my session identity to hand off workspace &amp; billing ownership.
              </label>

              {transferError && (
                <p role="alert" className="text-destructive type-caption">
                  {transferError}
                </p>
              )}
              {transferNotice && (
                <p role="status" className="text-success type-caption">
                  {transferNotice}
                </p>
              )}
            </form>
          )}
        </Card>
      )}

      <Card className="flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-foreground type-heading-m">
            {organizations.length === 0 ? "Create your team workspace" : "Create another workspace"}
          </h2>
          <p className="text-muted-foreground type-body-s">
            Collaborate in Shared Spaces while keeping every designer&apos;s Private Spaces isolated
            by default (1–25 self-serve seats).
          </p>
        </div>

        <form onSubmit={handleCreateOrganization} className="grid gap-4 sm:grid-cols-2">
          <InputField
            label="Team or studio name"
            placeholder="Orbit Design Studio"
            value={orgName}
            onChange={(e) => {
              const nextName = e.target.value;
              setOrgName(nextName);
              if (!slugTouched) {
                setOrgSlug(slugifyName(nextName));
              }
            }}
            required
          />

          <InputField
            label="Workspace slug"
            placeholder="orbit-design-studio"
            value={orgSlug}
            onChange={(e) => {
              setSlugTouched(true);
              setOrgSlug(e.target.value);
            }}
            required
          />

          {createError && (
            <p role="alert" className="text-destructive type-caption sm:col-span-2">
              {createError}
            </p>
          )}

          <div className="sm:col-span-2">
            <Button type="submit" disabled={creating}>
              <Plus className="size-4" />
              {creating ? "Creating..." : "Create team workspace"}
            </Button>
          </div>
        </form>
      </Card>

      <UpgradePromptDialog
        open={teamUpgradeOpen}
        onOpenChange={setTeamUpgradeOpen}
        requiredPlan="team"
        orgId={currentOrg?.id ?? null}
        featureTitle="Unlock Casefolio Teams seats"
        featureDescription="Subscribe to Casefolio Teams ($18/seat/mo or $15/seat/mo billed yearly, 1–25 self-serve seats) to collaborate in Shared Spaces with per-member Private Spaces."
      />
    </div>
  );
}
