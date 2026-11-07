"use client";

import { Check, Lock, MailPlus, Plus, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { UpgradePromptDialog } from "@/components/billing/upgrade-prompt-dialog";
import { Badge, ProBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InputField } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";
import { createOrganizationSchema, inviteTeamMemberSchema } from "@/lib/auth/schemas";
import { can, evaluateEntitlement } from "@/lib/entitlements";

export interface TeamOrganizationSummary {
  id: string;
  name: string;
  slug: string;
  seats: number;
  myRole: "owner" | "editor" | "viewer";
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
  }>;
}

export interface IncomingTeamInvitation {
  id: string;
  organizationName: string;
  inviterName: string;
  role: string;
}

export interface TeamWorkspaceClientProps {
  userPlan?: "free" | "pro" | "team";
  activeOrganizationId: string | null;
  organizations: TeamOrganizationSummary[];
  incomingInvitations: IncomingTeamInvitation[];
  highlightedInvitationId?: string;
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
  userPlan = "free",
  activeOrganizationId,
  organizations,
  incomingInvitations,
  highlightedInvitationId,
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
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [busyInvitationId, setBusyInvitationId] = useState<string | null>(null);
  const [teamUpgradeOpen, setTeamUpgradeOpen] = useState(false);

  const currentOrg =
    organizations.find((org) => org.id === selectedOrgId) ?? organizations[0] ?? null;
  const canInvite =
    currentOrg !== null && (currentOrg.myRole === "owner" || currentOrg.myRole === "editor");
  const seatsUsed = currentOrg ? currentOrg.members.length + currentOrg.invitations.length : 1;
  const seatDecision = evaluateEntitlement(userPlan, "team_seats", {
    seatsUsed,
    seatsLimit: currentOrg?.seats ?? 3,
  });
  const canUseTeamSeats = can(userPlan, "team_seats", {
    seatsUsed,
    seatsLimit: currentOrg?.seats ?? 3,
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
      role: inviteRole,
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
    setInviteStatus(`Invitation sent to ${parsed.data.email}.`);
    router.refresh();
  }

  async function handleAcceptInvitation(invitationId: string) {
    setBusyInvitationId(invitationId);
    setInviteError(null);
    const { error } = await authClient.organization.acceptInvitation({ invitationId });
    setBusyInvitationId(null);

    if (error) {
      setInviteError(error.message ?? "Could not accept invitation.");
      return;
    }
    router.refresh();
  }

  async function handleCancelInvitation(invitationId: string) {
    setBusyInvitationId(invitationId);
    const { error } = await authClient.organization.cancelInvitation({ invitationId });
    setBusyInvitationId(null);
    if (!error) {
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-6">
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
                      <span className="text-foreground capitalize">{invite.role}</span>
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
                <Badge tone="accent">{currentOrg.myRole}</Badge>
              </div>
              <p className="text-muted-foreground type-caption">
                Workspace slug: <span className="font-mono">{currentOrg.slug}</span> ·{" "}
                {currentOrg.members.length} of {currentOrg.seats} seats in use
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
                      {org.name} ({org.myRole})
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-tertiary type-overline">Members ({currentOrg.members.length})</h3>
            <div className="divide-border/70 border-border/80 bg-surface/40 divide-y rounded-2xl border">
              {currentOrg.members.map((member) => (
                <div
                  key={member.membershipId}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3.5"
                >
                  <div className="flex flex-col">
                    <span className="text-foreground type-body-s-strong">{member.name}</span>
                    <span className="text-muted-foreground type-caption">{member.email}</span>
                  </div>
                  <Badge tone={member.role === "owner" ? "accent" : "neutral"}>
                    {member.role}
                  </Badge>
                </div>
              ))}
            </div>
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
                      Collaborative seats require Casefolio Team
                    </span>
                    <ProBadge />
                  </div>
                  <p className="text-muted-foreground type-caption">{seatDecision.message}</p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                data-testid="upgrade-to-team-button"
                onClick={() => setTeamUpgradeOpen(true)}
              >
                Upgrade to Team
              </Button>
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
                  Editors can edit shared case studies; viewers can review drafts before publish.
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
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as "editor" | "viewer")}
                    className="border-input bg-elevated text-foreground focus-visible:ring-ring/40 type-body-m h-11 rounded-2xl border px-3.5 outline-none focus-visible:ring-2"
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
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
                    <div className="flex items-center gap-2">
                      <span className="text-foreground type-body-s">{inv.email}</span>
                      <Badge tone="draft">{inv.role}</Badge>
                    </div>
                    {currentOrg.myRole === "owner" && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busyInvitationId === inv.id}
                        onClick={() => handleCancelInvitation(inv.id)}
                      >
                        <X className="size-3.5" />
                        Cancel
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      <Card className="flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-foreground type-heading-m">
            {organizations.length === 0 ? "Create your team workspace" : "Create another workspace"}
          </h2>
          <p className="text-muted-foreground type-body-s">
            Collaborate with fellow designers and share case-study templates across 3+ team seats.
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
        featureTitle="Unlock collaborative Team seats"
        featureDescription="Upgrade to Casefolio Team ($29/mo or $24/mo billed yearly) to invite 3+ editors and reviewers into shared studio workspaces."
      />
    </div>
  );
}
