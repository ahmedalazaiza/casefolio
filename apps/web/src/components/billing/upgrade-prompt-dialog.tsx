"use client";

import { PaddleCheckoutModal } from "@/components/billing/paddle-checkout-modal";
import type { PaidPlanTier } from "@/lib/billing/plans";
import type { SiteCmsContent } from "@/lib/cms/schema";

export interface UpgradePromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requiredPlan?: PaidPlanTier;
  /** Short context shown as the modal title, e.g. "Unlock the Meridian Pro template". */
  featureTitle?: string;
  /** @deprecated The plan picker now explains the plan itself; kept for call-site compatibility. */
  featureDescription?: string;
  orgId?: string | null;
  onUpgraded?: (plan: PaidPlanTier) => void;
  /** @deprecated Pricing is always read from the billing catalog. */
  cmsPricing?: SiteCmsContent["pricing"];
}

/**
 * Single-step upgrade flow: every upgrade entry point opens the plan picker directly
 * (plan → interval → Paddle checkout) instead of showing an intermediate marketing screen
 * with a second, differently-worded price.
 */
export function UpgradePromptDialog({
  open,
  onOpenChange,
  requiredPlan = "pro",
  featureTitle,
  orgId = null,
  onUpgraded,
}: UpgradePromptDialogProps) {
  if (!open) return null;

  return (
    <PaddleCheckoutModal
      open={open}
      onOpenChange={onOpenChange}
      initialPlan={requiredPlan}
      orgId={orgId}
      onCheckoutCompleted={onUpgraded}
      contextTitle={featureTitle}
    />
  );
}
