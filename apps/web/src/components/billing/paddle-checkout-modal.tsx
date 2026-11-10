"use client";

import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import { Check, CreditCard, Loader2, Minus, Plus, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import {
  BILLING_PLAN_CATALOG,
  clampTeamsSeats,
  formatPlanHeadingLabel,
  getChargeAmountUsd,
  TEAMS_CALCULATOR_DEFAULT_SEATS,
  TEAMS_MAX_SELF_SERVE_SEATS,
  TEAMS_MIN_SEATS,
  type BillingInterval,
  type PaidPlanTier,
} from "@/lib/billing/plans";

export interface PreparedCheckoutPayload {
  mode: "paddle" | "sandbox_simulated";
  environment: "sandbox" | "production";
  clientToken: string;
  priceId: string;
  plan: PaidPlanTier;
  interval: BillingInterval;
  seats: number;
  amountUsd: number;
  customerEmail: string;
  orgId: string | null;
  /** Identity-free: `operationId` points at the server-side checkout intent. */
  customData: {
    operationId: string;
    plan: PaidPlanTier;
    interval: BillingInterval;
    seats: number;
  };
}

const PLAN_CONFIRM_POLL_MS = 2_000;
const PLAN_CONFIRM_TIMEOUT_MS = 90_000;

/** `live_` tokens belong to Paddle production; everything else is the sandbox. */
const IS_PRODUCTION_BILLING = (process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? "").startsWith("live_");

/**
 * The Paddle overlay reports `checkout.completed` the instant the customer pays, but the plan only
 * changes once our signed webhook has been processed. Instead of optimistically claiming an upgrade
 * (and being wrong if the webhook is delayed or rejected) we poll the server until the VERIFIED plan
 * matches, and fall back to honest "still activating" copy — never asking the customer to pay twice.
 */
async function confirmPlanActivation(args: {
  plan: PaidPlanTier;
  orgId: string | null;
}): Promise<"active" | "pending"> {
  const deadline = Date.now() + PLAN_CONFIRM_TIMEOUT_MS;
  const query = args.orgId ? `?orgId=${encodeURIComponent(args.orgId)}` : "";

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`/api/paddle/status${query}`, { cache: "no-store" });
      if (response.ok) {
        const json = (await response.json()) as {
          personal: { plan: string };
          team: { plan: string; status: string } | null;
        };
        const activated =
          args.plan === "pro"
            ? json.personal.plan === "pro"
            : json.team?.plan === "team" && ["active", "trialing"].includes(json.team.status);
        if (activated) return "active";
      }
    } catch {
      // transient network error — keep polling until the deadline
    }
    await new Promise((resolve) => setTimeout(resolve, PLAN_CONFIRM_POLL_MS));
  }
  return "pending";
}

export interface PaddleCheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPlan?: PaidPlanTier;
  initialInterval?: BillingInterval;
  initialSeats?: number;
  orgId?: string | null;
  onCheckoutCompleted?: (plan: PaidPlanTier) => void;
}

export function PaddleCheckoutModal({
  open,
  onOpenChange,
  initialPlan = "pro",
  initialInterval = "monthly",
  initialSeats = TEAMS_CALCULATOR_DEFAULT_SEATS,
  orgId = null,
  onCheckoutCompleted,
}: PaddleCheckoutModalProps) {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<PaidPlanTier>(initialPlan);
  const [selectedInterval, setSelectedInterval] =
    useState<BillingInterval>(initialInterval);
  const [selectedSeats, setSelectedSeats] = useState<number>(
    clampTeamsSeats(initialSeats),
  );
  const [loadingSession, setLoadingSession] = useState(false);
  const [submittingSandbox, setSubmittingSandbox] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<PreparedCheckoutPayload | null>(null);
  const [alreadySubscribed, setAlreadySubscribed] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedPlan(initialPlan);
      setSelectedInterval(initialInterval);
      setSelectedSeats(clampTeamsSeats(initialSeats));
      setErrorMessage(null);
      setAlreadySubscribed(false);
      setPrepared(null);
    }
  }, [open, initialPlan, initialInterval, initialSeats]);

  const planDef = BILLING_PLAN_CATALOG[selectedPlan];
  const effectiveSeats = selectedPlan === "team" ? selectedSeats : 1;
  const displayAmount = getChargeAmountUsd(selectedPlan, selectedInterval, effectiveSeats);

  async function launchPaddleOverlay(session: PreparedCheckoutPayload) {
    const planName = BILLING_PLAN_CATALOG[session.plan].name;
    let completionHandled = false;

    const paddle: Paddle | undefined = await initializePaddle({
      environment: session.environment,
      token: session.clientToken,
      eventCallback(event) {
        if (event.name === "checkout.completed" && !completionHandled) {
          completionHandled = true;
          const toastId = toast.loading(`Payment received — activating ${planName}…`);
          void confirmPlanActivation({ plan: session.plan, orgId: session.orgId }).then(
            (outcome) => {
              if (outcome === "active") {
                toast.success(`You're on Casefolio ${planName}!`, { id: toastId });
                onCheckoutCompleted?.(session.plan);
              } else {
                toast.message(
                  `Your payment went through. ${planName} is still activating and will appear in Billing shortly — you don't need to pay again.`,
                  { id: toastId, duration: 12_000 },
                );
              }
              router.refresh();
            },
          );
        } else if (
          event.name === "checkout.payment.failed" ||
          event.name === "checkout.failed" ||
          event.name === "checkout.error"
        ) {
          toast.error("We couldn't complete the payment. You haven't been charged — try another card.");
        }
      },
    });

    if (!paddle) {
      setErrorMessage("Could not initialize Paddle checkout script.");
      return;
    }

    onOpenChange(false);
    paddle.Checkout.open({
      items: [
        {
          priceId: session.priceId,
          quantity: session.seats,
        },
      ],
      customer: {
        email: session.customerEmail,
      },
      customData: session.customData,
    });
  }

  async function handlePrepareOrOpenCheckout() {
    setErrorMessage(null);
    setAlreadySubscribed(false);
    setLoadingSession(true);

    try {
      const response = await fetch("/api/paddle/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: selectedPlan,
          interval: selectedInterval,
          orgId: selectedPlan === "team" ? orgId : null,
          seats: effectiveSeats,
        }),
      });

      const json = (await response.json()) as
        | { ok: true; session: PreparedCheckoutPayload }
        | { ok: false; code?: string; error?: string };

      if (!response.ok || !json.ok) {
        setAlreadySubscribed("code" in json && json.code === "ALREADY_SUBSCRIBED");
        setErrorMessage(
          ("error" in json && json.error) || "Failed to initialize checkout session.",
        );
        return;
      }

      if (json.session.mode === "paddle") {
        await launchPaddleOverlay(json.session);
        return;
      }

      setPrepared(json.session);
    } catch {
      setErrorMessage("Network error while connecting to billing service.");
    } finally {
      setLoadingSession(false);
    }
  }

  async function handleCompleteSandboxPayment() {
    setErrorMessage(null);
    setSubmittingSandbox(true);

    try {
      const response = await fetch("/api/paddle/sandbox-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: selectedPlan,
          interval: selectedInterval,
          orgId: selectedPlan === "team" ? orgId : null,
          seats: effectiveSeats,
        }),
      });

      const json = (await response.json()) as
        | { ok: true; effectivePlan: string }
        | { ok: false; error?: string };

      if (!response.ok || !json.ok) {
        setErrorMessage(
          ("error" in json && json.error) || "Sandbox payment failed.",
        );
        return;
      }

      toast.success(
        `Sandbox checkout succeeded — welcome to Casefolio ${planDef.name}!`,
      );
      onOpenChange(false);
      onCheckoutCompleted?.(selectedPlan);
      router.refresh();
    } catch {
      setErrorMessage("Network error while finalizing sandbox payment.");
    } finally {
      setSubmittingSandbox(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="paddle-checkout-dialog">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>
              {prepared ? "Paddle Sandbox Checkout" : `Upgrade to ${planDef.name}`}
            </DialogTitle>
            <ProBadge />
            {!IS_PRODUCTION_BILLING && (
              <Badge tone="neutral" withDot={false}>
                Sandbox
              </Badge>
            )}
          </div>
          <DialogDescription>
            {prepared
              ? "Merchant of Record: Paddle.com Market Limited · Sandbox test mode."
              : planDef.tagline}
          </DialogDescription>
        </DialogHeader>

        {!prepared ? (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-2.5" role="group" aria-label="Select plan tier">
              {(["pro", "team"] as const).map((tier) => {
                const def = BILLING_PLAN_CATALOG[tier];
                const active = selectedPlan === tier;
                const unitUsd =
                  selectedInterval === "yearly"
                    ? def.yearlyMonthlyEquivalentUsd
                    : def.monthlyPriceUsd;
                return (
                  <button
                    key={tier}
                    type="button"
                    data-testid={`checkout-select-plan-${tier}`}
                    onClick={() => setSelectedPlan(tier)}
                    className={`flex flex-col items-start gap-1 rounded-lg border p-3.5 text-left transition-colors ${
                      active
                        ? "border-primary bg-accent text-foreground"
                        : "border-border bg-surface text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="text-foreground type-body-s-strong">{def.name}</span>
                    <span className="type-caption">
                      ${unitUsd}
                      {tier === "team" ? "/seat/mo" : "/mo"}
                    </span>
                  </button>
                );
              })}
            </div>

            <div
              className="border-border bg-sunken inline-flex self-start rounded-lg border p-1"
              role="group"
              aria-label="Billing interval"
            >
              <button
                type="button"
                data-testid="checkout-interval-monthly"
                onClick={() => setSelectedInterval("monthly")}
                className={`type-caption rounded-md px-3 py-1.5 transition-colors ${
                  selectedInterval === "monthly"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                data-testid="checkout-interval-yearly"
                onClick={() => setSelectedInterval("yearly")}
                className={`type-caption rounded-md px-3 py-1.5 transition-colors ${
                  selectedInterval === "yearly"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Yearly · Save {planDef.yearlySavingsPercent}%
              </button>
            </div>

            {selectedPlan === "team" && (
              <div
                data-testid="checkout-team-seats-picker"
                className="border-border bg-surface flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
              >
                <div className="flex flex-col">
                  <span className="text-foreground type-body-s-strong">
                    Paid seats (1–{TEAMS_MAX_SELF_SERVE_SEATS})
                  </span>
                  <span className="text-muted-foreground type-caption">
                    Includes Owner, Admin &amp; Member accounts
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Decrease checkout seats"
                    data-testid="checkout-seats-decrement"
                    disabled={selectedSeats <= TEAMS_MIN_SEATS}
                    onClick={() =>
                      setSelectedSeats((prev) => Math.max(TEAMS_MIN_SEATS, prev - 1))
                    }
                    className="border-border bg-elevated text-foreground hover:bg-sunken inline-flex size-8 items-center justify-center rounded-full border disabled:opacity-40"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span
                    data-testid="checkout-seats-value"
                    className="text-foreground type-body-s-strong min-w-8 text-center tabular-nums"
                  >
                    {selectedSeats}
                  </span>
                  <button
                    type="button"
                    aria-label="Increase checkout seats"
                    data-testid="checkout-seats-increment"
                    disabled={selectedSeats >= TEAMS_MAX_SELF_SERVE_SEATS}
                    onClick={() =>
                      setSelectedSeats((prev) =>
                        Math.min(TEAMS_MAX_SELF_SERVE_SEATS, prev + 1),
                      )
                    }
                    className="border-border bg-elevated text-foreground hover:bg-sunken inline-flex size-8 items-center justify-center rounded-full border disabled:opacity-40"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
              </div>
            )}

            <div className="border-border bg-surface flex flex-col gap-3 rounded-xl border p-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-foreground type-heading-s">
                  {formatPlanHeadingLabel(selectedPlan, selectedInterval, effectiveSeats)}
                </span>
                <span className="text-foreground type-heading-m font-mono tabular-nums">
                  ${displayAmount}
                  <span className="text-muted-foreground type-caption font-sans">
                    /{selectedInterval === "yearly" ? "yr" : "mo"}
                  </span>
                </span>
              </div>

              <ul className="flex flex-col gap-2">
                {planDef.features.map((feat) => (
                  <li key={feat} className="text-muted-foreground type-body-s flex items-center gap-2">
                    <Check className="text-success size-4 shrink-0" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            {errorMessage && (
              <div
                role="alert"
                data-testid="checkout-error"
                className="border-destructive/30 bg-destructive-soft text-destructive type-body-s flex flex-col gap-2 rounded-lg border px-3.5 py-2.5"
              >
                <p>{errorMessage}</p>
                {alreadySubscribed && (
                  <Link
                    href="/account/billing"
                    data-testid="checkout-manage-billing-link"
                    className="text-foreground type-body-s-strong underline underline-offset-2"
                    onClick={() => onOpenChange(false)}
                  >
                    Go to Billing
                  </Link>
                )}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
                disabled={loadingSession}
              >
                Cancel
              </Button>
              <Button
                type="button"
                data-testid="proceed-to-paddle-checkout"
                onClick={handlePrepareOrOpenCheckout}
                disabled={loadingSession}
              >
                {loadingSession ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Preparing checkout...
                  </>
                ) : (
                  <>
                    <CreditCard className="size-4" />
                    Continue to Paddle checkout
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="flex flex-col gap-4" data-testid="sandbox-payment-sheet">
            <div className="border-border bg-surface flex flex-col gap-2.5 rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground type-caption">Customer</span>
                <span className="text-foreground type-body-s font-mono">
                  {prepared.customerEmail}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground type-caption">Plan</span>
                <span className="text-foreground type-body-s-strong">
                  {formatPlanHeadingLabel(prepared.plan, prepared.interval, prepared.seats)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground type-caption">Paddle Price ID</span>
                <span className="text-tertiary type-caption font-mono">{prepared.priceId}</span>
              </div>
              <div className="border-border flex items-center justify-between border-t pt-2.5">
                <span className="text-foreground type-body-s-strong">Total due today</span>
                <span className="text-foreground type-heading-s font-mono tabular-nums">
                  ${prepared.amountUsd}.00 USD
                </span>
              </div>
            </div>

            <div className="border-border bg-elevated flex items-center justify-between rounded-lg border px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="border-border bg-surface text-foreground type-caption rounded border px-2 py-0.5 font-mono">
                  VISA
                </span>
                <div className="flex flex-col">
                  <span className="text-foreground type-body-s-strong">
                    Sandbox test card •••• 4242
                  </span>
                  <span className="text-tertiary type-caption">
                    Triggers signed HMAC-SHA256 Paddle webhook
                  </span>
                </div>
              </div>
              <ShieldCheck className="text-success size-4 shrink-0" />
            </div>

            {errorMessage && (
              <div
                role="alert"
                data-testid="checkout-error"
                className="border-destructive/30 bg-destructive-soft text-destructive type-body-s flex flex-col gap-2 rounded-lg border px-3.5 py-2.5"
              >
                <p>{errorMessage}</p>
                {alreadySubscribed && (
                  <Link
                    href="/account/billing"
                    data-testid="checkout-manage-billing-link"
                    className="text-foreground type-body-s-strong underline underline-offset-2"
                    onClick={() => onOpenChange(false)}
                  >
                    Go to Billing
                  </Link>
                )}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPrepared(null)}
                disabled={submittingSandbox}
              >
                Back
              </Button>
              <Button
                type="button"
                data-testid="complete-sandbox-checkout"
                onClick={handleCompleteSandboxPayment}
                disabled={submittingSandbox}
              >
                {submittingSandbox ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Processing payment...
                  </>
                ) : (
                  `Pay $${prepared.amountUsd}.00 (Sandbox)`
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
