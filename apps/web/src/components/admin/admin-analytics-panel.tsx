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

      {/* Specialized Report CSV Downloads */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground type-caption font-semibold">Download reports:</span>
        {(
          [
            { id: "subscribers", label: "Subscribers & MRR CSV" },
            { id: "exports", label: "Exports Breakdown CSV" },
            { id: "visits", label: "Visits & Traffic CSV" },
            { id: "feedback", label: "Feedback Ratings CSV" },
          ] as const
        ).map((rep) => (
          <a
            key={rep.id}
            href={`/api/admin/analytics/export?report=${rep.id}&range=${analytics.range}`}
            download={`casefolio-${rep.id}-${analytics.range}.csv`}
            className="border-border bg-elevated hover:border-primary text-foreground type-caption inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 font-medium transition-colors"
          >
            <Download className="size-3.5 text-[var(--cf-royal-text)]" />
            <span>{rep.label}</span>
          </a>
        ))}
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

      {analytics.telemetry && (
        <div className="grid gap-6 lg:grid-cols-12">
          <Card className="min-w-0 gap-4 p-6 lg:col-span-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="type-heading-s text-foreground">Subscribers &amp; Plan Mix</h2>
              <Badge tone="pro">
                ${analytics.telemetry.subscribers.mrrUsd.toFixed(0)} MRR
              </Badge>
            </div>
            <dl className="divide-border flex flex-col divide-y text-sm">
              <div className="flex justify-between py-2">
                <dt className="text-muted-foreground">Free accounts</dt>
                <dd className="text-foreground font-mono font-semibold">
                  {analytics.telemetry.subscribers.freeUsers.toLocaleString("en-US")}
                </dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-muted-foreground">Pro Monthly ($7.99)</dt>
                <dd className="text-foreground font-mono font-semibold">
                  {analytics.telemetry.subscribers.proMonthly.toLocaleString("en-US")}
                </dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-muted-foreground">Pro Annual ($79.90)</dt>
                <dd className="text-foreground font-mono font-semibold">
                  {analytics.telemetry.subscribers.proAnnual.toLocaleString("en-US")}
                </dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-muted-foreground">Teams workspaces</dt>
                <dd className="text-foreground font-mono font-semibold">
                  {analytics.telemetry.subscribers.teamWorkspaces} (
                  {analytics.telemetry.subscribers.teamPaidSeats} seats)
                </dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-muted-foreground">Past due / Canceled</dt>
                <dd className="text-foreground font-mono">
                  {analytics.telemetry.subscribers.pastDueSubscriptions} /{" "}
                  {analytics.telemetry.subscribers.canceledInRange}
                </dd>
              </div>
              <div className="flex justify-between pt-2">
                <dt className="text-muted-foreground font-semibold">Estimated ARR</dt>
                <dd className="text-foreground font-mono font-bold">
                  ${analytics.telemetry.subscribers.arrUsd.toLocaleString("en-US")}
                </dd>
              </div>
            </dl>
          </Card>

          <Card className="min-w-0 gap-4 p-6 lg:col-span-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="type-heading-s text-foreground">Exports by Format</h2>
              <Badge tone={analytics.telemetry.failedExports > 0 ? "draft" : "published"}>
                {analytics.telemetry.failedExports} failed
              </Badge>
            </div>
            {analytics.telemetry.exportsByFormat.length === 0 ? (
              <p className="text-muted-foreground type-body-s">No exports generated yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {analytics.telemetry.exportsByFormat.map((row) => (
                  <div
                    key={row.format}
                    className="flex items-center justify-between rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] px-3.5 py-2.5"
                  >
                    <div>
                      <p className="text-foreground type-body-s-strong uppercase">
                        {row.format.replace("_", " ")}
                      </p>
                      <p className="text-muted-foreground type-caption">
                        {row.completed} completed · {row.failed} failed
                      </p>
                    </div>
                    <span className="text-foreground font-mono text-sm font-bold">
                      {row.total}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-auto flex items-center justify-between border-t border-[var(--cf-border-subtle)] pt-3">
              <span className="text-muted-foreground type-caption">
                Feedback Rating:{" "}
                <strong className="text-foreground">
                  {analytics.telemetry.feedbackSummary.averageRating !== null
                    ? `${analytics.telemetry.feedbackSummary.averageRating.toFixed(2)}★`
                    : "—"}
                </strong>{" "}
                ({analytics.telemetry.feedbackSummary.totalResponses})
              </span>
              <Link
                href="/admin/feedback"
                className="text-primary type-caption font-semibold hover:underline"
              >
                View feedback &rarr;
              </Link>
            </div>
          </Card>

          <Card className="min-w-0 gap-4 p-6 lg:col-span-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="type-heading-s text-foreground">Visits Trend</h2>
              <Badge tone="neutral">
                {analytics.telemetry.uniqueVisitors.toLocaleString("en-US")} unique
              </Badge>
            </div>
            {(() => {
              const maxViews = Math.max(
                1,
                ...analytics.telemetry.viewsByBucket.map((b) => b.views),
              );
              return (
                <div
                  role="img"
                  aria-label="Visits trend across period buckets"
                  className="flex h-44 items-end gap-1.5 pt-2"
                >
                  {analytics.telemetry.viewsByBucket.map((b) => {
                    const heightPct =
                      b.views === 0 ? 6 : Math.max(14, Math.round((b.views / maxViews) * 100));
                    return (
                      <div
                        key={b.index}
                        className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
                        title={`${b.label}: ${b.views} views`}
                      >
                        <div className="bg-sunken flex h-full w-full items-end overflow-hidden rounded-t-sm">
                          <div
                            className="bg-[var(--cf-royal)] w-full rounded-t-sm"
                            style={{ height: `${heightPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </Card>
        </div>
      )}

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
