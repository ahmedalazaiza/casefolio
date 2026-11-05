"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatUsdWhole } from "@/lib/admin/overview-types";
import type { AdminSubscriptionsOverview } from "@/lib/admin/users-types";
import type { PlanTier } from "@casefolio/db";
import { BILLING_PLAN_CATALOG } from "@/lib/billing/plans";

function statusTone(status: string): "published" | "draft" | "danger" | "neutral" {
  const s = status.trim().toLowerCase();
  if (s === "active" || s === "trialing") return "published";
  if (s === "past_due") return "danger";
  if (s === "cancel_at_period_end" || s === "paused") return "draft";
  return "neutral";
}

const PLAN_ORDER: readonly PlanTier[] = ["free", "pro", "team"];

export function AdminSubscriptionsPanel({
  overview,
}: {
  overview: AdminSubscriptionsOverview;
}) {
  return (
    <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-8">
      {/* Page header (Figma 32:9505) */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-foreground type-heading-l">Subscriptions &amp; plans</h1>
          <p className="text-muted-foreground type-body-s">
            Plans, prices and active subscriptions synced via Paddle Billing.
          </p>
        </div>

        <Button asChild variant="secondary">
          <Link href="/admin/users">Manage users</Link>
        </Button>
      </header>

      {/* Stats (Figma 34:8565) */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card variant="flat" className="min-w-0 justify-between gap-2 p-5">
          <span className="text-muted-foreground type-caption">MRR</span>
          <span className="text-foreground type-heading-l">{formatUsdWhole(overview.mrrUsd)}</span>
          <span className="text-success type-caption">Active monthly recurring revenue</span>
        </Card>

        <Card variant="flat" className="min-w-0 justify-between gap-2 p-5">
          <span className="text-muted-foreground type-caption">Paying users</span>
          <span className="text-foreground type-heading-l">
            {overview.payingUsersCount.toLocaleString("en-US")}
          </span>
          <span className="text-muted-foreground type-caption">Pro &amp; Team subscribers</span>
        </Card>

        <Card variant="flat" className="min-w-0 justify-between gap-2 p-5">
          <span className="text-muted-foreground type-caption">Churn (30d)</span>
          <span className="text-foreground type-heading-l">
            {overview.churn30dPercent.toFixed(1)}%
          </span>
          <span className="text-muted-foreground type-caption">Canceled in last 30 days</span>
        </Card>

        <Card variant="flat" className="min-w-0 justify-between gap-2 p-5">
          <span className="text-muted-foreground type-caption">Trials active</span>
          <span className="text-foreground type-heading-l">
            {overview.trialsActiveCount.toLocaleString("en-US")}
          </span>
          <span className="text-muted-foreground type-caption">Active trial periods</span>
        </Card>
      </div>

      {/* Plan cards (Figma 34:8582) */}
      <div className="grid gap-5 lg:grid-cols-3">
        {PLAN_ORDER.map((tier) => {
          const plan = BILLING_PLAN_CATALOG[tier];
          return (
            <Card
              key={tier}
              variant={plan.highlighted ? "default" : "flat"}
              className="min-w-0 justify-between gap-5 p-6"
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-foreground type-heading-m">{plan.name}</h2>
                  {plan.highlighted && <Badge tone="accent">Most popular</Badge>}
                </div>
                <p className="text-muted-foreground type-body-s">{plan.tagline}</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-foreground type-display-s">${plan.monthlyPriceUsd}</span>
                  <span className="text-muted-foreground type-body-s">/ month</span>
                  {plan.yearlyTotalUsd > 0 && (
                    <span className="text-tertiary type-caption ml-2">
                      (${plan.yearlyTotalUsd}/yr)
                    </span>
                  )}
                </div>
                <ul className="flex flex-col gap-2 pt-2">
                  {plan.features.map((feat) => (
                    <li key={feat} className="text-foreground type-body-s flex items-start gap-2">
                      <Check className="text-primary mt-0.5 size-4 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="border-border border-t pt-4">
                <span className="text-tertiary type-caption">
                  Default seats: {plan.defaultSeats}
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Recent subscriptions table (Figma 34:8676) */}
      <Card variant="flat" className="min-w-0 gap-4 p-6">
        <h2 className="text-foreground type-heading-s">Recent subscriptions</h2>
        <div className="w-full max-w-full overflow-x-auto">
          <table className="w-full min-w-150 border-collapse text-left">
            <thead>
              <tr className="border-border border-b">
                <th className="text-tertiary type-overline py-2.5 pr-4">Customer</th>
                <th className="text-tertiary type-overline px-4 py-2.5">Plan</th>
                <th className="text-tertiary type-overline px-4 py-2.5">Amount</th>
                <th className="text-tertiary type-overline px-4 py-2.5">Status</th>
                <th className="text-tertiary type-overline px-4 py-2.5">Date</th>
                <th className="text-tertiary type-overline py-2.5 pl-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {overview.recentSubscriptions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-muted-foreground type-body-s py-8 text-center">
                    No subscription records yet.
                  </td>
                </tr>
              ) : (
                overview.recentSubscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-surface/60 transition-colors">
                    <td className="py-3.5 pr-4">
                      <div className="flex flex-col">
                        <span className="text-foreground type-body-s-strong">
                          {sub.customerName}
                        </span>
                        <span className="text-muted-foreground type-caption">
                          {sub.customerEmail}
                        </span>
                      </div>
                    </td>
                    <td className="text-foreground type-body-s px-4 py-3.5 capitalize">
                      {sub.plan} ({sub.interval})
                    </td>
                    <td className="text-foreground type-mono-s px-4 py-3.5">
                      ${sub.amountUsd.toFixed(2)}
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge tone={statusTone(sub.status)}>{sub.status}</Badge>
                    </td>
                    <td className="text-tertiary type-caption px-4 py-3.5">
                      {new Date(sub.updatedAtIso).toLocaleDateString("en-US", {
                        day: "numeric",
                        month: "short",
                      })}
                    </td>
                    <td className="py-3.5 pl-4 text-right">
                      {sub.userId ? (
                        <Button asChild variant="secondary" size="sm">
                          <Link href={`/admin/users/${sub.userId}`}>View user</Link>
                        </Button>
                      ) : (
                        <span className="text-tertiary type-caption">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
