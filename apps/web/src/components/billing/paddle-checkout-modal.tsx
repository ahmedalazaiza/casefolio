"use client";

import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import { Check, CreditCard, Loader2, ShieldCheck } from "lucide-react";
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
  formatPlanHeadingLabel,
  getChargeAmountUsd,
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
  customData: {
    userId: string;
    orgId: string | null;
    plan: PaidPlanTier;
    interval: BillingInterval;
    seats: number;
  };
}

export interface PaddleCheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPlan?: PaidPlanTier;
  initialInterval?: BillingInterval;
  orgId?: string | null;
  onCheckoutCompleted?: (plan: PaidPlanTier) => void;
}

export function PaddleCheckoutModal({
  open,
  onOpenChange,
  initialPlan = "pro",
  initialInterval = "monthly",
  orgId = null,
  onCheckoutCompleted,
}: PaddleCheckoutModalProps) {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<PaidPlanTier>(initialPlan);
  const [selectedInterval, setSelectedInterval] =
    useState<BillingInterval>(initialInterval);
  const [loadingSession, setLoadingSession] = useState(false);
  const [submittingSandbox, setSubmittingSandbox] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<PreparedCheckoutPayload | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedPlan(initialPlan);
      setSelectedInterval(initialInterval);
      setErrorMessage(null);
      setPrepared(null);
    }
  }, [open, initialPlan, initialInterval]);

  const planDef = BILLING_PLAN_CATALOG[selectedPlan];
  const displayAmount = getChargeAmountUsd(selectedPlan, selectedInterval);

  async function launchPaddleOverlay(session: PreparedCheckoutPayload) {
    const paddle: Paddle | undefined = await initializePaddle({
      environment: session.environment,
      token: session.clientToken,
      eventCallback(event) {
        if (event.name === "checkout.completed") {
          toast.success(`Upgraded to ${BILLING_PLAN_CATALOG[session.plan].name}!`);
          onOpenChange(false);
          onCheckoutCompleted?.(session.plan);
          router.refresh();
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
    setLoadingSession(true);

    try {
      const response = await fetch("/api/paddle/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: selectedPlan,
          interval: selectedInterval,
          orgId,
        }),
      });

      const json = (await response.json()) as
        | { ok: true; session: PreparedCheckoutPayload }
        | { ok: false; error?: string };

      if (!response.ok || !json.ok) {
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
          orgId,
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
            <Badge tone="neutral" withDot={false}>
              Sandbox
            </Badge>
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
                      ${selectedInterval === "yearly" ? def.yearlyMonthlyEquivalentUsd : def.monthlyPriceUsd}
                      /mo
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

            <div className="border-border bg-surface flex flex-col gap-3 rounded-xl border p-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-foreground type-heading-s">
                  {formatPlanHeadingLabel(selectedPlan, selectedInterval)}
                </span>
                <span className="text-foreground type-heading-m font-mono">
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
              <p
                role="alert"
                className="border-destructive/30 bg-destructive-soft text-destructive type-body-s rounded-lg border px-3.5 py-2.5"
              >
                {errorMessage}
              </p>
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
                  {formatPlanHeadingLabel(prepared.plan, prepared.interval)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground type-caption">Paddle Price ID</span>
                <span className="text-tertiary type-caption font-mono">{prepared.priceId}</span>
              </div>
              <div className="border-border flex items-center justify-between border-t pt-2.5">
                <span className="text-foreground type-body-s-strong">Total due today</span>
                <span className="text-foreground type-heading-s font-mono">
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
              <p
                role="alert"
                className="border-destructive/30 bg-destructive-soft text-destructive type-body-s rounded-lg border px-3.5 py-2.5"
              >
                {errorMessage}
              </p>
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
