"use client";

import type { PlanTier } from "@casefolio/db";
import {
  ArrowDown,
  BarChart3,
  Check,
  FileDown,
  FolderKanban,
  Globe,
  LayoutTemplate,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { PaddleCheckoutModal } from "@/components/billing/paddle-checkout-modal";
import { LandingPricingSection } from "@/components/marketing/landing-pricing-section";
import { TeamsSeatCalculator } from "@/components/marketing/teams-seat-calculator";
import { Badge } from "@/components/ui/badge";
import { Eyebrow } from "@/components/ui/eyebrow";
import {
  BILLING_PLAN_CATALOG,
  formatUsdFromCents,
  PAID_GRACE_DURATION_DAYS,
  PLUS_INCLUDED_SEATS,
  TEAMS_CALCULATOR_DEFAULT_SEATS,
  TEAMS_MAX_SELF_SERVE_SEATS,
  TEAMS_MIN_SEATS,
  type BillingInterval,
  type PaidPlanTier,
} from "@/lib/billing/plans";
import {
  FREE_MONTHLY_EXPORT_LIMIT,
  PRO_MONTHLY_EXPORT_LIMIT,
  TEAMS_MONTHLY_EXPORT_LIMIT_PER_SEAT,
} from "@/lib/exports/types";
import { FREE_PROJECT_LIMIT } from "@/lib/projects/types";
import { cn } from "@/lib/utils";

export interface ConfiguredPaddlePriceMap {
  environment: "sandbox" | "production";
  pro_monthly: string;
  pro_yearly: string;
  team_monthly: string;
  team_yearly: string;
  plus_monthly: string;
  plus_yearly: string;
}

export interface PricingPageClientProps {
  isAuthenticated: boolean;
  currentTier: PlanTier | null;
  activeOrgId: string | null;
  paddlePriceMap: ConfiguredPaddlePriceMap;
  initialInterval?: BillingInterval;
}

type PlanCellValue =
  | boolean
  | string
  | {
      included: boolean;
      detail: string;
    };

interface ComparisonRow {
  feature: string;
  hint?: string;
  free: PlanCellValue;
  pro: PlanCellValue;
  team: PlanCellValue;
  plus: PlanCellValue;
}

interface ComparisonGroup {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  rows: readonly ComparisonRow[];
}

const COMPARISON_GROUPS: readonly ComparisonGroup[] = [
  {
    id: "workspace",
    title: "Workspace, Seats & Case Studies",
    description: "How seats, Case Studies, and personal vs. shared workspaces scale.",
    icon: <FolderKanban className="size-4" />,
    rows: [
      {
        feature: "Seats & workspace scope",
        free: "1 seat · Personal workspace",
        pro: "1 seat · Personal workspace",
        team: `${TEAMS_MIN_SEATS}–${TEAMS_MAX_SELF_SERVE_SEATS} seats · Per-seat Team workspace`,
        plus: `Up to ${PLUS_INCLUDED_SEATS} seats included · Flat-rate Agency workspace`,
      },
      {
        feature: "Active Case Studies limit",
        free: `Maximum ${FREE_PROJECT_LIMIT} active Case Study`,
        pro: "Unlimited Case Studies",
        team: "Unlimited shared Case Studies",
        plus: "Unlimited shared Case Studies",
      },
      {
        feature: "Shared Team Workspace & Brand Kit",
        hint: "Shared logos, colors, reusable components, commenting & review mode",
        free: false,
        pro: false,
        team: true,
        plus: true,
      },
      {
        feature: "Role-based permissions (Admin, Editor, Viewer)",
        free: false,
        pro: false,
        team: true,
        plus: true,
      },
    ],
  },
  {
    id: "templates",
    title: "Templates & Customization",
    description: "Standard vs. Pro & Premium templates, fonts, color palettes, and custom sections.",
    icon: <LayoutTemplate className="size-4" />,
    rows: [
      {
        feature: "Standard templates",
        free: true,
        pro: true,
        team: true,
        plus: true,
      },
      {
        feature: "All Pro & Premium templates",
        free: false,
        pro: true,
        team: true,
        plus: true,
      },
      {
        feature: "Full customization (custom fonts, palettes & custom sections)",
        free: { included: false, detail: "Basic customization" },
        pro: true,
        team: true,
        plus: true,
      },
      {
        feature: "Pre-publish contrast & empty-slot checks",
        free: true,
        pro: true,
        team: true,
        plus: true,
      },
    ],
  },
  {
    id: "publishing",
    title: "Live Links, Custom Domain & White-Labeling",
    description: "Shareable links, branding removal, custom agency domains, and white-label output.",
    icon: <Globe className="size-4" />,
    rows: [
      {
        feature: "Live Shareable Link",
        free: true,
        pro: true,
        team: true,
        plus: true,
      },
      {
        feature: "Watermark-free exports & removable Casefolio footer",
        free: { included: false, detail: "Subtle watermark" },
        pro: true,
        team: true,
        plus: true,
      },
      {
        feature: "Custom Domain (e.g. work.youragency.com)",
        free: false,
        pro: false,
        team: false,
        plus: true,
      },
      {
        feature: "Complete White-Labeling (live links & PDF metadata)",
        hint: "Zero Casefolio branding in page titles, OpenGraph cards, or PDF metadata",
        free: false,
        pro: false,
        team: false,
        plus: true,
      },
    ],
  },
  {
    id: "exports",
    title: "PNG, PDF & Behance Exports",
    description: "Pixel-identical exports for portfolios, PDF presentations, and Behance.",
    icon: <FileDown className="size-4" />,
    rows: [
      {
        feature: "PNG & PDF Case Study export",
        free: "Included (with watermark)",
        pro: "High-res without watermark",
        team: "High-res without watermark",
        plus: "High-res white-label PDF & PNG",
      },
      {
        feature: "2x Retina PNG (2,880 px) & Behance 1,400 px slice pack",
        free: false,
        pro: true,
        team: true,
        plus: true,
      },
      {
        feature: "Monthly export allowance",
        free: `${FREE_MONTHLY_EXPORT_LIMIT}/mo`,
        pro: `${PRO_MONTHLY_EXPORT_LIMIT}/mo`,
        team: `${TEAMS_MONTHLY_EXPORT_LIMIT_PER_SEAT} × seats/mo`,
        plus: "2,000/mo agency pool",
      },
    ],
  },
  {
    id: "storage-analytics",
    title: "Analytics, Storage & Support",
    description: "Live link view analytics, asset storage, recovery portal, and support SLA.",
    icon: <BarChart3 className="size-4" />,
    rows: [
      {
        feature: "View analytics on live links",
        free: { included: false, detail: "7-day summary" },
        pro: "Basic view analytics (90d)",
        team: "Team analytics (365d)",
        plus: "Agency analytics (365d)",
      },
      {
        feature: "Asset storage & max upload size",
        free: "250 MB · 10 MB/file",
        pro: "5 GB · 25 MB/file",
        team: "10 GB × seats · 25 MB/file",
        plus: "200 GB · 50 MB/file",
      },
      {
        feature: `${PAID_GRACE_DURATION_DAYS}-day paid quota burst buffer & private member recovery`,
        free: false,
        pro: true,
        team: true,
        plus: true,
      },
      {
        feature: "Priority 24/7 support & dedicated onboarding",
        free: false,
        pro: false,
        team: false,
        plus: true,
      },
    ],
  },
  {
    id: "governance",
    title: "Privacy & Downgrade Protection",
    description: "Private member spaces and non-destructive downgrade safeguards.",
    icon: <Users className="size-4" />,
    rows: [
      {
        feature: "Non-destructive Free downgrade protection",
        hint: "Never deletes Case Studies; select 1 active Case Study while extras stay safely stored",
        free: true,
        pro: true,
        team: true,
        plus: true,
      },
      {
        feature: "404-isolated member private spaces (hidden from Admins)",
        free: false,
        pro: false,
        team: true,
        plus: true,
      },
    ],
  },
];

const PRICING_FAQ_STRIP = [
  {
    question: "How do Pro, Team, and Plus differ?",
    answer:
      "Pro ($9.99/mo or $7.99/mo billed annually) is built for individual creators with unlimited Case Studies and unwatermarked exports. Team ($6.99/seat/mo or $5.59/seat/mo annually, 2–10 seats) adds shared workspaces, Brand Kit, and review tools. Plus ($99/mo or $79/mo annually flat) includes up to 20 seats, custom domains, white-labeling, and 24/7 priority support.",
  },
  {
    question: "What happens if my Team grows past 10 seats?",
    answer:
      "Team supports 2 to 10 seats dynamically. As soon as you invite an 11th member, you can upgrade seamlessly to Casefolio Plus for flat-rate pricing covering up to 20 seats with zero per-seat math.",
  },
  {
    question: "What happens if I downgrade to Free with multiple Case Studies?",
    answer:
      "Your Case Studies are never deleted. Extra Case Studies are unpublished and locked for editing while you pick 1 active Case Study to keep live and editable until you upgrade again.",
  },
] as const;

function renderCellValue(val: PlanCellValue) {
  if (typeof val === "boolean") {
    return val ? (
      <span className="bg-success-soft text-foreground type-caption inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium">
        <Check className="text-success size-3.5 shrink-0" aria-hidden="true" />
        <span>Included</span>
      </span>
    ) : (
      <span className="bg-sunken text-muted-foreground type-caption inline-flex items-center gap-1.5 rounded-full px-2.5 py-1">
        <X className="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
        <span>Not included</span>
      </span>
    );
  }

  if (typeof val === "object") {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            "type-caption inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium",
            val.included
              ? "bg-success-soft text-foreground"
              : "bg-sunken text-muted-foreground",
          )}
        >
          {val.included ? (
            <Check className="text-success size-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <X className="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
          )}
          <span>{val.included ? "Included" : "Not included"}</span>
        </span>
        <span className="text-muted-foreground type-caption">{val.detail}</span>
      </div>
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

  function handleSelectPaidPlan(
    plan: PaidPlanTier,
    interval: BillingInterval,
    seats?: number,
  ) {
    setSelectedPlan(plan);
    setSelectedInterval(interval);
    setSelectedSeats(
      plan === "team" ? (seats ?? TEAMS_CALCULATOR_DEFAULT_SEATS) : 1,
    );
    setCheckoutOpen(true);
  }

  function handleStartCalculatorCheckout(
    seats: number,
    interval: BillingInterval,
    plan: "team" | "plus" = "team",
  ) {
    setSelectedPlan(plan);
    setSelectedInterval(interval);
    setSelectedSeats(plan === "team" ? seats : 1);
    setCheckoutOpen(true);
  }

  const proDisplayedLabel = formatUsdFromCents(
    selectedInterval === "yearly"
      ? BILLING_PLAN_CATALOG.pro.yearlyMonthlyEquivalentCents
      : BILLING_PLAN_CATALOG.pro.monthlyPriceCents,
  );
  const teamDisplayedLabel = formatUsdFromCents(
    selectedInterval === "yearly"
      ? BILLING_PLAN_CATALOG.team.yearlyMonthlyEquivalentCents
      : BILLING_PLAN_CATALOG.team.monthlyPriceCents,
  );
  const plusDisplayedLabel = formatUsdFromCents(
    selectedInterval === "yearly"
      ? BILLING_PLAN_CATALOG.plus.yearlyMonthlyEquivalentCents
      : BILLING_PLAN_CATALOG.plus.monthlyPriceCents,
  );

  return (
    <div className="min-w-0 px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
      <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-16 lg:gap-24">
        {/* 1. Header */}
        <header className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center sm:gap-6">
          <Eyebrow icon={<Sparkles />}>Pricing &amp; Plans</Eyebrow>
          <h1 className="text-foreground type-section text-balance">Unlock the full builder</h1>
          <p className="text-muted-foreground type-lead max-w-2xl">
            Transparent plans for solo creators, design studios, and agencies. Start free forever
            with {FREE_PROJECT_LIMIT} active Case Study — or choose Pro, Team, or Plus and save 20%
            on annual billing.
          </p>
          <a
            href="#plan-comparison"
            className="text-muted-foreground hover:text-foreground type-caption inline-flex items-center gap-1.5 transition-colors"
          >
            <span>Jump to full plan comparison &amp; what’s included</span>
            <ArrowDown className="size-3.5" />
          </a>
          {isAuthenticated && currentTier && (
            <p className="text-muted-foreground type-caption pt-1">
              Signed in on <strong className="text-foreground capitalize">{currentTier}</strong>{" "}
              plan ·{" "}
              <Link
                href="/account/billing"
                className="text-accent-foreground underline underline-offset-4"
              >
                Manage billing &amp; seats
              </Link>
            </p>
          )}
        </header>

        {/* 2. Top Pricing Cards + Monthly/Annual toggle */}
        <section aria-label="Subscription plans" className="flex flex-col gap-6">
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
            data-plus-monthly={paddlePriceMap.plus_monthly}
            data-plus-yearly={paddlePriceMap.plus_yearly}
            className="bg-warning-soft text-foreground mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-2.5 rounded-2xl px-4 py-2 text-center sm:rounded-full"
          >
            <ShieldCheck className="text-warning size-4 shrink-0" aria-hidden="true" />
            <span className="type-caption">
              Secure checkout via Paddle ({paddlePriceMap.environment} environment) · Instant VAT
              receipts · Cancel anytime.
            </span>
          </div>
        </section>

        {/* 3. Plan Differences: What's Included & What's Not */}
        <section
          id="plan-comparison"
          data-testid="plan-comparison-matrix"
          aria-labelledby="plan-comparison-heading"
          className="scroll-mt-24 flex min-w-0 flex-col gap-8"
        >
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
            <p className="text-accent-foreground type-overline">Plan comparison</p>
            <h2 id="plan-comparison-heading" className="text-foreground type-heading-l">
              Compare every feature &amp; quota
            </h2>
            <p className="text-muted-foreground type-body-m">
              See the exact difference between Free, Pro, Team, and Plus — with every included
              capability, quota limit, and excluded feature side by side.
            </p>

            {/* Included vs Not Included Legend */}
            <div className="mt-1 flex flex-wrap items-center justify-center gap-2.5">
              <span className="bg-success-soft text-foreground type-caption inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium">
                <Check className="text-success size-3.5 shrink-0" aria-hidden="true" />
                <span>Included in plan</span>
              </span>
              <span className="bg-sunken text-muted-foreground type-caption inline-flex items-center gap-1.5 rounded-full px-3 py-1">
                <X className="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
                <span>Not included</span>
              </span>
              <span className="bg-surface border-border text-muted-foreground type-caption inline-flex items-center rounded-full border px-3 py-1 font-mono">
                Team: {TEAMS_MIN_SEATS}–{TEAMS_MAX_SELF_SERVE_SEATS} seats · Plus: up to {PLUS_INCLUDED_SEATS} seats
              </span>
            </div>
          </div>

          {/* Desktop aligned 4-tier plan summary strip */}
          <div className="border-border/80 bg-surface shadow-card hidden items-center rounded-2xl border px-6 py-4 md:grid md:grid-cols-[32%_17%_17%_17%_17%]">
            <div className="pr-4">
              <p className="text-foreground type-body-s-strong">Capability &amp; quota breakdown</p>
              <p className="text-muted-foreground type-caption">
                Showing {selectedInterval === "yearly" ? "annual" : "monthly"} billing rates
              </p>
            </div>
            <div className="px-2">
              <p className="text-foreground type-body-s-strong">
                {BILLING_PLAN_CATALOG.free.name}
              </p>
              <p className="text-muted-foreground type-caption">$0 / forever</p>
            </div>
            <div className="flex flex-col gap-0.5 px-2">
              <div className="flex items-center gap-1.5">
                <span className="text-foreground type-body-s-strong">
                  {BILLING_PLAN_CATALOG.pro.name}
                </span>
                <Badge tone="accent" withDot={false}>
                  Popular
                </Badge>
              </div>
              <p className="text-muted-foreground type-caption">{proDisplayedLabel}/mo</p>
            </div>
            <div className="px-2">
              <p className="text-foreground type-body-s-strong">
                {BILLING_PLAN_CATALOG.team.name}
              </p>
              <p className="text-muted-foreground type-caption">{teamDisplayedLabel}/seat/mo</p>
            </div>
            <div className="px-2">
              <p className="text-foreground type-body-s-strong">
                {BILLING_PLAN_CATALOG.plus.name}
              </p>
              <p className="text-muted-foreground type-caption">{plusDisplayedLabel}/mo flat</p>
            </div>
          </div>

          {/* Categorized Comparison Cards */}
          <div className="flex flex-col gap-6">
            {COMPARISON_GROUPS.map((group) => (
              <div
                key={group.id}
                className="border-border/80 bg-card shadow-card overflow-hidden rounded-3xl border"
              >
                {/* Category header with aligned plan column labels on desktop */}
                <div className="border-border/70 bg-surface border-b px-5 py-4 sm:px-6 md:grid md:grid-cols-[32%_17%_17%_17%_17%] md:items-center">
                  <div className="flex items-center gap-3 pr-4">
                    <span
                      aria-hidden="true"
                      className="border-border/70 bg-elevated text-foreground inline-flex size-9 shrink-0 items-center justify-center rounded-xl border"
                    >
                      {group.icon}
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-foreground type-heading-s">{group.title}</h3>
                      <p className="text-muted-foreground type-caption">{group.description}</p>
                    </div>
                  </div>
                  <span className="text-muted-foreground type-overline hidden px-2 md:block">
                    {BILLING_PLAN_CATALOG.free.name}
                  </span>
                  <span className="text-accent-foreground type-overline hidden px-2 md:block">
                    {BILLING_PLAN_CATALOG.pro.name}
                  </span>
                  <span className="text-muted-foreground type-overline hidden px-2 md:block">
                    {BILLING_PLAN_CATALOG.team.name}
                  </span>
                  <span className="text-muted-foreground type-overline hidden px-2 md:block">
                    {BILLING_PLAN_CATALOG.plus.name}
                  </span>
                </div>

                <table
                  aria-label={`${group.title} comparison`}
                  className="block w-full border-collapse text-left md:table md:table-fixed"
                >
                  <thead className="sr-only">
                    <tr>
                      <th scope="col">Capability</th>
                      <th scope="col">{BILLING_PLAN_CATALOG.free.name}</th>
                      <th scope="col">{BILLING_PLAN_CATALOG.pro.name}</th>
                      <th scope="col">{BILLING_PLAN_CATALOG.team.name}</th>
                      <th scope="col">{BILLING_PLAN_CATALOG.plus.name}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border/70 flex flex-col divide-y md:table-row-group">
                    {group.rows.map((row) => (
                      <tr
                        key={row.feature}
                        className="md:hover:bg-surface/60 flex flex-col gap-2.5 p-4 sm:p-5 md:table-row md:p-0"
                      >
                        <td className="md:w-[32%] md:py-4 md:pr-4 md:pl-6">
                          <p className="text-foreground type-body-s-strong">{row.feature}</p>
                          {row.hint && (
                            <p className="text-muted-foreground type-caption mt-0.5">{row.hint}</p>
                          )}
                        </td>
                        <td
                          data-label={BILLING_PLAN_CATALOG.free.name}
                          className="before:text-muted-foreground flex items-center justify-between gap-3 pt-1 before:text-xs before:font-medium before:content-[attr(data-label)] md:table-cell md:w-[17%] md:px-2 md:py-4 md:before:content-none"
                        >
                          {renderCellValue(row.free)}
                        </td>
                        <td
                          data-label={BILLING_PLAN_CATALOG.pro.name}
                          className="before:text-accent-foreground md:bg-accent/25 flex items-center justify-between gap-3 pt-1 before:text-xs before:font-semibold before:content-[attr(data-label)] md:table-cell md:w-[17%] md:px-2 md:py-4 md:before:content-none"
                        >
                          {renderCellValue(row.pro)}
                        </td>
                        <td
                          data-label={BILLING_PLAN_CATALOG.team.name}
                          className="before:text-muted-foreground flex items-center justify-between gap-3 pt-1 before:text-xs before:font-medium before:content-[attr(data-label)] md:table-cell md:w-[17%] md:px-2 md:py-4 md:before:content-none"
                        >
                          {renderCellValue(row.team)}
                        </td>
                        <td
                          data-label={BILLING_PLAN_CATALOG.plus.name}
                          className="before:text-muted-foreground flex items-center justify-between gap-3 pt-1 before:text-xs before:font-medium before:content-[attr(data-label)] md:table-cell md:w-[17%] md:px-2 md:py-4 md:pr-6 md:before:content-none"
                        >
                          {renderCellValue(row.plus)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </section>

        {/* 4. Interactive Teams Seat Calculator (Spec §6 & §14) */}
        <section id="seat-calculator" aria-label="Teams seat calculator" className="min-w-0">
          <TeamsSeatCalculator
            interval={selectedInterval}
            onIntervalChange={setSelectedInterval}
            onStartTeamsCheckout={
              isAuthenticated ? handleStartCalculatorCheckout : undefined
            }
          />
        </section>

        {/* 5. Bottom 3-column FAQ strip */}
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
