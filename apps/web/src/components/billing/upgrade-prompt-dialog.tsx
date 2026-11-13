"use client";

import { Check, Lock, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PaddleCheckoutModal } from "@/components/billing/paddle-checkout-modal";
import { ProBadge } from "@/components/ui/badge";
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
  formatUsdFromCents,
  type PaidPlanTier,
} from "@/lib/billing/plans";

export interface UpgradePromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requiredPlan?: PaidPlanTier;
  featureTitle?: string;
  featureDescription?: string;
  orgId?: string | null;
  onUpgraded?: (plan: PaidPlanTier) => void;
}

export function UpgradePromptDialog({
  open,
  onOpenChange,
  requiredPlan = "pro",
  featureTitle = "Unlock Casefolio Pro",
  featureDescription = "Upgrade to unlock Unlimited Case Studies, all Pro & Premium templates, full customization, and watermark-free high-res PNG, PDF & Behance exports.",
  orgId = null,
  onUpgraded,
}: UpgradePromptDialogProps) {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const planDef = BILLING_PLAN_CATALOG[requiredPlan];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md" data-testid="upgrade-prompt-dialog">
          <DialogHeader>
            <div className="bg-accent text-primary mb-2 inline-flex size-11 items-center justify-center rounded-xl">
              <Lock className="size-5" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle>{featureTitle}</DialogTitle>
              <ProBadge />
            </div>
            <DialogDescription>{featureDescription}</DialogDescription>
          </DialogHeader>

          <div className="border-border/70 bg-wash-panel flex flex-col gap-3 rounded-2xl border p-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-foreground type-body-s-strong">
                Casefolio {planDef.name}
              </span>
              <span className="text-foreground type-heading-s font-mono tabular-nums">
                From {formatUsdFromCents(planDef.yearlyMonthlyEquivalentCents)}
                <span className="text-muted-foreground type-caption font-sans">
                  {requiredPlan === "team" ? "/seat/mo" : "/mo"}
                </span>
              </span>
            </div>

            <ul className="flex flex-col gap-2">
              {planDef.features.map((feat) => (
                <li
                  key={feat}
                  className="text-muted-foreground type-body-s flex items-center gap-2"
                >
                  <Check className="text-success size-4 shrink-0" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button asChild variant="secondary">
              <Link href="/account/billing" onClick={() => onOpenChange(false)}>
                View billing &amp; plans
              </Link>
            </Button>

            <Button
              type="button"
              data-testid="upgrade-prompt-open-checkout"
              onClick={() => {
                onOpenChange(false);
                setCheckoutOpen(true);
              }}
            >
              <Sparkles className="size-4" />
              Upgrade to {planDef.name}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {checkoutOpen && (
        <PaddleCheckoutModal
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          initialPlan={requiredPlan}
          orgId={orgId}
          onCheckoutCompleted={onUpgraded}
        />
      )}
    </>
  );
}
