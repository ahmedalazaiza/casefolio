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
  PAID_GRACE_DURATION_DAYS,
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
import { cn } from "@/lib/utils";

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
    title: "Workspace & Case Study Capacity",
    description: "How projects, published URLs, and personal vs. shared spaces scale.",
    icon: <FolderKanban className="size-4" />,
    rows: [
      {
        feature: "Workspace scope & seats",
        free: "1 personal workspace · 1 person",
        pro: "1 personal workspace · 1 person",
        team: `1 team workspace · S = 1–${TEAMS_MAX_SELF_SERVE_SEATS} paid seats`,
      },
      {
        feature: "Active, published & retained case studies",
        free: `Up to ${FREE_PROJECT_LIMIT} active (1 live, 10 retained)`,
        pro: `Up to ${PRO_PROJECT_LIMIT} active (10 live, 100 retained)`,
        team: `${TEAMS_PROJECT_LIMIT_PER_SEAT} × S active (10 × S live, 100 × S retained)`,
      },
      {
        feature: "Private personal spaces",
        free: "1 personal space",
        pro: "Up to 5 private spaces",
        team: "5 private spaces/member (hidden from Owner/Admin)",
      },
      {
        feature: "Shared collaborative team spaces",
        hint: "Collaborative spaces visible across workspace members",
        free: false,
        pro: false,
        team: { included: true, detail: "10 × S shared spaces" },
      },
    ],
  },
  {
    id: "templates",
    title: "Templates, Frames & Design System",
    description: "Starter layouts, Pro templates, device mockups, and theme tokens.",
    icon: <LayoutTemplate className="size-4" />,
    rows: [
      {
        feature: "Curated Casefolio templates",
        free: "3 approved Starter templates",
        pro: "All eligible published templates",
        team: "All eligible published templates",
      },
      {
        feature: "Pro-tier templates unlocked",
        free: false,
        pro: true,
        team: true,
      },
      {
        feature: "Ratio-locked hardware frames & curated theme palettes",
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
    title: "Publishing & Brand Control",
    description: "Hosted casefolio.app URLs, visibility modes, and branding controls.",
    icon: <Globe className="size-4" />,
    rows: [
      {
        feature: "Public, unlisted & private pages on casefolio.app",
        free: true,
        pro: true,
        team: true,
      },
      {
        feature: "Automatic OpenGraph social preview cards",
        free: true,
        pro: true,
        team: true,
      },
      {
        feature: "Removable “Made with Casefolio” branding",
        hint: "Clean unbranded footer on live pages and exported files",
        free: false,
        pro: true,
        team: true,
      },
    ],
  },
  {
    id: "exports",
    title: "High-Resolution Exports",
    description: "Pixel-identical Chromium exports for portfolios, Behance, and PDF decks.",
    icon: <FileDown className="size-4" />,
    rows: [
      {
        feature: "Monthly export allowance & PNG resolution",
        free: `${FREE_MONTHLY_EXPORT_LIMIT}/mo · 1x (1,440 px, branded)`,
        pro: `${PRO_MONTHLY_EXPORT_LIMIT}/mo · 1x & 2x (2,880 px, clean)`,
        team: `${TEAMS_MONTHLY_EXPORT_LIMIT_PER_SEAT} × S/mo · 1x & 2x (2,880 px, clean)`,
      },
      {
        feature: "2x Retina long PNG export (2,880 px)",
        free: false,
        pro: true,
        team: true,
      },
      {
        feature: "Paged A4 PDF deck export",
        free: false,
        pro: true,
        team: true,
      },
      {
        feature: "Behance 1,400px slice pack export",
        free: false,
        pro: true,
        team: true,
      },
    ],
  },
  {
    id: "storage-analytics",
    title: "Storage, Delivery & Analytics",
    description: "Asset storage, public CDN delivery, visitor insights, and version history.",
    icon: <BarChart3 className="size-4" />,
    rows: [
      {
        feature: "Storage, monthly uploads & max file size",
        free: "250 MB · 500 MB/mo · 10 MB/file",
        pro: "5 GB · 10 GB/mo · 25 MB/file",
        team: "10 GB × S · 20 GB × S/mo · 25 MB/file",
      },
      {
        feature: "Monthly public delivery bandwidth",
        free: "1 GB/mo",
        pro: "25 GB/mo",
        team: "25 GB × S/mo",
      },
      {
        feature: "Visitor analytics & recoverable content history",
        free: "7-day analytics · 7-day history",
        pro: "90-day analytics · 30-day history",
        team: "365-day analytics · 90-day history",
      },
      {
        feature: `${PAID_GRACE_DURATION_DAYS}-day paid quota burst grace buffer (up to 120%)`,
        free: false,
        pro: true,
        team: true,
      },
    ],
  },
  {
    id: "governance",
    title: "Team Collaboration, Privacy & Governance",
    description: "Role permissions, isolated member spaces, and offboarding continuity.",
    icon: <Users className="size-4" />,
    rows: [
      {
        feature: "Role-based access (Owner, Admin & Member)",
        free: false,
        pro: false,
        team: true,
      },
      {
        feature: "404-isolated member private spaces (hidden from Admins)",
        free: false,
        pro: false,
        team: true,
      },
      {
        feature: "Departed member ≥90-day private recovery portal",
        free: false,
        pro: false,
        team: true,
      },
    ],
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

  const proDisplayedUsd =
    selectedInterval === "yearly"
      ? BILLING_PLAN_CATALOG.pro.yearlyMonthlyEquivalentUsd
      : BILLING_PLAN_CATALOG.pro.monthlyPriceUsd;
  const teamDisplayedUsd =
    selectedInterval === "yearly"
      ? BILLING_PLAN_CATALOG.team.yearlyMonthlyEquivalentUsd
      : BILLING_PLAN_CATALOG.team.monthlyPriceUsd;

  return (
    <div className="min-w-0 px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
      <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-16 lg:gap-24">
        {/* 1. Header */}
        <header className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center sm:gap-6">
          <Eyebrow icon={<Sparkles />}>Pricing &amp; Teams</Eyebrow>
          <h1 className="text-foreground type-section text-balance">Unlock the full builder</h1>
          <p className="text-muted-foreground type-lead max-w-2xl">
            Honest, predictable plans for individual designers and product design teams. Start free
            with {FREE_PROJECT_LIMIT} active case studies — upgrade to Pro for unbranded 2x exports
            or Teams for private member spaces plus shared team publishing.
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

        {/* 2. Top Pricing Cards + Monthly/Yearly toggle */}
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
              See the exact difference between Free, Pro, and Teams — with every included capability,
              quota limit, and excluded tier feature side by side.
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
                S = paid seats (1–{TEAMS_MAX_SELF_SERVE_SEATS})
              </span>
            </div>
          </div>

          {/* Desktop aligned plan summary strip */}
          <div className="border-border/80 bg-surface shadow-card hidden items-center rounded-2xl border px-6 py-4 md:grid md:grid-cols-[37%_21%_21%_21%]">
            <div className="pr-4">
              <p className="text-foreground type-body-s-strong">Capability &amp; quota breakdown</p>
              <p className="text-muted-foreground type-caption">
                Showing {selectedInterval} billing rates
              </p>
            </div>
            <div className="px-3">
              <p className="text-foreground type-body-s-strong">
                {BILLING_PLAN_CATALOG.free.name}
              </p>
              <p className="text-muted-foreground type-caption">
                ${BILLING_PLAN_CATALOG.free.monthlyPriceUsd} /forever
              </p>
            </div>
            <div className="flex flex-col gap-0.5 px-3">
              <div className="flex items-center gap-1.5">
                <span className="text-foreground type-body-s-strong">
                  {BILLING_PLAN_CATALOG.pro.name}
                </span>
                <Badge tone="accent" withDot={false}>
                  Popular
                </Badge>
              </div>
              <p className="text-muted-foreground type-caption">${proDisplayedUsd}/mo</p>
            </div>
            <div className="px-3">
              <p className="text-foreground type-body-s-strong">
                {BILLING_PLAN_CATALOG.team.name}
              </p>
              <p className="text-muted-foreground type-caption">${teamDisplayedUsd}/seat/mo</p>
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
                <div className="border-border/70 bg-surface border-b px-5 py-4 sm:px-6 md:grid md:grid-cols-[37%_21%_21%_21%] md:items-center">
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
                  <span className="text-muted-foreground type-overline hidden px-3 md:block">
                    {BILLING_PLAN_CATALOG.free.name}
                  </span>
                  <span className="text-accent-foreground type-overline hidden px-3 md:block">
                    {BILLING_PLAN_CATALOG.pro.name}
                  </span>
                  <span className="text-muted-foreground type-overline hidden px-3 md:block">
                    {BILLING_PLAN_CATALOG.team.name}
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
                    </tr>
                  </thead>
                  <tbody className="divide-border/70 flex flex-col divide-y md:table-row-group">
                    {group.rows.map((row) => (
                      <tr
                        key={row.feature}
                        className="md:hover:bg-surface/60 flex flex-col gap-2.5 p-4 sm:p-5 md:table-row md:p-0"
                      >
                        <td className="md:w-[37%] md:py-4 md:pr-4 md:pl-6">
                          <p className="text-foreground type-body-s-strong">{row.feature}</p>
                          {row.hint && (
                            <p className="text-muted-foreground type-caption mt-0.5">{row.hint}</p>
                          )}
                        </td>
                        <td
                          data-label={BILLING_PLAN_CATALOG.free.name}
                          className="before:text-muted-foreground flex items-center justify-between gap-3 pt-1 before:text-xs before:font-medium before:content-[attr(data-label)] md:table-cell md:w-[21%] md:px-3 md:py-4 md:before:content-none"
                        >
                          {renderCellValue(row.free)}
                        </td>
                        <td
                          data-label={BILLING_PLAN_CATALOG.pro.name}
                          className="before:text-accent-foreground md:bg-accent/25 flex items-center justify-between gap-3 pt-1 before:text-xs before:font-semibold before:content-[attr(data-label)] md:table-cell md:w-[21%] md:px-3 md:py-4 md:before:content-none"
                        >
                          {renderCellValue(row.pro)}
                        </td>
                        <td
                          data-label={BILLING_PLAN_CATALOG.team.name}
                          className="before:text-muted-foreground flex items-center justify-between gap-3 pt-1 before:text-xs before:font-medium before:content-[attr(data-label)] md:table-cell md:w-[21%] md:px-3 md:py-4 md:pr-6 md:before:content-none"
                        >
                          {renderCellValue(row.team)}
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
