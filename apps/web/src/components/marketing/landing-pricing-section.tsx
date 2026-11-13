"use client";

import type { PlanTier } from "@casefolio/db";
import {
  ArrowRight,
  Building2,
  Crown,
  Minus,
  Plus,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlanCard } from "@/components/ui/domain-cards";
import {
  BILLING_PLAN_CATALOG,
  computeTeamsPrice,
  formatUsdFromCents,
  PLUS_INCLUDED_SEATS,
  TEAMS_MAX_SELF_SERVE_SEATS,
  TEAMS_MIN_SEATS,
  type BillingInterval,
  type PaidPlanTier,
} from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

const PAID_PLAN_ORDER: readonly PaidPlanTier[] = ["pro", "team", "plus"];

const PAID_CARD_EXCLUSIONS: Record<PaidPlanTier, readonly string[]> = {
  pro: [
    "Shared Team Workspace & Brand Kit",
    "Custom domain & complete PDF/live white-labeling",
  ],
  team: [
    "Custom domain & complete PDF/live white-labeling",
    `11–${PLUS_INCLUDED_SEATS} seats & priority 24/7 support`,
  ],
  plus: [],
};

const PAID_PLAN_ICONS: Record<PaidPlanTier, ReactNode> = {
  pro: <Crown />,
  team: <Users />,
  plus: <Building2 />,
};

export interface LandingPricingSectionProps {
  defaultInterval?: BillingInterval;
  interval?: BillingInterval;
  onIntervalChange?: (interval: BillingInterval) => void;
  onSelectPaidPlan?: (plan: PaidPlanTier, interval: BillingInterval, seats?: number) => void;
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
  const [teamSeats, setTeamSeats] = useState<number>(TEAMS_MIN_SEATS);
  const interval = controlledInterval ?? uncontrolledInterval;

  function setInterval(next: BillingInterval) {
    setUncontrolledInterval(next);
    onIntervalChange?.(next);
  }

  function adjustTeamSeats(delta: number) {
    setTeamSeats((prev) =>
      Math.max(TEAMS_MIN_SEATS, Math.min(TEAMS_MAX_SELF_SERVE_SEATS, prev + delta)),
    );
  }

  const roundedSavingsPercent = Math.round(
    BILLING_PLAN_CATALOG.pro.yearlySavingsPercent,
  );
  const teamCalc = computeTeamsPrice(teamSeats, interval);
  const freePlan = BILLING_PLAN_CATALOG.free;
  const isCurrentFree = currentTier === "free";

  return (
    <div className="flex w-full flex-col items-center gap-8 sm:gap-10">
      {/* Billing interval segmented toggle + annual 20% discount badge */}
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
            <span>Annual</span>
            <span
              className={cn(
                "type-caption rounded-full px-2.5 py-0.5 font-semibold",
                interval === "yearly"
                  ? "bg-primary text-primary-foreground"
                  : "bg-accent text-accent-foreground",
              )}
            >
              Save {roundedSavingsPercent}% · 2 months free
            </span>
          </button>
        </div>
      </div>

      {/* Framed studio stage housing the 3 main paid cards (Pro, Team, Plus) + subtle Free onboarding callout */}
      <div className="bg-surface border-border/60 w-full rounded-3xl border p-3 sm:rounded-[2.25rem] sm:p-5 lg:p-6">
        <div
          data-testid="paid-plan-cards-grid"
          className="grid w-full grid-cols-1 items-stretch gap-5 lg:grid-cols-3 lg:gap-6"
        >
          {PAID_PLAN_ORDER.map((tier) => {
            const plan = BILLING_PLAN_CATALOG[tier];
            const isTeams = tier === "team";
            const isPlus = tier === "plus";
            const isHighlighted = Boolean(plan.highlighted);
            const displayedMonthlyCents =
              interval === "monthly"
                ? plan.monthlyPriceCents
                : plan.yearlyMonthlyEquivalentCents;
            const priceLabel = formatUsdFromCents(displayedMonthlyCents);
            const periodLabel = isTeams ? "/seat/mo" : "/mo";

            const billingNote = isTeams
              ? interval === "yearly"
                ? `Billed ${formatUsdFromCents(plan.yearlyTotalCents)}/seat/year — Save 20%`
                : `Billed monthly · ${formatUsdFromCents(plan.yearlyMonthlyEquivalentCents)}/seat/mo on annual`
              : interval === "yearly"
                ? `Billed ${formatUsdFromCents(plan.yearlyTotalCents)}/year — Save 20%`
                : `Billed monthly · ${formatUsdFromCents(plan.yearlyMonthlyEquivalentCents)}/mo on annual`;

            const scopeLabel = isTeams
              ? `Small & mid-sized studios · ${TEAMS_MIN_SEATS}–${TEAMS_MAX_SELF_SERVE_SEATS} seats`
              : isPlus
                ? `Agencies & enterprises · Up to ${PLUS_INCLUDED_SEATS} seats flat`
                : "Freelancers & solo creators · 1 seat";

            const badgeLabel = isHighlighted
              ? "Most popular"
              : isTeams
                ? `${TEAMS_MIN_SEATS}–${TEAMS_MAX_SELF_SERVE_SEATS} seats`
                : `Up to ${PLUS_INCLUDED_SEATS} seats`;

            const featuresHeading =
              tier === "pro"
                ? "Includes everything in Free, plus"
                : tier === "team"
                  ? "Includes everything in Pro, plus"
                  : "Includes everything in Team, plus";

            const isCurrent = currentTier === tier;
            const ctaLabel = isCurrent
              ? "Current plan"
              : tier === "pro"
                ? "Upgrade to Pro"
                : tier === "team"
                  ? `Start Team (${teamSeats} seats)`
                  : "Upgrade to Plus";

            const ctaHref = isTeams
              ? `/sign-up?plan=team&interval=${interval}&seats=${teamSeats}`
              : `/sign-up?plan=${tier}&interval=${interval}`;

            const teamPriceExtra =
              isTeams && teamCalc.ok ? (
                <div
                  data-testid="team-card-seat-stepper"
                  className="border-border/70 bg-elevated mt-2 flex items-center justify-between gap-2 rounded-xl border px-3 py-2"
                >
                  <div className="flex flex-col">
                    <span className="text-foreground type-caption font-semibold tabular-nums">
                      {teamSeats} seats ·{" "}
                      {formatUsdFromCents(
                        interval === "yearly"
                          ? teamCalc.yearlyMonthlyEquivalentCents
                          : teamCalc.monthlyTotalCents,
                      )}
                      /mo
                    </span>
                    <span className="text-muted-foreground type-caption tabular-nums">
                      {interval === "yearly"
                        ? `${formatUsdFromCents(teamCalc.yearlyTotalCents)}/yr total`
                        : "Dynamic per-seat total"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label="Decrease Team card seats"
                      data-testid="team-card-seats-decrement"
                      disabled={teamSeats <= TEAMS_MIN_SEATS}
                      onClick={() => adjustTeamSeats(-1)}
                      className="border-border bg-surface text-foreground hover:bg-sunken inline-flex size-7 items-center justify-center rounded-full border transition-colors disabled:opacity-40"
                    >
                      <Minus className="size-3.5" aria-hidden="true" />
                    </button>
                    <span
                      data-testid="team-card-seats-value"
                      className="text-foreground type-caption min-w-5 text-center font-semibold tabular-nums"
                    >
                      {teamSeats}
                    </span>
                    <button
                      type="button"
                      aria-label="Increase Team card seats"
                      data-testid="team-card-seats-increment"
                      disabled={teamSeats >= TEAMS_MAX_SELF_SERVE_SEATS}
                      onClick={() => adjustTeamSeats(1)}
                      className="border-border bg-surface text-foreground hover:bg-sunken inline-flex size-7 items-center justify-center rounded-full border transition-colors disabled:opacity-40"
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ) : null;

            return (
              <PlanCard
                key={tier}
                data-testid={`plan-card-${tier}`}
                name={plan.name}
                price={priceLabel}
                period={periodLabel}
                badgeLabel={badgeLabel}
                scopeLabel={scopeLabel}
                billingNote={billingNote}
                priceExtra={teamPriceExtra}
                description={plan.tagline}
                ctaLabel={ctaLabel}
                ctaHref={onSelectPaidPlan ? undefined : ctaHref}
                onSelectPlan={
                  onSelectPaidPlan
                    ? () => onSelectPaidPlan(tier, interval, isTeams ? teamSeats : 1)
                    : undefined
                }
                featuresHeading={featuresHeading}
                features={plan.features}
                excludedFeatures={PAID_CARD_EXCLUSIONS[tier]}
                icon={PAID_PLAN_ICONS[tier]}
                highlighted={isHighlighted}
              />
            );
          })}
        </div>

        {/* Subtle Free default onboarding callout */}
        <div
          data-testid="free-onboarding-callout"
          className="border-border/70 bg-elevated mt-5 flex flex-col items-start justify-between gap-4 rounded-2xl border px-5 py-4 sm:mt-6 sm:flex-row sm:items-center sm:px-6"
        >
          <div className="flex flex-wrap items-center gap-3">
            <span
              aria-hidden="true"
              className="border-border/70 bg-surface text-foreground inline-flex size-9 shrink-0 items-center justify-center rounded-xl border"
            >
              <Sparkles className="size-4" />
            </span>
            <div className="flex flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-foreground type-body-s-strong">
                  {freePlan.name} — $0 / forever
                </span>
                <Badge tone="neutral">Included at signup</Badge>
              </div>
              <p className="text-muted-foreground type-caption">
                1 personal seat · 1 active Case Study · Standard templates · PNG &amp; PDF exports
                with subtle Casefolio watermark + Live Shareable Link.
              </p>
            </div>
          </div>
          <div className="flex w-full shrink-0 items-center gap-2.5 sm:w-auto">
            {isCurrentFree ? (
              <Badge tone="neutral">Current plan</Badge>
            ) : (
              <Button variant="secondary" size="sm" className="w-full sm:w-auto" asChild>
                <Link href="/sign-up">
                  <span>Start free</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            )}
          </div>
        </div>

        {showComparisonLink && (
          <div className="border-border/70 mt-4 flex flex-col items-center justify-between gap-4 rounded-2xl border bg-elevated px-5 py-4 sm:flex-row sm:px-6">
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-center sm:justify-start sm:text-left">
              <span className="text-foreground type-body-s-strong inline-flex items-center gap-2">
                <ShieldCheck className="text-success size-4 shrink-0" />
                <span>Need a side-by-side breakdown of all plans?</span>
              </span>
              <span className="text-muted-foreground type-caption">
                Compare Free, Pro, Team, and Plus features, limits, and the interactive per-seat calculator.
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
