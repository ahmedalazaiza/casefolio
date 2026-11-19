"use client";

import type { PlanTier } from "@casefolio/db";
import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  Calculator,
  Check,
  FileDown,
  FolderKanban,
  Globe,
  LayoutTemplate,
  MessageCircleQuestion,
  Rocket,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { PaddleCheckoutModal } from "@/components/billing/paddle-checkout-modal";
import { LandingPricingSection } from "@/components/marketing/landing-pricing-section";
import { ScrollRise, SectionStackSheet } from "@/components/marketing/motion";
import { TeamsSeatCalculator } from "@/components/marketing/teams-seat-calculator";
import { Eyebrow } from "@/components/ui/eyebrow";
import {
  BILLING_PLAN_CATALOG,
  formatUsdFromCents,
  FREE_LIFETIME_PROJECT_LIMIT,
  PAID_GRACE_DURATION_DAYS,
  PRO_MAX_PROJECTS,
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
    description: "Compare seat allocations, active project allowances, and shared vs. personal workspaces.",
    icon: <FolderKanban className="size-4" />,
    rows: [
      {
        feature: "Seats & workspace scope",
        free: "1 seat · Personal workspace",
        pro: "1 seat · Personal workspace",
        team: `${TEAMS_MIN_SEATS}–${TEAMS_MAX_SELF_SERVE_SEATS} seats · Shared Team workspace`,
      },
      {
        feature: "Case Studies allowance",
        hint: "Free grants 1 one-time lifetime credit; Pro slots can be deleted or archived anytime to rotate work",
        free: `${FREE_LIFETIME_PROJECT_LIMIT} lifetime Case Study credit`,
        pro: `Up to ${PRO_MAX_PROJECTS} active (rotatable)`,
        team: "Unlimited shared",
      },
      {
        feature: "Team Dashboard (invite by email, invite status & roles)",
        hint: "Manage Owner, Admin & Member seats with instant prorated additions",
        free: false,
        pro: false,
        team: true,
      },
      {
        feature: "Shared Team Workspace & Brand Kit",
        hint: "Centralized studio logos, brand colors, reusable blocks, and collaborative spaces",
        free: false,
        pro: false,
        team: true,
      },
    ],
  },
  {
    id: "templates",
    title: "Templates & Styling Control",
    description: "Starter vs. Pro & Premium templates, custom typography, color palettes, and modular sections.",
    icon: <LayoutTemplate className="size-4" />,
    rows: [
      {
        feature: "Starter case study templates",
        free: true,
        pro: true,
        team: true,
      },
      {
        feature: "All Pro & Premium templates",
        free: false,
        pro: true,
        team: true,
      },
      {
        feature: "Full A-to-Z styling (colors, typography & modular sections)",
        free: true,
        pro: true,
        team: true,
      },
      {
        feature: "Pre-publish contrast & empty-slot checks",
        free: true,
        pro: true,
        team: true,
      },
    ],
  },
  {
    id: "publishing",
    title: "Live Links & Custom URLs",
    description: "Shareable web URLs, custom /p/your-slug branding, and watermark removal.",
    icon: <Globe className="size-4" />,
    rows: [
      {
        feature: "Live Shareable Link",
        free: true,
        pro: true,
        team: true,
      },
      {
        feature: "Custom Case Study URL (/p/your-slug)",
        hint: "Customize the /p/ slug on published portfolio links",
        free: "Auto-generated link",
        pro: true,
        team: true,
      },
      {
        feature: "Watermark-free exports & removable Casefolio footer",
        free: { included: false, detail: "Subtle watermark" },
        pro: true,
        team: true,
      },
    ],
  },
  {
    id: "exports",
    title: "PNG, Behance & A4 PDF Exports",
    description: "Pixel-accurate exports formatted for Behance showcases, client presentations, and hiring decks.",
    icon: <FileDown className="size-4" />,
    rows: [
      {
        feature: "PNG & PDF Case Study export",
        free: "1× with subtle watermark",
        pro: "High-res, no watermark",
        team: "High-res, no watermark",
      },
      {
        feature: "2× Retina PNG (2,880 px) & Behance 1,400 px slice pack",
        free: false,
        pro: true,
        team: true,
      },
      {
        feature: "Monthly export allowance",
        free: `${FREE_MONTHLY_EXPORT_LIMIT}/mo`,
        pro: `${PRO_MONTHLY_EXPORT_LIMIT}/mo`,
        team: `${TEAMS_MONTHLY_EXPORT_LIMIT_PER_SEAT} × seats/mo`,
      },
    ],
  },
  {
    id: "storage-analytics",
    title: "Analytics, Storage & Recovery",
    description: "Live portfolio view insights, asset storage quotas, and member recovery protection.",
    icon: <BarChart3 className="size-4" />,
    rows: [
      {
        feature: "View analytics on live links",
        free: { included: false, detail: "7-day summary" },
        pro: "90-day portfolio analytics",
        team: "365-day team analytics",
      },
      {
        feature: "Asset storage & max upload size",
        free: "250 MB · 10 MB/file",
        pro: "5 GB · 25 MB/file",
        team: "10 GB × seats · 25 MB/file",
      },
      {
        feature: `${PAID_GRACE_DURATION_DAYS}-day paid quota grace buffer & private member recovery`,
        free: false,
        pro: true,
        team: true,
      },
    ],
  },
  {
    id: "governance",
    title: "Privacy & Downgrade Protection",
    description: "Isolated personal member drafts and non-destructive downgrade safeguards.",
    icon: <Users className="size-4" />,
    rows: [
      {
        feature: "Non-destructive Free downgrade protection",
        hint: "Your Case Studies are never deleted — choose 1 active Case Study while extras remain safely stored",
        free: true,
        pro: true,
        team: true,
      },
      {
        feature: "Isolated private member drafts (hidden from Admins)",
        free: false,
        pro: false,
        team: true,
      },
    ],
  },
];

const PRICING_FAQ_STRIP = [
  {
    question: "How do Free, Pro, and Teams compare?",
    answer:
      "Free ($0) gives you 1 lifetime Case Study credit to build and publish from A to Z with an auto-generated link. Pro ($7.99/mo or $79.90/yr — 2 months free, $6.66/mo eq.) unlocks up to 10 active rotatable Case Studies, custom /p/your-slug URLs, Pro templates, and watermark-free exports. Teams ($5.99/seat/mo or $59.90/seat/yr — 2 months free, $4.99/seat/mo eq., 2–25 seats) unlocks unlimited shared Case Studies, a Team Dashboard, and pooled studio storage.",
  },
  {
    question: "How does the 1 lifetime Free Case Study credit work?",
    answer:
      "Every Free personal workspace includes 1 one-time lifetime Case Study credit. You can edit, archive, unarchive, export, and publish that project freely — deleting it on Free does not issue a new credit. Upgrade to Pro anytime to rotate up to 10 active projects.",
  },
  {
    question: "What happens if I downgrade to Free with multiple Case Studies?",
    answer:
      "Nothing is deleted. You pick which 1 Case Study stays active and live, while additional Case Studies remain safely stored and locked until you upgrade again.",
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
      <div className="flex flex-wrap items-center justify-end gap-1.5 md:justify-start">
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

  return <span className="text-foreground type-body-s text-right md:text-left">{val}</span>;
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

  function handleStartCalculatorCheckout(seats: number, interval: BillingInterval) {
    setSelectedPlan("team");
    setSelectedInterval(interval);
    setSelectedSeats(seats);
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

  return (
    <div className="relative flex min-w-0 flex-col overflow-x-clip">
      {/* 1. Landing v3 Architectural Grid Pricing Hero */}
      <div className="v3-pattern-grid relative z-10 overflow-hidden pt-12 pb-16 sm:pt-16 sm:pb-20 lg:pt-20 lg:pb-24">
        <div className="v3-container">
          <header className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
            <Eyebrow step="01">Pricing &amp; Plans</Eyebrow>
            <h1 className="v3-display-xl text-balance text-[var(--cf-text-primary)]">
              Simple tiers for solo designers &amp;{" "}
              <span className="v3-sticker-lime">scaling studios.</span>
            </h1>

            <p className="v3-body-l max-w-2xl text-[var(--cf-text-secondary)]">
              Build and publish {FREE_LIFETIME_PROJECT_LIMIT} complete Case Study free from A to
              Z — then upgrade to Pro for up to {PRO_MAX_PROJECTS} rotatable Case Studies &amp;
              custom URLs, or Teams ({TEAMS_MIN_SEATS}–{TEAMS_MAX_SELF_SERVE_SEATS} seats) for
              unlimited studio collaboration. Get 2 months free on annual billing.
            </p>

            <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#plan-comparison"
                className="v3-btn-secondary focus-visible:ring-ring/40 py-3 px-5 text-sm outline-none focus-visible:ring-2"
              >
                <span>Compare all plans &amp; features</span>
                <ArrowDown className="size-4" />
              </a>
              <a
                href="#seat-calculator"
                className="v3-btn-primary focus-visible:ring-ring/40 py-3 pr-3.5 pl-5 text-sm outline-none focus-visible:ring-2"
              >
                <span>Seat calculator</span>
                <span className="inline-flex size-6 items-center justify-center rounded-md bg-[var(--cf-bg-accent)] text-[var(--cf-text-on-accent)]">
                  <Calculator className="size-3.5" />
                </span>
              </a>
            </div>
          </header>

          {isAuthenticated && currentTier && (
            <div className="mt-6 flex justify-center">
              <div className="inline-flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-4 py-2.5">
                <span className="v3-body-s text-[var(--cf-text-secondary)]">
                  Signed in on{" "}
                  <strong className="text-[var(--cf-text-primary)] capitalize">
                    {currentTier === "plus" ? "Teams" : currentTier}
                  </strong>{" "}
                  plan
                </span>
                <Link
                  href="/account/billing"
                  className="v3-btn-secondary py-1.5 text-xs"
                >
                  <span>Manage billing &amp; seats</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Overlapping Studio Tiers + Free Admission Sheet */}
      <SectionStackSheet
        overlapY={48}
        startScale={0.982}
        className="z-20 -mt-8 lg:-mt-12"
      >
        <div className="v3-sheet-elevated rounded-t-[2rem] border-t border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] pt-10 pb-20 sm:rounded-t-[2.75rem] sm:pt-14 sm:pb-24 lg:rounded-t-[3.5rem]">
          <div className="v3-container flex min-w-0 flex-col gap-8">
            <section aria-label="Subscription plans" className="flex flex-col gap-7">
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
                className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-2 rounded-2xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-5 py-3 text-center text-[var(--cf-text-secondary)]"
              >
                <ShieldCheck className="text-success size-4 shrink-0" aria-hidden="true" />
                <span className="type-caption">
                  Secure checkout powered by Paddle ({paddlePriceMap.environment} environment) · 2
                  months free on annual plans · Instant tax &amp; VAT receipts · Cancel anytime.
                </span>
              </div>
            </section>
          </div>
        </div>
      </SectionStackSheet>

      {/* 3. Overlapping Plan Comparison Matrix Sheet */}
      <SectionStackSheet
        overlapY={44}
        startScale={0.985}
        className="z-30 -mt-8 lg:-mt-12"
      >
        <section
          id="plan-comparison"
          data-testid="plan-comparison-matrix"
          aria-labelledby="plan-comparison-heading"
          className="v3-sheet-elevated scroll-mt-20 rounded-t-[2rem] border-t border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] pt-16 pb-20 sm:rounded-t-[2.75rem] sm:pt-20 sm:pb-24 lg:rounded-t-[3.5rem] lg:pt-24"
        >
          <div className="v3-container flex min-w-0 flex-col gap-8">
            <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
              <Eyebrow step="02" icon={<FolderKanban className="size-3.5" />}>
                Plan comparison
              </Eyebrow>
              <h2
                id="plan-comparison-heading"
                className="v3-display-l text-balance text-[var(--cf-text-primary)]"
              >
                See exactly what&apos;s{" "}
                <span className="v3-sticker-lime">included</span> &amp; what&apos;s not
              </h2>
              <p className="v3-body-l max-w-xl text-pretty text-[var(--cf-text-secondary)]">
                Every feature, monthly quota, seat allowance, and export capability across Free,
                Pro, and Teams—mapped side by side with zero hidden footnotes.
              </p>

              {/* Included vs Not Included Legend */}
              <div className="mt-1 flex flex-wrap items-center justify-center gap-2.5">
                <span className="bg-success-soft text-foreground type-caption inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 font-semibold">
                  <Check className="text-success size-3.5 shrink-0" aria-hidden="true" />
                  <span>Included in plan</span>
                </span>
                <span className="type-caption inline-flex items-center gap-1.5 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-3.5 py-1.5 text-[var(--cf-text-secondary)]">
                  <X className="size-3.5 shrink-0" aria-hidden="true" />
                  <span>Not included</span>
                </span>
                <span className="type-caption inline-flex items-center rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-3.5 py-1.5 font-mono font-semibold text-[var(--cf-text-primary)]">
                  Teams: {TEAMS_MIN_SEATS}–{TEAMS_MAX_SELF_SERVE_SEATS} seats · Annual = 2 months
                  free
                </span>
              </div>
            </div>

            {/* Desktop aligned 3-tier plan summary strip */}
            <div className="hidden overflow-hidden rounded-[1.5rem] border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] md:grid md:grid-cols-[37%_20%_20%_23%]">
              <div className="flex flex-col justify-center py-4 pr-5 pl-6">
                <p className="v3-body-s-strong text-[var(--cf-text-primary)]">
                  Capability &amp; quota breakdown
                </p>
                <p className="type-caption text-[var(--cf-text-secondary)]">
                  Showing{" "}
                  {selectedInterval === "yearly"
                    ? "annual rates (2 months free)"
                    : "monthly billing rates"}
                </p>
              </div>
              <div className="flex flex-col justify-center border-l border-[var(--cf-border-subtle)]/70 px-5 py-4">
                <p className="v3-body-s-strong text-[var(--cf-text-primary)]">
                  {BILLING_PLAN_CATALOG.free.name}
                </p>
                <p className="type-caption text-[var(--cf-text-secondary)]">$0 / forever</p>
              </div>
              <div className="flex flex-col justify-center border-l border-[var(--cf-border-subtle)]/70 px-5 py-4">
                <p className="v3-body-s-strong text-[var(--cf-text-primary)]">
                  {BILLING_PLAN_CATALOG.pro.name}
                </p>
                <p className="type-caption text-[var(--cf-text-secondary)]">{proDisplayedLabel}/mo</p>
              </div>
              <div className="flex items-center border-l border-[var(--cf-border-subtle)]/70 bg-[var(--cf-bg-surface)]/75 p-2.5 pr-4 pl-4">
                <div className="flex w-full flex-col gap-0.5 rounded-xl bg-[var(--cf-royal)] px-3.5 py-2.5 text-[var(--cf-text-on-royal)]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold">{BILLING_PLAN_CATALOG.team.name}</span>
                    <span className="rounded-md bg-[var(--cf-bg-accent)] px-1.5 py-0.5 text-[0.625rem] font-bold tracking-wider text-[var(--cf-text-on-accent)] uppercase">
                      Popular
                    </span>
                  </div>
                  <p className="type-caption text-[var(--cf-text-on-royal-muted)]">
                    {teamDisplayedLabel}/seat/mo
                  </p>
                </div>
              </div>
            </div>

            {/* Categorized Comparison Tables (Title outside card + aligned columns) */}
            <ScrollRise stagger y={18} className="flex flex-col gap-10">
              {COMPARISON_GROUPS.map((group, groupIdx) => (
                <section
                  key={group.id}
                  aria-labelledby={`comparison-group-${group.id}`}
                  className="flex flex-col gap-3.5"
                >
                  {/* Group heading outside the table card */}
                  <div className="flex flex-col gap-2.5 px-1 sm:flex-row sm:items-end sm:justify-between">
                    <div className="flex items-start gap-3.5">
                      <span
                        aria-hidden="true"
                        className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--cf-royal)] text-[var(--cf-bg-accent)]"
                      >
                        {group.icon}
                      </span>
                      <div className="flex min-w-0 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="v3-label inline-flex items-center rounded-md border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] px-2 py-0.5 text-[var(--cf-royal-text)]">
                            0{groupIdx + 1}
                          </span>
                          <h3
                            id={`comparison-group-${group.id}`}
                            className="v3-heading-m text-[var(--cf-text-primary)]"
                          >
                            {group.title}
                          </h3>
                        </div>
                        <p className="v3-body-s max-w-2xl text-[var(--cf-text-secondary)]">
                          {group.description}
                        </p>
                      </div>
                    </div>
                    <span className="type-caption hidden shrink-0 font-mono text-[var(--cf-text-tertiary)] sm:inline-block">
                      {group.rows.length}{" "}
                      {group.rows.length === 1 ? "capability" : "capabilities"}
                    </span>
                  </div>

                  {/* Standalone 4-column comparison table card */}
                  <div className="overflow-hidden rounded-[1.75rem] border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)]">
                    <table
                      aria-label={`${group.title} comparison`}
                      className="block w-full border-collapse text-left md:table md:table-fixed"
                    >
                      <colgroup className="hidden md:table-column-group">
                        <col className="w-[37%]" />
                        <col className="w-[20%]" />
                        <col className="w-[20%]" />
                        <col className="w-[23%]" />
                      </colgroup>
                      <thead className="hidden border-b border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)]/80 md:table-header-group">
                        <tr>
                          <th
                            scope="col"
                            className="type-overline py-3 pr-5 pl-6 text-left text-[var(--cf-text-tertiary)]"
                          >
                            Capability
                          </th>
                          <th
                            scope="col"
                            className="type-overline border-l border-[var(--cf-border-subtle)]/70 px-5 py-3 text-left text-[var(--cf-text-tertiary)]"
                          >
                            {BILLING_PLAN_CATALOG.free.name}
                          </th>
                          <th
                            scope="col"
                            className="type-overline border-l border-[var(--cf-border-subtle)]/70 px-5 py-3 text-left text-[var(--cf-text-tertiary)]"
                          >
                            {BILLING_PLAN_CATALOG.pro.name}
                          </th>
                          <th
                            scope="col"
                            className="type-overline border-l border-[var(--cf-border-subtle)]/70 bg-[var(--cf-bg-surface)]/75 py-3 pr-6 pl-5 text-left text-[var(--cf-royal-text)]"
                          >
                            {BILLING_PLAN_CATALOG.team.name}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="flex flex-col divide-y divide-[var(--cf-border-subtle)] md:table-row-group">
                        {group.rows.map((row) => (
                          <tr
                            key={row.feature}
                            className="flex flex-col gap-3 p-4 transition-colors sm:p-5 md:table-row md:p-0 md:hover:bg-[var(--cf-bg-canvas)]/55"
                          >
                            <td className="min-w-0 md:py-4.5 md:pr-5 md:pl-6 md:align-top">
                              <p className="v3-body-s-strong text-[var(--cf-text-primary)]">
                                {row.feature}
                              </p>
                              {row.hint && (
                                <p className="type-caption mt-1 text-[var(--cf-text-secondary)]">
                                  {row.hint}
                                </p>
                              )}
                            </td>
                            <td
                              data-label={BILLING_PLAN_CATALOG.free.name}
                              className="flex min-w-0 items-center justify-between gap-3 pt-1 before:text-xs before:font-medium before:text-[var(--cf-text-tertiary)] before:content-[attr(data-label)] md:table-cell md:border-l md:border-[var(--cf-border-subtle)]/70 md:px-5 md:py-4.5 md:align-middle md:before:content-none"
                            >
                              {renderCellValue(row.free)}
                            </td>
                            <td
                              data-label={BILLING_PLAN_CATALOG.pro.name}
                              className="flex min-w-0 items-center justify-between gap-3 pt-1 before:text-xs before:font-medium before:text-[var(--cf-text-tertiary)] before:content-[attr(data-label)] md:table-cell md:border-l md:border-[var(--cf-border-subtle)]/70 md:px-5 md:py-4.5 md:align-middle md:before:content-none"
                            >
                              {renderCellValue(row.pro)}
                            </td>
                            <td
                              data-label={BILLING_PLAN_CATALOG.team.name}
                              className="flex min-w-0 items-center justify-between gap-3 pt-1 before:text-xs before:font-semibold before:text-[var(--cf-royal-text)] before:content-[attr(data-label)] md:table-cell md:border-l md:border-[var(--cf-border-subtle)]/70 md:bg-[var(--cf-bg-surface)]/75 md:py-4.5 md:pr-6 md:pl-5 md:align-middle md:before:content-none"
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
      </SectionStackSheet>

      {/* 4. Overlapping Seat Calculator + Billing FAQ Sheet */}
      <SectionStackSheet
        overlapY={40}
        startScale={0.986}
        className="z-40 -mt-8 lg:-mt-12"
      >
        <div className="v3-sheet-elevated rounded-t-[2rem] border-t border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] pt-16 pb-20 sm:rounded-t-[2.75rem] sm:pt-20 sm:pb-24 lg:rounded-t-[3.5rem]">
          <div className="v3-container flex flex-col gap-16">
            <section id="seat-calculator" aria-label="Teams seat calculator" className="scroll-mt-20">
              <TeamsSeatCalculator
                interval={selectedInterval}
                onIntervalChange={setSelectedInterval}
                onStartTeamsCheckout={
                  isAuthenticated ? handleStartCalculatorCheckout : undefined
                }
              />
            </section>

            <section aria-label="Billing questions" className="flex flex-col gap-8">
              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
                <div className="flex flex-col items-start gap-2.5">
                  <Eyebrow step="04" icon={<MessageCircleQuestion className="size-3.5" />}>
                    Billing FAQ
                  </Eyebrow>
                  <h2 className="v3-display-l text-balance text-[var(--cf-text-primary)]">
                    Answers on plans, seats &amp;{" "}
                    <span className="v3-sticker-lime">downgrades</span>
                  </h2>
                </div>
                <Link href="/help/billing-and-plans" className="v3-btn-secondary py-2.5 px-4 text-xs">
                  <span>Read full billing FAQ</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>

              <ScrollRise stagger y={14} className="grid grid-cols-1 gap-5 md:grid-cols-3">
                {PRICING_FAQ_STRIP.map((item, idx) => (
                  <article
                    key={item.question}
                    className="flex flex-col gap-3 rounded-[1.75rem] border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--cf-royal)] hover:shadow-[var(--cf-shadow-hover)]"
                  >
                    <span
                      className={cn(
                        "inline-flex w-fit items-center rounded-lg px-2.5 py-1 text-xs font-bold tracking-wider uppercase",
                        idx === 1
                          ? "bg-[var(--cf-bg-accent)] text-[var(--cf-text-on-accent)]"
                          : "bg-[var(--cf-royal)] text-[var(--cf-text-on-royal)]",
                      )}
                    >
                      0{idx + 1}
                    </span>
                    <h3 className="v3-heading-s text-[var(--cf-text-primary)]">{item.question}</h3>
                    <p className="v3-body-s leading-relaxed text-[var(--cf-text-secondary)]">
                      {item.answer}
                    </p>
                  </article>
                ))}
              </ScrollRise>
            </section>
          </div>
        </div>
      </SectionStackSheet>

      {/* 5. Overlapping Electric Royal Blue Launch Sheet + Dual Signature Ribbon */}
      <SectionStackSheet
        overlapY={40}
        startScale={0.988}
        className="z-50 -mt-8 lg:-mt-12"
      >
        <section className="v3-pattern-dots-dark v3-sheet-royal overflow-hidden rounded-t-[2rem] pt-14 sm:rounded-t-[2.75rem] lg:rounded-t-[3.5rem] lg:pt-20">
          <div className="v3-container flex flex-col items-center pb-14 text-center lg:pb-20">
            <span className="v3-label mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--cf-border-on-royal)] bg-[var(--cf-bg-inverse-elevated)] px-3.5 py-1 text-[var(--cf-bg-accent)] uppercase">
              <Rocket className="size-3.5" />
              <span>05 · Start Free Forever</span>
            </span>
            <h2 className="v3-display-l max-w-2xl text-[var(--cf-text-inverse)]">
              Test the canvas before paying{" "}
              <span className="v3-sticker-lime">a single cent</span>
            </h2>
            <p className="v3-body-l mt-4 max-w-xl text-[var(--cf-text-inverse-muted)]">
              Build and publish {FREE_LIFETIME_PROJECT_LIMIT} complete Case Study free — no credit
              card required. Upgrade to Pro or Teams whenever you need custom URLs, rotatable slots,
              or studio seats.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/sign-up" className="v3-btn-lime py-3.5 px-6 text-base">
                <span>Start free</span>
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/help/billing-and-plans"
                className="inline-flex items-center justify-center gap-2 rounded-[0.625rem] border border-[var(--cf-border-on-royal)] bg-[var(--cf-bg-inverse-elevated)] px-5 py-3.5 text-base font-semibold text-[var(--cf-text-inverse)] transition-colors hover:bg-[var(--cf-bg-elevated)]/15"
              >
                <span>Billing guide</span>
              </Link>
            </div>
          </div>
          <div aria-hidden="true" className="grid h-2.5 w-full grid-cols-12">
            <div className="col-span-8 bg-[var(--cf-royal-deep)]" />
            <div className="col-span-4 bg-[var(--cf-bg-accent)]" />
          </div>
        </section>
      </SectionStackSheet>

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
