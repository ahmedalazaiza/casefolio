"use client";

import type { PlanTier } from "@casefolio/db";
import {
  ArrowDown,
  ArrowRight,
  Check,
  FolderKanban,
  ShieldCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PaddleCheckoutModal } from "@/components/billing/paddle-checkout-modal";
import { CmsIcon } from "@/components/cms/cms-icon";
import { LandingPricingSection } from "@/components/marketing/landing-pricing-section";
import { ScrollRise } from "@/components/marketing/motion";
import { TestCanvasCtaSection } from "@/components/marketing/test-canvas-cta";
import { Eyebrow } from "@/components/ui/eyebrow";
import {
  formatUsdFromCents,
  TEAMS_CALCULATOR_DEFAULT_SEATS,
  type BillingInterval,
  type PaidPlanTier,
} from "@/lib/billing/plans";
import {
  DEFAULT_SITE_CMS_CONTENT,
  mergeBillingCatalogWithCms,
  type SiteCmsContent,
} from "@/lib/cms/schema";
import { cn } from "@/lib/utils";

export interface ConfiguredPaddlePriceMap {
  environment: "sandbox" | "production";
  pro_monthly: string;
  pro_yearly: string;
  team_monthly: string;
  team_yearly: string;
  plus_monthly?: string;
  plus_yearly?: string;
}

export interface PricingPageClientProps {
  isAuthenticated: boolean;
  currentTier: PlanTier | null;
  activeOrgId: string | null;
  paddlePriceMap: ConfiguredPaddlePriceMap;
  initialInterval?: BillingInterval;
  cmsPricing?: SiteCmsContent["pricing"];
}

type PlanCellValue =
  | boolean
  | string
  | {
      included: boolean;
      detail: string;
    };

function renderCellValue(val: PlanCellValue) {
  if (typeof val === "boolean") {
    return val ? (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--cf-lp-green-pill-bg)] bg-[var(--cf-lp-green-pill-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--cf-lp-green-pill-fg)]">
        <Check className="size-3.5 shrink-0" aria-hidden="true" />
        <span>Included</span>
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] px-2.5 py-1 text-xs font-medium text-[var(--cf-text-secondary)]">
        <X className="size-3.5 shrink-0" aria-hidden="true" />
        <span>Not included</span>
      </span>
    );
  }

  if (typeof val === "object") {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2 md:justify-start">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
            val.included
              ? "border-[var(--cf-lp-green-pill-bg)] bg-[var(--cf-lp-green-pill-bg)] text-[var(--cf-lp-green-pill-fg)]"
              : "border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] text-[var(--cf-text-secondary)]",
          )}
        >
          {val.included ? (
            <Check className="size-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <X className="size-3.5 shrink-0" aria-hidden="true" />
          )}
          <span>{val.included ? "Included" : "Not included"}</span>
        </span>
        <span className="text-[0.8125rem] font-medium text-[var(--cf-text-primary)]">
          {val.detail}
        </span>
      </div>
    );
  }

  return (
    <span className="text-[0.875rem] font-medium text-right text-[var(--cf-text-primary)] md:text-left">
      {val}
    </span>
  );
}

export function PricingPageClient({
  isAuthenticated,
  currentTier,
  activeOrgId,
  paddlePriceMap,
  initialInterval = "monthly",
  cmsPricing = DEFAULT_SITE_CMS_CONTENT.pricing,
}: PricingPageClientProps) {
  const catalog = mergeBillingCatalogWithCms(cmsPricing);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PaidPlanTier>("pro");
  const [selectedInterval, setSelectedInterval] = useState<BillingInterval>(initialInterval);
  const [selectedSeats, setSelectedSeats] = useState<number>(
    cmsPricing.tiers.team.defaultSeats || TEAMS_CALCULATOR_DEFAULT_SEATS,
  );

  function handleSelectPaidPlan(
    plan: PaidPlanTier,
    interval: BillingInterval,
    seats?: number,
  ) {
    setSelectedPlan(plan);
    setSelectedInterval(interval);
    setSelectedSeats(
      plan === "team"
        ? (seats ?? cmsPricing.tiers.team.defaultSeats ?? TEAMS_CALCULATOR_DEFAULT_SEATS)
        : selectedSeats,
    );
    setCheckoutOpen(true);
  }

  const proDisplayedLabel = formatUsdFromCents(
    selectedInterval === "yearly"
      ? catalog.pro.yearlyTotalCents
      : catalog.pro.monthlyPriceCents,
  );
  const teamDisplayedLabel = formatUsdFromCents(
    selectedInterval === "yearly"
      ? catalog.team.yearlyTotalCents
      : catalog.team.monthlyPriceCents,
  );

  return (
    <div className="relative flex min-w-0 flex-col overflow-x-clip bg-[var(--cf-bg-canvas)]">
      {/* 1. Editorial Serif Pricing Hero */}
      <div className="relative z-10 overflow-hidden pt-12 pb-10 sm:pt-16 sm:pb-14 lg:pt-20">
        <div className="v3-container">
          <header className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
            <Eyebrow>{cmsPricing.heroEyebrowText}</Eyebrow>
            <h1 className="v3-display-xl text-balance text-[var(--cf-text-primary)]">
              {cmsPricing.heroTitleLead}{" "}
              <span className="v3-sticker-lime">{cmsPricing.heroTitleHighlight}</span>
            </h1>

            <p className="v3-body-l max-w-xl text-[var(--cf-text-secondary)]">
              {cmsPricing.heroSubtitle}
            </p>

            <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#plan-comparison"
                className="v3-btn-secondary focus-visible:ring-ring/40 py-3 px-6 text-sm outline-none focus-visible:ring-2"
              >
                <span>Compare plans</span>
                <ArrowDown className="size-4" />
              </a>
              <Link
                href="/faq"
                className="v3-btn-secondary focus-visible:ring-ring/40 py-3 px-6 text-sm outline-none focus-visible:ring-2"
              >
                <span>Billing FAQ</span>
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </header>

          {isAuthenticated && currentTier && (
            <div className="mt-6 flex justify-center">
              <div className="inline-flex flex-wrap items-center gap-3 rounded-full border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] px-4 py-2">
                <span className="v3-body-s text-[var(--cf-text-secondary)]">
                  Signed in on{" "}
                  <strong className="text-[var(--cf-text-primary)] capitalize">
                    {currentTier === "plus" ? "Teams" : currentTier}
                  </strong>{" "}
                  plan
                </span>
                <Link
                  href="/account/billing"
                  className="v3-btn-secondary py-1.5 px-3.5 text-xs"
                >
                  <span>Manage billing &amp; seats</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Studio Tiers + Free Admission */}
      <div className="py-8 sm:py-12">
        <div className="v3-container flex min-w-0 flex-col gap-8">
          <section aria-label="Subscription plans" className="flex flex-col gap-7">
            <LandingPricingSection
              interval={selectedInterval}
              onIntervalChange={setSelectedInterval}
              teamSeats={selectedSeats}
              onTeamSeatsChange={setSelectedSeats}
              currentTier={currentTier}
              onSelectPaidPlan={isAuthenticated ? handleSelectPaidPlan : undefined}
              cmsPricing={cmsPricing}
            />

            {/* Merchant of Record note — single-line icon + text */}
            <div className="flex justify-center">
              <div
                data-testid="paddle-config-summary"
                data-pro-monthly={paddlePriceMap.pro_monthly}
                data-pro-yearly={paddlePriceMap.pro_yearly}
                data-team-monthly={paddlePriceMap.team_monthly}
                data-team-yearly={paddlePriceMap.team_yearly}
                className="inline-flex max-w-full flex-nowrap items-center justify-center gap-2.5 rounded-full border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] px-5 py-2.5 text-[var(--cf-text-primary)]"
              >
                <ShieldCheck className="text-success size-4 shrink-0" aria-hidden="true" />
                <span className="text-xs font-medium leading-snug lg:whitespace-nowrap">
                  Secure checkout powered by Paddle ({paddlePriceMap.environment} environment) ·{" "}
                  {cmsPricing.annualBadgeLabel} on annual plans · Instant tax &amp; VAT receipts ·
                  Cancel anytime.
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* 3. Plan Comparison Matrix — High Contrast */}
      <section
        id="plan-comparison"
        data-testid="plan-comparison-matrix"
        aria-labelledby="plan-comparison-heading"
        className="scroll-mt-20 border-b border-[var(--cf-lp-cream-divider)] py-16 sm:py-24"
      >
        <div className="v3-container flex min-w-0 flex-col gap-10">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
            <Eyebrow icon={<FolderKanban className="size-3.5" />}>
              Plan comparison
            </Eyebrow>
            <h2
              id="plan-comparison-heading"
              className="v3-display-l text-balance text-[var(--cf-text-primary)]"
            >
              See exactly what&apos;s{" "}
              <span className="v3-sticker-lime">included</span> &amp; what&apos;s not
            </h2>
            <p className="v3-body-m max-w-lg text-pretty text-[var(--cf-text-secondary)]">
              Side-by-side quotas, seats, and export formats across {catalog.free.name},{" "}
              {catalog.pro.name}, and {catalog.team.name}.
            </p>

            {/* Included vs Not Included Legend */}
            <div className="mt-1 flex flex-wrap items-center justify-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--cf-lp-green-pill-bg)] bg-[var(--cf-lp-green-pill-bg)] px-3.5 py-1.5 text-xs font-semibold text-[var(--cf-lp-green-pill-fg)]">
                <Check className="size-3.5 shrink-0" aria-hidden="true" />
                <span>Included in plan</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] px-3.5 py-1.5 text-xs font-medium text-[var(--cf-text-secondary)]">
                <X className="size-3.5 shrink-0" aria-hidden="true" />
                <span>Not included</span>
              </span>
              <span className="inline-flex items-center rounded-full border border-[var(--cf-border-strong)]/40 bg-[var(--cf-bg-surface)] px-3.5 py-1.5 font-mono text-xs font-semibold text-[var(--cf-text-primary)]">
                {cmsPricing.annualPillText}
              </span>
            </div>
          </div>

          {/* Desktop aligned 3-tier plan summary strip */}
          <div className="hidden overflow-hidden rounded-2xl border border-[var(--cf-border-strong)]/40 bg-[var(--cf-bg-surface)] md:grid md:grid-cols-[37%_20%_21%_22%]">
            <div className="flex flex-col justify-center py-4 pr-5 pl-6">
              <p className="text-[0.9375rem] font-semibold text-[var(--cf-text-primary)]">
                Capability &amp; quota breakdown
              </p>
              <p className="mt-0.5 text-xs font-medium text-[var(--cf-text-secondary)]">
                Showing{" "}
                {selectedInterval === "yearly"
                  ? `annual rates (${cmsPricing.annualBadgeLabel})`
                  : "monthly billing rates"}
              </p>
            </div>
            <div className="flex flex-col justify-center border-l border-[var(--cf-border-subtle)] px-5 py-4">
              <p className="text-[0.9375rem] font-semibold text-[var(--cf-text-primary)]">
                {catalog.free.name}
              </p>
              <p className="mt-0.5 text-xs font-medium text-[var(--cf-text-secondary)]">
                {formatUsdFromCents(catalog.free.monthlyPriceCents)} / forever
              </p>
            </div>
            <div className="flex items-center border-l border-[var(--cf-border-subtle)] p-2.5 px-3">
              <div className="flex w-full flex-col gap-0.5 rounded-xl bg-[var(--cf-lp-dark)] px-3.5 py-2.5 text-[var(--cf-lp-dark-ink)]">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-semibold">{catalog.pro.name}</span>
                  {cmsPricing.popularTier === "pro" && (
                    <span className="rounded-full bg-[var(--cf-lp-lime)] px-2 py-0.5 text-[0.625rem] font-bold tracking-wide text-[var(--cf-lp-on-lime)] uppercase">
                      {cmsPricing.popularBadgeText}
                    </span>
                  )}
                </div>
                <p className="text-xs font-medium text-[var(--cf-lp-dark-ink)]/85 tabular-nums">
                  {proDisplayedLabel}
                  {selectedInterval === "yearly" ? "/yr" : "/mo"}
                </p>
              </div>
            </div>
            <div className="flex flex-col justify-center border-l border-[var(--cf-border-subtle)] py-4 pr-6 pl-5">
              <p className="text-[0.9375rem] font-semibold text-[var(--cf-text-primary)]">
                {catalog.team.name}
              </p>
              <p className="mt-0.5 text-xs font-medium text-[var(--cf-text-secondary)] tabular-nums">
                {teamDisplayedLabel}
                {selectedInterval === "yearly" ? "/seat/yr" : "/seat/mo"}
              </p>
            </div>
          </div>

          {/* Categorized Comparison Tables */}
          <ScrollRise stagger y={18} className="flex flex-col gap-10">
            {cmsPricing.comparisonGroups.map((group) => (
              <section
                key={group.id}
                aria-labelledby={`comparison-group-${group.id}`}
                className="flex flex-col gap-4"
              >
                <div className="flex flex-col gap-2.5 px-1 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex items-start gap-3.5">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-[var(--cf-border-strong)]/40 bg-[var(--cf-bg-surface)] text-[var(--cf-text-primary)]"
                    >
                      <CmsIcon iconName={group.iconName} className="size-4" />
                    </span>
                    <div className="flex min-w-0 flex-col gap-1">
                      <h3
                        id={`comparison-group-${group.id}`}
                        className="v3-heading-m font-semibold text-[var(--cf-text-primary)]"
                      >
                        {group.title}
                      </h3>
                      <p className="max-w-2xl text-[0.9375rem] leading-relaxed text-[var(--cf-text-secondary)]">
                        {group.description}
                      </p>
                    </div>
                  </div>
                  <span className="hidden shrink-0 rounded-full border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] px-3 py-1 font-mono text-xs font-medium text-[var(--cf-text-primary)] sm:inline-block">
                    {group.rows.length}{" "}
                    {group.rows.length === 1 ? "capability" : "capabilities"}
                  </span>
                </div>

                <div className="overflow-hidden rounded-2xl border border-[var(--cf-border-strong)]/35 bg-[var(--cf-bg-elevated)]">
                  <table
                    aria-label={`${group.title} comparison`}
                    className="block w-full border-collapse text-left md:table md:table-fixed"
                  >
                    <colgroup className="hidden md:table-column-group">
                      <col className="w-[37%]" />
                      <col className="w-[20%]" />
                      <col className="w-[21%]" />
                      <col className="w-[22%]" />
                    </colgroup>
                    <thead className="hidden border-b border-[var(--cf-border-strong)]/35 bg-[var(--cf-bg-surface)] md:table-header-group">
                      <tr>
                        <th
                          scope="col"
                          className="type-overline py-3.5 pr-5 pl-6 text-left font-semibold text-[var(--cf-text-primary)]"
                        >
                          Capability
                        </th>
                        <th
                          scope="col"
                          className="type-overline border-l border-[var(--cf-border-subtle)] px-5 py-3.5 text-left font-semibold text-[var(--cf-text-primary)]"
                        >
                          {catalog.free.name}
                        </th>
                        <th
                          scope="col"
                          className="type-overline border-l border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)]/70 px-5 py-3.5 text-left font-bold text-[var(--cf-text-primary)]"
                        >
                          {catalog.pro.name}
                        </th>
                        <th
                          scope="col"
                          className="type-overline border-l border-[var(--cf-border-subtle)] py-3.5 pr-6 pl-5 text-left font-semibold text-[var(--cf-text-primary)]"
                        >
                          {catalog.team.name}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="flex flex-col divide-y divide-[var(--cf-border-subtle)] md:table-row-group">
                      {group.rows.map((row) => (
                        <tr
                          key={row.feature}
                          className="flex flex-col gap-3 p-4 transition-colors sm:p-5 md:table-row md:p-0 md:hover:bg-[var(--cf-bg-surface)]/55"
                        >
                          <td className="min-w-0 md:py-4.5 md:pr-5 md:pl-6 md:align-top">
                            <p className="text-[0.9375rem] font-semibold text-[var(--cf-text-primary)]">
                              {row.feature}
                            </p>
                            {row.hint && (
                              <p className="mt-1 text-[0.8125rem] leading-relaxed text-[var(--cf-text-secondary)]">
                                {row.hint}
                              </p>
                            )}
                          </td>
                          <td
                            data-label={catalog.free.name}
                            className="flex min-w-0 items-center justify-between gap-3 pt-1 before:text-xs before:font-semibold before:text-[var(--cf-text-secondary)] before:content-[attr(data-label)] md:table-cell md:border-l md:border-[var(--cf-border-subtle)] md:px-5 md:py-4.5 md:align-middle md:before:content-none"
                          >
                            {renderCellValue(row.free)}
                          </td>
                          <td
                            data-label={catalog.pro.name}
                            className="flex min-w-0 items-center justify-between gap-3 pt-1 before:text-xs before:font-bold before:text-[var(--cf-text-primary)] before:content-[attr(data-label)] md:table-cell md:border-l md:border-[var(--cf-border-subtle)] md:bg-[var(--cf-bg-surface)]/75 md:px-5 md:py-4.5 md:align-middle md:before:content-none"
                          >
                            {renderCellValue(row.pro)}
                          </td>
                          <td
                            data-label={catalog.team.name}
                            className="flex min-w-0 items-center justify-between gap-3 pt-1 before:text-xs before:font-semibold before:text-[var(--cf-text-secondary)] before:content-[attr(data-label)] md:table-cell md:border-l md:border-[var(--cf-border-subtle)] md:py-4.5 md:pr-6 md:pl-5 md:align-middle md:before:content-none"
                          >
                            {renderCellValue(row.team)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </ScrollRise>
        </div>
      </section>

      {/* 4. Test the canvas CTA */}
      <TestCanvasCtaSection />

      {isAuthenticated && (
        <PaddleCheckoutModal
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          initialPlan={selectedPlan}
          initialInterval={selectedInterval}
          initialSeats={selectedSeats}
          orgId={activeOrgId}
        />
      )}
    </div>
  );
}
