"use client";

import { ArrowRight, Building2, Calculator, Minus, Plus, ShieldAlert, Users } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { Eyebrow } from "@/components/ui/eyebrow";
import {
  BILLING_PLAN_CATALOG,
  computeTeamsPrice,
  formatUsdFromCents,
  getWorkspaceQuotas,
  PLUS_INCLUDED_SEATS,
  TEAMS_CALCULATOR_DEFAULT_SEATS,
  TEAMS_CALCULATOR_QUICK_SEATS,
  TEAMS_MAX_SELF_SERVE_SEATS,
  TEAMS_MIN_SEATS,
  type BillingInterval,
} from "@/lib/billing/plans";
import { formatBytesHuman } from "@/lib/storage/quotas";
import { cn } from "@/lib/utils";

export interface TeamsSeatCalculatorProps {
  interval: BillingInterval;
  onIntervalChange?: (interval: BillingInterval) => void;
  onStartTeamsCheckout?: (
    seats: number,
    interval: BillingInterval,
    plan?: "team" | "plus",
  ) => void;
  defaultSeats?: number;
}

export function TeamsSeatCalculator({
  interval,
  onIntervalChange,
  onStartTeamsCheckout,
  defaultSeats = TEAMS_CALCULATOR_DEFAULT_SEATS,
}: TeamsSeatCalculatorProps) {
  const [seats, setSeats] = useState<number>(Math.max(TEAMS_MIN_SEATS, defaultSeats));
  const sliderId = useId();

  const priceResult = computeTeamsPrice(seats, interval);
  const clampedQuotas = getWorkspaceQuotas(
    seats > TEAMS_MAX_SELF_SERVE_SEATS ? "plus" : "team",
    Math.min(seats, PLUS_INCLUDED_SEATS),
  );
  const plusPlan = BILLING_PLAN_CATALOG.plus;

  function updateSeats(next: number) {
    if (!Number.isFinite(next)) return;
    const bounded = Math.max(TEAMS_MIN_SEATS, Math.min(25, Math.round(next)));
    setSeats(bounded);
  }

  return (
    <div
      data-testid="teams-seat-calculator"
      className="flex w-full min-w-0 flex-col gap-7 rounded-[2.25rem] border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-6 sm:p-9"
    >
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="flex flex-col items-start gap-2.5">
          <Eyebrow step="03" icon={<Calculator className="size-3.5" />}>
            Team &amp; Agency Seat Calculator
          </Eyebrow>
          <h3 className="v3-heading-m text-[var(--cf-text-primary)]">
            Estimate per-seat Team pricing ({TEAMS_MIN_SEATS}–{TEAMS_MAX_SELF_SERVE_SEATS} seats) or{" "}
            <span className="v3-sticker-lime">Plus flat rate</span>
          </h3>
          <p className="v3-body-s max-w-2xl text-[var(--cf-text-secondary)]">
            Team scales flexibly from {TEAMS_MIN_SEATS} to {TEAMS_MAX_SELF_SERVE_SEATS} seats (seats
            × seat price). Need 11–{PLUS_INCLUDED_SEATS} seats, a custom domain, or full
            white-labeling? Casefolio Plus covers up to {PLUS_INCLUDED_SEATS} seats for one
            predictable flat price.
          </p>
        </div>

        {onIntervalChange && (
          <div
            role="group"
            aria-label="Calculator billing interval"
            className="inline-flex shrink-0 self-start rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] p-1"
          >
            <button
              type="button"
              aria-pressed={interval === "monthly"}
              onClick={() => onIntervalChange("monthly")}
              className={cn(
                "type-caption rounded-lg px-3.5 py-1.5 font-semibold transition-colors",
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
              onClick={() => onIntervalChange("yearly")}
              className={cn(
                "type-caption rounded-lg px-3.5 py-1.5 font-semibold transition-colors",
                interval === "yearly"
                  ? "bg-[var(--cf-royal)] text-[var(--cf-text-on-royal)]"
                  : "text-[var(--cf-text-secondary)] hover:text-[var(--cf-text-primary)]",
              )}
            >
              Annual (Save 20%)
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Controls column */}
        <div className="flex flex-col gap-5 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label
              htmlFor={sliderId}
              className="v3-body-s-strong flex items-center gap-2 text-[var(--cf-text-primary)]"
            >
              <span className="inline-flex size-7 items-center justify-center rounded-lg border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] text-[var(--cf-text-primary)]">
                <Users className="size-3.5 shrink-0" aria-hidden="true" />
              </span>
              <span>Team seats (including Admin)</span>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Decrease seats"
                data-testid="teams-calc-decrement"
                disabled={seats <= TEAMS_MIN_SEATS}
                onClick={() => updateSeats(seats - 1)}
                className="inline-flex size-9 items-center justify-center rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] text-[var(--cf-text-primary)] transition-colors hover:border-[var(--cf-royal)] hover:bg-[var(--cf-bg-surface)] disabled:opacity-40"
              >
                <Minus className="size-4" aria-hidden="true" />
              </button>
              <span
                data-testid="teams-calc-seat-count"
                className="inline-flex min-w-14 items-center justify-center rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] px-3 py-1.5 font-display text-base font-bold text-[var(--cf-text-primary)] tabular-nums"
              >
                {seats}
              </span>
              <button
                type="button"
                aria-label="Increase seats"
                data-testid="teams-calc-increment"
                disabled={seats >= 25}
                onClick={() => updateSeats(seats + 1)}
                className="inline-flex size-9 items-center justify-center rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] text-[var(--cf-text-primary)] transition-colors hover:border-[var(--cf-royal)] hover:bg-[var(--cf-bg-surface)] disabled:opacity-40"
              >
                <Plus className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <input
            id={sliderId}
            type="range"
            min={TEAMS_MIN_SEATS}
            max={21}
            step={1}
            value={Math.min(seats, 21)}
            onChange={(e) => updateSeats(Number(e.target.value))}
            aria-label="Paid seats slider"
            className="accent-primary h-2 w-full cursor-pointer rounded-lg"
          />

          {/* Quick-reference seat presets */}
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Quick seat presets">
            {TEAMS_CALCULATOR_QUICK_SEATS.map((preset) => {
              const active = seats === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  data-testid={`teams-calc-preset-${preset}`}
                  aria-pressed={active}
                  onClick={() => updateSeats(preset)}
                  className={cn(
                    "type-caption rounded-xl border px-3 py-1.5 font-semibold transition-colors",
                    active
                      ? "border-[var(--cf-royal)] bg-[var(--cf-royal)] text-[var(--cf-text-on-royal)]"
                      : "border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] text-[var(--cf-text-secondary)] hover:border-[var(--cf-royal)] hover:text-[var(--cf-text-primary)]",
                  )}
                >
                  {preset} seats
                </button>
              );
            })}
            <button
              type="button"
              data-testid="teams-calc-preset-15"
              aria-pressed={seats > TEAMS_MAX_SELF_SERVE_SEATS && seats <= PLUS_INCLUDED_SEATS}
              onClick={() => updateSeats(15)}
              className={cn(
                "type-caption rounded-xl border px-3 py-1.5 font-semibold transition-colors",
                seats > TEAMS_MAX_SELF_SERVE_SEATS && seats <= PLUS_INCLUDED_SEATS
                  ? "border-[var(--cf-royal)] bg-[var(--cf-royal)] text-[var(--cf-text-on-royal)]"
                  : "border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] text-[var(--cf-text-secondary)] hover:border-[var(--cf-royal)] hover:text-[var(--cf-text-primary)]",
              )}
            >
              11–{PLUS_INCLUDED_SEATS} seats (Plus)
            </button>
            <button
              type="button"
              data-testid="teams-calc-preset-26"
              aria-pressed={seats > PLUS_INCLUDED_SEATS}
              onClick={() => updateSeats(21)}
              className={cn(
                "type-caption rounded-xl border px-3 py-1.5 font-semibold transition-colors",
                seats > PLUS_INCLUDED_SEATS
                  ? "border-warning bg-warning-soft text-foreground"
                  : "border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] text-[var(--cf-text-secondary)] hover:text-[var(--cf-text-primary)]",
              )}
            >
              21+ seats
            </button>
          </div>

          {/* Pooled workspace quotas preview */}
          {seats <= PLUS_INCLUDED_SEATS && (
            <dl className="grid grid-cols-2 gap-3 rounded-2xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] p-4 sm:grid-cols-4">
              <div className="flex flex-col gap-0.5">
                <dt className="type-caption text-[var(--cf-text-tertiary)]">Case Studies</dt>
                <dd className="v3-body-s-strong text-[var(--cf-text-primary)]">Unlimited</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="type-caption text-[var(--cf-text-tertiary)]">Exports / month</dt>
                <dd className="v3-body-s-strong text-[var(--cf-text-primary)] tabular-nums">
                  {clampedQuotas.monthlyExportsLimit}/mo
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="type-caption text-[var(--cf-text-tertiary)]">Pooled storage</dt>
                <dd className="v3-body-s-strong text-[var(--cf-text-primary)] tabular-nums">
                  {formatBytesHuman(clampedQuotas.storageBytesLimit)}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="type-caption text-[var(--cf-text-tertiary)]">Spaces</dt>
                <dd className="v3-body-s-strong text-[var(--cf-text-primary)] tabular-nums">
                  5/member + {clampedQuotas.sharedSpacesLimit} shared
                </dd>
              </div>
            </dl>
          )}
        </div>

        {/* Electric Royal Blue Studio Price Breakdown Card */}
        <div className="v3-pattern-dots-dark flex flex-col justify-between gap-5 rounded-[1.75rem] border border-[var(--cf-border-on-royal)] p-5 text-[var(--cf-text-on-royal)] sm:p-6 lg:col-span-5">
          {priceResult.ok ? (
            <>
              <div className="flex flex-col gap-2">
                <span className="inline-flex w-fit items-center rounded-md bg-[var(--cf-bg-accent)] px-2.5 py-0.5 text-[0.6875rem] font-bold tracking-wider text-[var(--cf-text-on-accent)] uppercase">
                  {interval === "yearly" ? "Annual billing equivalent" : "Monthly billing"} ·{" "}
                  {priceResult.seats} paid seats
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span
                    data-testid="teams-calc-headline-price"
                    className="font-display text-3xl leading-none font-bold tracking-tight text-[var(--cf-text-on-royal)] tabular-nums sm:text-4xl"
                  >
                    {formatUsdFromCents(
                      interval === "yearly"
                        ? priceResult.yearlyMonthlyEquivalentCents
                        : priceResult.monthlyTotalCents,
                    )}
                  </span>
                  <span className="type-body-s text-[var(--cf-text-on-royal-muted)]">/ month</span>
                </div>

                {interval === "yearly" ? (
                  <p
                    data-testid="teams-calc-billing-detail"
                    className="type-body-s text-[var(--cf-text-on-royal-muted)]"
                  >
                    Billed{" "}
                    <strong className="text-[var(--cf-text-on-royal)]">
                      {formatUsdFromCents(priceResult.yearlyTotalCents)}/year
                    </strong>{" "}
                    (saves{" "}
                    <strong className="text-[var(--cf-bg-accent)]">
                      {formatUsdFromCents(priceResult.annualSavingsCents)}/yr
                    </strong>{" "}
                    — 20% off).
                  </p>
                ) : (
                  <p
                    data-testid="teams-calc-billing-detail"
                    className="type-body-s text-[var(--cf-text-on-royal-muted)]"
                  >
                    Or switch to annual for{" "}
                    <strong className="text-[var(--cf-text-on-royal)]">
                      {formatUsdFromCents(priceResult.yearlyMonthlyEquivalentCents)}/mo
                    </strong>{" "}
                    ({formatUsdFromCents(priceResult.yearlyTotalCents)}/yr — save{" "}
                    {formatUsdFromCents(priceResult.annualSavingsCents)}/yr).
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3">
                {onStartTeamsCheckout ? (
                  <button
                    type="button"
                    data-testid="teams-calc-cta"
                    onClick={() => onStartTeamsCheckout(priceResult.seats, interval, "team")}
                    className="v3-btn-lime w-full py-3 text-sm"
                  >
                    <span>Start Team ({priceResult.seats} seats)</span>
                    <ArrowRight className="size-4" />
                  </button>
                ) : (
                  <Link
                    href={`/sign-up?plan=team&interval=${interval}&seats=${priceResult.seats}`}
                    data-testid="teams-calc-cta"
                    className="v3-btn-lime w-full py-3 text-sm"
                  >
                    <span>Start Team ({priceResult.seats} seats)</span>
                    <ArrowRight className="size-4" />
                  </Link>
                )}

                <p
                  data-testid="teams-calc-disclaimer"
                  className="type-caption text-center text-[var(--cf-text-on-royal-muted)]"
                >
                  Before tax; this calculator saves nothing and charges nothing.
                </p>
              </div>
            </>
          ) : priceResult.code === "PLUS_UPGRADE_REQUIRED" ? (
            <div
              data-testid="teams-calc-plus-recommendation"
              className="flex flex-col justify-between gap-4"
            >
              <div className="flex flex-col gap-2">
                <div className="inline-flex items-center gap-2 text-[var(--cf-bg-accent)]">
                  <Building2 className="size-5 shrink-0" aria-hidden="true" />
                  <span className="type-body-s-strong text-[var(--cf-text-on-royal)]">
                    Casefolio Plus — up to {PLUS_INCLUDED_SEATS} seats included
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span
                    data-testid="teams-calc-headline-price"
                    className="font-display text-3xl leading-none font-bold tracking-tight text-[var(--cf-text-on-royal)] tabular-nums sm:text-4xl"
                  >
                    {formatUsdFromCents(
                      interval === "yearly"
                        ? plusPlan.yearlyMonthlyEquivalentCents
                        : plusPlan.monthlyPriceCents,
                    )}
                  </span>
                  <span className="type-body-s text-[var(--cf-text-on-royal-muted)]">
                    / month flat
                  </span>
                </div>
                <p className="type-body-s text-[var(--cf-text-on-royal-muted)]">
                  {interval === "yearly"
                    ? `Billed ${formatUsdFromCents(plusPlan.yearlyTotalCents)}/year (save $240/yr). Includes custom domain, complete white-labeling, and priority 24/7 support.`
                    : `Flat rate with zero per-seat math — or ${formatUsdFromCents(plusPlan.yearlyMonthlyEquivalentCents)}/mo billed annually (${formatUsdFromCents(plusPlan.yearlyTotalCents)}/yr).`}
                </p>
              </div>
              <div className="flex flex-col gap-2.5">
                {onStartTeamsCheckout ? (
                  <button
                    type="button"
                    data-testid="teams-calc-cta"
                    onClick={() => onStartTeamsCheckout(1, interval, "plus")}
                    className="v3-btn-lime w-full py-3 text-sm"
                  >
                    <span>Upgrade to Plus (up to {PLUS_INCLUDED_SEATS} seats)</span>
                    <ArrowRight className="size-4" />
                  </button>
                ) : (
                  <Link
                    href={`/sign-up?plan=plus&interval=${interval}`}
                    data-testid="teams-calc-cta"
                    className="v3-btn-lime w-full py-3 text-sm"
                  >
                    <span>Upgrade to Plus (up to {PLUS_INCLUDED_SEATS} seats)</span>
                    <ArrowRight className="size-4" />
                  </Link>
                )}
                <p
                  data-testid="teams-calc-disclaimer"
                  className="type-caption text-center text-[var(--cf-text-on-royal-muted)]"
                >
                  Before tax; this calculator saves nothing and charges nothing.
                </p>
              </div>
            </div>
          ) : (
            <div
              data-testid="teams-calc-capacity-review"
              className="flex flex-col justify-between gap-4"
            >
              <div className="flex flex-col gap-2">
                <div className="inline-flex items-center gap-2 text-[var(--cf-bg-accent)]">
                  <ShieldAlert className="size-5 shrink-0" aria-hidden="true" />
                  <span className="type-body-s-strong text-[var(--cf-text-on-royal)]">
                    Custom capacity above {PLUS_INCLUDED_SEATS} seats
                  </span>
                </div>
                <p className="type-body-s text-[var(--cf-text-on-royal-muted)]">
                  {priceResult.message}
                </p>
              </div>
              <div className="flex flex-col gap-2.5">
                <Link href="/help/billing-and-plans" className="v3-btn-lime w-full py-3 text-sm">
                  <span>Contact dedicated onboarding</span>
                  <ArrowRight className="size-4" />
                </Link>
                <p
                  data-testid="teams-calc-disclaimer"
                  className="type-caption text-center text-[var(--cf-text-on-royal-muted)]"
                >
                  Before tax; this calculator saves nothing and charges nothing.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
