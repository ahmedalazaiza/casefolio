"use client";

import type { PlanTier } from "@casefolio/db";
import {
  AlertTriangle,
  ArrowRightLeft,
  Check,
  Copy,
  Loader2,
  Lock,
  LogOut,
  MailPlus,
  Minus,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PaddleCheckoutModal } from "@/components/billing/paddle-checkout-modal";
import { UpgradePromptDialog } from "@/components/billing/upgrade-prompt-dialog";
import { Badge, ProBadge, TeamsBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, InputField } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import { createOrganizationSchema, inviteTeamMemberSchema } from "@/lib/auth/schemas";
import {
  clampTeamsSeats,
  formatUsdFromCents,
  TEAMS_MAX_SELF_SERVE_SEATS,
  TEAMS_MIN_SEATS,
} from "@/lib/billing/plans";
import { can, evaluateEntitlement } from "@/lib/entitlements";

export type CanonicalOrLegacyRole = "owner" | "admin" | "member" | "editor" | "viewer";

export interface TeamInvitationHistoryItem {
  id: string;
  email: string;
  role: string;
  status: "pending" | "accepted" | "expired" | "canceled";
  createdAtIso?: string;
  expiresAtIso?: string;
  acceptedAtIso?: string | null;
  revokedAtIso?: string | null;
  resentAtIso?: string | null;
  resentCount?: number;
}

export interface TeamOrganizationSummary {
  id: string;
  name: string;
  slug: string;
  seats: number;
  plan?: PlanTier;
  paidSeats?: number;
  renewalSeats?: number | null;
  hasActiveTeamPlan?: boolean;
  billingInterval?: "monthly" | "yearly";
  subscriptionStatus?: string;
  currentPeriodEndIso?: string | null;
  isLockedForQuantityChange?: boolean;
  lockReason?: string | null;
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
  invitations: TeamInvitationHistoryItem[];
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

export type InspectedInvitationNotice =
  | { state: "not_found" }
  | {
      state: "email_mismatch";
      organizationName: string;
      inviterName: string;
      invitedEmail: string;
      role: string;
    }
  | {
      state: "accepted";
      organizationId: string;
      organizationName: string;
      invitedEmail: string;
    }
  | {
      state: "expired";
      organizationName: string;
      inviterName: string;
      invitedEmail: string;
      expiresAtIso: string;
    }
  | {
      state: "canceled";
      organizationName: string;
      invitedEmail: string;
    };

export interface TeamWorkspaceClientProps {
  currentUserId?: string;
  currentUserEmail?: string;
  userPlan?: PlanTier;
  activeOrganizationId: string | null;
  organizations: TeamOrganizationSummary[];
  incomingInvitations: IncomingTeamInvitation[];
  incomingTransfers?: IncomingOwnerTransferSummary[];
  inspectedInvitation?: InspectedInvitationNotice | null;
  highlightedInvitationId?: string;
  invitationToken?: string;
}

interface SeatIncreasePreviewState {
  operationId: string;
  currentSeats: number;
  targetSeats: number;
  addedSeats: number;
  immediateChargeCents: number;
  renewalChargeCents: number;
  interval: "monthly" | "yearly";
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

function formatShortTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function slugifyName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

async function switchActiveWorkspaceSession(organizationId: string | null): Promise<void> {
  await fetch("/api/workspaces", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ organizationId }),
  }).catch(() => undefined);
}

export function TeamWorkspaceClient({
  currentUserId,
  currentUserEmail,
  userPlan: _userPlan = "free",
  activeOrganizationId,
  organizations,
  incomingInvitations,
  incomingTransfers = [],
  inspectedInvitation = null,
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
  const [latestInviteUrl, setLatestInviteUrl] = useState<string | null>(null);
  const [recentInviteUrls, setRecentInviteUrls] = useState<Record<string, string>>({});
  const [copiedInvitationId, setCopiedInvitationId] = useState<string | null>(null);
  const [inviteFilter, setInviteFilter] = useState<"all" | "pending" | "accepted" | "inactive">(
    "all",
  );
  const [busyInvitationId, setBusyInvitationId] = useState<string | null>(null);
  const [switchingAccount, setSwitchingAccount] = useState(false);

  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [memberMessage, setMemberMessage] = useState<string | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [confirmDepartureTarget, setConfirmDepartureTarget] = useState<{
    targetUserId: string;
    memberName: string;
    isSelf: boolean;
  } | null>(null);

  // Inline seat management state
  const [targetSeatCount, setTargetSeatCount] = useState<number>(TEAMS_MIN_SEATS);
  const [seatActionBusy, setSeatActionBusy] = useState(false);
  const [seatActionMessage, setSeatActionMessage] = useState<string | null>(null);
  const [seatActionError, setSeatActionError] = useState<string | null>(null);
  const [seatIncreasePreview, setSeatIncreasePreview] =
    useState<SeatIncreasePreviewState | null>(null);
  const [teamCheckoutOpen, setTeamCheckoutOpen] = useState(false);

  const [transferTargetUserId, setTransferTargetUserId] = useState<string>("");
  const [transferBusy, setTransferBusy] = useState(false);
  const [transferNotice, setTransferNotice] = useState<string | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferStepUpTarget, setTransferStepUpTarget] = useState<
    | { mode: "request" }
    | { mode: "accept"; transferRequestId: string; organizationName: string }
    | null
  >(null);
  const [transferStepUpMethod, setTransferStepUpMethod] = useState<"password" | "otp">(
    "password",
  );
  const [transferStepUpPassword, setTransferStepUpPassword] = useState("");
  const [transferStepUpOtp, setTransferStepUpOtp] = useState("");
  const [transferOtpSent, setTransferOtpSent] = useState(false);
  const [transferOtpSending, setTransferOtpSending] = useState(false);
  const [transferModalError, setTransferModalError] = useState<string | null>(null);

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

  useEffect(() => {
    if (currentOrg) {
      setTargetSeatCount(
        clampTeamsSeats(currentOrg.renewalSeats ?? currentOrg.paidSeats ?? TEAMS_MIN_SEATS),
      );
      setSeatActionError(null);
      setSeatActionMessage(null);
    }
  }, [currentOrg?.id, currentOrg?.paidSeats, currentOrg?.renewalSeats]);

  const admissionCeiling =
    renewalSeats !== null ? Math.min(paidSeats, renewalSeats) : paidSeats;
  const activeMembersCount = currentOrg ? currentOrg.members.length : 1;

  const pendingInvitationsCount = useMemo(() => {
    if (!currentOrg) return 0;
    const distinctPending = new Set(
      currentOrg.invitations
        .filter((inv) => inv.status === "pending")
        .map((inv) => inv.email.trim().toLowerCase()),
    );
    return distinctPending.size;
  }, [currentOrg]);

  const seatsUsed = activeMembersCount + pendingInvitationsCount;
  const availableSeats = Math.max(0, admissionCeiling - seatsUsed);

  const effectiveOrgPlan: PlanTier =
    currentOrg?.hasActiveTeamPlan ||
    currentOrg?.plan === "team" ||
    currentOrg?.plan === "plus"
      ? "team"
      : "free";

  const isTeamAtMaxCap =
    effectiveOrgPlan === "team" && seatsUsed >= TEAMS_MAX_SELF_SERVE_SEATS;

  const seatDecision = evaluateEntitlement(effectiveOrgPlan, "team_seats", {
    seatsUsed,
    seatsLimit: admissionCeiling,
  });
  const canUseTeamSeats = can(effectiveOrgPlan, "team_seats", {
    seatsUsed,
    seatsLimit: admissionCeiling,
  });

  const filteredInvitations = useMemo(() => {
    if (!currentOrg) return [];
    return currentOrg.invitations.filter((inv) => {
      if (inviteFilter === "pending") return inv.status === "pending";
      if (inviteFilter === "accepted") return inv.status === "accepted";
      if (inviteFilter === "inactive") {
        return inv.status === "expired" || inv.status === "canceled";
      }
      return true;
    });
  }, [currentOrg, inviteFilter]);

  async function handleSwitchAccountForInvitation() {
    setSwitchingAccount(true);
    const params = new URLSearchParams();
    if (highlightedInvitationId) params.set("invitationId", highlightedInvitationId);
    if (invitationToken) params.set("token", invitationToken);
    const callbackPath =
      params.size > 0 ? `/account/team?${params.toString()}` : "/account/team";
    try {
      await authClient.signOut();
    } catch {
      // Proceed to sign-in even if session cleanup had a transient hiccup
    }
    router.push(`/sign-in?callbackUrl=${encodeURIComponent(callbackPath)}`);
    router.refresh();
  }

  async function handleCopyInvitationLink(invitationId: string, explicitUrl?: string) {
    const resolvedUrl =
      explicitUrl ??
      recentInviteUrls[invitationId] ??
      `${window.location.origin}/account/team?invitationId=${encodeURIComponent(invitationId)}`;
    try {
      await navigator.clipboard.writeText(resolvedUrl);
      setCopiedInvitationId(invitationId);
      toast.success("Copied invitation link to clipboard.");
      window.setTimeout(() => {
        setCopiedInvitationId((prev) => (prev === invitationId ? null : prev));
      }, 2500);
    } catch {
      toast.error("Could not access clipboard.");
    }
  }

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

    if (error) {
      setCreating(false);
      setCreateError(error.message ?? "Could not create team workspace.");
      return;
    }

    if (data?.id) {
      await authClient.organization
        .setActive({ organizationId: data.id })
        .catch(() => undefined);
      await switchActiveWorkspaceSession(data.id);
      setSelectedOrgId(data.id);
    }
    setCreating(false);
    setOrgName("");
    setOrgSlug("");
    setSlugTouched(false);
    toast.success(`Created team workspace “${parsed.data.name}”.`);
    router.refresh();
  }

  async function handleInviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentOrg) return;

    setInviteError(null);
    setInviteStatus(null);
    setLatestInviteUrl(null);

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
      if (effectiveOrgPlan !== "team") {
        setTeamUpgradeOpen(true);
      }
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
        | {
            ok: true;
            invitation: { id: string; email: string; role: string };
            inviteUrl?: string;
            emailDelivered?: boolean;
          }
        | { ok: false; code?: string; error?: string };

      if (!response.ok || !json.ok) {
        const message = ("error" in json && json.error) || "Could not send invitation.";
        setInviteError(message);
        if ("code" in json && json.code === "TEAM_PLAN_REQUIRED") {
          setTeamUpgradeOpen(true);
        }
        return;
      }

      if (json.inviteUrl) {
        setLatestInviteUrl(json.inviteUrl);
        setRecentInviteUrls((prev) => ({
          ...prev,
          [json.invitation.id]: json.inviteUrl!,
        }));
      }

      setInviteEmail("");
      setInviteStatus(
        json.emailDelivered === false
          ? `Invitation created for ${parsed.data.email} (seat reserved for 7 days). Email delivery isn't configured in this environment — copy the invite link below to share directly.`
          : `Invitation email sent to ${parsed.data.email} (seat reserved for 7 days until accepted or revoked).`,
      );
      router.refresh();
    } catch {
      setInviteError("Network error while sending invitation.");
    } finally {
      setInviting(false);
    }
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
      const json = (await response.json()) as {
        ok: boolean;
        organizationId?: string;
        error?: string;
      };
      if (!response.ok || !json.ok) {
        setInviteError(json.error ?? "Could not accept invitation.");
        return;
      }
      if (json.organizationId) {
        await switchActiveWorkspaceSession(json.organizationId);
        setSelectedOrgId(json.organizationId);
      }
      toast.success("Joined team workspace!");
      router.refresh();
    } catch {
      setInviteError("Network error while accepting invitation.");
    } finally {
      setBusyInvitationId(null);
    }
  }

  async function handleDeclineInvitation(invitationId: string) {
    setBusyInvitationId(invitationId);
    setInviteError(null);
    try {
      const response = await fetch(`/api/team/invitations/${invitationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "decline",
          token: invitationId === highlightedInvitationId ? invitationToken : undefined,
        }),
      });
      const json = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !json.ok) {
        setInviteError(json.error ?? "Could not decline invitation.");
        return;
      }
      toast.message("Invitation declined.");
      router.refresh();
    } catch {
      setInviteError("Network error while declining invitation.");
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
      const json = (await response.json()) as {
        ok: boolean;
        inviteUrl?: string;
        emailDelivered?: boolean;
        error?: string;
      };
      if (!response.ok || !json.ok) {
        setInviteError(json.error ?? "Could not resend invitation.");
        return;
      }
      if (json.inviteUrl) {
        setLatestInviteUrl(json.inviteUrl);
        setRecentInviteUrls((prev) => ({
          ...prev,
          [invitationId]: json.inviteUrl!,
        }));
      }
      setInviteStatus(
        json.emailDelivered === false
          ? "Generated a fresh 7-day invite link — copy the link to share directly."
          : "Invitation email resent with a fresh 7-day link.",
      );
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

  async function handlePreviewOrUpdateSeats() {
    if (!currentOrg || !isOwner) return;
    setSeatActionError(null);
    setSeatActionMessage(null);

    if (targetSeatCount === paidSeats) return;

    setSeatActionBusy(true);
    try {
      if (targetSeatCount > paidSeats) {
        if (targetSeatCount < seatsUsed) {
        setSeatActionError(
          `Free ${seatsUsed - targetSeatCount} more seat${seatsUsed - targetSeatCount === 1 ? "" : "s"} by revoking pending invites or removing members below before reducing to ${targetSeatCount} seats.`,
        );
        return;
      }

      const res = await fetch("/api/paddle/seats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "preview_increase",
            organizationId: currentOrg.id,
            targetSeats: targetSeatCount,
          }),
        });
        const json = (await res.json()) as
          | ({ ok: true } & SeatIncreasePreviewState)
          | { ok: false; error?: string };
        if (!res.ok || !json.ok) {
          setSeatActionError(
            ("error" in json && json.error) || "Could not preview seat increase.",
          );
          return;
        }
        setSeatIncreasePreview({
          operationId: json.operationId,
          currentSeats: json.currentSeats,
          targetSeats: json.targetSeats,
          addedSeats: json.addedSeats,
          immediateChargeCents: json.immediateChargeCents,
          renewalChargeCents: json.renewalChargeCents,
          interval: json.interval,
        });
        return;
      }

      if (targetSeatCount < seatsUsed) {
        setSeatActionError(
          `Free ${seatsUsed - targetSeatCount} more seat${seatsUsed - targetSeatCount === 1 ? "" : "s"} by revoking pending invites or removing members below before reducing to ${targetSeatCount} seats.`,
        );
        return;
      }

      const res = await fetch("/api/paddle/seats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "schedule_decrease",
          organizationId: currentOrg.id,
          targetSeats: targetSeatCount,
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setSeatActionError(json.error ?? "Could not schedule seat decrease.");
        return;
      }
      setSeatActionMessage(
        `Scheduled renewal seat count to ${targetSeatCount} seats starting next billing period.`,
      );
      router.refresh();
    } catch {
      setSeatActionError("Network error while updating team seats.");
    } finally {
      setSeatActionBusy(false);
    }
  }

  async function handleConfirmSeatIncrease() {
    if (!currentOrg || !seatIncreasePreview) return;
    setSeatActionBusy(true);
    setSeatActionError(null);
    try {
      if (targetSeatCount < seatsUsed) {
        setSeatActionError(
          `Free ${seatsUsed - targetSeatCount} more seat${seatsUsed - targetSeatCount === 1 ? "" : "s"} by revoking pending invites or removing members below before reducing to ${targetSeatCount} seats.`,
        );
        return;
      }

      const res = await fetch("/api/paddle/seats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm_increase",
          organizationId: currentOrg.id,
          operationId: seatIncreasePreview.operationId,
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setSeatActionError(json.error ?? "Could not confirm seat increase.");
        return;
      }
      toast.success(`Updated workspace to ${seatIncreasePreview.targetSeats} paid seats!`);
      setSeatActionMessage(
        `Workspace expanded to ${seatIncreasePreview.targetSeats} paid seats.`,
      );
      setSeatIncreasePreview(null);
      router.refresh();
    } catch {
      setSeatActionError("Network error while confirming seat increase.");
    } finally {
      setSeatActionBusy(false);
    }
  }

  async function handleCancelScheduledDecrease() {
    if (!currentOrg) return;
    setSeatActionBusy(true);
    setSeatActionError(null);
    setSeatActionMessage(null);
    try {
      if (targetSeatCount < seatsUsed) {
        setSeatActionError(
          `Free ${seatsUsed - targetSeatCount} more seat${seatsUsed - targetSeatCount === 1 ? "" : "s"} by revoking pending invites or removing members below before reducing to ${targetSeatCount} seats.`,
        );
        return;
      }

      const res = await fetch("/api/paddle/seats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel_decrease",
          organizationId: currentOrg.id,
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setSeatActionError(json.error ?? "Could not cancel scheduled seat decrease.");
        return;
      }
      setTargetSeatCount(paidSeats);
      setSeatActionMessage(`Kept all ${paidSeats} paid seats active for upcoming renewals.`);
      router.refresh();
    } catch {
      setSeatActionError("Network error while canceling scheduled decrease.");
    } finally {
      setSeatActionBusy(false);
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

  async function executeRemoveOrLeaveMember(targetUserId: string, isSelf: boolean) {
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
      setConfirmDepartureTarget(null);
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

  function openTransferStepUp(
    target:
      | { mode: "request" }
      | { mode: "accept"; transferRequestId: string; organizationName: string },
  ) {
    setTransferError(null);
    setTransferNotice(null);
    setTransferModalError(null);
    setTransferStepUpPassword("");
    setTransferStepUpOtp("");
    setTransferOtpSent(false);
    setTransferStepUpMethod("password");
    setTransferStepUpTarget(target);
  }

  function handleRequestOwnershipTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentOrg || !transferTargetUserId) return;
    openTransferStepUp({ mode: "request" });
  }

  async function handleSendTransferStepUpOtp() {
    setTransferModalError(null);
    setTransferOtpSending(true);
    try {
      const res = await fetch("/api/account/step-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_otp",
          purpose: "ownership_transfer",
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setTransferModalError(json.error ?? "Could not send confirmation code.");
        return;
      }
      setTransferOtpSent(true);
    } catch {
      setTransferModalError("Network error while sending confirmation code.");
    } finally {
      setTransferOtpSending(false);
    }
  }

  async function handleConfirmTransferStepUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!transferStepUpTarget) return;
    if (transferStepUpTarget.mode === "request" && (!currentOrg || !transferTargetUserId)) {
      return;
    }

    setTransferBusy(true);
    setTransferModalError(null);
    setTransferError(null);
    setTransferNotice(null);

    try {
      const stepUpBody =
        transferStepUpMethod === "password"
          ? {
              action: "verify_password" as const,
              purpose: "ownership_transfer" as const,
              password: transferStepUpPassword,
            }
          : {
              action: "verify_otp" as const,
              purpose: "ownership_transfer" as const,
              otp: transferStepUpOtp.trim(),
            };

      const stepUpRes = await fetch("/api/account/step-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stepUpBody),
      });
      const stepUpJson = (await stepUpRes.json()) as
        | { ok: true; stepUpToken: string }
        | { ok: false; code?: string; error?: string };

      if (!stepUpRes.ok || !stepUpJson.ok) {
        if ("code" in stepUpJson && stepUpJson.code === "NO_PASSWORD_ACCOUNT") {
          setTransferStepUpMethod("otp");
        }
        setTransferModalError(
          ("error" in stepUpJson && stepUpJson.error) ||
            "Identity verification failed. Please check your credentials.",
        );
        return;
      }

      if (transferStepUpTarget.mode === "request" && currentOrg) {
        const response = await fetch("/api/team/transfer-ownership", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "request",
            organizationId: currentOrg.id,
            targetMemberUserId: transferTargetUserId,
            stepUpToken: stepUpJson.stepUpToken,
          }),
        });
        const json = (await response.json()) as { ok: boolean; error?: string };
        if (!response.ok || !json.ok) {
          setTransferModalError(json.error ?? "Could not initiate ownership transfer.");
          return;
        }
        setTransferNotice(
          "Ownership transfer requested. The recipient must confirm within 48 hours to complete the swap.",
        );
        setTransferStepUpTarget(null);
        router.refresh();
        return;
      }

      if (transferStepUpTarget.mode === "accept") {
        const response = await fetch("/api/team/transfer-ownership", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "accept",
            transferRequestId: transferStepUpTarget.transferRequestId,
            stepUpToken: stepUpJson.stepUpToken,
          }),
        });
        const json = (await response.json()) as { ok: boolean; error?: string };
        if (!response.ok || !json.ok) {
          setTransferModalError(json.error ?? "Could not accept ownership transfer.");
          return;
        }
        setTransferNotice("Workspace ownership transferred to your account.");
        setTransferStepUpTarget(null);
        router.refresh();
      }
    } catch {
      setTransferModalError("Network error while confirming ownership transfer.");
    } finally {
      setTransferBusy(false);
    }
  }

  async function handleCancelOrDeclineTransfer(
    transferRequestId: string,
    action: "cancel" | "decline",
  ) {
    setTransferBusy(true);
    setTransferError(null);
    setTransferNotice(null);
    try {
      const response = await fetch("/api/team/transfer-ownership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          transferRequestId,
        }),
      });
      const json = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !json.ok) {
        setTransferError(
          json.error ??
            (action === "cancel"
              ? "Could not cancel ownership transfer."
              : "Could not decline ownership transfer."),
        );
        return;
      }
      setTransferNotice(
        action === "cancel"
          ? "Pending ownership transfer canceled."
          : "Ownership transfer request declined.",
      );
      router.refresh();
    } catch {
      setTransferError("Network error while updating ownership transfer.");
    } finally {
      setTransferBusy(false);
    }
  }

  const eligibleTransferCandidates =
    currentOrg?.members.filter((m) => toCanonicalRole(m.role) !== "owner") ?? [];

  return (
    <div className="flex flex-col gap-6">
      {inspectedInvitation && (
        <Card
          role="alert"
          data-testid="team-invitation-status-banner"
          className="border-warning/40 bg-warning-soft flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-warning mt-0.5 size-5 shrink-0" />
            <div className="flex flex-col gap-1">
              {inspectedInvitation.state === "email_mismatch" && (
                <>
                  <p className="text-foreground type-body-m-strong">
                    Invitation sent to a different email address
                  </p>
                  <p className="text-muted-foreground type-body-s">
                    This invitation to join{" "}
                    <strong className="text-foreground">
                      {inspectedInvitation.organizationName}
                    </strong>{" "}
                    ({formatRoleLabel(inspectedInvitation.role)}) was sent to{" "}
                    <strong className="text-foreground font-mono">
                      {inspectedInvitation.invitedEmail}
                    </strong>
                    , while you are currently signed in as{" "}
                    <strong className="text-foreground font-mono">
                      {currentUserEmail ?? "another account"}
                    </strong>
                    .
                  </p>
                </>
              )}
              {inspectedInvitation.state === "accepted" && (
                <>
                  <p className="text-foreground type-body-m-strong">
                    Invitation already accepted
                  </p>
                  <p className="text-muted-foreground type-body-s">
                    The invitation to{" "}
                    <strong className="text-foreground">
                      {inspectedInvitation.organizationName}
                    </strong>{" "}
                    for <span className="font-mono">{inspectedInvitation.invitedEmail}</span> has
                    already been accepted.
                  </p>
                </>
              )}
              {inspectedInvitation.state === "expired" && (
                <>
                  <p className="text-foreground type-body-m-strong">Invitation expired</p>
                  <p className="text-muted-foreground type-body-s">
                    This invitation to{" "}
                    <strong className="text-foreground">
                      {inspectedInvitation.organizationName}
                    </strong>{" "}
                    expired on {formatShortTimestamp(inspectedInvitation.expiresAtIso)}. Ask{" "}
                    {inspectedInvitation.inviterName} to send a fresh invite.
                  </p>
                </>
              )}
              {inspectedInvitation.state === "canceled" && (
                <>
                  <p className="text-foreground type-body-m-strong">
                    Invitation no longer active
                  </p>
                  <p className="text-muted-foreground type-body-s">
                    This invitation to{" "}
                    <strong className="text-foreground">
                      {inspectedInvitation.organizationName}
                    </strong>{" "}
                    was revoked or declined.
                  </p>
                </>
              )}
              {inspectedInvitation.state === "not_found" && (
                <>
                  <p className="text-foreground type-body-m-strong">Invitation not found</p>
                  <p className="text-muted-foreground type-body-s">
                    We couldn&apos;t find this team invitation link. Check with your workspace
                    Owner for an updated invite.
                  </p>
                </>
              )}
            </div>
          </div>

          {inspectedInvitation.state === "email_mismatch" && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              data-testid="switch-account-for-invite-btn"
              disabled={switchingAccount}
              onClick={() => void handleSwitchAccountForInvitation()}
            >
              {switchingAccount ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Switching...
                </>
              ) : (
                <>
                  <LogOut className="size-4" />
                  Switch account
                </>
              )}
            </Button>
          )}

          {inspectedInvitation.state === "accepted" &&
            organizations.some((o) => o.id === inspectedInvitation.organizationId) && (
              <Button
                type="button"
                size="sm"
                onClick={async () => {
                  await switchActiveWorkspaceSession(inspectedInvitation.organizationId);
                  router.push("/dashboard");
                  router.refresh();
                }}
              >
                Open workspace
              </Button>
            )}
        </Card>
      )}

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
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={transferBusy}
                    onClick={() =>
                      openTransferStepUp({
                        mode: "accept",
                        transferRequestId: tr.id,
                        organizationName: tr.organizationName,
                      })
                    }
                  >
                    <ArrowRightLeft className="size-4" />
                    Accept workspace ownership
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={transferBusy}
                    onClick={() => handleCancelOrDeclineTransfer(tr.id, "decline")}
                  >
                    Decline
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
              const isBusy = busyInvitationId === invite.id;
              return (
                <div
                  key={invite.id}
                  data-testid={`incoming-invite-card-${invite.id}`}
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
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      data-testid={`decline-invite-btn-${invite.id}`}
                      disabled={isBusy}
                      onClick={() => void handleDeclineInvitation(invite.id)}
                    >
                      <X className="size-4" />
                      Decline invitation
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      data-testid={`accept-invite-btn-${invite.id}`}
                      disabled={isBusy}
                      onClick={() => void handleAcceptInvitation(invite.id)}
                    >
                      <Check className="size-4" />
                      Accept invitation
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {organizations.length > 0 && currentOrg && (
        <Card className="flex flex-col gap-5 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex size-7 items-center justify-center rounded-lg bg-[var(--cf-royal-soft)] text-[var(--cf-royal-text)]">
                  <Users className="size-3.5" />
                </span>
                <h2 className="v3-dashboard-section-title text-foreground">{currentOrg.name}</h2>
                <Badge tone="accent">{formatRoleLabel(currentOrg.myRole)}</Badge>
                {currentOrg.hasActiveTeamPlan ? (
                  <TeamsBadge />
                ) : (
                  <Badge tone="draft">Unfunded</Badge>
                )}
              </div>
              <p className="text-muted-foreground type-caption">
                Workspace slug: <span className="font-mono">{currentOrg.slug}</span> ·{" "}
                {currentOrg.hasActiveTeamPlan ? (
                  <>
                    {activeMembersCount} active + {pendingInvitationsCount} pending of {paidSeats}{" "}
                    paid {paidSeats === 1 ? "seat" : "seats"} · Unlimited Case Studies
                    {renewalSeats !== null && renewalSeats < paidSeats
                      ? ` (renews at ${renewalSeats} seats)`
                      : ""}
                  </>
                ) : (
                  "Activate Casefolio Teams ($5.99/seat/mo · 2–25 seats) to invite collaborators"
                )}
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
                    await authClient.organization
                      .setActive({ organizationId: nextId })
                      .catch(() => undefined);
                    await switchActiveWorkspaceSession(nextId);
                    router.refresh();
                  }}
                  className="border-border bg-elevated text-foreground h-8 rounded-lg border px-2.5 text-xs font-semibold"
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
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="flex flex-col gap-0.5 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] p-3">
              <span className="text-tertiary type-caption">Paid seats (S)</span>
              <span className="text-foreground font-display text-base font-bold">
                {currentOrg.hasActiveTeamPlan ? paidSeats : "0 (Unfunded)"}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] p-3">
              <span className="text-tertiary type-caption">Active members</span>
              <span className="text-foreground font-display text-base font-bold">
                {activeMembersCount}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] p-3">
              <span className="text-tertiary type-caption">Reserved invites</span>
              <span className="text-foreground font-display text-base font-bold">
                {pendingInvitationsCount}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] p-3">
              <span className="text-tertiary type-caption">Available seats</span>
              <div className="flex items-center justify-between gap-2">
                <span className="text-foreground font-display text-base font-bold">
                  {currentOrg.hasActiveTeamPlan ? availableSeats : 0}
                </span>
                {isOwner && (
                  <Link
                    href="/account/billing"
                    className="text-primary type-caption underline-offset-4 hover:underline"
                  >
                    Billing &rarr;
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Inline Owner Seat Management (`+ / -` seats or Upgrade to Teams) */}
          {isOwner && (
            <div
              data-testid="team-inline-seat-controls"
              className="border-border/80 bg-surface/40 flex flex-col gap-3 rounded-2xl border p-4"
            >
              {currentOrg.hasActiveTeamPlan ? (
                <>
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-foreground type-body-s-strong">
                        Seat capacity ({TEAMS_MIN_SEATS}–{TEAMS_MAX_SELF_SERVE_SEATS} seats)
                      </span>
                      <span className="text-muted-foreground type-caption">
                        {currentOrg.billingInterval === "yearly"
                          ? "$4.99/seat/mo billed annually ($59.90/seat/yr · 2 months free)"
                          : "$5.99/seat/mo · Switch to annual in Billing for 2 months free ($4.99/seat/mo)"}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label="Decrease team seats"
                          data-testid="team-seats-decrement"
                          disabled={
                            seatActionBusy ||
                            Boolean(currentOrg.isLockedForQuantityChange) ||
                            targetSeatCount <= TEAMS_MIN_SEATS
                          }
                          onClick={() =>
                            setTargetSeatCount((prev) =>
                              Math.max(TEAMS_MIN_SEATS, prev - 1),
                            )
                          }
                          className="border-border bg-elevated text-foreground hover:bg-sunken inline-flex size-8 items-center justify-center rounded-full border disabled:opacity-40"
                        >
                          <Minus className="size-3.5" />
                        </button>
                        <span
                          data-testid="team-seats-target-value"
                          className="text-foreground type-body-s-strong min-w-8 text-center font-mono tabular-nums"
                        >
                          {targetSeatCount}
                        </span>
                        <button
                          type="button"
                          aria-label="Increase team seats"
                          data-testid="team-seats-increment"
                          disabled={
                            seatActionBusy ||
                            Boolean(currentOrg.isLockedForQuantityChange) ||
                            targetSeatCount >= TEAMS_MAX_SELF_SERVE_SEATS
                          }
                          onClick={() =>
                            setTargetSeatCount((prev) =>
                              Math.min(TEAMS_MAX_SELF_SERVE_SEATS, prev + 1),
                            )
                          }
                          className="border-border bg-elevated text-foreground hover:bg-sunken inline-flex size-8 items-center justify-center rounded-full border disabled:opacity-40"
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>

                      {targetSeatCount !== paidSeats && (
                        <Button
                          type="button"
                          size="sm"
                          data-testid="team-seats-apply-btn"
                          disabled={seatActionBusy || Boolean(currentOrg.isLockedForQuantityChange)}
                          onClick={() => void handlePreviewOrUpdateSeats()}
                        >
                          {seatActionBusy ? (
                            <>
                              <Loader2 className="size-3.5 animate-spin" />
                              Updating...
                            </>
                          ) : targetSeatCount > paidSeats ? (
                            `Add +${targetSeatCount - paidSeats} ${targetSeatCount - paidSeats === 1 ? "seat" : "seats"}`
                          ) : (
                            `Reduce to ${targetSeatCount} at renewal`
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  {renewalSeats !== null && renewalSeats < paidSeats && (
                    <div className="border-border bg-elevated flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5">
                      <span className="text-muted-foreground type-caption">
                        Scheduled to decrease from <strong className="text-foreground">{paidSeats}</strong> to{" "}
                        <strong className="text-foreground">{renewalSeats}</strong> seats on{" "}
                        {formatShortTimestamp(currentOrg.currentPeriodEndIso)}.
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={seatActionBusy}
                        onClick={() => void handleCancelScheduledDecrease()}
                      >
                        Cancel decrease
                      </Button>
                    </div>
                  )}

                  {targetSeatCount < seatsUsed && (
                    <p className="text-warning type-caption">
                      You have {seatsUsed} occupied seats ({activeMembersCount} active +{" "}
                      {pendingInvitationsCount} pending). Revoke or remove{" "}
                      {seatsUsed - targetSeatCount} seat
                      {seatsUsed - targetSeatCount === 1 ? "" : "s"} below (or use Billing&apos;s
                      guided flow) before reducing to {targetSeatCount}.
                    </p>
                  )}

                  {currentOrg.isLockedForQuantityChange && currentOrg.lockReason && (
                    <p className="text-muted-foreground type-caption">{currentOrg.lockReason}</p>
                  )}
                </>
              ) : (
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-foreground type-body-s-strong">
                      Activate Casefolio Teams for {currentOrg.name}
                    </span>
                    <span className="text-muted-foreground type-caption">
                      $5.99/seat/mo or $4.99/seat/mo on annual (2 months free) · {TEAMS_MIN_SEATS}–
                      {TEAMS_MAX_SELF_SERVE_SEATS} seats · Unlimited shared Case Studies &amp;
                      custom URLs.
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    data-testid="activate-teams-checkout-btn"
                    onClick={() => setTeamCheckoutOpen(true)}
                  >
                    <Sparkles className="size-3.5" />
                    Upgrade to Teams
                  </Button>
                </div>
              )}

              {seatActionError && (
                <p role="alert" className="text-destructive type-caption">
                  {seatActionError}
                </p>
              )}
              {seatActionMessage && (
                <p role="status" className="text-success type-caption">
                  {seatActionMessage}
                </p>
              )}
            </div>
          )}

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
                  data-testid="leave-workspace-btn"
                  disabled={busyMemberId === currentUserId}
                  onClick={() =>
                    setConfirmDepartureTarget({
                      targetUserId: currentUserId,
                      memberName: "yourself",
                      isSelf: true,
                    })
                  }
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
                          data-testid={`remove-member-btn-${member.userId}`}
                          disabled={busyMemberId === member.userId}
                          onClick={() =>
                            setConfirmDepartureTarget({
                              targetUserId: member.userId,
                              memberName: member.name || member.email,
                              isSelf: false,
                            })
                          }
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
                      {isTeamAtMaxCap
                        ? `Self-serve maximum reached (${TEAMS_MAX_SELF_SERVE_SEATS} seats)`
                        : effectiveOrgPlan === "team"
                          ? "All paid seats are currently assigned or reserved"
                          : "Collaborative seats require Casefolio Teams"}
                    </span>
                    <ProBadge />
                  </div>
                  <p className="text-muted-foreground type-caption">{seatDecision.message}</p>
                </div>
              </div>
              {isTeamAtMaxCap ? (
                <Button asChild variant="secondary" size="sm">
                  <Link href="/help">Contact enterprise support</Link>
                </Button>
              ) : effectiveOrgPlan === "team" && isOwner ? (
                <Button
                  type="button"
                  size="sm"
                  data-testid="upgrade-to-team-button"
                  onClick={() =>
                    setTargetSeatCount((prev) =>
                      Math.min(TEAMS_MAX_SELF_SERVE_SEATS, Math.max(paidSeats + 1, prev + 1)),
                    )
                  }
                >
                  <Plus className="size-3.5" />
                  Add paid seat
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

              <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto] sm:items-end">
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
                    className="border-input bg-elevated text-foreground focus-visible:ring-ring/40 h-10 rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
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
                <div
                  role="status"
                  className="border-success/30 bg-success-soft flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5"
                >
                  <span className="text-foreground type-caption">{inviteStatus}</span>
                  {latestInviteUrl && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      data-testid="copy-latest-invite-link-btn"
                      onClick={() => void handleCopyInvitationLink("latest", latestInviteUrl)}
                    >
                      {copiedInvitationId === "latest" ? (
                        <>
                          <Check className="size-3.5" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="size-3.5" />
                          Copy invite link
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </form>
          )}

          {/* Full Workspace Invitations Lifecycle Table (Pending, Accepted, Expired, Canceled) */}
          {currentOrg.invitations.length > 0 && (
            <div className="flex flex-col gap-3" data-testid="team-invitations-history">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-tertiary type-overline">
                  Workspace invitations ({currentOrg.invitations.length})
                </h3>
                <div
                  role="group"
                  aria-label="Filter invitations by status"
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] p-0.5"
                >
                  {(
                    [
                      { id: "all", label: "All" },
                      { id: "pending", label: "Pending" },
                      { id: "accepted", label: "Accepted" },
                      { id: "inactive", label: "Expired / Canceled" },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setInviteFilter(tab.id)}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                        inviteFilter === tab.id
                          ? "bg-[var(--cf-royal)] text-[var(--cf-text-on-royal)]"
                          : "text-[var(--cf-text-secondary)] hover:text-[var(--cf-text-primary)]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredInvitations.length === 0 ? (
                <p className="text-muted-foreground type-caption py-2">
                  No invitations match this filter.
                </p>
              ) : (
                <div className="divide-border border-border divide-y rounded-xl border">
                  {filteredInvitations.map((inv) => {
                    const statusBadge =
                      inv.status === "pending"
                        ? { tone: "draft" as const, label: "Pending · Seat reserved" }
                        : inv.status === "accepted"
                          ? { tone: "published" as const, label: "Accepted" }
                          : inv.status === "expired"
                            ? { tone: "neutral" as const, label: "Expired" }
                            : { tone: "danger" as const, label: "Canceled" };

                    const timestampNote =
                      inv.status === "accepted" && inv.acceptedAtIso
                        ? `Joined ${formatShortTimestamp(inv.acceptedAtIso)}`
                        : inv.status === "canceled" && inv.revokedAtIso
                          ? `Canceled ${formatShortTimestamp(inv.revokedAtIso)}`
                          : inv.status === "expired"
                            ? `Expired ${formatShortTimestamp(inv.expiresAtIso)}`
                            : `Expires ${formatShortTimestamp(inv.expiresAtIso)}`;

                    return (
                      <div
                        key={inv.id}
                        data-testid={`org-invitation-row-${inv.id}`}
                        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                      >
                        <div className="flex flex-col gap-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-foreground type-body-s-strong">{inv.email}</span>
                            <Badge tone="neutral" withDot={false}>
                              {formatRoleLabel(inv.role)}
                            </Badge>
                            <Badge tone={statusBadge.tone}>{statusBadge.label}</Badge>
                          </div>
                          <span className="text-muted-foreground type-caption">
                            Sent {formatShortTimestamp(inv.createdAtIso)} · {timestampNote}
                            {(inv.resentCount ?? 0) > 0
                              ? ` · Resent ${inv.resentCount}×`
                              : ""}
                          </span>
                        </div>

                        {(isOwner || isAdmin) && inv.status === "pending" && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              data-testid={`copy-invite-link-${inv.id}`}
                              disabled={busyInvitationId === inv.id}
                              onClick={() => void handleCopyInvitationLink(inv.id)}
                            >
                              {copiedInvitationId === inv.id ? (
                                <>
                                  <Check className="size-3.5" />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="size-3.5" />
                                  Copy invite link
                                </>
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              data-testid={`resend-invite-${inv.id}`}
                              disabled={busyInvitationId === inv.id}
                              onClick={() => void handleResendInvitation(inv.id)}
                            >
                              <RefreshCw className="size-3.5" />
                              Resend email
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              data-testid={`revoke-invite-${inv.id}`}
                              disabled={busyInvitationId === inv.id}
                              onClick={() => void handleCancelInvitation(inv.id)}
                            >
                              <X className="size-3.5" />
                              Revoke
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
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
                <div className="border-border bg-surface flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={transferBusy}
                    onClick={() =>
                      handleCancelOrDeclineTransfer(currentOrg.pendingTransfer!.id, "cancel")
                    }
                  >
                    Cancel transfer
                  </Button>
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
                  disabled={transferBusy || !transferTargetUserId}
                >
                  <ArrowRightLeft className="size-4" />
                  Request transfer
                </Button>
              </div>

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
            by default ({TEAMS_MIN_SEATS}–{TEAMS_MAX_SELF_SERVE_SEATS} seats on Casefolio Teams ·
            $5.99/seat/mo or $4.99/seat/mo on annual with 2 months free).
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
        featureDescription={`Subscribe to Casefolio Teams ($5.99/seat/mo or $4.99/seat/mo billed annually with 2 months free, ${TEAMS_MIN_SEATS}–${TEAMS_MAX_SELF_SERVE_SEATS} seats) for unlimited shared Case Studies, custom URLs, and role-based collaboration.`}
      />

      {teamCheckoutOpen && (
        <PaddleCheckoutModal
          open={teamCheckoutOpen}
          onOpenChange={setTeamCheckoutOpen}
          initialPlan="team"
          orgId={currentOrg?.id ?? null}
        />
      )}

      {/* Confirm Prorated Seat Increase Dialog */}
      <Dialog
        open={seatIncreasePreview !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !seatActionBusy) {
            setSeatIncreasePreview(null);
          }
        }}
      >
        <DialogContent className="max-w-md" data-testid="confirm-seat-increase-dialog">
          <DialogHeader>
            <DialogTitle>Confirm seat increase</DialogTitle>
            <DialogDescription>
              Adding {seatIncreasePreview?.addedSeats}{" "}
              {seatIncreasePreview?.addedSeats === 1 ? "seat" : "seats"} ({seatIncreasePreview?.currentSeats} &rarr;{" "}
              {seatIncreasePreview?.targetSeats} total paid seats).
            </DialogDescription>
          </DialogHeader>

          {seatIncreasePreview && (
            <div className="border-border bg-surface flex flex-col gap-2 rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground type-caption">Prorated due today</span>
                <span className="text-foreground type-body-m-strong font-mono tabular-nums">
                  {formatUsdFromCents(seatIncreasePreview.immediateChargeCents)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground type-caption">
                  Next {seatIncreasePreview.interval === "yearly" ? "annual" : "monthly"} renewal
                </span>
                <span className="text-foreground type-body-s font-mono tabular-nums">
                  {formatUsdFromCents(seatIncreasePreview.renewalChargeCents)}/
                  {seatIncreasePreview.interval === "yearly" ? "yr" : "mo"}
                </span>
              </div>
            </div>
          )}

          {seatActionError && (
            <p role="alert" className="text-destructive type-caption">
              {seatActionError}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={seatActionBusy}
              onClick={() => setSeatIncreasePreview(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              data-testid="confirm-seat-increase-submit"
              disabled={seatActionBusy}
              onClick={() => void handleConfirmSeatIncrease()}
            >
              {seatActionBusy ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Confirming...
                </>
              ) : (
                "Confirm & add seats"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Remove Member / Leave Workspace Dialog */}
      <Dialog
        open={confirmDepartureTarget !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !busyMemberId) {
            setConfirmDepartureTarget(null);
          }
        }}
      >
        <DialogContent className="max-w-md" data-testid="confirm-member-departure-dialog">
          <DialogHeader>
            <DialogTitle>
              {confirmDepartureTarget?.isSelf
                ? `Leave ${currentOrg?.name ?? "workspace"}?`
                : `Remove ${confirmDepartureTarget?.memberName ?? "member"}?`}
            </DialogTitle>
            <DialogDescription>
              {confirmDepartureTarget?.isSelf
                ? "You will lose access to Shared Spaces immediately. Your Private Spaces remain completely hidden from the team and stay recoverable for 90 days in your personal Recovery Portal."
                : "They will lose access to Shared Spaces immediately, freeing their occupied seat. Their Private Spaces remain private and move to their personal 90-day Recovery Portal."}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={Boolean(busyMemberId)}
              onClick={() => setConfirmDepartureTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              data-testid="confirm-member-departure-submit"
              disabled={Boolean(busyMemberId)}
              onClick={() => {
                if (confirmDepartureTarget) {
                  void executeRemoveOrLeaveMember(
                    confirmDepartureTarget.targetUserId,
                    confirmDepartureTarget.isSelf,
                  );
                }
              }}
            >
              {busyMemberId
                ? "Processing..."
                : confirmDepartureTarget?.isSelf
                  ? "Leave workspace"
                  : "Remove member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {transferStepUpTarget && (
        <Dialog
          open={Boolean(transferStepUpTarget)}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setTransferStepUpTarget(null);
            }
          }}
        >
          <DialogContent className="max-w-md" data-testid="transfer-stepup-dialog">
            <DialogHeader>
              <DialogTitle>Confirm your identity</DialogTitle>
              <DialogDescription>
                {transferStepUpTarget.mode === "request"
                  ? "Verify your identity before initiating a workspace & billing ownership handoff."
                  : `Verify your identity to accept sole Billing & Workspace Owner authority for ${transferStepUpTarget.organizationName}.`}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleConfirmTransferStepUp} className="flex flex-col gap-4">
              {transferStepUpMethod === "password" ? (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="transfer-stepup-password">Password</Label>
                    <button
                      type="button"
                      onClick={() => {
                        setTransferStepUpMethod("otp");
                        setTransferModalError(null);
                      }}
                      className="text-primary type-caption underline-offset-4 hover:underline"
                    >
                      Use 6-digit email code
                    </button>
                  </div>
                  <Input
                    id="transfer-stepup-password"
                    type="password"
                    autoComplete="current-password"
                    value={transferStepUpPassword}
                    onChange={(e) => setTransferStepUpPassword(e.target.value)}
                    required
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="transfer-stepup-otp">6-digit security code</Label>
                    <button
                      type="button"
                      onClick={() => {
                        setTransferStepUpMethod("password");
                        setTransferModalError(null);
                      }}
                      className="text-primary type-caption underline-offset-4 hover:underline"
                    >
                      Use password instead
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      id="transfer-stepup-otp"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="000000"
                      value={transferStepUpOtp}
                      onChange={(e) => setTransferStepUpOtp(e.target.value.replace(/\D/g, ""))}
                      required
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={transferOtpSending}
                      onClick={handleSendTransferStepUpOtp}
                    >
                      {transferOtpSending
                        ? "Sending..."
                        : transferOtpSent
                          ? "Resend"
                          : "Send code"}
                    </Button>
                  </div>
                </div>
              )}

              {transferModalError && (
                <p
                  role="alert"
                  className="border-destructive/30 bg-destructive-soft text-destructive type-body-s rounded-lg border px-3.5 py-2.5"
                >
                  {transferModalError}
                </p>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setTransferStepUpTarget(null)}
                  disabled={transferBusy}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    transferBusy ||
                    (transferStepUpMethod === "password"
                      ? transferStepUpPassword.length === 0
                      : transferStepUpOtp.trim().length !== 6)
                  }
                >
                  {transferBusy ? "Verifying..." : "Confirm ownership handoff"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
