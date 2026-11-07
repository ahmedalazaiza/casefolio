"use client";

import type { PlanTier } from "@casefolio/db";
import {
  AlertTriangle,
  Check,
  CreditCard,
  ExternalLink,
  Loader2,
  RotateCcw,
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
    effectivePlan === "team" ? "Team" : effectivePlan === "pro" ? "Pro" : "Free";

  // Modals state
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<PaidPlanTier>("pro");
  const [checkoutInterval, setCheckoutInterval] =
    useState<BillingInterval>(currentInterval);

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

  const [updatePaymentOpen, setUpdatePaymentOpen] = useState(false);

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (initialPortalAction === "cancel" && effectivePlan !== "free") {
      setCancelStep(1);
    }
  }, [initialPortalAction, effectivePlan]);

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

      // Sandbox fallback: open inline subscription management / cancellation flow
      setCancelAcknowledged(false);
      setCancelStep(1);
    } catch {
      toast.error("Network error while opening billing portal.");
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
    setCheckoutOpen(true);
  }

  const isPastDue = sub?.status === "past_due";
  const isCancelScheduled = sub?.status === "cancel_at_period_end";
  const hasPaidAccess = effectivePlan === "pro" || effectivePlan === "team";

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
      {/* Conditional Alert Banner: Payment Failed (Figma 2:11343) */}
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
                We couldn&apos;t charge {sub.paymentBrand} ••{sub.paymentLast4}. Paddle
                will retry automatically — update your payment method to keep {planTitle}{" "}
                features active.
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

      {/* Conditional Alert Banner: Subscription Cancelled (Figma 2:11509) */}
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
                {planTitle} stays active until {periodEndFormatted}, then your account
                moves to Free. Public pages revert to the Free watermark and Pro templates
                lock for new drafts.
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

      {/* Top Row: Current plan + Payment method (Figma 2:11191) */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Current plan card */}
        <section
          data-testid="billing-current-plan-card"
          className="border-border/80 bg-wash-panel shadow-card flex flex-col justify-between gap-5 rounded-3xl border p-6 sm:p-7"
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground type-body-s-strong">
                Current plan
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
                ? "$0/mo · Up to 2 projects & watermarked PNG exports"
                : isCancelScheduled
                  ? `${currentAmountSummary} · access ends ${periodEndFormatted}`
                  : `${currentAmountSummary} · next charge ${periodEndFormatted}`}
            </p>
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

          {hasPaidAccess && sub ? (
            <div className="flex items-center gap-3.5">
              <div className="border-border bg-surface text-foreground type-caption flex h-9 min-w-12 items-center justify-center rounded-md border px-2.5 font-mono">
                {sub.paymentBrand}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-foreground type-body-s-strong">
                  {sub.paymentBrand === "VISA" ? "Visa" : sub.paymentBrand} ending{" "}
                  {sub.paymentLast4}
                </span>
                <span className="text-muted-foreground type-caption">
                  Expires {sub.paymentExpiry}
                </span>
              </div>
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

      {/* Billing details card (Figma 2:11230) */}
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

      {/* Modal / Change plan (Figma 2:11733) */}
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
              {/* Billing period segment */}
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
                  Yearly · Save 17%
                </button>
              </div>

              {/* 3 Plan Cards */}
              <div
                role="radiogroup"
                aria-label="Choose plan tier"
                className="grid gap-3.5 md:grid-cols-3"
              >
                {(["free", "pro", "team"] as const).map((tier) => {
                  const def = BILLING_PLAN_CATALOG[tier];
                  const selected = pickerTier === tier;
                  const unitPrice =
                    tier === "free"
                      ? 0
                      : pickerInterval === "yearly"
                        ? def.yearlyMonthlyEquivalentUsd
                        : def.monthlyPriceUsd;

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

                        <div className="flex items-baseline gap-1">
                          <span className="text-foreground type-heading-l font-mono">
                            ${unitPrice}
                          </span>
                          <span className="text-muted-foreground type-caption">
                            /mo
                            {tier !== "free" && pickerInterval === "yearly"
                              ? ` ($${def.yearlyTotalUsd}/yr)`
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

      {/* Modal / Downgrade to Free? (Figma 2:12014) */}
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
                  Projects beyond the 2-project Free limit cannot create new drafts
                </span>
              </li>
              <li className="text-foreground type-body-s flex items-start gap-2.5">
                <XCircle className="text-destructive mt-0.5 size-4 shrink-0" />
                <span>Pro templates lock for new case studies</span>
              </li>
              <li className="text-foreground type-body-s flex items-start gap-2.5">
                <XCircle className="text-destructive mt-0.5 size-4 shrink-0" />
                <span>
                  &ldquo;Made with Casefolio&rdquo; badge returns; PDF &amp; Behance
                  exports lock
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

      {/* Modal / Cancel Step 1 (reason) (Figma 2:12201) */}
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

      {/* Modal / Cancel Step 2 (confirm) (Figma 2:12399) */}
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
                    Published pages display the &ldquo;Made with Casefolio&rdquo; badge
                    after {periodEndFormatted}
                  </span>
                </li>
                <li className="text-foreground type-body-s flex items-start gap-2.5">
                  <XCircle className="text-destructive mt-0.5 size-4 shrink-0" />
                  <span>Unlimited PDF &amp; Behance exports end</span>
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

      {/* Modal / Update payment method (Figma 2:12591) */}
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
                  Current method: {sub?.paymentBrand ?? "VISA"} ••••{" "}
                  {sub?.paymentLast4 ?? "4242"}
                </span>
                <span className="text-muted-foreground type-caption">
                  {overview.hasLivePaddlePortal
                    ? "Open the Paddle Customer Portal to replace your card or switch to PayPal."
                    : "In Sandbox mode, re-run Sandbox Checkout to refresh your test payment method and clear any failed-payment state."}
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
                      setCheckoutPlan(effectivePlan === "team" ? "team" : "pro");
                      setCheckoutInterval(currentInterval);
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
        />
      )}
    </div>
  );
}
