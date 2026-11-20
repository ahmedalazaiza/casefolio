"use client";

import type { PlanTier } from "@casefolio/db";
import {
  ArrowRight,
  Crown,
  Minus,
  Plus,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ScrollRise } from "@/components/marketing/motion";
import { PlanCard, type PlanSpecItem } from "@/components/ui/domain-cards";
import {
  formatUsdFromCents,
  TEAMS_CALCULATOR_DEFAULT_SEATS,
  type ActivePlanTier,
  type BillingInterval,
  type PaidPlanTier,
} from "@/lib/billing/plans";
import {
  computeTeamsPriceWithCms,
  DEFAULT_SITE_CMS_CONTENT,
  mergeBillingCatalogWithCms,
  type SiteCmsContent,
} from "@/lib/cms/schema";
import {
  FREE_MONTHLY_EXPORT_LIMIT,
  PRO_MONTHLY_EXPORT_LIMIT,
  TEAMS_MONTHLY_EXPORT_LIMIT_PER_SEAT,
} from "@/lib/exports/types";
import { cn } from "@/lib/utils";

const DISPLAY_PLAN_ORDER: readonly ActivePlanTier[] = ["free", "pro", "team"];

const PLAN_ICONS: Record<ActivePlanTier, ReactNode> = {
  free: <Sparkles />,
  pro: <Crown />,
  team: <Users />,
};

export interface LandingPricingSectionProps {
  defaultInterval?: BillingInterval;
  interval?: BillingInterval;
  onIntervalChange?: (interval: BillingInterval) => void;
  teamSeats?: number;
  onTeamSeatsChange?: (seats: number) => void;
  onSelectPaidPlan?: (
    plan: PaidPlanTier,
    interval: BillingInterval,
    seats?: number,
  ) => void;
  currentTier?: PlanTier | null;
  showComparisonLink?: boolean;
  cmsPricing?: SiteCmsContent["pricing"];
}

export function LandingPricingSection({
  defaultInterval = "monthly",
  interval: controlledInterval,
  onIntervalChange,
  teamSeats: controlledTeamSeats,
  onTeamSeatsChange,
  onSelectPaidPlan,
  currentTier = null,
  showComparisonLink = false,
  cmsPricing = DEFAULT_SITE_CMS_CONTENT.pricing,
}: LandingPricingSectionProps) {
  const catalog = mergeBillingCatalogWithCms(cmsPricing);
  const minSeats = Math.max(1, catalog.team.minSeats);
  const maxSeats = Math.max(minSeats, catalog.team.maxSeats);
  const defaultTeamSeats = Math.max(
    minSeats,
    Math.min(maxSeats, catalog.team.defaultSeats || TEAMS_CALCULATOR_DEFAULT_SEATS),
  );

  const [uncontrolledInterval, setUncontrolledInterval] =
    useState<BillingInterval>(defaultInterval);
  const [uncontrolledSeats, setUncontrolledSeats] = useState<number>(defaultTeamSeats);

  const interval = controlledInterval ?? uncontrolledInterval;
  const teamSeats = Math.max(
    minSeats,
    Math.min(maxSeats, Math.round(controlledTeamSeats ?? uncontrolledSeats)),
  );

  function setInterval(next: BillingInterval) {
    setUncontrolledInterval(next);
    onIntervalChange?.(next);
  }

  function adjustTeamSeats(delta: number) {
    const next = Math.max(minSeats, Math.min(maxSeats, teamSeats + delta));
    setUncontrolledSeats(next);
    onTeamSeatsChange?.(next);
  }

  const teamCalc = computeTeamsPriceWithCms(teamSeats, interval, cmsPricing.tiers.team);

  return (
    <div className="flex w-full flex-col items-center gap-8">
      {/* Studio Command Billing Interval Dock */}
      <div
        role="group"
        aria-label="Billing interval"
        className="inline-flex items-center gap-1.5 rounded-2xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-1.5"
      >
        <button
          type="button"
          aria-pressed={interval === "monthly"}
          onClick={() => setInterval("monthly")}
          className={cn(
            "focus-visible:ring-ring/40 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors outline-none focus-visible:ring-2",
            interval === "monthly"
              ? "bg-[var(--cf-royal)] text-[var(--cf-text-on-royal)]"
              : "text-[var(--cf-text-secondary)] hover:text-[var(--cf-text-primary)]",
          )}
        >
          Monthly
        </button>
        <button
          type="button"
          aria-pressed={interval === "yearly"}
          onClick={() => setInterval("yearly")}
          className={cn(
            "focus-visible:ring-ring/40 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors outline-none focus-visible:ring-2",
            interval === "yearly"
              ? "bg-[var(--cf-royal)] text-[var(--cf-text-on-royal)]"
              : "text-[var(--cf-text-secondary)] hover:text-[var(--cf-text-primary)]",
          )}
        >
          <span>Annual</span>
          <span className="rounded-lg bg-[var(--cf-bg-accent)] px-2.5 py-0.5 text-[0.6875rem] font-bold tracking-wider text-[var(--cf-text-on-accent)] uppercase">
            {cmsPricing.annualBadgeLabel}
          </span>
        </button>
      </div>

      {/* 3 Plan Cards: Free (Left) · Pro Most Popular (Center Royal Blue) · Teams Dynamic Seats (Right) */}
      <ScrollRise
        data-testid="paid-plan-cards-grid"
        stagger
        y={20}
        className="grid w-full grid-cols-1 items-stretch gap-5 lg:grid-cols-3 lg:gap-6"
      >
        {DISPLAY_PLAN_ORDER.map((tier) => {
          const plan = catalog[tier];
          const isFree = tier === "free";
          const isTeams = tier === "team";
          const isHighlighted = cmsPricing.popularTier === tier;

          let priceLabel: string;
          let periodLabel: string;
          let billingNote: string;

          if (isFree && plan.monthlyPriceCents === 0) {
            priceLabel = "$0";
            periodLabel = "/forever";
            billingNote = "No credit card required · Upgrade anytime";
          } else if (isTeams && teamCalc.ok) {
            const headlineCents =
              interval === "yearly"
                ? teamCalc.yearlyTotalCents
                : teamCalc.monthlyTotalCents;
            priceLabel = formatUsdFromCents(headlineCents);
            periodLabel = interval === "yearly" ? "/yr" : "/mo";
            billingNote =
              interval === "yearly"
                ? `${formatUsdFromCents(plan.yearlyMonthlyEquivalentCents)}/seat/mo · ${teamSeats} seats (${cmsPricing.annualBadgeLabel})`
                : `${formatUsdFromCents(plan.monthlyPriceCents)}/seat/mo · ${formatUsdFromCents(teamCalc.yearlyTotalCents)}/yr on annual (${cmsPricing.annualBadgeLabel})`;
          } else {
            const headlineCents =
              interval === "yearly" ? plan.yearlyTotalCents : plan.monthlyPriceCents;
            priceLabel = formatUsdFromCents(headlineCents);
            periodLabel = interval === "yearly" ? "/yr" : "/mo";
            billingNote =
              interval === "yearly"
                ? `Equals ${formatUsdFromCents(plan.yearlyMonthlyEquivalentCents)}/mo · ${cmsPricing.annualBadgeLabel} (save ${formatUsdFromCents(plan.yearlySavingsCents)}/yr)`
                : `Billed monthly · ${formatUsdFromCents(plan.yearlyTotalCents)}/yr on annual (${cmsPricing.annualBadgeLabel})`;
          }

          const scopeLabel = plan.scopeSummary;
          const badgeLabel = isHighlighted
            ? cmsPricing.popularBadgeText
            : plan.badgeLabel || (isFree ? "Free starter" : `${minSeats}–${maxSeats} seats`);

          const featuresHeading = isFree
            ? "Included in Free"
            : plan.includesLabel || (tier === "pro" ? "Includes everything in Free, plus" : "Includes everything in Pro, plus");

          const specs: readonly PlanSpecItem[] = isFree
            ? [
                {
                  label: "Case studies",
                  value: plan.maxCaseStudies < 0 ? "Unlimited" : `${plan.maxCaseStudies} lifetime`,
                },
                { label: "Share link", value: plan.customSlugEnabled ? "/p/your-slug" : "Auto URL" },
                { label: "Exports / mo", value: `${FREE_MONTHLY_EXPORT_LIMIT}/mo (1×)` },
                { label: "Cloud storage", value: "250 MB" },
              ]
            : tier === "pro"
              ? [
                  {
                    label: "Case studies",
                    value: plan.maxCaseStudies < 0 ? "Unlimited" : `Up to ${plan.maxCaseStudies} active`,
                  },
                  { label: "Custom URL", value: plan.customSlugEnabled ? "/p/your-slug" : "Auto URL" },
                  { label: "Exports / mo", value: `${PRO_MONTHLY_EXPORT_LIMIT}/mo` },
                  { label: "Cloud storage", value: "5 GB" },
                ]
              : [
                  { label: "Team seats", value: `${teamSeats} seats` },
                  {
                    label: "Case studies",
                    value: plan.maxCaseStudies < 0 ? "Unlimited" : `${plan.maxCaseStudies} shared`,
                  },
                  {
                    label: "Pooled exports",
                    value: `${teamSeats * TEAMS_MONTHLY_EXPORT_LIMIT_PER_SEAT}/mo`,
                  },
                  { label: "Pooled storage", value: `${teamSeats * 10} GB` },
                ];

          const isCurrent =
            currentTier === tier || (isTeams && currentTier === "plus");
          const ctaLabel = isCurrent
            ? "Current plan"
            : isFree
              ? currentTier
                ? "Go to Dashboard"
                : plan.ctaLabel
              : isTeams
                ? `${plan.ctaLabel.replace(/\s*\(\d+\s*seats\)/i, "")} (${teamSeats} seats)`
                : plan.ctaLabel;

          const ctaHref = isFree
            ? currentTier
              ? "/dashboard"
              : "/sign-up"
            : isTeams
              ? `/sign-up?plan=team&interval=${interval}&seats=${teamSeats}`
              : `/sign-up?plan=${tier}&interval=${interval}`;

          const canTriggerPaidModal = Boolean(!isFree && !isCurrent && onSelectPaidPlan);

          const teamPriceExtra =
            isTeams && teamCalc.ok ? (
              <div
                data-testid="team-card-seat-stepper"
                className="mt-3 flex items-center justify-between gap-2 rounded-2xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] px-3.5 py-2.5"
              >
                <div className="flex flex-col">
                  <span className="type-caption font-bold text-[var(--cf-text-primary)] tabular-nums">
                    {teamSeats} seats ·{" "}
                    {interval === "yearly"
                      ? `${formatUsdFromCents(plan.yearlyTotalCents)}/seat/yr`
                      : `${formatUsdFromCents(plan.monthlyPriceCents)}/seat/mo`}
                  </span>
                  <span className="type-caption text-[var(--cf-text-secondary)] tabular-nums">
                    {interval === "yearly"
                      ? `${formatUsdFromCents(teamCalc.yearlyMonthlyEquivalentCents)}/mo equiv. (${cmsPricing.annualBadgeLabel})`
                      : `${formatUsdFromCents(teamCalc.monthlyTotalCents)}/mo total`}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Decrease Team card seats"
                    data-testid="team-card-seats-decrement"
                    disabled={teamSeats <= minSeats}
                    onClick={() => adjustTeamSeats(-1)}
                    className="inline-flex size-7 items-center justify-center rounded-lg border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] text-[var(--cf-text-primary)] transition-colors hover:border-[var(--cf-royal)] disabled:opacity-40"
                  >
                    <Minus className="size-3.5" aria-hidden="true" />
                  </button>
                  <span
                    data-testid="team-card-seats-value"
                    className="type-caption min-w-5 text-center font-bold text-[var(--cf-text-primary)] tabular-nums"
                  >
                    {teamSeats}
                  </span>
                  <button
                    type="button"
                    aria-label="Increase Team card seats"
                    data-testid="team-card-seats-increment"
                    disabled={teamSeats >= maxSeats}
                    onClick={() => adjustTeamSeats(1)}
                    className="inline-flex size-7 items-center justify-center rounded-lg border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] text-[var(--cf-text-primary)] transition-colors hover:border-[var(--cf-royal)] disabled:opacity-40"
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
              specs={specs}
              description={plan.tagline}
              ctaLabel={ctaLabel}
              ctaHref={canTriggerPaidModal ? undefined : ctaHref}
              ctaDisabled={isCurrent}
              onSelectPlan={
                canTriggerPaidModal && onSelectPaidPlan
                  ? () =>
                      onSelectPaidPlan(
                        tier as PaidPlanTier,
                        interval,
                        isTeams ? teamSeats : 1,
                      )
                  : undefined
              }
              featuresHeading={featuresHeading}
              features={plan.features}
              icon={PLAN_ICONS[tier]}
              highlighted={isHighlighted}
            />
          );
        })}
      </ScrollRise>

      {showComparisonLink && (
        <div className="flex w-full flex-col items-center justify-between gap-4 rounded-2xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-5 sm:flex-row sm:px-6">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-center sm:justify-start sm:text-left">
            <span className="v3-body-s-strong inline-flex items-center gap-2 text-[var(--cf-text-primary)]">
              <ShieldCheck className="text-success size-4 shrink-0" />
              <span>Need a side-by-side breakdown of all plans?</span>
            </span>
            <span className="type-caption text-[var(--cf-text-secondary)]">
              Compare Free, Pro, and Teams features, limits, and the interactive per-seat
              calculator.
            </span>
          </div>
          <Link href="/pricing#plan-comparison" className="v3-btn-secondary py-2 text-xs">
            <span>Compare all plans</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
