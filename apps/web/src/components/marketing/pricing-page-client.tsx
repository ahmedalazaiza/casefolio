"use client";

import type { PlanTier } from "@casefolio/db";
import { Check, Minus, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PaddleCheckoutModal } from "@/components/billing/paddle-checkout-modal";
import { LandingPricingSection } from "@/components/marketing/landing-pricing-section";
import { TeamsSeatCalculator } from "@/components/marketing/teams-seat-calculator";
import { Eyebrow } from "@/components/ui/eyebrow";
import {
  BILLING_PLAN_CATALOG,
  TEAMS_CALCULATOR_DEFAULT_SEATS,
  TEAMS_MAX_SELF_SERVE_SEATS,
  type BillingInterval,
  type PaidPlanTier,
} from "@/lib/billing/plans";
import {
  FREE_MONTHLY_EXPORT_LIMIT,
  PRO_MONTHLY_EXPORT_LIMIT,
  TEAMS_MONTHLY_EXPORT_LIMIT_PER_SEAT,
} from "@/lib/exports/types";
import {
  FREE_PROJECT_LIMIT,
  PRO_PROJECT_LIMIT,
  TEAMS_PROJECT_LIMIT_PER_SEAT,
} from "@/lib/projects/types";

export interface ConfiguredPaddlePriceMap {
  environment: "sandbox" | "production";
  pro_monthly: string;
  pro_yearly: string;
  team_monthly: string;
  team_yearly: string;
}

export interface PricingPageClientProps {
  isAuthenticated: boolean;
  currentTier: PlanTier | null;
  activeOrgId: string | null;
  paddlePriceMap: ConfiguredPaddlePriceMap;
  initialInterval?: BillingInterval;
}

interface ComparisonRow {
  category: string;
  feature: string;
  free: string | boolean;
  pro: string | boolean;
  team: string | boolean;
}

const COMPARISON_ROWS: readonly ComparisonRow[] = [
  {
    category: "Workspace",
    feature: "Workspace scope & seats",
    free: "1 personal workspace · 1 person",
    pro: "1 personal workspace · 1 person",
    team: `1 team workspace · S = 1–${TEAMS_MAX_SELF_SERVE_SEATS} paid seats`,
  },
  {
    category: "Workspace",
    feature: "Active, published & retained case studies",
    free: `Up to ${FREE_PROJECT_LIMIT} active (1 live, 10 retained)`,
    pro: `Up to ${PRO_PROJECT_LIMIT} active (10 live, 100 retained)`,
    team: `${TEAMS_PROJECT_LIMIT_PER_SEAT} × S active (10 × S live, 100 × S retained)`,
  },
  {
    category: "Workspace",
    feature: "Private & shared spaces",
    free: "1 personal space",
    pro: "Up to 5 private spaces",
    team: "5 private spaces/member (hidden from Owner/Admin) + 10 × S shared",
  },
  {
    category: "Templates",
    feature: "Curated Casefolio templates",
    free: "3 approved Starter templates",
    pro: "All eligible published templates",
    team: "All eligible published templates",
  },
  {
    category: "Publishing",
    feature: "Public & unlisted pages on casefolio.app",
    free: true,
    pro: true,
    team: true,
  },
  {
    category: "Publishing",
    feature: "Removable “Made with Casefolio” branding",
    free: false,
    pro: true,
    team: true,
  },
  {
    category: "Exports",
    feature: "Long PNG export & resolution",
    free: `${FREE_MONTHLY_EXPORT_LIMIT}/mo · 1x (1,440 px, branded)`,
    pro: `${PRO_MONTHLY_EXPORT_LIMIT}/mo · 1x & 2x (2,880 px, clean)`,
    team: `${TEAMS_MONTHLY_EXPORT_LIMIT_PER_SEAT} × S/mo · 1x & 2x (2,880 px, clean)`,
  },
  {
    category: "Exports",
    feature: "Paged A4 PDF & Behance 1,400w slices",
    free: false,
    pro: true,
    team: true,
  },
  {
    category: "Storage & Delivery",
    feature: "Storage, monthly uploads & max file size",
    free: "250 MB · 500 MB/mo · 10 MB/file",
    pro: "5 GB · 10 GB/mo · 25 MB/file",
    team: "10 GB × S · 20 GB × S/mo · 25 MB/file",
  },
  {
    category: "Storage & Delivery",
    feature: "Monthly public delivery bandwidth",
    free: "1 GB/mo",
    pro: "25 GB/mo",
    team: "25 GB × S/mo",
  },
  {
    category: "Analytics & History",
    feature: "Visitor analytics & recoverable content history",
    free: "7-day analytics · 7-day history",
    pro: "90-day analytics · 30-day history",
    team: "365-day analytics · 90-day history",
  },
  {
    category: "Governance",
    feature: "Team roles & departed member recovery",
    free: "Personal owner",
    pro: "Personal owner",
    team: "Owner, Admin & Member · ≥90-day private recovery portal",
  },
];

const PRICING_FAQ_STRIP = [
  {
    question: "Are personal and team workspaces separate?",
    answer:
      "Yes. Pro covers one personal workspace ($12/mo or $120/yr), while Teams covers one shared team workspace ($18 × S/mo or $180 × S/yr). Joining a team workspace never alters or exposes your personal workspace.",
  },
  {
    question: "Can Team Owners or Admins read my private space?",
    answer:
      "No. Every member's private spaces inside a Team workspace are hidden from Owners, Admins, and other teammates by default — returning 404 on unauthorized probes. Shared spaces are collaborative across the team.",
  },
  {
    question: "How do seat changes and billing work?",
    answer:
      "Paddle acts as our Merchant of Record for cards, VAT, and invoices. Adding seats previews the exact prorated charge before billing; decreasing seats takes effect at your next renewal with full paid capacity preserved until then.",
  },
] as const;

function renderCellValue(val: string | boolean) {
  if (typeof val === "boolean") {
    return val ? (
      <span className="text-foreground inline-flex items-center gap-1.5">
        <Check className="text-success size-4 shrink-0" aria-hidden="true" />
        <span className="sr-only">Included</span>
      </span>
    ) : (
      <span className="text-muted-foreground inline-flex items-center">
        <Minus className="size-4 shrink-0" aria-hidden="true" />
        <span className="sr-only">Not included</span>
      </span>
    );
  }
  return <span className="text-foreground type-body-s">{val}</span>;
}

export function PricingPageClient({
  isAuthenticated,
  currentTier,
  activeOrgId,
  paddlePriceMap,
  initialInterval = "monthly",
}: PricingPageClientProps) {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PaidPlanTier>("pro");
  const [selectedInterval, setSelectedInterval] = useState<BillingInterval>(initialInterval);
  const [selectedSeats, setSelectedSeats] = useState<number>(TEAMS_CALCULATOR_DEFAULT_SEATS);

  function handleSelectPaidPlan(plan: PaidPlanTier, interval: BillingInterval) {
    setSelectedPlan(plan);
    setSelectedInterval(interval);
    setSelectedSeats(plan === "team" ? TEAMS_CALCULATOR_DEFAULT_SEATS : 1);
    setCheckoutOpen(true);
  }

  function handleStartCalculatorCheckout(seats: number, interval: BillingInterval) {
    setSelectedPlan("team");
    setSelectedInterval(interval);
    setSelectedSeats(seats);
    setCheckoutOpen(true);
  }

  return (
    <div className="min-w-0 px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
      <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-16 lg:gap-20">
        {/* Header */}
        <header className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <Eyebrow icon={<Sparkles />}>Pricing &amp; Teams</Eyebrow>
          <h1 className="text-foreground type-section text-balance">Unlock the full builder</h1>
          <p className="text-muted-foreground type-lead max-w-2xl">
            Honest, predictable plans for individual designers and product design teams. Start free
            with {FREE_PROJECT_LIMIT} active case studies — upgrade to Pro for unbranded 2x exports
            or Teams for private member spaces plus shared team publishing.
          </p>
          {isAuthenticated && currentTier && (
            <p className="text-muted-foreground type-caption pt-1">
              Signed in on <strong className="text-foreground capitalize">{currentTier}</strong>{" "}
              personal plan ·{" "}
              <Link
                href="/account/billing"
                className="text-accent-foreground underline underline-offset-4"
              >
                Manage billing &amp; seats
              </Link>
            </p>
          )}
        </header>

        {/* Plans grid + Monthly/Yearly toggle */}
        <section aria-label="Subscription plans" className="flex flex-col gap-8">
          <LandingPricingSection
            interval={selectedInterval}
            onIntervalChange={setSelectedInterval}
            currentTier={currentTier}
            onSelectPaidPlan={isAuthenticated ? handleSelectPaidPlan : undefined}
          />

          {/* Merchant of Record note */}
          <div
            data-testid="paddle-config-summary"
            data-pro-monthly={paddlePriceMap.pro_monthly}
            data-pro-yearly={paddlePriceMap.pro_yearly}
            data-team-monthly={paddlePriceMap.team_monthly}
            data-team-yearly={paddlePriceMap.team_yearly}
            className="bg-warning-soft text-foreground mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-2.5 rounded-2xl px-4 py-2 text-center sm:rounded-full"
          >
            <ShieldCheck className="text-warning size-4 shrink-0" aria-hidden="true" />
            <span className="type-caption">
              Secure checkout via Paddle ({paddlePriceMap.environment} environment) · Instant VAT
              receipts · Cancel anytime.
            </span>
          </div>
        </section>

        {/* Interactive Teams Seat Calculator (Spec §6 & §14) */}
        <section aria-label="Teams seat calculator" className="min-w-0">
          <TeamsSeatCalculator
            interval={selectedInterval}
            onIntervalChange={setSelectedInterval}
            onStartTeamsCheckout={
              isAuthenticated ? handleStartCalculatorCheckout : undefined
            }
          />
        </section>

        {/* Plan comparison matrix */}
        <section aria-labelledby="plan-comparison-heading" className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-2 text-center">
            <p className="text-accent-foreground type-overline">Plan comparison</p>
            <h2 id="plan-comparison-heading" className="text-foreground type-heading-l">
              Compare every feature &amp; quota
            </h2>
          </div>

          <div className="md:border-border md:bg-card relative w-full max-w-full md:overflow-x-auto md:rounded-3xl md:border">
            <table className="block w-full border-collapse text-left md:table md:min-w-160">
              <thead className="hidden md:table-header-group">
                <tr className="border-border bg-surface border-b">
                  <th className="text-foreground type-body-s-strong px-5 py-4">Capability</th>
                  <th className="text-foreground type-body-s-strong px-5 py-4">
                    {BILLING_PLAN_CATALOG.free.name}{" "}
                    <span className="text-muted-foreground font-normal">
                      (${BILLING_PLAN_CATALOG.free.monthlyPriceUsd})
                    </span>
                  </th>
                  <th className="text-foreground type-body-s-strong px-5 py-4">
                    {BILLING_PLAN_CATALOG.pro.name}{" "}
                    <span className="text-muted-foreground font-normal">
                      (${BILLING_PLAN_CATALOG.pro.monthlyPriceUsd}/mo)
                    </span>
                  </th>
                  <th className="text-foreground type-body-s-strong px-5 py-4">
                    {BILLING_PLAN_CATALOG.team.name}{" "}
                    <span className="text-muted-foreground font-normal">
                      (${BILLING_PLAN_CATALOG.team.monthlyPriceUsd}/seat/mo)
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="md:divide-border flex flex-col gap-3 md:table-row-group md:divide-y">
                {COMPARISON_ROWS.map((row) => (
                  <tr
                    key={row.feature}
                    className="border-border bg-card md:hover:bg-surface/60 flex flex-col rounded-2xl border p-4 md:table-row md:rounded-none md:border-0 md:bg-transparent md:p-0"
                  >
                    <td className="border-border/70 border-b pb-3 md:border-0 md:px-5 md:py-3.5">
                      <p className="text-foreground type-body-s-strong">{row.feature}</p>
                      <p className="text-muted-foreground type-caption">{row.category}</p>
                    </td>
                    <td
                      data-label={BILLING_PLAN_CATALOG.free.name}
                      className="before:text-muted-foreground flex items-center justify-between gap-3 pt-2.5 before:text-xs before:font-medium before:content-[attr(data-label)] md:table-cell md:px-5 md:py-3.5 md:before:content-none"
                    >
                      {renderCellValue(row.free)}
                    </td>
                    <td
                      data-label={BILLING_PLAN_CATALOG.pro.name}
                      className="before:text-accent-foreground flex items-center justify-between gap-3 pt-2 before:text-xs before:font-medium before:content-[attr(data-label)] md:table-cell md:px-5 md:py-3.5 md:before:content-none"
                    >
                      {renderCellValue(row.pro)}
                    </td>
                    <td
                      data-label={BILLING_PLAN_CATALOG.team.name}
                      className="before:text-muted-foreground flex items-center justify-between gap-3 pt-2 before:text-xs before:font-medium before:content-[attr(data-label)] md:table-cell md:px-5 md:py-3.5 md:before:content-none"
                    >
                      {renderCellValue(row.team)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Bottom 3-column FAQ strip */}
        <section
          aria-label="Billing questions"
          className="border-border grid grid-cols-1 gap-8 border-t pt-10 md:grid-cols-3"
        >
          {PRICING_FAQ_STRIP.map((item) => (
            <div key={item.question} className="flex flex-col gap-2">
              <h3 className="text-foreground type-heading-s">{item.question}</h3>
              <p className="text-muted-foreground type-body-s">{item.answer}</p>
            </div>
          ))}
        </section>
      </div>

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
