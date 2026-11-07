"use client";

import { Download } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import {
  ADMIN_ANALYTICS_RANGES,
  formatCompactCount,
  formatDeltaBadge,
  serializeAdminAnalyticsCsv,
  type AdminAnalyticsRange,
  type AdminPlatformAnalytics,
} from "@/lib/admin/overview-types";
import { cn } from "@/lib/utils";

function formatRangeSubtitle(range: AdminAnalyticsRange): string {
  if (range === "7d") return "Last 7 days across all workspaces.";
  if (range === "30d") return "Last 30 days across all workspaces.";
  if (range === "90d") return "Last 90 days across all workspaces.";
  return "All-time activity across all workspaces.";
}

function formatRangeSegmentLabel(range: AdminAnalyticsRange): string {
  if (range === "7d") return "7 days";
  if (range === "30d") return "30 days";
  if (range === "90d") return "90 days";
  return "All time";
}

export function AdminAnalyticsPanel({ analytics }: { analytics: AdminPlatformAnalytics }) {
  const maxWeekly = Math.max(1, ...analytics.weeklyPublishes.map((b) => b.publishes));

  function handleExportCsv() {
    const csv = serializeAdminAnalyticsCsv(analytics);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `casefolio-admin-analytics-${analytics.range}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-8">
      {/* Page header (Figma 32:10001) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <Eyebrow className="w-fit">Platform Telemetry</Eyebrow>
          <h1 className="type-display-m text-foreground">Analytics</h1>
          <p className="text-muted-foreground type-body-s">{formatRangeSubtitle(analytics.range)}</p>
        </div>

        <Button variant="secondary" onClick={handleExportCsv}>
          <Download className="size-4" />
          Export CSV
        </Button>
      </div>

      {/* Range filter (Figma 35:8625) */}
      <div>
        <div
          role="group"
          aria-label="Analytics range"
          className="border-border/70 bg-sunken/80 inline-flex flex-wrap items-center gap-1 rounded-full border p-1"
        >
          {ADMIN_ANALYTICS_RANGES.map((r) => {
            const active = analytics.range === r;
            return (
              <Link
                key={r}
                href={`/admin/analytics?range=${r}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring/40 rounded-full px-3.5 py-1.5 transition-all outline-none focus-visible:ring-2",
                  active
                    ? "bg-elevated text-foreground shadow-card type-caption font-medium"
                    : "text-muted-foreground hover:text-foreground type-caption",
                )}
              >
                {formatRangeSegmentLabel(r)}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Stats (Figma 35:8635) */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="min-w-0 justify-between gap-3 p-5">
          <span className="text-muted-foreground type-caption">Case studies published</span>
          <span className="text-foreground type-display-s">
            {analytics.publishedCaseStudies.toLocaleString("en-US")}
          </span>
          <span className="text-success type-caption">
            {analytics.publishesPrevPeriod !== null
              ? formatDeltaBadge(analytics.publishedCaseStudies, analytics.publishesPrevPeriod, "")
                  .trim()
              : "All-time published"}
          </span>
        </Card>

        <Card className="min-w-0 justify-between gap-3 p-5">
          <span className="text-muted-foreground type-caption">Public views</span>
          <span className="text-foreground type-display-s">
            {formatCompactCount(analytics.publicViews)}
          </span>
          <span className="text-success type-caption">
            {analytics.viewsPrevPeriod !== null
              ? formatDeltaBadge(analytics.publicViews, analytics.viewsPrevPeriod, "").trim()
              : "All-time public views"}
          </span>
        </Card>

        <Card className="min-w-0 justify-between gap-3 p-5">
          <span className="text-muted-foreground type-caption">PDF / PNG exports</span>
          <span className="text-foreground type-display-s">
            {analytics.completedExports.toLocaleString("en-US")}
          </span>
          <span className="text-success type-caption">
            {analytics.exportsPrevPeriod !== null
              ? formatDeltaBadge(analytics.completedExports, analytics.exportsPrevPeriod, "").trim()
              : "Completed exports"}
          </span>
        </Card>

        <Card className="min-w-0 justify-between gap-3 p-5">
          <span className="text-muted-foreground type-caption">Free → Pro</span>
          <span className="text-foreground type-display-s">
            {analytics.freeToProRatePercent.toFixed(1)}%
          </span>
          <span className="text-muted-foreground type-caption">
            {analytics.paidUsers.toLocaleString("en-US")} paid of{" "}
            {analytics.totalUsers.toLocaleString("en-US")} users
          </span>
        </Card>
      </div>

      {/* Charts row (Figma 35:8652) */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="min-w-0 gap-5 p-6 lg:col-span-7">
          <div className="flex items-center justify-between gap-3">
            <h2 className="type-heading-s text-foreground">Published case studies per week</h2>
            <Badge tone="published">
              {analytics.publishedCaseStudies.toLocaleString("en-US")} published
            </Badge>
          </div>

          <div
            role="img"
            aria-label="Published case studies per week"
            className="flex h-52 items-end gap-2 pt-2"
          >
            {analytics.weeklyPublishes.map((b) => {
              const heightPct =
                b.publishes === 0 ? 6 : Math.max(14, Math.round((b.publishes / maxWeekly) * 100));
              return (
                <div
                  key={b.index}
                  className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
                  title={`${b.label}: ${b.publishes} published`}
                >
                  <div className="bg-sunken flex h-full w-full max-w-8 items-end overflow-hidden rounded-t-md">
                    <div
                      className="bg-primary w-full rounded-t-md transition-all"
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="text-tertiary type-caption hidden truncate sm:block">
                    {b.index % 2 === 0 ? b.label : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="min-w-0 gap-4 p-6 lg:col-span-5">
          <h2 className="type-heading-s text-foreground">Template usage</h2>
          <div className="flex flex-col gap-4">
            {analytics.templateUsage.length === 0 ? (
              <p className="text-muted-foreground type-body-s">No templates recorded yet.</p>
            ) : (
              analytics.templateUsage.map((item) => {
                const suffix =
                  item.status === "draft"
                    ? " (draft)"
                    : item.status === "archived"
                      ? " (archived)"
                      : "";
                return (
                  <div key={item.id} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-foreground type-body-s truncate">
                        {item.name}
                        {suffix}
                      </span>
                      <span className="text-muted-foreground type-caption shrink-0">
                        {item.projectCount > 0 ? `${item.sharePercent}%` : "—"}
                      </span>
                    </div>
                    <div className="bg-sunken h-2 w-full overflow-hidden rounded-full">
                      <div
                        className="bg-primary h-full rounded-full transition-all"
                        style={{ width: `${item.sharePercent}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {/* Top case studies (Figma 35:8698) */}
      <Card className="min-w-0 gap-4 p-6">
        <h2 className="type-heading-s text-foreground">Top case studies</h2>
        <div className="w-full max-w-full overflow-x-auto">
          <table className="w-full min-w-140 border-collapse text-left">
            <thead>
              <tr className="border-border/70 border-b">
                <th className="text-tertiary type-overline py-2.5 pr-4">Case study</th>
                <th className="text-tertiary type-overline px-4 py-2.5">Author</th>
                <th className="text-tertiary type-overline px-4 py-2.5">Template</th>
                <th className="text-tertiary type-overline px-4 py-2.5 text-right">Views</th>
                <th className="text-tertiary type-overline py-2.5 pl-4 text-right">Exports</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {analytics.topCaseStudies.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-muted-foreground type-body-s py-8 text-center">
                    No published case studies in this period yet.
                  </td>
                </tr>
              ) : (
                analytics.topCaseStudies.map((cs) => (
                  <tr key={cs.id} className="hover:bg-surface/60 transition-colors">
                    <td className="py-3 pr-4">
                      {cs.slug ? (
                        <Link
                          href={`/p/${cs.slug}`}
                          className="text-foreground hover:text-primary type-body-s-strong transition-colors"
                        >
                          {cs.name}
                        </Link>
                      ) : (
                        <span className="text-foreground type-body-s-strong">{cs.name}</span>
                      )}
                    </td>
                    <td className="text-muted-foreground type-body-s px-4 py-3">{cs.authorName}</td>
                    <td className="text-muted-foreground type-body-s px-4 py-3">
                      {cs.templateName}
                    </td>
                    <td className="text-foreground type-body-s-strong px-4 py-3 text-right">
                      {cs.views.toLocaleString("en-US")}
                    </td>
                    <td className="text-foreground type-body-s py-3 pl-4 text-right">
                      {cs.exports.toLocaleString("en-US")}
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
