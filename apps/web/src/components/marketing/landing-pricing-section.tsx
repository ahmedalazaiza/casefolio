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
import { Badge } from "@/components/ui/badge";
import { PlanCard, type PlanSpecItem } from "@/components/ui/domain-cards";
import {
  BILLING_PLAN_CATALOG,
  computeTeamsPrice,
  formatUsdFromCents,
  PRO_MAX_PROJECTS,
  TEAMS_CALCULATOR_DEFAULT_SEATS,
  TEAMS_MAX_SELF_SERVE_SEATS,
  TEAMS_MIN_SEATS,
  type BillingInterval,
  type PaidPlanTier,
} from "@/lib/billing/plans";
import {
  PRO_MONTHLY_EXPORT_LIMIT,
  TEAMS_MONTHLY_EXPORT_LIMIT_PER_SEAT,
} from "@/lib/exports/types";
import { cn } from "@/lib/utils";

const PAID_PLAN_ORDER: readonly PaidPlanTier[] = ["pro", "team"];

const PAID_PLAN_ICONS: Record<PaidPlanTier, ReactNode> = {
  pro: <Crown />,
  team: <Users />,
};

export interface LandingPricingSectionProps {
  defaultInterval?: BillingInterval;
  interval?: BillingInterval;
  onIntervalChange?: (interval: BillingInterval) => void;
  onSelectPaidPlan?: (
    plan: PaidPlanTier,
    interval: BillingInterval,
    seats?: number,
  ) => void;
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
  const [teamSeats, setTeamSeats] = useState<number>(TEAMS_CALCULATOR_DEFAULT_SEATS);
  const interval = controlledInterval ?? uncontrolledInterval;

  function setInterval(next: BillingInterval) {
    setUncontrolledInterval(next);
    onIntervalChange?.(next);
  }

  function adjustTeamSeats(delta: number) {
    setTeamSeats((prev) =>
      Math.max(
        TEAMS_MIN_SEATS,
        Math.min(TEAMS_MAX_SELF_SERVE_SEATS, prev + delta),
      ),
    );
  }

  const teamCalc = computeTeamsPrice(teamSeats, interval);
  const freePlan = BILLING_PLAN_CATALOG.free;
  const isCurrentFree = currentTier === "free";

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
            2 months free
          </span>
        </button>
      </div>

      {/* 2 Sculpted Paid Plan Cards (Pro & Electric Royal Blue Teams Stage) */}
      <ScrollRise
        data-testid="paid-plan-cards-grid"
        stagger
        y={20}
        className="grid w-full grid-cols-1 items-stretch gap-6 lg:grid-cols-2"
      >
        {PAID_PLAN_ORDER.map((tier) => {
          const plan = BILLING_PLAN_CATALOG[tier];
          const isTeams = tier === "team";
          const isHighlighted = Boolean(plan.highlighted);
          const displayedMonthlyCents =
            interval === "monthly"
              ? plan.monthlyPriceCents
              : plan.yearlyMonthlyEquivalentCents;
          const priceLabel = formatUsdFromCents(displayedMonthlyCents);
          const periodLabel = isTeams ? "/seat/mo" : "/mo";

          const billingNote = isTeams
            ? interval === "yearly"
              ? `Billed ${formatUsdFromCents(plan.yearlyTotalCents)}/seat/year — 2 months free`
              : `Billed monthly · ${formatUsdFromCents(plan.yearlyMonthlyEquivalentCents)}/seat/mo on annual (2 months free)`
            : interval === "yearly"
              ? `Billed ${formatUsdFromCents(plan.yearlyTotalCents)}/year — 2 months free`
              : `Billed monthly · ${formatUsdFromCents(plan.yearlyMonthlyEquivalentCents)}/mo on annual (2 months free)`;

          const scopeLabel = isTeams
            ? `Product design teams & studios · ${TEAMS_MIN_SEATS}–${TEAMS_MAX_SELF_SERVE_SEATS} seats`
            : `Freelancers & solo designers · Up to ${PRO_MAX_PROJECTS} active projects`;

          const badgeLabel = isHighlighted ? "Most popular" : "Solo creator";

          const featuresHeading =
            tier === "pro"
              ? "Includes everything in Free, plus"
              : "Includes everything in Pro, plus";

          const specs: readonly PlanSpecItem[] =
            tier === "pro"
              ? [
                  { label: "Case studies", value: `Up to ${PRO_MAX_PROJECTS} active` },
                  { label: "Custom URL", value: "/p/your-slug" },
                  { label: "Exports / mo", value: `${PRO_MONTHLY_EXPORT_LIMIT}/mo` },
                  { label: "Cloud storage", value: "5 GB" },
                ]
              : [
                  { label: "Team seats", value: `${teamSeats} seats` },
                  { label: "Case studies", value: "Unlimited" },
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
            : tier === "pro"
              ? "Upgrade to Pro"
              : `Start Teams (${teamSeats} seats)`;

          const ctaHref = isTeams
            ? `/sign-up?plan=team&interval=${interval}&seats=${teamSeats}`
            : `/sign-up?plan=${tier}&interval=${interval}`;

          const teamPriceExtra =
            isTeams && teamCalc.ok ? (
              <div
                data-testid="team-card-seat-stepper"
                className={cn(
                  "mt-3 flex items-center justify-between gap-2 rounded-2xl border px-3.5 py-2.5",
                  isHighlighted
                    ? "border-[var(--cf-border-on-royal)] bg-[var(--cf-bg-inverse-elevated)]/80"
                    : "border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)]",
                )}
              >
                <div className="flex flex-col">
                  <span
                    className={cn(
                      "type-caption font-bold tabular-nums",
                      isHighlighted
                        ? "text-[var(--cf-text-on-royal)]"
                        : "text-[var(--cf-text-primary)]",
                    )}
                  >
                    {teamSeats} seats ·{" "}
                    {formatUsdFromCents(
                      interval === "yearly"
                        ? teamCalc.yearlyMonthlyEquivalentCents
                        : teamCalc.monthlyTotalCents,
                    )}
                    /mo
                  </span>
                  <span
                    className={cn(
                      "type-caption tabular-nums",
                      isHighlighted
                        ? "text-[var(--cf-text-on-royal-muted)]"
                        : "text-[var(--cf-text-secondary)]",
                    )}
                  >
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
                    className={cn(
                      "inline-flex size-7 items-center justify-center rounded-lg border transition-colors disabled:opacity-40",
                      isHighlighted
                        ? "border-[var(--cf-border-on-royal)] bg-[var(--cf-bg-elevated)]/15 text-[var(--cf-text-on-royal)] hover:bg-[var(--cf-bg-elevated)]/25"
                        : "border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] text-[var(--cf-text-primary)]",
                    )}
                  >
                    <Minus className="size-3.5" aria-hidden="true" />
                  </button>
                  <span
                    data-testid="team-card-seats-value"
                    className={cn(
                      "type-caption min-w-5 text-center font-bold tabular-nums",
                      isHighlighted
                        ? "text-[var(--cf-bg-accent)]"
                        : "text-[var(--cf-text-primary)]",
                    )}
                  >
                    {teamSeats}
                  </span>
                  <button
                    type="button"
                    aria-label="Increase Team card seats"
                    data-testid="team-card-seats-increment"
                    disabled={teamSeats >= TEAMS_MAX_SELF_SERVE_SEATS}
                    onClick={() => adjustTeamSeats(1)}
                    className={cn(
                      "inline-flex size-7 items-center justify-center rounded-lg border transition-colors disabled:opacity-40",
                      isHighlighted
                        ? "border-[var(--cf-border-on-royal)] bg-[var(--cf-bg-elevated)]/15 text-[var(--cf-text-on-royal)] hover:bg-[var(--cf-bg-elevated)]/25"
                        : "border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] text-[var(--cf-text-primary)]",
                    )}
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
              ctaHref={onSelectPaidPlan ? undefined : ctaHref}
              onSelectPlan={
                onSelectPaidPlan
                  ? () =>
                      onSelectPaidPlan(tier, interval, isTeams ? teamSeats : 1)
                  : undefined
              }
              featuresHeading={featuresHeading}
              features={plan.features}
              icon={PAID_PLAN_ICONS[tier]}
              highlighted={isHighlighted}
            />
          );
        })}
      </ScrollRise>

      {/* Studio 00 · Free Forever Admission Card */}
      <div
        data-testid="free-onboarding-callout"
        className="v3-pattern-dots-light flex w-full flex-col items-start justify-between gap-5 rounded-[2rem] border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-6 sm:flex-row sm:items-center sm:px-8 sm:py-7"
      >
        <div className="flex flex-wrap items-center gap-4">
          <span
            aria-hidden="true"
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--cf-royal)] text-[var(--cf-bg-accent)]"
          >
            <Sparkles className="size-5" />
          </span>
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center rounded-md bg-[var(--cf-bg-accent)] px-2 py-0.5 text-[0.6875rem] font-bold tracking-wider text-[var(--cf-text-on-accent)] uppercase">
                00 · Free Starter
              </span>
              <span className="v3-heading-s text-[var(--cf-text-primary)]">
                {freePlan.name} — $0 / forever
              </span>
              <Badge tone="neutral">Included at signup</Badge>
            </div>
            <p className="v3-body-s text-[var(--cf-text-secondary)]">
              1 personal seat · 1 lifetime Case Study credit · Full A-to-Z builder · 5 exports/mo
              (1440px PNG &amp; PDF with subtle watermark) · 250 MB storage · Auto-generated
              shareable link.
            </p>
          </div>
        </div>
        <div className="flex w-full shrink-0 items-center gap-2.5 sm:w-auto">
          {isCurrentFree ? (
            <Badge tone="neutral">Current plan</Badge>
          ) : (
            <Link
              href="/sign-up"
              className="v3-btn-primary w-full py-2.5 pr-3 pl-5 text-sm sm:w-auto"
            >
              <span>Start free</span>
              <span className="inline-flex size-6 items-center justify-center rounded-md bg-[var(--cf-bg-accent)] text-[var(--cf-text-on-accent)]">
                <ArrowRight className="size-3.5" />
              </span>
            </Link>
          )}
        </div>
      </div>

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
