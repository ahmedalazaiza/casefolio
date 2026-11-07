"use client";

import {
  ArrowLeft,
  BarChart3,
  Download,
  ExternalLink,
  Eye,
  Globe,
  Lock,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { UpgradePromptDialog } from "@/components/billing/upgrade-prompt-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import type {
  AnalyticsRangeKey,
  ProjectAnalyticsPayload,
} from "@/lib/analytics/page-views-utils";
import { cn } from "@/lib/utils";

const RANGE_SEGMENTS: ReadonlyArray<{
  key: AnalyticsRangeKey;
  label: string;
  requiresPro: boolean;
}> = [
  { key: "7d", label: "7d", requiresPro: false },
  { key: "30d", label: "30d", requiresPro: false },
  { key: "90d", label: "90d", requiresPro: true },
  { key: "all", label: "All", requiresPro: true },
];

function formatDeltaCopy(delta: number | null, suffix = "vs previous"): string {
  if (delta === null) {
    return "All-time window";
  }
  if (delta > 0) {
    return `↑ ${delta}% ${suffix}`;
  }
  if (delta < 0) {
    return `↓ ${Math.abs(delta)}% ${suffix}`;
  }
  return `0% ${suffix}`;
}

export interface ProjectAnalyticsPanelProps {
  analytics: ProjectAnalyticsPayload;
}

export function ProjectAnalyticsPanel({ analytics }: ProjectAnalyticsPanelProps) {
  const router = useRouter();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const showUnpublishedEmptyState =
    !analytics.isPublished && analytics.kpis.allTimeViews === 0;

  const maxBucketViews = Math.max(
    1,
    ...analytics.chartBuckets.map((bucket) => bucket.views),
  );

  const handleSelectRange = (segment: (typeof RANGE_SEGMENTS)[number]) => {
    if (segment.requiresPro && !analytics.hasFullAnalyticsEntitlement) {
      setUpgradeOpen(true);
      return;
    }
    router.push(`/projects/${analytics.projectId}/analytics?range=${segment.key}`);
  };

  const bucketCount = Math.max(1, analytics.chartBuckets.length);
  const svgWidth = 606;
  const svgHeight = 200;
  const gap = bucketCount > 10 ? 8 : 14;
  const barWidth = Math.max(
    16,
    (svgWidth - gap * (bucketCount - 1)) / bucketCount,
  );

  return (
    <div
      data-testid="project-analytics-panel"
      className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-2 py-4 sm:px-6 sm:py-6 lg:px-8"
    >
      {/* Top project header + sub-navigation */}
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <Link
              href={`/editor/${analytics.projectId}`}
              aria-label="Back to case study editor"
              className="border-border/80 bg-elevated text-foreground hover:bg-surface shadow-xs mt-1 inline-flex size-10 shrink-0 items-center justify-center rounded-full border transition-colors"
            >
              <ArrowLeft className="size-4" />
            </Link>

            <div className="flex flex-col gap-1.5">
              <Eyebrow className="w-fit">Analytics</Eyebrow>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-foreground type-display-m">{analytics.projectName}</h1>
                {analytics.isPublished ? (
                  <Badge tone="published">
                    {analytics.visibility === "unlisted" ? "Unlisted" : "Public"}
                  </Badge>
                ) : (
                  <Badge tone="draft">Draft</Badge>
                )}
              </div>
              <p className="text-muted-foreground type-body-s">
                Privacy-safe views, unique visitors, and referral sources · Bots automatically
                filtered.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!showUnpublishedEmptyState && (
              <div
                role="group"
                aria-label="Analytics date range"
                data-testid="analytics-range-selector"
                className="border-border/70 bg-sunken/80 inline-flex items-center gap-1 rounded-full border p-1"
              >
                {RANGE_SEGMENTS.map((segment) => {
                  const isActive = analytics.range === segment.key;
                  const isLocked =
                    segment.requiresPro && !analytics.hasFullAnalyticsEntitlement;
                  return (
                    <button
                      key={segment.key}
                      type="button"
                      data-testid={`analytics-range-${segment.key}`}
                      aria-pressed={isActive}
                      onClick={() => handleSelectRange(segment)}
                      className={cn(
                        "focus-visible:ring-ring/40 inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 transition-all outline-none focus-visible:ring-2",
                        isActive
                          ? "bg-elevated text-foreground shadow-card type-body-s-strong"
                          : "text-muted-foreground hover:text-foreground type-body-s",
                      )}
                    >
                      <span>{segment.label}</span>
                      {isLocked && <Lock className="text-tertiary size-3" />}
                    </button>
                  );
                })}
              </div>
            )}

            {analytics.isPublished && analytics.slug && (
              <Button asChild variant="secondary" size="sm">
                <Link href={`/p/${analytics.slug}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-3.5" />
                  <span>Open Live</span>
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Sub-nav across Publish & Share, Exports, and Analytics */}
        <nav
          aria-label="Project publishing, exports, and analytics"
          className="border-border/70 bg-sunken/80 inline-flex w-fit max-w-full flex-wrap items-center gap-1 rounded-full border p-1"
        >
          <Link
            href={`/projects/${analytics.projectId}/share`}
            className="text-muted-foreground hover:text-foreground type-body-s-strong inline-flex items-center gap-2 rounded-full px-4 py-2 transition-colors"
          >
            <Globe className="size-3.5" />
            <span>Publish &amp; Share</span>
          </Link>
          <Link
            href={`/projects/${analytics.projectId}/exports`}
            className="text-muted-foreground hover:text-foreground type-body-s-strong inline-flex items-center gap-2 rounded-full px-4 py-2 transition-colors"
          >
            <Download className="size-3.5" />
            <span>Exports (PNG / PDF / Behance)</span>
          </Link>
          <Link
            href={`/projects/${analytics.projectId}/analytics`}
            aria-current="page"
            className="bg-elevated text-foreground shadow-card type-body-s-strong inline-flex items-center gap-2 rounded-full px-4 py-2"
          >
            <BarChart3 className="text-primary size-3.5" />
            <span>Analytics</span>
          </Link>
        </nav>
      </div>

      {showUnpublishedEmptyState ? (
        /* Matches Figma 2:8745 "Analytics — Not published yet" */
        <section
          data-testid="analytics-unpublished-empty"
          className="border-border/80 bg-elevated shadow-card flex flex-col items-start gap-4 rounded-3xl border p-8 sm:p-14"
        >
          <div className="bg-accent text-primary flex size-14 items-center justify-center rounded-2xl">
            <Eye className="size-6" />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-foreground type-heading-l">No data yet</h2>
            <p className="text-muted-foreground type-body-m max-w-md">
              Analytics start once this case study is published.
            </p>
          </div>
          <Button asChild className="mt-1">
            <Link href={`/projects/${analytics.projectId}/share`}>Publish case study</Link>
          </Button>
        </section>
      ) : (
        <>
          {/* 4 KPI Cards (Matches Figma 2:8577) */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <article
              data-testid="analytics-kpi-views"
              className="border-border/80 bg-elevated shadow-card flex flex-col gap-2 rounded-3xl border p-6"
            >
              <span className="text-tertiary type-overline">VIEWS</span>
              <span
                data-testid="analytics-total-views-value"
                className="text-foreground type-display-m"
              >
                {analytics.kpis.views.toLocaleString()}
              </span>
              <span className="text-muted-foreground type-caption">
                {formatDeltaCopy(analytics.kpis.viewsDeltaPercent, "vs previous")}
              </span>
            </article>

            <article
              data-testid="analytics-kpi-visitors"
              className="border-border/80 bg-elevated shadow-card flex flex-col gap-2 rounded-3xl border p-6"
            >
              <span className="text-tertiary type-overline">UNIQUE VISITORS</span>
              <span
                data-testid="analytics-unique-visitors-value"
                className="text-foreground type-display-m"
              >
                {analytics.kpis.uniqueVisitors.toLocaleString()}
              </span>
              <span className="text-muted-foreground type-caption">
                {formatDeltaCopy(analytics.kpis.visitorsDeltaPercent, "vs previous")}
              </span>
            </article>

            <article
              data-testid="analytics-kpi-engagement"
              className="border-border/80 bg-elevated shadow-card flex flex-col gap-2 rounded-3xl border p-6"
            >
              <span className="text-tertiary type-overline">VIEWS PER VISITOR</span>
              <span className="text-foreground type-display-m">
                {analytics.kpis.viewsPerVisitor}×
              </span>
              <span className="text-muted-foreground type-caption">
                {analytics.kpis.topCountry
                  ? `Top location: ${analytics.kpis.topCountry}`
                  : "Global readership"}
              </span>
            </article>

            <article
              data-testid="analytics-kpi-exports"
              className="border-border/80 bg-elevated shadow-card flex flex-col gap-2 rounded-3xl border p-6"
            >
              <span className="text-tertiary type-overline">DOWNLOADS &amp; EXPORTS</span>
              <span className="text-foreground type-display-m">
                {analytics.kpis.completedExports.toLocaleString()}
              </span>
              <span className="text-muted-foreground type-caption">
                Completed PNG / PDF / Behance
              </span>
            </article>
          </div>

          {/* Views over time + Top sources (Matches Figma 2:8594) */}
          <div className="grid gap-6 lg:grid-cols-12">
            <section
              data-testid="analytics-views-chart-card"
              className="border-border/80 bg-elevated shadow-card flex flex-col justify-between gap-6 rounded-3xl border p-6 sm:p-8 lg:col-span-8"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-foreground type-heading-s">Views over time</h2>
                <span className="text-tertiary type-caption">
                  {analytics.range === "all" ? "All time" : `Last ${analytics.range}`} ·{" "}
                  {analytics.kpis.views.toLocaleString()} view
                  {analytics.kpis.views === 1 ? "" : "s"}
                </span>
              </div>

              <div className="flex flex-col gap-3">
                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  role="img"
                  aria-label={`Views over time bar chart showing ${analytics.kpis.views} total views`}
                  data-testid="analytics-views-svg"
                  className="h-52 w-full overflow-visible"
                >
                  {analytics.chartBuckets.map((bucket, index) => {
                    const x = index * (barWidth + gap);
                    const maxBarHeight = svgHeight - 28;
                    const activeHeight =
                      bucket.views > 0
                        ? Math.max(16, Math.round((bucket.views / maxBucketViews) * maxBarHeight))
                        : 4;
                    const y = svgHeight - activeHeight;

                    return (
                      <g key={`${bucket.dateKey}-${index}`}>
                        <title>{`${bucket.label}: ${bucket.views} view${bucket.views === 1 ? "" : "s"} (${bucket.uniqueVisitors} unique)`}</title>
                        <rect
                          x={x}
                          y={28}
                          width={barWidth}
                          height={maxBarHeight}
                          rx={6}
                          className="fill-sunken/70"
                        />
                        <rect
                          x={x}
                          y={y}
                          width={barWidth}
                          height={activeHeight}
                          rx={6}
                          data-testid="analytics-chart-bar"
                          data-date={bucket.dateKey}
                          data-views={bucket.views}
                          className={cn(
                            "transition-all",
                            bucket.views > 0 ? "fill-primary" : "fill-border",
                          )}
                        />
                        {bucket.views > 0 && (
                          <text
                            x={x + barWidth / 2}
                            y={Math.max(14, y - 6)}
                            textAnchor="middle"
                            className="fill-foreground type-caption"
                          >
                            {bucket.views}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>

                <div className="text-tertiary type-caption flex items-center justify-between gap-2 pt-1">
                  <span>{analytics.chartBuckets[0]?.label ?? ""}</span>
                  <span>
                    {
                      analytics.chartBuckets[Math.floor(analytics.chartBuckets.length / 2)]
                        ?.label ?? ""
                    }
                  </span>
                  <span>
                    {analytics.chartBuckets[analytics.chartBuckets.length - 1]?.label ?? ""}
                  </span>
                </div>
              </div>
            </section>

            <section
              data-testid="analytics-top-sources-card"
              className="border-border/80 bg-elevated shadow-card flex flex-col gap-5 rounded-3xl border p-6 sm:p-8 lg:col-span-4"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-foreground type-heading-s">Top sources</h2>
                <span className="text-tertiary type-caption">Share</span>
              </div>

              <div className="divide-border flex flex-col divide-y">
                {analytics.topSources.map((item) => (
                  <div
                    key={item.source}
                    data-testid="analytics-source-row"
                    data-source={item.source}
                    className="flex flex-col gap-2 py-3.5 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-foreground type-body-s truncate">{item.source}</span>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-tertiary type-caption">{item.views}</span>
                        <span className="text-foreground type-body-s-strong w-10 text-right">
                          {item.percentage}%
                        </span>
                      </div>
                    </div>
                    <div className="bg-sunken h-1.5 w-full overflow-hidden rounded-full">
                      <div
                        className="bg-primary h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, Math.max(0, item.percentage))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}

      <UpgradePromptDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        featureTitle="Unlock 90-day & all-time analytics"
        featureDescription="Free plans include 7-day and 30-day case study analytics. Upgrade to Casefolio Pro or Team for 90-day and full historical trends."
      />
    </div>
  );
}
