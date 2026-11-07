"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import {
  ADMIN_OVERVIEW_RANGES,
  formatDeltaBadge,
  formatProjectTypeLabel,
  formatTemplateStatusLabel,
  formatUsdWhole,
  type AdminOverviewMetrics,
} from "@/lib/admin/overview-types";
import { cn } from "@/lib/utils";

function statusTone(status: "published" | "draft" | "archived"): "published" | "draft" | "neutral" {
  if (status === "published") return "published";
  if (status === "draft") return "draft";
  return "neutral";
}

export function AdminOverviewPanel({ metrics }: { metrics: AdminOverviewMetrics }) {
  const maxBarTotal = Math.max(
    1,
    ...metrics.buckets.map((bucket) => bucket.signups + bucket.publishes),
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-8">
      {/* Page header (Figma 31:6749) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <Eyebrow className="w-fit">Platform Overview</Eyebrow>
          <h1 className="type-display-m text-foreground">Overview</h1>
          <p className="text-muted-foreground type-body-s">
            Platform health for the last {metrics.rangeDays} days.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="Overview date range"
            className="border-border/70 bg-sunken/80 inline-flex items-center gap-1 rounded-full border p-1"
          >
            {ADMIN_OVERVIEW_RANGES.map((r) => {
              const active = metrics.range === r;
              return (
                <Link
                  key={r}
                  href={`/admin?range=${r}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "focus-visible:ring-ring/40 rounded-full px-3.5 py-1.5 transition-all outline-none focus-visible:ring-2",
                    active
                      ? "bg-elevated text-foreground shadow-card type-caption font-medium"
                      : "text-muted-foreground hover:text-foreground type-caption",
                  )}
                >
                  {r}
                </Link>
              );
            })}
          </div>

          <Button asChild>
            <Link href="/admin/templates/new">Upload template</Link>
          </Button>
        </div>
      </div>

      {/* KPI cards (Figma 31:6765 + C-901 KPIs) */}
      <div
        data-testid="admin-overview-kpis"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      >
        <Card
          data-testid="kpi-total-users"
          className="min-w-0 justify-between gap-3 p-5"
        >
          <span className="text-muted-foreground type-caption">Total users</span>
          <span className="text-foreground type-display-s" data-testid="kpi-total-users-value">
            {metrics.totalUsers.toLocaleString("en-US")}
          </span>
          <div>
            <Badge tone={metrics.newUsersInRange >= metrics.newUsersPrevRange ? "published" : "neutral"}>
              {formatDeltaBadge(metrics.newUsersInRange, metrics.newUsersPrevRange)}
            </Badge>
          </div>
        </Card>

        <Card data-testid="kpi-mrr" className="min-w-0 justify-between gap-3 p-5">
          <span className="text-muted-foreground type-caption">MRR</span>
          <span className="text-foreground type-display-s" data-testid="kpi-mrr-value">
            {formatUsdWhole(metrics.mrrUsd)}
          </span>
          <div>
            <Badge tone={metrics.activeSubscriptions > 0 ? "published" : "neutral"}>
              {metrics.activeSubscriptions.toLocaleString("en-US")} active subs
            </Badge>
          </div>
        </Card>

        <Card
          data-testid="kpi-published-projects"
          className="min-w-0 justify-between gap-3 p-5"
        >
          <span className="text-muted-foreground type-caption">Published case studies</span>
          <span
            className="text-foreground type-display-s"
            data-testid="kpi-published-projects-value"
          >
            {metrics.publishedCaseStudies.toLocaleString("en-US")}
          </span>
          <div>
            <Badge
              tone={metrics.publishesInRange >= metrics.publishesPrevRange ? "published" : "neutral"}
            >
              {formatDeltaBadge(metrics.publishesInRange, metrics.publishesPrevRange)}
            </Badge>
          </div>
        </Card>

        <Card
          data-testid="kpi-completed-exports"
          className="min-w-0 justify-between gap-3 p-5"
        >
          <span className="text-muted-foreground type-caption">Completed exports</span>
          <span
            className="text-foreground type-display-s"
            data-testid="kpi-completed-exports-value"
          >
            {metrics.completedExports.toLocaleString("en-US")}
          </span>
          <div>
            <Badge
              tone={metrics.exportsInRange >= metrics.exportsPrevRange ? "published" : "neutral"}
            >
              +{metrics.exportsInRange.toLocaleString("en-US")} in {metrics.range}
            </Badge>
          </div>
        </Card>

        <Card
          data-testid="kpi-templates-live"
          className="min-w-0 justify-between gap-3 p-5"
        >
          <span className="text-muted-foreground type-caption">Templates live</span>
          <span className="text-foreground type-display-s" data-testid="kpi-templates-live-value">
            {metrics.publishedTemplates.toLocaleString("en-US")}
          </span>
          <div>
            <Badge tone="neutral">
              {metrics.publishedTemplates} published · {metrics.draftTemplates} drafts
            </Badge>
          </div>
        </Card>
      </div>

      {/* Two-column row: Signups & publishes chart + Needs attention (Figma 31:6790) */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="min-w-0 gap-5 p-6 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="type-heading-s text-foreground">Signups &amp; publishes</h2>
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground type-caption inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="bg-primary inline-block size-2 rounded-full" />
                Signups ({metrics.newUsersInRange})
              </span>
              <span className="text-muted-foreground type-caption inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="bg-success inline-block size-2 rounded-full" />
                Publishes ({metrics.publishesInRange})
              </span>
            </div>
          </div>

          <div
            role="img"
            aria-label={`Signups and publishes across the last ${metrics.rangeDays} days`}
            className="flex h-64 items-end gap-2 pt-4"
          >
            {metrics.buckets.map((bucket) => {
              const total = bucket.signups + bucket.publishes;
              const heightPct = total === 0 ? 6 : Math.max(12, Math.round((total / maxBarTotal) * 100));
              const publishSharePct =
                total > 0 ? Math.round((bucket.publishes / total) * 100) : 0;

              return (
                <div
                  key={bucket.index}
                  className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
                  title={`${bucket.label}: ${bucket.signups} signups, ${bucket.publishes} publishes`}
                >
                  <div className="bg-sunken flex h-full w-full max-w-8 items-end overflow-hidden rounded-t-md">
                    <div
                      className="bg-primary/85 flex w-full flex-col justify-end rounded-t-md transition-all"
                      style={{ height: `${heightPct}%` }}
                    >
                      {publishSharePct > 0 && (
                        <div
                          className="bg-success w-full"
                          style={{ height: `${publishSharePct}%` }}
                        />
                      )}
                    </div>
                  </div>
                  <span className="text-tertiary type-caption hidden truncate sm:block">
                    {bucket.index % 2 === 0 ? bucket.label : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="min-w-0 gap-4 p-6 lg:col-span-5">
          <h2 className="type-heading-s text-foreground">Needs attention</h2>
          <div className="divide-border/70 flex flex-col divide-y">
            {metrics.needsAttention.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="hover:bg-surface/80 focus-visible:ring-ring/40 -mx-2 flex items-center justify-between gap-3 rounded-2xl px-3 py-3 transition-colors outline-none focus-visible:ring-2"
              >
                <span className="text-foreground type-body-s min-w-0 truncate">{item.label}</span>
                <Badge tone={item.tone}>{item.badgeLabel}</Badge>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {/* Top templates by usage (Figma 31:6828) */}
      <Card className="min-w-0 gap-4 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="type-heading-s text-foreground">Top templates by usage</h2>
          <Button variant="secondary" size="sm" asChild>
            <Link href="/admin/templates">View all</Link>
          </Button>
        </div>

        <div className="w-full max-w-full overflow-x-auto">
          <table className="w-full min-w-140 border-collapse text-left" data-testid="top-templates-table">
            <thead>
              <tr className="border-border/70 border-b">
                <th className="text-tertiary type-overline py-2.5 pr-4">Template</th>
                <th className="text-tertiary type-overline px-4 py-2.5">Type</th>
                <th className="text-tertiary type-overline px-4 py-2.5">Status</th>
                <th className="text-tertiary type-overline px-4 py-2.5">Version</th>
                <th className="text-tertiary type-overline py-2.5 pl-4 text-right">Projects</th>
              </tr>
            </thead>
            <tbody className="divide-border/70 divide-y">
              {metrics.topTemplates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-muted-foreground type-body-s py-8 text-center">
                    No templates uploaded yet.
                  </td>
                </tr>
              ) : (
                metrics.topTemplates.map((tpl) => (
                  <tr key={tpl.id} className="hover:bg-surface/60 transition-colors">
                    <td className="py-3.5 pr-4">
                      <Link
                        href={`/admin/templates/${tpl.id}`}
                        className="text-foreground hover:text-primary type-body-s-strong transition-colors"
                      >
                        {tpl.name}
                      </Link>
                    </td>
                    <td className="text-muted-foreground type-body-s px-4 py-3.5">
                      {formatProjectTypeLabel(tpl.type)}
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge tone={statusTone(tpl.status)}>
                        {formatTemplateStatusLabel(tpl.status)}
                      </Badge>
                    </td>
                    <td className="text-muted-foreground type-mono-s px-4 py-3.5">
                      {tpl.version ? `v${tpl.version}` : "—"}
                    </td>
                    <td className="text-foreground type-body-s-strong py-3.5 pl-4 text-right">
                      {tpl.projectCount > 0 ? tpl.projectCount.toLocaleString("en-US") : "—"}
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
