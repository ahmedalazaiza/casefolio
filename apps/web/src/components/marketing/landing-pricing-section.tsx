"use client";

import type { PlanTier } from "@casefolio/db";
import { ArrowRight, Crown, ShieldCheck, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { PlanCard } from "@/components/ui/domain-cards";
import {
  BILLING_PLAN_CATALOG,
  TEAMS_MAX_SELF_SERVE_SEATS,
  type BillingInterval,
  type PaidPlanTier,
} from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

const PLAN_ORDER: readonly PlanTier[] = ["free", "pro", "team"];

const PLAN_CARD_EXCLUSIONS: Record<PlanTier, readonly string[]> = {
  free: [
    "Pro templates & removable branding",
    "2x Retina PNG, A4 PDF & Behance 1,400px pack",
    "Shared team spaces & multi-seat roles",
  ],
  pro: [
    "Shared team spaces & pooled org capacity",
    "Team role governance & member recovery portal",
  ],
  team: [],
};

const PLAN_ICONS: Record<PlanTier, ReactNode> = {
  free: <Sparkles />,
  pro: <Crown />,
  team: <Users />,
};

export interface LandingPricingSectionProps {
  defaultInterval?: BillingInterval;
  interval?: BillingInterval;
  onIntervalChange?: (interval: BillingInterval) => void;
  onSelectPaidPlan?: (plan: PaidPlanTier, interval: BillingInterval) => void;
  currentTier?: PlanTier | null;
  showComparisonLink?: boolean;
}

export function LandingPricingSection({
  defaultInterval = "monthly",
  interval: controlledInterval,
  onIntervalChange,
  onSelectPaidPlan,
  currentTier = null,
  showComparisonLink = false,
}: LandingPricingSectionProps) {
  const [uncontrolledInterval, setUncontrolledInterval] =
    useState<BillingInterval>(defaultInterval);
  const interval = controlledInterval ?? uncontrolledInterval;

  function setInterval(next: BillingInterval) {
    setUncontrolledInterval(next);
    onIntervalChange?.(next);
  }

  const roundedSavingsPercent = Math.round(
    BILLING_PLAN_CATALOG.pro.yearlySavingsPercent,
  );

  return (
    <div className="flex w-full flex-col items-center gap-8 sm:gap-10">
      {/* Billing interval segmented toggle + annual value hint */}
      <div className="flex flex-col items-center gap-3">
        <div
          role="group"
          aria-label="Billing interval"
          className="bg-surface border-border/80 shadow-card inline-flex items-center gap-1 rounded-full border p-1.5"
        >
          <button
            type="button"
            aria-pressed={interval === "monthly"}
            onClick={() => setInterval("monthly")}
            className={cn(
              "type-body-s-strong focus-visible:ring-ring/40 rounded-full px-5 py-2 transition-all outline-none focus-visible:ring-2",
              interval === "monthly"
                ? "bg-inverse text-inverse-foreground shadow-xs"
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
              "type-body-s-strong focus-visible:ring-ring/40 inline-flex items-center gap-2 rounded-full px-5 py-2 transition-all outline-none focus-visible:ring-2",
              interval === "yearly"
                ? "bg-inverse text-inverse-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span>Yearly</span>
            <span
              className={cn(
                "type-caption rounded-full px-2.5 py-0.5 font-semibold",
                interval === "yearly"
                  ? "bg-primary text-primary-foreground"
                  : "bg-accent text-accent-foreground",
              )}
            >
              2 months free · -{roundedSavingsPercent}%
            </span>
          </button>
        </div>
      </div>

      {/* Framed studio stage housing the 3 plan cards */}
      <div className="bg-surface border-border/60 w-full rounded-3xl border p-3 sm:rounded-[2.25rem] sm:p-5 lg:p-6">
        <div className="grid w-full grid-cols-1 items-stretch gap-5 lg:grid-cols-3 lg:gap-6">
          {PLAN_ORDER.map((tier) => {
            const plan = BILLING_PLAN_CATALOG[tier];
            const isFree = tier === "free";
            const isTeams = tier === "team";
            const isHighlighted = Boolean(plan.highlighted);
            const displayedMonthlyUsd =
              isFree || interval === "monthly"
                ? plan.monthlyPriceUsd
                : plan.yearlyMonthlyEquivalentUsd;
            const priceLabel = `$${displayedMonthlyUsd}`;
            const periodLabel = isFree
              ? "/forever"
              : isTeams
                ? "/seat/mo"
                : "/mo";
            const billingNote = isFree
              ? "No credit card required · Upgrade anytime"
              : isTeams
                ? interval === "yearly"
                  ? `Billed $${plan.yearlyTotalUsd}/seat/yr · Save $${plan.yearlySavingsCents / 100}/seat/yr`
                  : `Billed monthly · $${plan.yearlyMonthlyEquivalentUsd}/seat/mo on yearly`
                : interval === "yearly"
                  ? `Billed $${plan.yearlyTotalUsd}/yr · Save $${plan.yearlySavingsCents / 100}/yr`
                  : `Billed monthly · $${plan.yearlyMonthlyEquivalentUsd}/mo on yearly`;
            const scopeLabel = isFree
              ? "Personal · 1 designer"
              : isTeams
                ? `Team · 1–${TEAMS_MAX_SELF_SERVE_SEATS} paid seats`
                : "Personal studio · 1 designer";
            const badgeLabel = isHighlighted
              ? "Most popular"
              : isFree
                ? "Starter"
                : `1–${TEAMS_MAX_SELF_SERVE_SEATS} seats`;
            const featuresHeading = isFree
              ? "What’s included"
              : tier === "pro"
                ? "Everything in Free, plus"
                : "Everything in Pro, plus";

            const isCurrent = currentTier === tier;
            const ctaLabel = isCurrent
              ? "Current plan"
              : isFree
                ? "Start free"
                : tier === "pro"
                  ? "Upgrade to Pro"
                  : "Start Teams workspace";

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
                scopeLabel={scopeLabel}
                billingNote={billingNote}
                description={plan.tagline}
                ctaLabel={ctaLabel}
                ctaHref={!isFree && onSelectPaidPlan ? undefined : ctaHref}
                onSelectPlan={
                  !isFree && onSelectPaidPlan
                    ? () => onSelectPaidPlan(tier, interval)
                    : undefined
                }
                featuresHeading={featuresHeading}
                features={plan.features}
                excludedFeatures={PLAN_CARD_EXCLUSIONS[tier]}
                icon={PLAN_ICONS[tier]}
                highlighted={isHighlighted}
              />
            );
          })}
        </div>

        {showComparisonLink && (
          <div className="border-border/70 mt-5 flex flex-col items-center justify-between gap-4 rounded-2xl border bg-elevated px-5 py-4 sm:mt-6 sm:flex-row sm:px-6">
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-center sm:justify-start sm:text-left">
              <span className="text-foreground type-body-s-strong inline-flex items-center gap-2">
                <ShieldCheck className="text-success size-4 shrink-0" />
                <span>Need a side-by-side breakdown of quotas &amp; features?</span>
              </span>
              <span className="text-muted-foreground type-caption">
                See everything included &amp; excluded across Free, Pro, and Teams, plus the live seat calculator.
              </span>
            </div>
            <Button variant="secondary" size="sm" asChild>
              <Link href="/pricing#plan-comparison">
                <span>Compare all plans</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
