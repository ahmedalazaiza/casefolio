"use client";

import type { PlanTier } from "@casefolio/db";
import { useState } from "react";
import { PlanCard } from "@/components/ui/domain-cards";
import {
  BILLING_PLAN_CATALOG,
  type BillingInterval,
  type PaidPlanTier,
} from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

const PLAN_ORDER: readonly PlanTier[] = ["free", "pro", "team"];

export interface LandingPricingSectionProps {
  defaultInterval?: BillingInterval;
  onSelectPaidPlan?: (plan: PaidPlanTier, interval: BillingInterval) => void;
  currentTier?: PlanTier | null;
}

export function LandingPricingSection({
  defaultInterval = "monthly",
  onSelectPaidPlan,
  currentTier = null,
}: LandingPricingSectionProps) {
  const [interval, setInterval] = useState<BillingInterval>(defaultInterval);

  return (
    <div className="flex flex-col items-center gap-10">
      {/* Billing interval segmented toggle (Figma 29:6787) */}
      <div
        role="group"
        aria-label="Billing interval"
        className="bg-sunken border-border inline-flex items-center gap-1 rounded-full border p-1"
      >
        <button
          type="button"
          aria-pressed={interval === "monthly"}
          onClick={() => setInterval("monthly")}
          className={cn(
            "type-body-s-strong focus-visible:ring-ring/40 rounded-full px-4 py-1.5 transition-all outline-none focus-visible:ring-2",
            interval === "monthly"
              ? "bg-elevated text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Monthly
        </button>
        <button
          type="button"
          aria-pressed={interval === "yearly"}
          onClick={() => setInterval("yearly")}
          className={cn(
            "type-body-s-strong focus-visible:ring-ring/40 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 transition-all outline-none focus-visible:ring-2",
            interval === "yearly"
              ? "bg-elevated text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <span>Yearly</span>
          <span className="bg-accent text-accent-foreground type-caption rounded-full px-2 py-0.5">
            Save {BILLING_PLAN_CATALOG.pro.yearlySavingsPercent}%
          </span>
        </button>
      </div>

      {/* 3-plan grid wired to BILLING_PLAN_CATALOG (Figma 29:6792) */}
      <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-3">
        {PLAN_ORDER.map((tier) => {
          const plan = BILLING_PLAN_CATALOG[tier];
          const isFree = tier === "free";
          const isHighlighted = Boolean(plan.highlighted);
          const displayedMonthlyUsd =
            isFree || interval === "monthly"
              ? plan.monthlyPriceUsd
              : plan.yearlyMonthlyEquivalentUsd;
          const priceLabel = `$${displayedMonthlyUsd}`;
          const periodLabel = isFree
            ? "/forever"
            : interval === "yearly"
              ? `/mo · $${plan.yearlyTotalUsd}/yr`
              : "/mo";
          const badgeLabel = isHighlighted
            ? "Popular"
            : isFree
              ? "Starter"
              : `${plan.defaultSeats}+ seats`;

          const isCurrent = currentTier === tier;
          const ctaLabel = isCurrent
            ? "Current plan"
            : isFree
              ? "Start free"
              : tier === "pro"
                ? "Upgrade to Pro"
                : "Start Team workspace";

          const ctaHref = isFree
            ? "/sign-up"
            : `/sign-up?plan=${tier}&interval=${interval}`;

          return (
            <PlanCard
              key={tier}
              name={plan.name}
              price={priceLabel}
              period={periodLabel}
              badgeLabel={badgeLabel}
              description={plan.tagline}
              ctaLabel={ctaLabel}
              ctaHref={!isFree && onSelectPaidPlan ? undefined : ctaHref}
              onSelectPlan={
                !isFree && onSelectPaidPlan
                  ? () => onSelectPaidPlan(tier, interval)
                  : undefined
              }
              features={plan.features}
              highlighted={isHighlighted}
            />
          );
        })}
      </div>
    </div>
  );
}
