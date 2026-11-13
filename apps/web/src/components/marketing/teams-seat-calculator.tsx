"use client";

import { Building2, Calculator, Minus, Plus, ShieldAlert, Users } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
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
      className="border-border bg-card flex w-full min-w-0 flex-col gap-6 rounded-3xl border p-5 sm:p-8"
    >
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="flex flex-col gap-1.5">
          <div className="text-accent-foreground inline-flex items-center gap-2">
            <Calculator className="size-4 shrink-0" aria-hidden="true" />
            <span className="type-overline">Team &amp; Agency Seat Calculator</span>
          </div>
          <h3 className="text-foreground type-heading-m">
            Estimate per-seat Team pricing ({TEAMS_MIN_SEATS}–{TEAMS_MAX_SELF_SERVE_SEATS} seats) or Plus flat rate
          </h3>
          <p className="text-muted-foreground type-body-s max-w-2xl">
            Team scales flexibly from {TEAMS_MIN_SEATS} to {TEAMS_MAX_SELF_SERVE_SEATS} seats (seats × seat price). Need 11–{PLUS_INCLUDED_SEATS} seats, a custom domain, or full white-labeling? Casefolio Plus covers up to {PLUS_INCLUDED_SEATS} seats for one predictable flat price.
          </p>
        </div>

        {onIntervalChange && (
          <div
            role="group"
            aria-label="Calculator billing interval"
            className="bg-sunken border-border inline-flex shrink-0 self-start rounded-full border p-1"
          >
            <button
              type="button"
              aria-pressed={interval === "monthly"}
              onClick={() => onIntervalChange("monthly")}
              className={cn(
                "type-caption rounded-full px-3 py-1.5 font-medium transition-colors",
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
              onClick={() => onIntervalChange("yearly")}
              className={cn(
                "type-caption rounded-full px-3 py-1.5 font-medium transition-colors",
                interval === "yearly"
                  ? "bg-elevated text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
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
            <label htmlFor={sliderId} className="text-foreground type-body-s-strong flex items-center gap-2">
              <Users className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
              <span>Team seats (including Admin)</span>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Decrease seats"
                data-testid="teams-calc-decrement"
                disabled={seats <= TEAMS_MIN_SEATS}
                onClick={() => updateSeats(seats - 1)}
                className="border-border bg-elevated text-foreground hover:bg-sunken inline-flex size-9 items-center justify-center rounded-full border transition-colors disabled:opacity-40"
              >
                <Minus className="size-4" aria-hidden="true" />
              </button>
              <span
                data-testid="teams-calc-seat-count"
                className="border-border bg-surface text-foreground type-body-m-strong inline-flex min-w-14 items-center justify-center rounded-xl border px-3 py-1.5 tabular-nums"
              >
                {seats}
              </span>
              <button
                type="button"
                aria-label="Increase seats"
                data-testid="teams-calc-increment"
                disabled={seats >= 25}
                onClick={() => updateSeats(seats + 1)}
                className="border-border bg-elevated text-foreground hover:bg-sunken inline-flex size-9 items-center justify-center rounded-full border transition-colors disabled:opacity-40"
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

          {/* Quick-reference seat presets: 2, 3, 5, 8, 10 + 15 (Plus) + 21+ */}
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
                    "type-caption rounded-full border px-3 py-1.5 font-medium transition-colors",
                    active
                      ? "border-foreground bg-inverse text-inverse-foreground"
                      : "border-border bg-surface text-muted-foreground hover:text-foreground",
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
                "type-caption rounded-full border px-3 py-1.5 font-medium transition-colors",
                seats > TEAMS_MAX_SELF_SERVE_SEATS && seats <= PLUS_INCLUDED_SEATS
                  ? "border-foreground bg-inverse text-inverse-foreground"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground",
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
                "type-caption rounded-full border px-3 py-1.5 font-medium transition-colors",
                seats > PLUS_INCLUDED_SEATS
                  ? "border-warning bg-warning-soft text-foreground"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground",
              )}
            >
              21+ seats
            </button>
          </div>

          {/* Pooled workspace quotas preview */}
          {seats <= PLUS_INCLUDED_SEATS && (
            <dl className="border-border bg-surface grid grid-cols-2 gap-3 rounded-2xl border p-4 sm:grid-cols-4">
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground type-caption">Case Studies</dt>
                <dd className="text-foreground type-body-s-strong">Unlimited</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground type-caption">Exports / month</dt>
                <dd className="text-foreground type-body-s-strong tabular-nums">
                  {clampedQuotas.monthlyExportsLimit}/mo
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground type-caption">Pooled storage</dt>
                <dd className="text-foreground type-body-s-strong tabular-nums">
                  {formatBytesHuman(clampedQuotas.storageBytesLimit)}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground type-caption">Spaces</dt>
                <dd className="text-foreground type-body-s-strong tabular-nums">
                  5/member + {clampedQuotas.sharedSpacesLimit} shared
                </dd>
              </div>
            </dl>
          )}
        </div>

        {/* Price breakdown card */}
        <div className="border-border bg-surface flex flex-col justify-between gap-5 rounded-2xl border p-5 lg:col-span-5">
          {priceResult.ok ? (
            <>
              <div className="flex flex-col gap-2">
                <p className="text-muted-foreground type-caption">
                  {interval === "yearly" ? "Annual billing equivalent" : "Monthly billing"} ·{" "}
                  {priceResult.seats} paid seats
                </p>
                <div className="flex items-baseline gap-2">
                  <span
                    data-testid="teams-calc-headline-price"
                    className="text-foreground type-heading-xl tabular-nums"
                  >
                    {formatUsdFromCents(
                      interval === "yearly"
                        ? priceResult.yearlyMonthlyEquivalentCents
                        : priceResult.monthlyTotalCents,
                    )}
                  </span>
                  <span className="text-muted-foreground type-body-s">/ month</span>
                </div>

                {interval === "yearly" ? (
                  <p data-testid="teams-calc-billing-detail" className="text-muted-foreground type-body-s">
                    Billed{" "}
                    <strong className="text-foreground">
                      {formatUsdFromCents(priceResult.yearlyTotalCents)}/year
                    </strong>{" "}
                    (saves{" "}
                    <strong className="text-success">
                      {formatUsdFromCents(priceResult.annualSavingsCents)}/yr
                    </strong>{" "}
                    — 20% off).
                  </p>
                ) : (
                  <p data-testid="teams-calc-billing-detail" className="text-muted-foreground type-body-s">
                    Or switch to annual for{" "}
                    <strong className="text-foreground">
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
                    className="bg-inverse text-inverse-foreground hover:bg-inverse/90 type-body-s-strong inline-flex w-full items-center justify-center rounded-full px-5 py-3 transition-colors"
                  >
                    Start Team ({priceResult.seats} seats)
                  </button>
                ) : (
                  <Link
                    href={`/sign-up?plan=team&interval=${interval}&seats=${priceResult.seats}`}
                    data-testid="teams-calc-cta"
                    className="bg-inverse text-inverse-foreground hover:bg-inverse/90 type-body-s-strong inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-center transition-colors"
                  >
                    Start Team ({priceResult.seats} seats)
                  </Link>
                )}

                <p
                  data-testid="teams-calc-disclaimer"
                  className="text-muted-foreground type-caption text-center"
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
                <div className="text-accent-foreground inline-flex items-center gap-2">
                  <Building2 className="size-5 shrink-0" aria-hidden="true" />
                  <span className="type-body-s-strong text-foreground">
                    Casefolio Plus — up to {PLUS_INCLUDED_SEATS} seats included
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span
                    data-testid="teams-calc-headline-price"
                    className="text-foreground type-heading-xl tabular-nums"
                  >
                    {formatUsdFromCents(
                      interval === "yearly"
                        ? plusPlan.yearlyMonthlyEquivalentCents
                        : plusPlan.monthlyPriceCents,
                    )}
                  </span>
                  <span className="text-muted-foreground type-body-s">/ month flat</span>
                </div>
                <p className="text-muted-foreground type-body-s">
                  {interval === "yearly"
                    ? `Billed ${formatUsdFromCents(plusPlan.yearlyTotalCents)}/year (save $240/yr). Includes custom domain, complete white-labeling, and priority 24/7 support.`
                    : `Flat rate with zero per-seat math — or ${formatUsdFromCents(plusPlan.yearlyMonthlyEquivalentCents)}/mo billed annually (${formatUsdFromCents(plusPlan.yearlyTotalCents)}/yr).`}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                {onStartTeamsCheckout ? (
                  <button
                    type="button"
                    data-testid="teams-calc-cta"
                    onClick={() => onStartTeamsCheckout(1, interval, "plus")}
                    className="bg-inverse text-inverse-foreground hover:bg-inverse/90 type-body-s-strong inline-flex w-full items-center justify-center rounded-full px-5 py-3 transition-colors"
                  >
                    Upgrade to Plus (up to {PLUS_INCLUDED_SEATS} seats)
                  </button>
                ) : (
                  <Link
                    href={`/sign-up?plan=plus&interval=${interval}`}
                    data-testid="teams-calc-cta"
                    className="bg-inverse text-inverse-foreground hover:bg-inverse/90 type-body-s-strong inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-center transition-colors"
                  >
                    Upgrade to Plus (up to {PLUS_INCLUDED_SEATS} seats)
                  </Link>
                )}
                <p
                  data-testid="teams-calc-disclaimer"
                  className="text-muted-foreground type-caption text-center"
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
                <div className="text-warning inline-flex items-center gap-2">
                  <ShieldAlert className="size-5 shrink-0" aria-hidden="true" />
                  <span className="type-body-s-strong text-foreground">
                    Custom capacity above {PLUS_INCLUDED_SEATS} seats
                  </span>
                </div>
                <p className="text-muted-foreground type-body-s">{priceResult.message}</p>
              </div>
              <div className="flex flex-col gap-2">
                <Link
                  href="/help/billing-and-plans"
                  className="border-border bg-elevated text-foreground hover:bg-sunken type-body-s-strong inline-flex w-full items-center justify-center rounded-full border px-5 py-2.5 text-center transition-colors"
                >
                  Contact dedicated onboarding
                </Link>
                <p
                  data-testid="teams-calc-disclaimer"
                  className="text-muted-foreground type-caption text-center"
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

