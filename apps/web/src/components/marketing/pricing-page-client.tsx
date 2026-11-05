"use client";

import type { PlanTier } from "@casefolio/db";
import { Check, Minus, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PaddleCheckoutModal } from "@/components/billing/paddle-checkout-modal";
import { LandingPricingSection } from "@/components/marketing/landing-pricing-section";
import { Badge } from "@/components/ui/badge";
import {
  BILLING_PLAN_CATALOG,
  type BillingInterval,
  type PaidPlanTier,
} from "@/lib/billing/plans";
import { FREE_MONTHLY_EXPORT_LIMIT } from "@/lib/exports/types";
import { FREE_PROJECT_LIMIT } from "@/lib/projects/types";

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
    feature: "Case study projects",
    free: `Up to ${FREE_PROJECT_LIMIT} projects`,
    pro: "Unlimited",
    team: "Unlimited",
  },
  {
    category: "Workspace",
    feature: "Curated Casefolio templates",
    free: "Free templates",
    pro: "All Free & Pro templates",
    team: "All Free & Pro templates",
  },
  {
    category: "Editor",
    feature: "Constrained slot editor, crops & version history",
    free: true,
    pro: true,
    team: true,
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
    feature: "Remove “Made with Casefolio” badge",
    free: false,
    pro: true,
    team: true,
  },
  {
    category: "Exports",
    feature: "High-res long PNG export",
    free: `${FREE_MONTHLY_EXPORT_LIMIT}/mo (watermarked)`,
    pro: "Unlimited · no watermark",
    team: "Unlimited · no watermark",
  },
  {
    category: "Exports",
    feature: "Paged A4 PDF & Behance 1400w slices",
    free: false,
    pro: true,
    team: true,
  },
  {
    category: "Analytics",
    feature: "Case study analytics",
    free: "Total page views",
    pro: "Views, visitors, referrers & countries",
    team: "Studio-wide views, visitors & referrers",
  },
  {
    category: "Team",
    feature: "Collaborative seats & roles",
    free: "1 designer",
    pro: "1 designer",
    team: `${BILLING_PLAN_CATALOG.team.defaultSeats}+ seats (Owner, Editor, Viewer)`,
  },
  {
    category: "Team",
    feature: "Shared studio brand kit & 10 GB storage",
    free: false,
    pro: false,
    team: true,
  },
];

const PRICING_FAQ_STRIP = [
  {
    question: "What happens to published pages if I cancel?",
    answer:
      "Paid access remains active through the end of your current billing period. Afterwards, your projects and assets remain safe in your account under Free plan limits.",
  },
  {
    question: "Which actions need a paid plan?",
    answer: `Creating more than ${FREE_PROJECT_LIMIT} projects, unlocking Pro templates, exporting unwatermarked PNG/PDF/Behance files, removing the public badge, and viewing full referrer analytics.`,
  },
  {
    question: "Who handles payment & invoices?",
    answer:
      "Paddle acts as our Merchant of Record — handling cards, Apple/Google Pay, global VAT/sales tax and downloadable invoices. Casefolio never stores card data.",
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
  const [selectedInterval, setSelectedInterval] =
    useState<BillingInterval>(initialInterval);

  function handleSelectPaidPlan(plan: PaidPlanTier, interval: BillingInterval) {
    setSelectedPlan(plan);
    setSelectedInterval(interval);
    setCheckoutOpen(true);
  }

  return (
    <div className="bg-background px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
      <div className="mx-auto flex max-w-6xl flex-col gap-16 lg:gap-20">
        {/* Header matching Figma 2:8861 */}
        <header className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <Badge tone="neutral">Case Study Builder</Badge>
          <h1 className="text-foreground type-display-l text-balance">
            Unlock the full builder
          </h1>
          <p className="text-muted-foreground type-body-l">
            Create, publish and export case studies from Casefolio templates.
            Start free with {FREE_PROJECT_LIMIT} projects — upgrade whenever
            your portfolio or studio grows.
          </p>
          {isAuthenticated && currentTier && (
            <p className="text-muted-foreground type-caption pt-1">
              Signed in on{" "}
              <strong className="text-foreground capitalize">
                {currentTier}
              </strong>{" "}
              plan ·{" "}
              <Link
                href="/account/billing"
                className="text-accent-foreground underline underline-offset-4"
              >
                Manage billing &amp; invoices
              </Link>
            </p>
          )}
        </header>

        {/* Plans grid + Monthly/Yearly toggle (Figma 2:8867 + 2:8872) */}
        <section aria-label="Subscription plans" className="flex flex-col gap-8">
          <LandingPricingSection
            defaultInterval={initialInterval}
            currentTier={currentTier}
            onSelectPaidPlan={isAuthenticated ? handleSelectPaidPlan : undefined}
          />

          {/* Merchant of Record note (Figma 2:8972) */}
          <div
            data-testid="paddle-config-summary"
            data-pro-monthly={paddlePriceMap.pro_monthly}
            data-pro-yearly={paddlePriceMap.pro_yearly}
            data-team-monthly={paddlePriceMap.team_monthly}
            data-team-yearly={paddlePriceMap.team_yearly}
            className="bg-warning-soft text-foreground mx-auto flex max-w-2xl items-center justify-center gap-2.5 rounded-full px-4 py-2 text-center"
          >
            <ShieldCheck
              className="text-warning size-4 shrink-0"
              aria-hidden="true"
            />
            <span className="type-caption">
              Secure checkout via Paddle ({paddlePriceMap.environment} environment)
              · Instant VAT receipts · Cancel anytime.
            </span>
          </div>
        </section>

        {/* Plan comparison matrix */}
        <section
          aria-labelledby="plan-comparison-heading"
          className="flex flex-col gap-6"
        >
          <div className="flex flex-col gap-2 text-center">
            <p className="text-accent-foreground type-overline">
              Plan comparison
            </p>
            <h2
              id="plan-comparison-heading"
              className="text-foreground type-heading-l"
            >
              Compare every feature &amp; quota
            </h2>
          </div>

          <div className="border-border bg-card overflow-x-auto rounded-xl border">
            <table className="w-full min-w-160 border-collapse text-left">
              <thead>
                <tr className="border-border bg-surface border-b">
                  <th className="text-foreground type-body-s-strong px-5 py-4">
                    Capability
                  </th>
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
                      (${BILLING_PLAN_CATALOG.team.monthlyPriceUsd}/mo)
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.feature} className="hover:bg-surface/60">
                    <td className="px-5 py-3.5">
                      <p className="text-foreground type-body-s-strong">
                        {row.feature}
                      </p>
                      <p className="text-muted-foreground type-caption">
                        {row.category}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">{renderCellValue(row.free)}</td>
                    <td className="px-5 py-3.5">{renderCellValue(row.pro)}</td>
                    <td className="px-5 py-3.5">{renderCellValue(row.team)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Bottom 3-column FAQ strip matching Figma 2:8977 */}
        <section
          aria-label="Billing questions"
          className="border-border grid grid-cols-1 gap-8 border-t pt-10 md:grid-cols-3"
        >
          {PRICING_FAQ_STRIP.map((item) => (
            <div key={item.question} className="flex flex-col gap-2">
              <h3 className="text-foreground type-heading-s">
                {item.question}
              </h3>
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
          orgId={activeOrgId}
        />
      )}
    </div>
  );
}
