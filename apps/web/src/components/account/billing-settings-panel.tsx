"use client";

import type { PlanTier } from "@casefolio/db";
import {
  AlertTriangle,
  Check,
  CreditCard,
  ExternalLink,
  Globe,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
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
import {
  BILLING_PLAN_CATALOG,
  formatPlanAmountSummary,
  formatPlanHeadingLabel,
  formatUsdFromCents,
  PLUS_INCLUDED_SEATS,
  TEAMS_MAX_SELF_SERVE_SEATS,
  TEAMS_MIN_SEATS,
  type BillingInterval,
  type PaidPlanTier,
} from "@/lib/billing/plans";
import type { UserBillingOverview } from "@/lib/billing/service";

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

export function BillingSettingsPanel({
  overview,
  accountName,
  accountEmail,
  initialPortalAction,
}: BillingSettingsPanelProps) {
  const router = useRouter();
  const sub = overview.subscription;
  const effectivePlan = overview.effectivePlan;
  const currentInterval: BillingInterval = sub?.interval ?? "monthly";
  const currentPlanHeading = formatPlanHeadingLabel(effectivePlan, currentInterval);
  const currentAmountSummary = formatPlanAmountSummary(effectivePlan, currentInterval);
  const periodEndFormatted = formatDateLabel(sub?.currentPeriodEndIso);
  const planTitle =
    effectivePlan === "plus"
      ? "Plus"
      : effectivePlan === "team"
        ? "Team"
        : effectivePlan === "pro"
          ? "Pro"
          : "Free";
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
  const [pickerTier, setPickerTier] = useState<PlanTier>(
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

  // Team seat & custom domain management state
  const [targetSeatCount, setTargetSeatCount] = useState<number>(
    teamBilling && teamBilling.paidSeats > 0
      ? Math.max(TEAMS_MIN_SEATS, teamBilling.paidSeats)
      : 3,
  );
  const [seatPreview, setSeatPreview] = useState<SeatIncreasePreviewState | null>(null);
  const [seatError, setSeatError] = useState<string | null>(null);
  const [customDomainInput, setCustomDomainInput] = useState<string>(
    teamBilling?.customDomain ?? "",
  );
  const [domainError, setDomainError] = useState<string | null>(null);

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
    setCustomDomainInput(teamBilling?.customDomain ?? "");
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
        `Casefolio Team supports ${TEAMS_MIN_SEATS}–${TEAMS_MAX_SELF_SERVE_SEATS} paid seats. Upgrade to Casefolio Plus ($99/mo or $79/mo billed annually) for up to ${PLUS_INCLUDED_SEATS} seats, Custom Domain, and White-Labeling.`,
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

    // Schedule seat decrease at renewal
    setBusyAction("seat-decrease");
    try {
      const res = await fetch("/api/paddle/seats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "schedule_decrease",
          organizationId: teamBilling.organizationId,
          targetSeats: targetSeatCount,
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

      toast.success("Cancelled pending seat decrease.");
      router.refresh();
    } catch {
      setSeatError("Network error while cancelling pending decrease.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSaveCustomDomain() {
    if (!teamBilling) return;
    setBusyAction("custom-domain");
    setDomainError(null);
    try {
      const res = await fetch("/api/paddle/seats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_custom_domain",
          organizationId: teamBilling.organizationId,
          customDomain: customDomainInput.trim() || null,
        }),
      });
      const json = (await res.json()) as
        | { ok: true; customDomain: string | null }
        | { ok: false; error?: string };

      if (!res.ok || !json.ok) {
        setDomainError(
          ("error" in json && json.error) || "Could not update custom domain.",
        );
        return;
      }

      toast.success(
        json.customDomain
          ? `Custom domain saved: ${json.customDomain}`
          : "Custom domain cleared.",
      );
      router.refresh();
    } catch {
      setDomainError("Network error while updating custom domain.");
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
      pickerTier === "team" || pickerTier === "plus"
        ? (teamBilling?.organizationId ?? null)
        : null,
    );
    setCheckoutOpen(true);
  }

  const isPastDue = sub?.status === "past_due";
  const isCancelScheduled = sub?.status === "cancel_at_period_end";
  const hasPaidAccess =
    effectivePlan === "pro" || effectivePlan === "team" || effectivePlan === "plus";

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
          className="border-destructive/30 bg-destructive-soft flex flex-wrap items-center justify-between gap-4 rounded-3xl border p-5 sm:p-6"
        >
          <div className="flex items-start gap-3.5">
            <div className="bg-elevated text-destructive flex size-10 shrink-0 items-center justify-center rounded-2xl">
              <AlertTriangle className="size-4" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-foreground type-body-s-strong">Payment failed</span>
              <p className="text-muted-foreground type-body-s max-w-xl">
                We couldn&apos;t charge{" "}
                {sub.paymentBrand && sub.paymentLast4
                  ? `${sub.paymentBrand} ••${sub.paymentLast4}`
                  : "your payment method"}
                . Paddle will retry automatically during your 7-day grace window — update
                your payment method to keep {planTitle} features active.
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
          className="border-warning/30 bg-warning-soft flex flex-wrap items-center justify-between gap-4 rounded-3xl border p-5 sm:p-6"
        >
          <div className="flex items-start gap-3.5">
            <div className="bg-elevated text-warning flex size-10 shrink-0 items-center justify-center rounded-2xl">
              <AlertTriangle className="size-4" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-foreground type-body-s-strong">
                Subscription cancelled
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
          className="border-border/80 bg-wash-panel shadow-card flex flex-col justify-between gap-5 rounded-3xl border p-6 sm:p-7"
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
                ? "$0 / forever · 1 active Case Study, standard templates, watermarked PNG & PDF export + Live Shareable Link"
                : isCancelScheduled
                  ? `${currentAmountSummary} · access ends ${periodEndFormatted}`
                  : `${currentAmountSummary} · next charge ${periodEndFormatted}`}
            </p>

            {personalPublished.length > 1 && (
              <div className="border-border/70 bg-surface/80 flex flex-col gap-1.5 rounded-2xl border p-3">
                <Label htmlFor="keep-public-select" className="type-caption text-foreground">
                  {!hasPaidAccess
                    ? "Active Case Study on Free (1 editable & live; extras safely locked):"
                    : "Keep 1 active Case Study editable & live if downgraded to Free:"}
                </Label>
                <select
                  id="keep-public-select"
                  data-testid="keep-public-project-select"
                  value={keepPublicProjectId}
                  disabled={busyAction === "keep-public"}
                  onChange={(e) => handleSaveKeepPublicChoice(e.target.value)}
                  className="border-border bg-elevated text-foreground type-caption h-9 rounded-xl border px-2.5"
                >
                  {personalPublished.map((proj) => (
                    <option key={proj.id} value={proj.id}>
                      {proj.name} {proj.slug ? `(/p/${proj.slug})` : ""}
                    </option>
                  ))}
                </select>
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
          className="border-border/80 bg-elevated shadow-card flex flex-col justify-between gap-5 rounded-3xl border p-6 sm:p-7"
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
          className="border-border/80 bg-elevated shadow-card flex flex-col gap-5 rounded-3xl border p-6 sm:p-8"
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
                    teamBilling.plan === "team" || teamBilling.plan === "plus"
                      ? "published"
                      : "neutral"
                  }
                >
                  {teamBilling.plan === "plus"
                    ? "Plus Active"
                    : teamBilling.plan === "team"
                      ? "Team Active"
                      : "Unfunded"}
                </Badge>
                <Badge tone="accent">{teamBilling.role}</Badge>
              </div>
              <p className="text-muted-foreground type-body-s">
                Separate from your personal workspace.{" "}
                {teamBilling.plan === "plus"
                  ? `Flat agency rate includes up to ${PLUS_INCLUDED_SEATS} team seats, Custom Domain, and White-Labeling.`
                  : `Team includes ${TEAMS_MIN_SEATS}–${TEAMS_MAX_SELF_SERVE_SEATS} per-seat licenses; upgrade to Plus for up to ${PLUS_INCLUDED_SEATS} seats.`}
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
                    Activate Casefolio Team
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    data-testid="activate-plus-subscription-btn"
                    onClick={() => {
                      setCheckoutPlan("plus");
                      setCheckoutInterval("monthly");
                      setCheckoutOrgId(teamBilling.organizationId);
                      setCheckoutOpen(true);
                    }}
                  >
                    <Sparkles className="size-3.5" />
                    Activate Plus
                  </Button>
                </div>
              )}

            {teamBilling.isOwner && teamBilling.plan === "team" && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                data-testid="upgrade-team-to-plus-btn"
                onClick={() => {
                  setCheckoutPlan("plus");
                  setCheckoutInterval(teamBilling.interval ?? "monthly");
                  setCheckoutOrgId(teamBilling.organizationId);
                  setCheckoutOpen(true);
                }}
              >
                <Sparkles className="size-3.5" />
                Upgrade to Plus ({PLUS_INCLUDED_SEATS} seats)
              </Button>
            )}
          </div>

          {/* 5 separate, unambiguous seat counters */}
          <dl className="border-border bg-surface grid grid-cols-2 gap-3 rounded-2xl border p-4 sm:grid-cols-5">
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
              className="border-warning/30 bg-warning-soft flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3"
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

          {teamBilling.isOwner && teamBilling.plan === "team" && (
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
                      targetSeatCount <=
                        Math.max(TEAMS_MIN_SEATS, teamBilling.occupiedSeats) ||
                      teamBilling.isLockedForQuantityChange
                    }
                    onClick={() =>
                      setTargetSeatCount((v) =>
                        Math.max(TEAMS_MIN_SEATS, teamBilling.occupiedSeats, v - 1),
                      )
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
                      targetSeatCount >= TEAMS_MAX_SELF_SERVE_SEATS + 1 ||
                      teamBilling.isLockedForQuantityChange
                    }
                    onClick={() =>
                      setTargetSeatCount((v) =>
                        Math.min(TEAMS_MAX_SELF_SERVE_SEATS + 1, v + 1),
                      )
                    }
                    className="border-border bg-surface text-foreground inline-flex size-8 items-center justify-center rounded-full border disabled:opacity-40"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>

                {targetSeatCount > TEAMS_MAX_SELF_SERVE_SEATS ? (
                  <Button
                    type="button"
                    size="sm"
                    data-testid="seat-limit-upgrade-plus-btn"
                    onClick={() => {
                      setCheckoutPlan("plus");
                      setCheckoutInterval(teamBilling.interval ?? "monthly");
                      setCheckoutOrgId(teamBilling.organizationId);
                      setCheckoutOpen(true);
                    }}
                  >
                    <Sparkles className="size-3.5" />
                    Upgrade to Plus (up to {PLUS_INCLUDED_SEATS} seats)
                  </Button>
                ) : (
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
                )}
              </div>

              {targetSeatCount > TEAMS_MAX_SELF_SERVE_SEATS && (
                <p className="text-muted-foreground type-caption">
                  Casefolio Team supports up to {TEAMS_MAX_SELF_SERVE_SEATS} seats.
                  Switch to Casefolio Plus for up to {PLUS_INCLUDED_SEATS} seats at a
                  predictable flat rate, plus Custom Domain and White-Labeling.
                </p>
              )}

              {seatError && (
                <p role="alert" className="text-destructive type-caption">
                  {seatError}
                </p>
              )}
            </div>
          )}

          {teamBilling.plan === "plus" && (
            <div
              data-testid="plus-custom-domain-section"
              className="border-border flex flex-col gap-3 border-t pt-4"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Globe className="text-primary size-4" />
                  <span className="text-foreground type-body-s-strong">
                    Custom Domain &amp; White-Labeling
                  </span>
                  <Badge tone="published">Included in Plus</Badge>
                </div>
                <p className="text-muted-foreground type-caption">
                  Serve published Case Studies on your agency domain (e.g.{" "}
                  <span className="font-mono">work.youragency.com</span>) with complete
                  Casefolio branding removal on live links and PDF metadata.
                </p>
              </div>

              {teamBilling.isOwner || teamBilling.role === "admin" ? (
                <div className="flex flex-wrap items-center gap-2.5">
                  <Input
                    data-testid="plus-custom-domain-input"
                    value={customDomainInput}
                    onChange={(e) => setCustomDomainInput(e.target.value)}
                    placeholder="work.youragency.com"
                    className="max-w-sm font-mono"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    data-testid="save-custom-domain-btn"
                    disabled={busyAction === "custom-domain"}
                    onClick={handleSaveCustomDomain}
                  >
                    {busyAction === "custom-domain" ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save custom domain"
                    )}
                  </Button>
                </div>
              ) : (
                <p className="text-foreground type-caption font-mono">
                  {teamBilling.customDomain
                    ? `Active domain: ${teamBilling.customDomain}`
                    : "No custom domain configured yet (Owner or Admin can configure)."}
                </p>
              )}

              {domainError && (
                <p role="alert" className="text-destructive type-caption">
                  {domainError}
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {/* Billing details card */}
      <section
        data-testid="billing-details-card"
        className="border-border/80 bg-elevated shadow-card flex flex-col gap-5 rounded-3xl border p-6 sm:p-8"
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
            <div className="border-border/80 bg-surface text-muted-foreground type-body-s flex min-h-11 items-center rounded-2xl border px-3.5 py-2">
              {accountName}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-foreground type-body-s-strong">Billing email</span>
            <div className="border-border/80 bg-surface text-muted-foreground type-body-s flex min-h-11 items-center rounded-2xl border px-3.5 py-2 break-all">
              {accountEmail}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-foreground type-body-s-strong">
            Tax &amp; VAT compliance
          </span>
          <div className="border-border/80 bg-surface text-muted-foreground type-body-s flex min-h-11 items-center rounded-2xl border px-3.5 py-2">
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

            <div className="border-border bg-surface flex flex-col gap-2.5 rounded-2xl border p-4">
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
                      ? "bg-elevated text-foreground shadow-card"
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
                      ? "bg-elevated text-foreground shadow-card"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Annual · Save {BILLING_PLAN_CATALOG.pro.yearlySavingsPercent}%
                </button>
              </div>

              <div
                role="radiogroup"
                aria-label="Choose plan tier"
                className="grid gap-3.5 md:grid-cols-2 lg:grid-cols-4"
              >
                {(["free", "pro", "team", "plus"] as const).map((tier) => {
                  const def = BILLING_PLAN_CATALOG[tier];
                  const selected = pickerTier === tier;
                  const unitCents =
                    tier === "free"
                      ? 0
                      : pickerInterval === "yearly"
                        ? def.yearlyMonthlyEquivalentCents
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
                      className={`focus-visible:ring-ring/40 flex cursor-pointer flex-col justify-between gap-4 rounded-2xl border p-5 text-left transition-all outline-none focus-visible:ring-2 ${
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
                          {def.highlighted && <ProBadge />}
                        </div>

                        <div className="flex flex-wrap items-baseline gap-1">
                          <span className="text-foreground type-heading-l font-mono tabular-nums">
                            {formatUsdFromCents(unitCents)}
                          </span>
                          <span className="text-muted-foreground type-caption">
                            {tier === "free"
                              ? "/forever"
                              : tier === "team"
                                ? "/seat/mo"
                                : "/mo"}
                            {tier !== "free" && pickerInterval === "yearly"
                              ? ` (${formatUsdFromCents(def.yearlyTotalCents)}${tier === "team" ? "/seat/yr" : "/yr"})`
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
                  Creating a 2nd Case Study requires upgrading back to Pro, Team, or Plus
                </span>
              </li>
              <li className="text-foreground type-body-s flex items-start gap-2.5">
                <XCircle className="text-destructive mt-0.5 size-4 shrink-0" />
                <span>
                  Subtle Casefolio watermark returns on live links and PNG/PDF exports;
                  2x PNG &amp; Behance exports lock
                </span>
              </li>
            </ul>

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
                    2x PNG &amp; Behance exports end
                  </span>
                </li>
              </ul>

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
                        effectivePlan === "plus"
                          ? "plus"
                          : effectivePlan === "team"
                            ? "team"
                            : "pro";
                      setCheckoutPlan(nextPlan);
                      setCheckoutInterval(currentInterval);
                      setCheckoutOrgId(
                        nextPlan === "team" || nextPlan === "plus"
                          ? (teamBilling?.organizationId ?? null)
                          : null,
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
