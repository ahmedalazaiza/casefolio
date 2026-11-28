"use client";

import {
  AlertTriangle,
  Check,
  CreditCard,
  ExternalLink,
  Loader2,
  Lock,
  Minus,
  Plus,
  RotateCcw,
  UserMinus,
  Users,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PaddleCheckoutModal } from "@/components/billing/paddle-checkout-modal";
import { Badge, ProBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  BILLING_PLAN_CATALOG,
  evaluateSubscriptionLifecycle,
  formatPlanAmountSummary,
  formatPlanHeadingLabel,
  formatUsdFromCents,
  getPastDueDaysRemaining,
  PAST_DUE_GRACE_DAYS,
  PRO_MAX_PROJECTS,
  TEAMS_CALCULATOR_DEFAULT_SEATS,
  TEAMS_MAX_SELF_SERVE_SEATS,
  TEAMS_MIN_SEATS,
  type ActivePlanTier,
  type BillingInterval,
  type PaidPlanTier,
} from "@/lib/billing/plans";
import type {
  PersonalPublicProjectChoice,
  TeamSeatRosterItem,
  UserBillingOverview,
} from "@/lib/billing/service";

const CANCEL_REASONS = [
  { value: "too_expensive", label: "It’s too expensive" },
  { value: "finished_portfolio", label: "I finished my portfolio" },
  { value: "missing_feature", label: "Missing a template or feature" },
  { value: "switching_tool", label: "I’m switching to another tool" },
  { value: "other", label: "Other" },
] as const;

type CancelReasonValue = (typeof CANCEL_REASONS)[number]["value"];

interface SeatIncreasePreviewState {
  operationId: string;
  currentSeats: number;
  targetSeats: number;
  addedSeats: number;
  immediateChargeUsd: number;
  renewalChargeUsd: number;
  interval: BillingInterval;
}

export interface BillingSettingsPanelProps {
  overview: UserBillingOverview;
  accountName: string;
  accountEmail: string;
  initialPortalAction?: string;
}

function formatDateLabel(iso: string | null | undefined): string {
  if (!iso) return "the end of your billing period";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function KeepFreeProjectSelector({
  id,
  label,
  projects,
  value,
  disabled,
  onChange,
  testId,
}: {
  id: string;
  label: string;
  projects: PersonalPublicProjectChoice[];
  value: string;
  disabled?: boolean;
  onChange: (projectId: string) => void;
  testId?: string;
}) {
  if (projects.length <= 1) return null;
  return (
    <div className="border-border/70 bg-surface/80 flex flex-col gap-1.5 rounded-xl border p-3">
      <Label htmlFor={id} className="type-caption text-foreground">
        {label}
      </Label>
      <Select
        id={id}
        data-testid={testId}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {projects.map((proj) => (
          <option key={proj.id} value={proj.id}>
            {proj.name}
            {proj.slug ? ` (/p/${proj.slug})` : ""}
            {proj.visibility === "private" ? " · Draft" : ""}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function BillingSettingsPanel({
  overview,
  accountName,
  accountEmail,
  initialPortalAction,
}: BillingSettingsPanelProps) {
  const router = useRouter();
  const sub = overview.subscription;
  const effectivePlan: ActivePlanTier =
    overview.effectivePlan === "plus" || overview.effectivePlan === "team"
      ? "team"
      : overview.effectivePlan === "pro"
        ? "pro"
        : "free";
  const currentInterval: BillingInterval = sub?.interval ?? "monthly";
  const currentPlanHeading = formatPlanHeadingLabel(effectivePlan, currentInterval);
  const currentAmountSummary = formatPlanAmountSummary(effectivePlan, currentInterval);
  const periodEndFormatted = formatDateLabel(sub?.currentPeriodEndIso);
  const planTitle =
    effectivePlan === "team" ? "Teams" : effectivePlan === "pro" ? "Pro" : "Free";
  const teamBilling = overview.teamBilling ?? null;
  const personalPublished = overview.personalPublishedProjects ?? [];

  // Modals state
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<PaidPlanTier>("pro");
  const [checkoutInterval, setCheckoutInterval] =
    useState<BillingInterval>(currentInterval);
  const [checkoutOrgId, setCheckoutOrgId] = useState<string | null>(null);

  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [pickerInterval, setPickerInterval] =
    useState<BillingInterval>(currentInterval);
  const [pickerTier, setPickerTier] = useState<ActivePlanTier>(
    effectivePlan === "free" ? "pro" : effectivePlan,
  );

  const [downgradeConfirmOpen, setDowngradeConfirmOpen] = useState(false);

  const [cancelStep, setCancelStep] = useState<0 | 1 | 2>(0);
  const [cancelReason, setCancelReason] = useState<CancelReasonValue>("finished_portfolio");
  const [cancelFeedback, setCancelFeedback] = useState("");
  const [cancelAcknowledged, setCancelAcknowledged] = useState(false);
  const [keepPublicProjectId, setKeepPublicProjectId] = useState<string>(
    overview.keepPublicProjectId ?? personalPublished[0]?.id ?? "",
  );

  const [updatePaymentOpen, setUpdatePaymentOpen] = useState(false);

  // Team seat management state
  const [targetSeatCount, setTargetSeatCount] = useState<number>(
    teamBilling && teamBilling.paidSeats > 0
      ? Math.max(TEAMS_MIN_SEATS, teamBilling.paidSeats)
      : TEAMS_CALCULATOR_DEFAULT_SEATS,
  );
  const [seatPreview, setSeatPreview] = useState<SeatIncreasePreviewState | null>(null);
  const [seatError, setSeatError] = useState<string | null>(null);
  const [seatReleaseOpen, setSeatReleaseOpen] = useState(false);
  const [rosterState, setRosterState] = useState<TeamSeatRosterItem | null>(
    teamBilling?.occupiedRoster ?? null,
  );
  const [seatReleaseBusyId, setSeatReleaseBusyId] = useState<string | null>(null);
  const [teamCancelOpen, setTeamCancelOpen] = useState(false);
  const [teamCancelAcknowledged, setTeamCancelAcknowledged] = useState(false);

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (initialPortalAction === "cancel" && effectivePlan !== "free") {
      setCancelStep(1);
    }
  }, [initialPortalAction, effectivePlan]);

  useEffect(() => {
    if (teamBilling && teamBilling.paidSeats > 0) {
      setTargetSeatCount(Math.max(TEAMS_MIN_SEATS, teamBilling.paidSeats));
    }
    setRosterState(teamBilling?.occupiedRoster ?? null);
  }, [teamBilling]);

  async function handleOpenCustomerPortal() {
    setBusyAction("portal");
    setActionError(null);
    try {
      const response = await fetch("/api/paddle/portal", { method: "POST" });
      const json = (await response.json()) as
        | { ok: true; mode: "paddle_portal" | "local_portal"; url: string }
        | { ok: false; error?: string };

      if (!response.ok || !json.ok) {
        toast.error(
          ("error" in json && json.error) || "Could not open customer portal.",
        );
        return;
      }

      if (json.mode === "paddle_portal") {
        window.location.assign(json.url);
        return;
      }

      setCancelAcknowledged(false);
      setCancelStep(1);
    } catch {
      toast.error("Network error while opening billing portal.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSaveKeepPublicChoice(projectId: string) {
    setKeepPublicProjectId(projectId);
    setBusyAction("keep-public");
    try {
      const res = await fetch("/api/paddle/seats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "keep_public_project",
          projectId: projectId || null,
        }),
      });
      if (res.ok) {
        toast.success("Saved public project preference for Free plan.");
        router.refresh();
      }
    } catch {
      toast.error("Could not save public project preference.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSubmitCancellation(reason: CancelReasonValue, feedback: string) {
    setBusyAction("cancel");
    setActionError(null);
    try {
      const response = await fetch("/api/paddle/portal", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          feedback,
          immediate: false,
          keepPublicProjectId: keepPublicProjectId || null,
        }),
      });
      const json = (await response.json()) as
        | { ok: true; status: string }
        | { ok: false; error?: string };

      if (!response.ok || !json.ok) {
        setActionError(
          ("error" in json && json.error) || "Could not schedule cancellation.",
        );
        return;
      }

      toast.success(
        `Subscription scheduled to cancel at period end (${periodEndFormatted}).`,
      );
      setCancelStep(0);
      setDowngradeConfirmOpen(false);
      router.refresh();
    } catch {
      setActionError("Network error while cancelling subscription.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleResumeSubscription() {
    setBusyAction("resume");
    try {
      const response = await fetch("/api/paddle/portal", { method: "PATCH" });
      const json = (await response.json()) as
        | { ok: true }
        | { ok: false; error?: string };

      if (!response.ok || !json.ok) {
        toast.error(("error" in json && json.error) || "Could not resume subscription.");
        return;
      }

      toast.success("Your subscription has been resumed.");
      router.refresh();
    } catch {
      toast.error("Network error while resuming subscription.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handlePreviewOrScheduleSeats() {
    if (!teamBilling) return;
    setSeatError(null);

    if (targetSeatCount === teamBilling.paidSeats) {
      return;
    }

    if (targetSeatCount > TEAMS_MAX_SELF_SERVE_SEATS) {
      setSeatError(
        `Self-serve Teams supports ${TEAMS_MIN_SEATS}–${TEAMS_MAX_SELF_SERVE_SEATS} paid seats. Contact support for 26+ enterprise seats.`,
      );
      return;
    }

    if (targetSeatCount > teamBilling.paidSeats) {
      setBusyAction("seat-preview");
      try {
        const res = await fetch("/api/paddle/seats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "preview_increase",
            organizationId: teamBilling.organizationId,
            targetSeats: targetSeatCount,
          }),
        });
        const json = (await res.json()) as
          | ({ ok: true } & SeatIncreasePreviewState)
          | { ok: false; error?: string };

        if (!res.ok || !json.ok) {
          setSeatError(
            ("error" in json && json.error) || "Could not preview seat increase.",
          );
          return;
        }

        setSeatPreview({
          operationId: json.operationId,
          currentSeats: json.currentSeats,
          targetSeats: json.targetSeats,
          addedSeats: json.addedSeats,
          immediateChargeUsd: json.immediateChargeUsd,
          renewalChargeUsd: json.renewalChargeUsd,
          interval: json.interval,
        });
      } catch {
        setSeatError("Network error while previewing seat increase.");
      } finally {
        setBusyAction(null);
      }
      return;
    }

    if (targetSeatCount < teamBilling.paidSeats && rosterState) {
      const currentOccupied =
        rosterState.members.length + rosterState.pendingInvites.length;
      if (targetSeatCount < currentOccupied) {
        setSeatReleaseOpen(true);
        return;
      }
    }

    await executeScheduleSeatDecrease(targetSeatCount);
  }

  async function executeScheduleSeatDecrease(nextSeatCount: number) {
    if (!teamBilling) return;
    // Schedule seat decrease at renewal
    setBusyAction("seat-decrease");
    setSeatError(null);
    try {
      const res = await fetch("/api/paddle/seats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "schedule_decrease",
          organizationId: teamBilling.organizationId,
          targetSeats: nextSeatCount,
        }),
      });
      const json = (await res.json()) as
        | { ok: true; renewalSeats: number }
        | { ok: false; error?: string };

      if (!res.ok || !json.ok) {
        setSeatError(
          ("error" in json && json.error) || "Could not schedule seat decrease.",
        );
        return;
      }

      setSeatReleaseOpen(false);
      toast.success(
        `Scheduled renewal seat count to ${json.renewalSeats}. Current capacity (${teamBilling.paidSeats}) stays active until renewal.`,
      );
      router.refresh();
    } catch {
      setSeatError("Network error while scheduling seat decrease.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRevokeInviteForSeatDecrease(invitationId: string) {
    setSeatReleaseBusyId(`inv:${invitationId}`);
    setSeatError(null);
    try {
      const res = await fetch(`/api/team/invitations/${encodeURIComponent(invitationId)}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setSeatError(json.error ?? "Could not revoke pending invitation.");
        return;
      }
      setRosterState((prev) =>
        prev
          ? {
              ...prev,
              pendingInvites: prev.pendingInvites.filter((inv) => inv.id !== invitationId),
            }
          : prev,
      );
      toast.success("Pending invitation revoked — 1 seat freed.");
      router.refresh();
    } catch {
      setSeatError("Network error while revoking invitation.");
    } finally {
      setSeatReleaseBusyId(null);
    }
  }

  async function handleRemoveMemberForSeatDecrease(memberUserId: string, memberName: string) {
    if (!teamBilling) return;
    setSeatReleaseBusyId(`mem:${memberUserId}`);
    setSeatError(null);
    try {
      const res = await fetch("/api/team/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: teamBilling.organizationId,
          targetUserId: memberUserId,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setSeatError(json.error ?? "Could not remove member.");
        return;
      }
      setRosterState((prev) =>
        prev
          ? {
              ...prev,
              members: prev.members.filter((m) => m.userId !== memberUserId),
            }
          : prev,
      );
      toast.success(`Removed ${memberName} — 1 seat freed.`);
      router.refresh();
    } catch {
      setSeatError("Network error while removing member.");
    } finally {
      setSeatReleaseBusyId(null);
    }
  }

  async function handleCancelTeamSubscription() {
    if (!teamBilling) return;
    setBusyAction("team-cancel");
    setActionError(null);
    try {
      const res = await fetch("/api/paddle/portal", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: teamBilling.organizationId,
          reason: "other",
          feedback: "Canceled Teams subscription via Billing settings",
          immediate: false,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setActionError(json.error ?? "Could not schedule Teams cancellation.");
        return;
      }
      setTeamCancelOpen(false);
      setTeamCancelAcknowledged(false);
      toast.success("Teams subscription scheduled to end at period end.");
      router.refresh();
    } catch {
      setActionError("Network error while cancelling Teams subscription.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleResumeTeamSubscription() {
    if (!teamBilling) return;
    setBusyAction("team-resume");
    try {
      const res = await fetch("/api/paddle/portal", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: teamBilling.organizationId }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        toast.error(json.error ?? "Could not resume Teams subscription.");
        return;
      }
      toast.success("Teams subscription resumed.");
      router.refresh();
    } catch {
      toast.error("Network error while resuming Teams subscription.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleConfirmSeatIncrease() {
    if (!teamBilling || !seatPreview) return;
    setBusyAction("seat-confirm");
    setSeatError(null);
    try {
      const res = await fetch("/api/paddle/seats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm_increase",
          organizationId: teamBilling.organizationId,
          operationId: seatPreview.operationId,
        }),
      });
      const json = (await res.json()) as
        | { ok: true; paidSeats: number; chargedUsd: number }
        | { ok: false; error?: string };

      if (!res.ok || !json.ok) {
        setSeatError(
          ("error" in json && json.error) || "Payment failed; seats were not added.",
        );
        return;
      }

      toast.success(
        `Added seats — your workspace now has ${json.paidSeats} paid seats.`,
      );
      setSeatPreview(null);
      router.refresh();
    } catch {
      setSeatError("Network error while confirming seat increase.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCancelPendingSeatDecrease() {
    if (!teamBilling) return;
    setBusyAction("seat-cancel-decrease");
    setSeatError(null);
    try {
      const res = await fetch("/api/paddle/seats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel_decrease",
          organizationId: teamBilling.organizationId,
        }),
      });
      const json = (await res.json()) as
        | { ok: true }
        | { ok: false; error?: string };

      if (!res.ok || !json.ok) {
        setSeatError(
          ("error" in json && json.error) || "Could not cancel pending decrease.",
        );
        return;
      }

      toast.success("Canceled pending seat decrease.");
      router.refresh();
    } catch {
      setSeatError("Network error while canceling pending decrease.");
    } finally {
      setBusyAction(null);
    }
  }

  function handleConfirmPickerSelection() {
    if (pickerTier === "free") {
      if (effectivePlan === "free") {
        setChangePlanOpen(false);
        return;
      }
      setChangePlanOpen(false);
      setActionError(null);
      setDowngradeConfirmOpen(true);
      return;
    }

    setChangePlanOpen(false);
    setCheckoutPlan(pickerTier);
    setCheckoutInterval(pickerInterval);
    setCheckoutOrgId(
      pickerTier === "team" ? (teamBilling?.organizationId ?? null) : null,
    );
    setCheckoutOpen(true);
  }

  const isPastDue = sub?.status === "past_due";
  const isCancelScheduled = sub?.status === "cancel_at_period_end";
  const hasPaidAccess = effectivePlan === "pro" || effectivePlan === "team";

  const personalPastDueLifecycle =
    isPastDue && sub
      ? evaluateSubscriptionLifecycle({
          status: "past_due",
          currentPeriodEnd: sub.currentPeriodEndIso ? new Date(sub.currentPeriodEndIso) : null,
          pastDueSince: sub.pastDueSinceIso ? new Date(sub.pastDueSinceIso) : null,
        })
      : null;
  const personalGraceDaysLeft = personalPastDueLifecycle
    ? getPastDueDaysRemaining(personalPastDueLifecycle.pastDueEndsAt)
    : PAST_DUE_GRACE_DAYS;
  const personalGraceEndLabel = personalPastDueLifecycle?.pastDueEndsAt
    ? formatDateLabel(personalPastDueLifecycle.pastDueEndsAt.toISOString())
    : "end of the 10-day grace window";

  const statusBadge = (() => {
    if (!hasPaidAccess) {
      return <Badge tone="neutral">Free</Badge>;
    }
    if (isPastDue) {
      return <Badge tone="danger">Past due</Badge>;
    }
    if (isCancelScheduled) {
      return <Badge tone="draft">Cancels soon</Badge>;
    }
    return <Badge tone="published">Active</Badge>;
  })();

  const isSamePlanSelection =
    pickerTier === effectivePlan &&
    (pickerTier === "free" || pickerInterval === currentInterval);

  return (
    <div className="flex flex-col gap-6" data-testid="billing-settings-panel">
      {/* Conditional Alert Banner: Payment Failed */}
      {isPastDue && sub && (
        <div
          role="alert"
          data-testid="billing-payment-failed-banner"
          className="border-destructive/30 bg-destructive-soft flex flex-wrap items-center justify-between gap-4 rounded-xl border p-5 sm:p-6"
        >
          <div className="flex items-start gap-3.5">
            <div className="bg-elevated text-destructive flex size-10 shrink-0 items-center justify-center rounded-xl">
              <AlertTriangle className="size-4" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-foreground type-body-s-strong">
                Payment failed — {personalGraceDaysLeft}{" "}
                {personalGraceDaysLeft === 1 ? "day" : "days"} left to renew
              </span>
              <p className="text-muted-foreground type-body-s max-w-xl">
                We couldn&apos;t charge{" "}
                {sub.paymentBrand && sub.paymentLast4
                  ? `${sub.paymentBrand} ••${sub.paymentLast4}`
                  : "your payment method"}
                . Renew by {personalGraceEndLabel} during your 10-day grace window — otherwise
                your account reverts to Free (1 active project) and excess Case Studies lock
                until payment resumes.
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            data-testid="banner-update-payment-btn"
            onClick={() => setUpdatePaymentOpen(true)}
          >
            Update payment method
          </Button>
        </div>
      )}

      {/* Conditional Alert Banner: Subscription Cancelled */}
      {isCancelScheduled && sub && (
        <div
          role="status"
          data-testid="billing-cancelled-banner"
          className="border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] flex flex-wrap items-center justify-between gap-4 rounded-xl border p-5 sm:p-6"
        >
          <div className="flex items-start gap-3.5">
            <div className="bg-elevated text-warning flex size-10 shrink-0 items-center justify-center rounded-xl">
              <AlertTriangle className="size-4" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-foreground type-body-s-strong">
                Subscription canceled
              </span>
              <p className="text-muted-foreground type-body-s max-w-xl">
                {planTitle} stays active until {periodEndFormatted}, then your personal
                workspace moves to Free (1 active Case Study kept editable &amp; live,
                extra Case Studies safely locked, watermarked PNG &amp; PDF exports).
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid="resume-subscription-btn"
            disabled={busyAction === "resume"}
            onClick={handleResumeSubscription}
          >
            {busyAction === "resume" ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Resuming...
              </>
            ) : (
              <>
                <RotateCcw className="size-3.5" />
                Resume subscription
              </>
            )}
          </Button>
        </div>
      )}

      {/* Top Row: Current Personal Plan + Payment method */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Current plan card */}
        <section
          data-testid="billing-current-plan-card"
          className="border-border/80 bg-wash-panel flex flex-col justify-between gap-5 rounded-xl border p-6 sm:p-7"
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground type-body-s-strong">
                Personal workspace plan
              </span>
              {statusBadge}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <h2
                data-testid="billing-current-plan-title"
                className="text-foreground type-display-m"
              >
                {currentPlanHeading}
              </h2>
              {hasPaidAccess && <ProBadge />}
            </div>

            <p className="text-muted-foreground type-body-s">
              {!hasPaidAccess
                ? "$0 / forever · 1 lifetime Case Study credit, starter templates, watermarked 1× PNG & PDF export + auto-generated shareable link"
                : isCancelScheduled
                  ? `${currentAmountSummary} · access ends ${periodEndFormatted}`
                  : `${currentAmountSummary} · next charge ${periodEndFormatted}`}
            </p>

            {personalPublished.length > 1 && hasPaidAccess && (
              <KeepFreeProjectSelector
                id="keep-public-select"
                testId="keep-public-project-select"
                label="Choose 1 active Case Study to keep editable & live if downgraded to Free:"
                projects={personalPublished}
                value={keepPublicProjectId}
                disabled={busyAction === "keep-public"}
                onChange={(val) => void handleSaveKeepPublicChoice(val)}
              />
            )}

            {personalPublished.length > 1 && !hasPaidAccess && (
              <div
                data-testid="free-locked-summary-box"
                className="border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] flex items-start gap-2.5 rounded-xl border p-3"
              >
                <Lock className="text-warning mt-0.5 size-4 shrink-0" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-foreground type-caption font-semibold">
                    1 Case Study active · {personalPublished.length - 1} locked on Free
                  </span>
                  <span className="text-muted-foreground type-caption">
                    Extra Case Studies stay locked and unopenable until you renew or upgrade to
                    Pro — paying restores all projects and live URLs automatically.
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {!hasPaidAccess ? (
              <>
                <Button
                  key="free-upgrade-pro"
                  type="button"
                  size="sm"
                  data-testid="billing-upgrade-pro-btn"
                  onClick={() => {
                    setCheckoutPlan("pro");
                    setCheckoutInterval("monthly");
                    setCheckoutOrgId(null);
                    setCheckoutOpen(true);
                  }}
                >
                  <CreditCard className="size-3.5" />
                  Upgrade to Pro
                </Button>
                <Button
                  key="free-change-plan"
                  type="button"
                  variant="secondary"
                  size="sm"
                  data-testid="open-change-plan-modal"
                  onClick={() => {
                    setPickerTier("pro");
                    setPickerInterval("monthly");
                    setChangePlanOpen(true);
                  }}
                >
                  Change plan
                </Button>
              </>
            ) : (
              <>
                <Button
                  key="paid-change-plan"
                  type="button"
                  variant="secondary"
                  size="sm"
                  data-testid="open-change-plan-modal"
                  onClick={() => {
                    setPickerTier(effectivePlan);
                    setPickerInterval(currentInterval);
                    setChangePlanOpen(true);
                  }}
                >
                  Change plan
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  data-testid="open-paddle-portal-btn"
                  disabled={busyAction === "portal"}
                  onClick={handleOpenCustomerPortal}
                >
                  {busyAction === "portal" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <ExternalLink className="size-3.5" />
                  )}
                  Manage in portal
                </Button>
                {!isCancelScheduled && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    data-testid="open-cancel-subscription-modal"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      setActionError(null);
                      setCancelAcknowledged(false);
                      setCancelStep(1);
                    }}
                  >
                    Cancel subscription
                  </Button>
                )}
              </>
            )}
          </div>
        </section>

        {/* Payment method card */}
        <section
          data-testid="billing-payment-method-card"
          className="border-border/80 bg-elevated flex flex-col justify-between gap-5 rounded-xl border p-6 sm:p-7"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground type-body-s-strong">
              Payment method
            </span>
            {hasPaidAccess && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                data-testid="open-update-payment-modal"
                onClick={() => setUpdatePaymentOpen(true)}
              >
                Update
              </Button>
            )}
          </div>

          {hasPaidAccess && sub && sub.paymentBrand && sub.paymentLast4 ? (
            <div className="flex items-center gap-3.5">
              <div className="border-border bg-surface text-foreground type-caption flex h-9 min-w-12 items-center justify-center rounded-md border px-2.5 font-mono">
                {sub.paymentBrand}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-foreground type-body-s-strong">
                  {sub.paymentBrand === "VISA" ? "Visa" : sub.paymentBrand} ending{" "}
                  {sub.paymentLast4}
                </span>
                {sub.paymentExpiry && (
                  <span className="text-muted-foreground type-caption">
                    Expires {sub.paymentExpiry}
                  </span>
                )}
              </div>
            </div>
          ) : hasPaidAccess && sub ? (
            <div className="flex flex-col gap-1" data-testid="billing-payment-method-managed">
              <span className="text-foreground type-body-s-strong">
                Payment method managed by Paddle
              </span>
              <span className="text-muted-foreground type-caption">
                Update your card, Apple Pay, or PayPal securely in the Paddle customer portal.
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <span className="text-foreground type-body-s-strong">
                No payment method on file
              </span>
              <span className="text-muted-foreground type-caption">
                Paddle collects card, Apple Pay, or PayPal details securely when you
                upgrade.
              </span>
            </div>
          )}

          <div className="text-tertiary type-caption flex items-center justify-between border-t pt-3">
            <span>Merchant of Record: Paddle ({overview.environment})</span>
            <Link
              href="/account/invoices"
              className="text-foreground hover:text-primary type-caption underline-offset-4 hover:underline"
            >
              View invoices →
            </Link>
          </div>
        </section>
      </div>

      {/* Team Workspace Seat & Subscription Card (Spec §8 & §14) */}
      {teamBilling && (
        <section
          data-testid="team-billing-seat-card"
          className="border-border/80 bg-elevated flex flex-col gap-5 rounded-xl border p-6 sm:p-8"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <Users className="text-primary size-4" />
                <h3 className="text-foreground type-heading-m">
                  Team workspace · {teamBilling.organizationName}
                </h3>
                <Badge
                  tone={
                    teamBilling.status === "past_due"
                      ? "danger"
                      : teamBilling.status === "cancel_at_period_end"
                        ? "draft"
                        : teamBilling.plan === "team" || teamBilling.plan === "plus"
                          ? "published"
                          : "neutral"
                  }
                >
                  {teamBilling.status === "past_due"
                    ? `Past due${typeof teamBilling.daysRemaining === "number" ? ` · ${teamBilling.daysRemaining}d left` : ""}`
                    : teamBilling.status === "cancel_at_period_end"
                      ? "Cancels soon"
                      : teamBilling.plan === "team" || teamBilling.plan === "plus"
                        ? "Teams Active"
                        : teamBilling.status === "canceled"
                          ? "Locked · Ended"
                          : "Unfunded"}
                </Badge>
                <Badge tone="accent">{teamBilling.role}</Badge>
              </div>
              <p className="text-muted-foreground type-body-s">
                Separate from your personal workspace. Teams includes {TEAMS_MIN_SEATS}–
                {TEAMS_MAX_SELF_SERVE_SEATS} per-seat licenses ($5.99/seat/mo · $59.90/seat/yr with
                2 months free), unlimited shared Case Studies, and custom URLs.
              </p>
            </div>

            {teamBilling.isOwner &&
              teamBilling.plan !== "team" &&
              teamBilling.plan !== "plus" && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    data-testid="activate-team-subscription-btn"
                    onClick={() => {
                      setCheckoutPlan("team");
                      setCheckoutInterval("monthly");
                      setCheckoutOrgId(teamBilling.organizationId);
                      setCheckoutOpen(true);
                    }}
                  >
                    <CreditCard className="size-3.5" />
                    {teamBilling.status === "canceled"
                      ? "Renew Teams to unlock"
                      : "Activate Casefolio Teams"}
                  </Button>
                </div>
              )}

            {teamBilling.isOwner &&
              (teamBilling.plan === "team" || teamBilling.plan === "plus") &&
              teamBilling.status !== "cancel_at_period_end" && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    data-testid="open-cancel-team-modal"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      setActionError(null);
                      setTeamCancelAcknowledged(false);
                      setTeamCancelOpen(true);
                    }}
                  >
                    Cancel Teams
                  </Button>
                </div>
              )}
          </div>

          {teamBilling.status === "past_due" && (
            <div
              role="alert"
              data-testid="team-billing-past-due-banner"
              className="border-destructive/30 bg-destructive-soft flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
            >
              <p className="text-foreground type-body-s">
                Team renewal failed —{" "}
                <strong>
                  {teamBilling.daysRemaining ?? PAST_DUE_GRACE_DAYS}{" "}
                  {(teamBilling.daysRemaining ?? PAST_DUE_GRACE_DAYS) === 1 ? "day" : "days"} left
                </strong>{" "}
                {teamBilling.graceEndsAtIso
                  ? `(until ${formatDateLabel(teamBilling.graceEndsAtIso)}) `
                  : ""}
                before all Team Case Studies and exports lock until the Owner renews.
              </p>
              {teamBilling.isOwner && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (overview.hasLivePaddlePortal) {
                      void handleOpenCustomerPortal();
                    } else {
                      setCheckoutPlan("team");
                      setCheckoutInterval(teamBilling.interval);
                      setCheckoutOrgId(teamBilling.organizationId);
                      setCheckoutOpen(true);
                    }
                  }}
                >
                  Update team payment
                </Button>
              )}
            </div>
          )}

          {teamBilling.status === "cancel_at_period_end" && (
            <div
              role="status"
              data-testid="team-billing-cancelled-banner"
              className="border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
            >
              <p className="text-foreground type-body-s">
                Teams subscription ends on{" "}
                <strong>{formatDateLabel(teamBilling.currentPeriodEndIso)}</strong>. After that, all
                Team projects lock until renewed (each member keeps 1 Free project in their
                Personal Workspace).
              </p>
              {teamBilling.isOwner && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busyAction === "team-resume"}
                  onClick={handleResumeTeamSubscription}
                >
                  <RotateCcw className="size-3.5" />
                  {busyAction === "team-resume" ? "Resuming..." : "Resume Teams"}
                </Button>
              )}
            </div>
          )}

          {/* 5 separate, unambiguous seat counters */}
          <dl className="border-border bg-surface grid grid-cols-2 gap-3 rounded-xl border p-4 sm:grid-cols-5">
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground type-caption">Paid seats (S)</dt>
              <dd
                data-testid="seat-counter-paid"
                className="text-foreground type-heading-s tabular-nums"
              >
                {teamBilling.paidSeats}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground type-caption">Active members</dt>
              <dd
                data-testid="seat-counter-members"
                className="text-foreground type-heading-s tabular-nums"
              >
                {teamBilling.activeMembers}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground type-caption">Reserved invites</dt>
              <dd
                data-testid="seat-counter-reserved"
                className="text-foreground type-heading-s tabular-nums"
              >
                {teamBilling.reservedInvites}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground type-caption">Available seats</dt>
              <dd
                data-testid="seat-counter-available"
                className="text-foreground type-heading-s tabular-nums"
              >
                {teamBilling.availableSeats}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground type-caption">Renewal target</dt>
              <dd
                data-testid="seat-counter-renewal"
                className="text-foreground type-heading-s tabular-nums"
              >
                {teamBilling.renewalSeats ?? teamBilling.paidSeats}
              </dd>
            </div>
          </dl>

          {teamBilling.renewalSeats !== null && (
            <div
              data-testid="pending-seat-decrease-banner"
              className="border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
            >
              <p className="text-foreground type-body-s">
                Scheduled to renew at{" "}
                <strong>{teamBilling.renewalSeats} seats</strong> on{" "}
                {formatDateLabel(teamBilling.currentPeriodEndIso)}. Current paid
                capacity ({teamBilling.paidSeats}) stays active until renewal.
              </p>
              {teamBilling.isOwner && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  data-testid="cancel-pending-decrease-btn"
                  disabled={busyAction === "seat-cancel-decrease"}
                  onClick={handleCancelPendingSeatDecrease}
                >
                  Cancel pending decrease
                </Button>
              )}
            </div>
          )}

          {teamBilling.isOwner &&
            (teamBilling.plan === "team" || teamBilling.plan === "plus") && (
              <div className="border-border flex flex-col gap-3 border-t pt-4">
                {teamBilling.isLockedForQuantityChange && teamBilling.lockReason && (
                  <p className="text-warning type-caption">{teamBilling.lockReason}</p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <span className="text-foreground type-body-s-strong">
                      Adjust paid seats ({TEAMS_MIN_SEATS}–{TEAMS_MAX_SELF_SERVE_SEATS}):
                    </span>
                    <button
                      type="button"
                      aria-label="Decrease target seats"
                      disabled={
                        targetSeatCount <= TEAMS_MIN_SEATS ||
                        teamBilling.isLockedForQuantityChange
                      }
                      onClick={() =>
                        setTargetSeatCount((v) => Math.max(TEAMS_MIN_SEATS, v - 1))
                      }
                      className="border-border bg-surface text-foreground inline-flex size-8 items-center justify-center rounded-full border disabled:opacity-40"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <span
                      data-testid="target-seat-count-value"
                      className="text-foreground type-body-m-strong min-w-8 text-center tabular-nums"
                    >
                      {targetSeatCount}
                    </span>
                    <button
                      type="button"
                      aria-label="Increase target seats"
                      disabled={
                        targetSeatCount >= TEAMS_MAX_SELF_SERVE_SEATS ||
                        teamBilling.isLockedForQuantityChange
                      }
                      onClick={() =>
                        setTargetSeatCount((v) =>
                          Math.min(TEAMS_MAX_SELF_SERVE_SEATS, v + 1),
                        )
                      }
                      className="border-border bg-surface text-foreground inline-flex size-8 items-center justify-center rounded-full border disabled:opacity-40"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    data-testid="apply-seat-change-btn"
                    disabled={
                      targetSeatCount === teamBilling.paidSeats ||
                      teamBilling.isLockedForQuantityChange ||
                      busyAction === "seat-preview" ||
                      busyAction === "seat-decrease"
                    }
                    onClick={handlePreviewOrScheduleSeats}
                  >
                    {targetSeatCount > teamBilling.paidSeats
                      ? "Preview prorated seat increase"
                      : targetSeatCount < teamBilling.paidSeats
                        ? "Schedule renewal decrease"
                        : "Select new seat count"}
                  </Button>
                </div>

                <p className="text-muted-foreground type-caption">
                  Self-serve Teams supports {TEAMS_MIN_SEATS}–{TEAMS_MAX_SELF_SERVE_SEATS} seats.
                  {targetSeatCount <
                    (rosterState
                      ? rosterState.members.length + rosterState.pendingInvites.length
                      : teamBilling.occupiedSeats) && (
                    <span className="text-warning font-medium">
                      {" "}
                      You currently have{" "}
                      {rosterState
                        ? rosterState.members.length + rosterState.pendingInvites.length
                        : teamBilling.occupiedSeats}{" "}
                      occupied seats — clicking Schedule will guide you to release unused invites or
                      members first.
                    </span>
                  )}
                  {targetSeatCount === TEAMS_MIN_SEATS && (
                    <span>
                      {" "}
                      Working solo (1 seat)?{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setCheckoutPlan("pro");
                          setCheckoutInterval("monthly");
                          setCheckoutOrgId(null);
                          setCheckoutOpen(true);
                        }}
                        className="text-primary font-semibold underline-offset-4 hover:underline"
                      >
                        Switch to Personal Pro ($7.99/mo)
                      </button>{" "}
                      and cancel Teams anytime.
                    </span>
                  )}
                </p>

                {seatError && (
                  <p role="alert" className="text-destructive type-caption">
                    {seatError}
                  </p>
                )}
              </div>
            )}
        </section>
      )}

      {/* Billing details card */}
      <section
        data-testid="billing-details-card"
        className="border-border/80 bg-elevated flex flex-col gap-5 rounded-xl border p-6 sm:p-8"
      >
        <div className="flex flex-col gap-1">
          <h3 className="text-foreground type-heading-m">Billing details</h3>
          <p className="text-muted-foreground type-body-s">
            Used on Paddle receipts and VAT/GST tax invoices.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-foreground type-body-s-strong">Account name</span>
            <div className="border-border/80 bg-surface text-muted-foreground type-body-s flex min-h-11 items-center rounded-xl border px-3.5 py-2">
              {accountName}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-foreground type-body-s-strong">Billing email</span>
            <div className="border-border/80 bg-surface text-muted-foreground type-body-s flex min-h-11 items-center rounded-xl border px-3.5 py-2 break-all">
              {accountEmail}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-foreground type-body-s-strong">
            Tax &amp; VAT compliance
          </span>
          <div className="border-border/80 bg-surface text-muted-foreground type-body-s flex min-h-11 items-center rounded-xl border px-3.5 py-2">
            Paddle.com Market Limited acts as Merchant of Record and calculates regional
            VAT/sales tax at checkout.
          </div>
        </div>
      </section>

      {/* Seat Increase Proration Preview Modal */}
      {seatPreview && (
        <Dialog open onOpenChange={(open) => !open && setSeatPreview(null)}>
          <DialogContent className="max-w-md" data-testid="seat-increase-preview-dialog">
            <DialogHeader>
              <DialogTitle>
                Confirm seat increase ({seatPreview.currentSeats} → {seatPreview.targetSeats})
              </DialogTitle>
              <DialogDescription>
                Adding {seatPreview.addedSeats} paid{" "}
                {seatPreview.addedSeats === 1 ? "seat" : "seats"} expands pooled workspace
                quotas immediately after payment succeeds.
              </DialogDescription>
            </DialogHeader>

            <div className="border-border bg-surface flex flex-col gap-2.5 rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground type-caption">
                  Prorated charge due today
                </span>
                <span className="text-foreground type-heading-s font-mono tabular-nums">
                  ${seatPreview.immediateChargeUsd.toFixed(2)} USD
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground type-caption">
                  Next {seatPreview.interval} renewal ({seatPreview.targetSeats} seats)
                </span>
                <span className="text-foreground type-body-s-strong font-mono tabular-nums">
                  ${seatPreview.renewalChargeUsd.toFixed(2)} USD
                </span>
              </div>
            </div>

            {seatError && (
              <p role="alert" className="text-destructive type-caption">
                {seatError}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setSeatPreview(null)}
                disabled={busyAction === "seat-confirm"}
              >
                Cancel
              </Button>
              <Button
                type="button"
                data-testid="confirm-seat-increase-btn"
                disabled={busyAction === "seat-confirm"}
                onClick={handleConfirmSeatIncrease}
              >
                {busyAction === "seat-confirm" ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Charging...
                  </>
                ) : (
                  `Confirm & pay $${seatPreview.immediateChargeUsd.toFixed(2)}`
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal / Change plan */}
      {changePlanOpen && (
        <Dialog open={changePlanOpen} onOpenChange={setChangePlanOpen}>
          <DialogContent className="max-w-4xl" data-testid="change-plan-dialog">
            <DialogHeader>
              <DialogTitle>Change plan</DialogTitle>
              <DialogDescription>
                Upgrades apply immediately via Paddle; downgrades take effect at the end
                of your current billing period.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-5">
              <div
                className="border-border/70 bg-sunken/80 inline-flex self-start rounded-full border p-1"
                role="group"
                aria-label="Billing interval"
              >
                <button
                  type="button"
                  data-testid="picker-interval-monthly"
                  onClick={() => setPickerInterval("monthly")}
                  className={`type-caption rounded-full px-4 py-1.5 transition-all ${
                    pickerInterval === "monthly"
                      ? "bg-elevated text-foreground border-border border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  data-testid="picker-interval-yearly"
                  onClick={() => setPickerInterval("yearly")}
                  className={`type-caption rounded-full px-4 py-1.5 transition-all ${
                    pickerInterval === "yearly"
                      ? "bg-elevated text-foreground border-border border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Annual · 2 months free
                </button>
              </div>

              <div
                role="radiogroup"
                aria-label="Choose plan tier"
                className="grid gap-3.5 md:grid-cols-3"
              >
                {(["free", "pro", "team"] as const).map((tier) => {
                  const def = BILLING_PLAN_CATALOG[tier];
                  const selected = pickerTier === tier;
                  const displayedPriceCents =
                    tier === "free"
                      ? 0
                      : pickerInterval === "yearly"
                        ? def.yearlyTotalCents
                        : def.monthlyPriceCents;

                  return (
                    <div
                      key={tier}
                      role="radio"
                      aria-checked={selected}
                      tabIndex={0}
                      data-testid={`plan-card-${tier}`}
                      onClick={() => setPickerTier(tier)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setPickerTier(tier);
                        }
                      }}
                      className={`focus-visible:ring-ring/40 flex cursor-pointer flex-col justify-between gap-4 rounded-xl border p-5 text-left transition-all outline-none focus-visible:ring-2 ${
                        selected
                          ? "border-primary bg-accent/50 ring-primary/15 ring-2"
                          : "border-border/80 bg-surface/70 hover:border-border-strong"
                      }`}
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-foreground type-heading-s">
                            {def.name}
                          </span>
                          {def.highlighted && <Badge tone="accent">Most popular</Badge>}
                        </div>

                        <div className="flex flex-wrap items-baseline gap-1">
                          <span className="text-foreground type-heading-l font-mono tabular-nums">
                            {formatUsdFromCents(displayedPriceCents)}
                          </span>
                          <span className="text-muted-foreground type-caption">
                            {tier === "free"
                              ? "/forever"
                              : pickerInterval === "yearly"
                                ? tier === "team"
                                  ? "/seat/yr"
                                  : "/yr"
                                : tier === "team"
                                  ? "/seat/mo"
                                  : "/mo"}
                            {tier !== "free" && pickerInterval === "yearly"
                              ? ` (${formatUsdFromCents(def.yearlyMonthlyEquivalentCents)}${tier === "team" ? "/seat/mo" : "/mo"} · 2 months free)`
                              : ""}
                          </span>
                        </div>

                        <p className="text-muted-foreground type-caption">
                          {def.tagline}
                        </p>

                        <ul className="flex flex-col gap-1.5 pt-1">
                          {def.features.map((feat) => (
                            <li
                              key={feat}
                              className="text-foreground type-caption flex items-start gap-2"
                            >
                              <Check className="text-success mt-0.5 size-3.5 shrink-0" />
                              <span>{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <span className="text-tertiary type-caption pt-2">
                        {effectivePlan === tier ? "Current tier" : `Select ${def.name}`}
                      </span>
                    </div>
                  );
                })}
              </div>

              <DialogFooter className="sm:justify-between">
                <span className="text-muted-foreground type-caption self-center">
                  Current: {currentPlanHeading}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setChangePlanOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    data-testid="confirm-plan-selection-btn"
                    disabled={isSamePlanSelection}
                    onClick={handleConfirmPickerSelection}
                  >
                    {pickerTier === "free"
                      ? "Review downgrade"
                      : `Continue with ${BILLING_PLAN_CATALOG[pickerTier].name}`}
                  </Button>
                </div>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal / Downgrade to Free? */}
      {downgradeConfirmOpen && (
        <Dialog open={downgradeConfirmOpen} onOpenChange={setDowngradeConfirmOpen}>
          <DialogContent className="max-w-md" data-testid="downgrade-confirm-dialog">
            <DialogHeader>
              <DialogTitle>Downgrade to Free?</DialogTitle>
              <DialogDescription>
                Takes effect {periodEndFormatted}. After that:
              </DialogDescription>
            </DialogHeader>

            <ul className="flex flex-col gap-3 py-1">
              <li className="text-foreground type-body-s flex items-start gap-2.5">
                <XCircle className="text-destructive mt-0.5 size-4 shrink-0" />
                <span>
                  1 chosen Case Study stays active, editable &amp; live; extra Case
                  Studies safely lock and unpublish without deleting any work
                </span>
              </li>
              <li className="text-foreground type-body-s flex items-start gap-2.5">
                <XCircle className="text-destructive mt-0.5 size-4 shrink-0" />
                <span>
                  Creating or duplicating another Case Study requires upgrading back to Pro
                  ($7.99/mo · up to {PRO_MAX_PROJECTS} active projects) or Teams
                </span>
              </li>
              <li className="text-foreground type-body-s flex items-start gap-2.5">
                <XCircle className="text-destructive mt-0.5 size-4 shrink-0" />
                <span>
                  Custom URL slug editing locks, subtle Casefolio watermark returns on live links
                  and PNG/PDF exports, and 2× PNG &amp; full Layerat exports lock
                </span>
              </li>
            </ul>

            <KeepFreeProjectSelector
              id="downgrade-keep-public-select"
              testId="downgrade-keep-public-select"
              label="Choose the 1 Case Study to stay unlocked on Free (all others lock until you re-upgrade):"
              projects={personalPublished}
              value={keepPublicProjectId}
              disabled={busyAction === "cancel"}
              onChange={setKeepPublicProjectId}
            />

            {actionError && (
              <p
                role="alert"
                className="border-destructive/30 bg-destructive-soft text-destructive type-body-s rounded-lg border px-3.5 py-2.5"
              >
                {actionError}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDowngradeConfirmOpen(false)}
                disabled={busyAction === "cancel"}
              >
                Keep {planTitle}
              </Button>
              <Button
                type="button"
                variant="destructive"
                data-testid="confirm-downgrade-btn"
                disabled={busyAction === "cancel"}
                onClick={() =>
                  handleSubmitCancellation("other", "Downgrade to Free via plan picker")
                }
              >
                {busyAction === "cancel" ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  "Downgrade to Free"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal / Cancel Step 1 (reason) */}
      {cancelStep === 1 && (
        <Dialog open onOpenChange={(open) => !open && setCancelStep(0)}>
          <DialogContent className="max-w-md" data-testid="cancel-step1-dialog">
            <DialogHeader>
              <DialogTitle>Before you go — why are you cancelling?</DialogTitle>
              <DialogDescription>
                Step 1 of 2 · Optional, helps us improve.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2" role="radiogroup" aria-label="Cancellation reason">
                {CANCEL_REASONS.map((option) => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 transition-colors ${
                      cancelReason === option.value
                        ? "border-primary bg-accent text-foreground"
                        : "border-border bg-surface text-foreground hover:border-border-strong"
                    }`}
                  >
                    <input
                      type="radio"
                      name="cancel-reason"
                      value={option.value}
                      checked={cancelReason === option.value}
                      onChange={() => setCancelReason(option.value)}
                      className="accent-primary size-4"
                    />
                    <span className="type-body-s">{option.label}</span>
                  </label>
                ))}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cancel-feedback-input">
                  Anything else we could improve? (optional)
                </Label>
                <Input
                  id="cancel-feedback-input"
                  value={cancelFeedback}
                  onChange={(e) => setCancelFeedback(e.target.value)}
                  placeholder="Missing layout block, export preset, etc."
                  maxLength={500}
                />
              </div>

              <div className="border-border bg-surface flex flex-col gap-1 rounded-lg border p-3.5">
                <span className="text-foreground type-body-s-strong">
                  Keep access until period end
                </span>
                <span className="text-muted-foreground type-caption">
                  Your {planTitle} features stay active through {periodEndFormatted} with
                  zero extra charges.
                </span>
              </div>

              <DialogFooter className="sm:justify-between">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setCancelStep(0)}
                >
                  Keep my subscription
                </Button>
                <Button
                  type="button"
                  data-testid="cancel-step1-continue"
                  onClick={() => setCancelStep(2)}
                >
                  Continue
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal / Cancel Step 2 (confirm) */}
      {cancelStep === 2 && (
        <Dialog open onOpenChange={(open) => !open && setCancelStep(0)}>
          <DialogContent className="max-w-md" data-testid="cancel-step2-dialog">
            <DialogHeader>
              <div className="flex items-start gap-3">
                <div className="bg-destructive-soft text-destructive flex size-10 shrink-0 items-center justify-center rounded-lg">
                  <AlertTriangle className="size-5" />
                </div>
                <div className="flex flex-col gap-1">
                  <DialogTitle>Cancel {planTitle} subscription?</DialogTitle>
                  <DialogDescription>
                    Step 2 of 2 · You keep {planTitle} until {periodEndFormatted}. No
                    further charges.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <ul className="flex flex-col gap-2.5">
                <li className="text-foreground type-body-s flex items-start gap-2.5">
                  <XCircle className="text-destructive mt-0.5 size-4 shrink-0" />
                  <span>
                    1 Case Study stays active &amp; live; extra Case Studies safely lock
                    and unpublish after {periodEndFormatted}
                  </span>
                </li>
                <li className="text-foreground type-body-s flex items-start gap-2.5">
                  <XCircle className="text-destructive mt-0.5 size-4 shrink-0" />
                  <span>
                    Subtle Casefolio watermark returns on live links and PNG/PDF exports;
                    2x PNG &amp; full Layerat exports end
                  </span>
                </li>
              </ul>

              <KeepFreeProjectSelector
                id="cancel-keep-public-select"
                testId="cancel-keep-public-select"
                label="Choose the 1 Case Study to keep unlocked on Free after cancellation:"
                projects={personalPublished}
                value={keepPublicProjectId}
                disabled={busyAction === "cancel"}
                onChange={setKeepPublicProjectId}
              />

              <label className="text-foreground type-body-s flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  data-testid="cancel-confirm-checkbox"
                  checked={cancelAcknowledged}
                  onChange={(e) => setCancelAcknowledged(e.target.checked)}
                  className="accent-primary size-4 rounded"
                />
                <span>
                  I understand my {planTitle} features end on {periodEndFormatted}
                </span>
              </label>

              {actionError && (
                <p
                  role="alert"
                  className="border-destructive/30 bg-destructive-soft text-destructive type-body-s rounded-lg border px-3.5 py-2.5"
                >
                  {actionError}
                </p>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setCancelStep(1)}
                  disabled={busyAction === "cancel"}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  data-testid="confirm-cancel-subscription-btn"
                  disabled={!cancelAcknowledged || busyAction === "cancel"}
                  onClick={() => handleSubmitCancellation(cancelReason, cancelFeedback)}
                >
                  {busyAction === "cancel" ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Cancelling...
                    </>
                  ) : (
                    "Cancel subscription"
                  )}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal / Update payment method */}
      {updatePaymentOpen && (
        <Dialog open={updatePaymentOpen} onOpenChange={setUpdatePaymentOpen}>
          <DialogContent className="max-w-md" data-testid="update-payment-dialog">
            <DialogHeader>
              <DialogTitle>Update payment method</DialogTitle>
              <DialogDescription>
                Card details are securely processed by Paddle (Merchant of Record).
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <div className="border-border bg-surface flex flex-col gap-1.5 rounded-lg border p-4">
                <span className="text-foreground type-body-s-strong">
                  {sub?.paymentBrand && sub?.paymentLast4
                    ? `Current method: ${sub.paymentBrand} •••• ${sub.paymentLast4}`
                    : "Current method: managed in Paddle"}
                </span>
                <span className="text-muted-foreground type-caption">
                  {overview.hasLivePaddlePortal
                    ? "Open the Paddle Customer Portal to replace your card or switch to PayPal."
                    : "In Sandbox mode, retry the sandbox payment from Upgrade to simulate a successful payment retry and clear the failed-payment state."}
                </span>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setUpdatePaymentOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setUpdatePaymentOpen(false);
                    if (overview.hasLivePaddlePortal) {
                      void handleOpenCustomerPortal();
                    } else {
                      const nextPlan: PaidPlanTier =
                        effectivePlan === "team" ? "team" : "pro";
                      setCheckoutPlan(nextPlan);
                      setCheckoutInterval(currentInterval);
                      setCheckoutOrgId(
                        nextPlan === "team" ? (teamBilling?.organizationId ?? null) : null,
                      );
                      setCheckoutOpen(true);
                    }
                  }}
                >
                  {overview.hasLivePaddlePortal
                    ? "Open Paddle portal"
                    : "Refresh via Sandbox Checkout"}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Guided Team Seat Release Modal */}
      {seatReleaseOpen && teamBilling && rosterState && (
        <Dialog open={seatReleaseOpen} onOpenChange={setSeatReleaseOpen}>
          <DialogContent className="max-w-lg" data-testid="seat-release-dialog">
            <DialogHeader>
              <DialogTitle>Free seats to reduce to {targetSeatCount}</DialogTitle>
              <DialogDescription>
                You currently occupy{" "}
                <strong>
                  {rosterState.members.length + rosterState.pendingInvites.length}
                </strong>{" "}
                seats ({rosterState.members.length} members +{" "}
                {rosterState.pendingInvites.length} pending invites). Remove or revoke{" "}
                <strong>
                  {Math.max(
                    0,
                    rosterState.members.length +
                      rosterState.pendingInvites.length -
                      targetSeatCount,
                  )}
                </strong>{" "}
                more to schedule the reduction.
              </DialogDescription>
            </DialogHeader>

            <div className="flex max-h-80 flex-col gap-4 overflow-y-auto pr-1">
              {rosterState.pendingInvites.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-muted-foreground type-caption font-semibold uppercase tracking-wider">
                    Pending invitations ({rosterState.pendingInvites.length})
                  </span>
                  {rosterState.pendingInvites.map((inv) => {
                    const busy = seatReleaseBusyId === `inv:${inv.id}`;
                    return (
                      <div
                        key={inv.id}
                        className="border-border bg-surface flex items-center justify-between gap-2 rounded-xl border px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-foreground type-body-s truncate">{inv.email}</p>
                          <p className="text-muted-foreground type-caption">
                            Pending invite · {inv.role}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={Boolean(seatReleaseBusyId)}
                          onClick={() => void handleRevokeInviteForSeatDecrease(inv.id)}
                        >
                          {busy ? <Loader2 className="size-3.5 animate-spin" /> : "Revoke"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <span className="text-muted-foreground type-caption font-semibold uppercase tracking-wider">
                  Team members ({rosterState.members.length})
                </span>
                {rosterState.members
                  .filter((m) => m.role !== "owner")
                  .map((member) => {
                    const busy = seatReleaseBusyId === `mem:${member.userId}`;
                    return (
                      <div
                        key={member.userId}
                        className="border-border bg-surface flex items-center justify-between gap-2 rounded-xl border px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-foreground type-body-s truncate">
                            {member.name} ({member.email})
                          </p>
                          <p className="text-muted-foreground type-caption">
                            Active {member.role} · Private projects move to 90d Recovery Portal
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={Boolean(seatReleaseBusyId)}
                          onClick={() =>
                            void handleRemoveMemberForSeatDecrease(member.userId, member.name)
                          }
                        >
                          {busy ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <>
                              <UserMinus className="size-3.5" />
                              Remove
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
              </div>
            </div>

            {seatError && (
              <p role="alert" className="text-destructive type-caption">
                {seatError}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setSeatReleaseOpen(false)}
                disabled={busyAction === "seat-decrease"}
              >
                Close
              </Button>
              <Button
                type="button"
                data-testid="confirm-guided-seat-decrease-btn"
                disabled={
                  rosterState.members.length + rosterState.pendingInvites.length >
                    targetSeatCount || busyAction === "seat-decrease"
                }
                onClick={() => void executeScheduleSeatDecrease(targetSeatCount)}
              >
                {busyAction === "seat-decrease" ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  `Schedule decrease to ${targetSeatCount} seats`
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Cancel Teams Subscription Dialog */}
      {teamCancelOpen && teamBilling && (
        <Dialog open={teamCancelOpen} onOpenChange={setTeamCancelOpen}>
          <DialogContent className="max-w-md" data-testid="cancel-team-dialog">
            <DialogHeader>
              <DialogTitle>Cancel {teamBilling.organizationName} Teams?</DialogTitle>
              <DialogDescription>
                Paid seats stay active until {formatDateLabel(teamBilling.currentPeriodEndIso)}.
                After that:
              </DialogDescription>
            </DialogHeader>

            <ul className="flex flex-col gap-2.5 py-1">
              <li className="text-foreground type-body-s flex items-start gap-2.5">
                <XCircle className="text-destructive mt-0.5 size-4 shrink-0" />
                <span>
                  All Team Case Studies, edits, exports, and live Team links lock completely until
                  you renew Teams.
                </span>
              </li>
              <li className="text-foreground type-body-s flex items-start gap-2.5">
                <Check className="text-success mt-0.5 size-4 shrink-0" />
                <span>
                  Each team member keeps their own independent Personal Workspace (1 Free Case Study,
                  or Pro if subscribed personally).
                </span>
              </li>
            </ul>

            <label className="text-foreground type-body-s flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                data-testid="cancel-team-confirm-checkbox"
                checked={teamCancelAcknowledged}
                onChange={(e) => setTeamCancelAcknowledged(e.target.checked)}
                className="accent-primary size-4 rounded"
              />
              <span>
                I understand Team projects will lock after{" "}
                {formatDateLabel(teamBilling.currentPeriodEndIso)}
              </span>
            </label>

            {actionError && (
              <p
                role="alert"
                className="border-destructive/30 bg-destructive-soft text-destructive type-body-s rounded-lg border px-3.5 py-2.5"
              >
                {actionError}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setTeamCancelOpen(false)}
                disabled={busyAction === "team-cancel"}
              >
                Keep Teams
              </Button>
              <Button
                type="button"
                variant="destructive"
                data-testid="confirm-cancel-team-btn"
                disabled={!teamCancelAcknowledged || busyAction === "team-cancel"}
                onClick={() => void handleCancelTeamSubscription()}
              >
                {busyAction === "team-cancel" ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  "Cancel Teams subscription"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Paddle Sandbox / Live Checkout Modal */}
      {checkoutOpen && (
        <PaddleCheckoutModal
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          initialPlan={checkoutPlan}
          initialInterval={checkoutInterval}
          orgId={checkoutOrgId}
        />
      )}
    </div>
  );
}
