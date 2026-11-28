"use client";

import { Download, MessageSquareHeart, Star } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Select } from "@/components/ui/select";
import { formatRelativeActivity } from "@/lib/admin/users-types";
import type { AdminFeedbackOverview } from "@/lib/feedback/types";
import { cn } from "@/lib/utils";

export function AdminFeedbackPanel({
  overview,
}: {
  overview: AdminFeedbackOverview;
}) {
  const [starFilter, setStarFilter] = useState<number | "all">("all");
  const [triggerFilter, setTriggerFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return overview.entries.filter((entry) => {
      if (starFilter !== "all" && entry.rating !== starFilter) return false;
      if (triggerFilter !== "all" && entry.triggerMoment !== triggerFilter) return false;
      return true;
    });
  }, [overview.entries, starFilter, triggerFilter]);

  return (
    <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-1.5">
          <Eyebrow icon={<MessageSquareHeart className="size-3.5" />}>
            User Feedback &amp; Product Discovery
          </Eyebrow>
          <h1 className="text-foreground type-display-m">Customer Ratings &amp; Survey</h1>
          <p className="text-muted-foreground type-body-s max-w-2xl">
            5-star ratings and roadmap requests collected from users inside the studio after real milestone usage.
          </p>
        </div>

        <Button asChild variant="secondary">
          <a href="/api/admin/feedback?format=csv" download="casefolio-feedback-report.csv">
            <Download className="size-4" />
            <span>Export CSV</span>
          </a>
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="gap-2 p-5">
          <span className="text-muted-foreground type-caption">Average Rating</span>
          <div className="flex items-center gap-2">
            <span className="text-foreground type-display-s font-mono">
              {overview.averageRating !== null ? overview.averageRating.toFixed(2) : "—"}
            </span>
            <Star className="size-5 fill-amber-400 text-amber-400" />
          </div>
          <span className="text-muted-foreground type-caption">Out of 5.00 stars</span>
        </Card>

        <Card className="gap-2 p-5">
          <span className="text-muted-foreground type-caption">Total Responses</span>
          <span className="text-foreground type-display-s font-mono">
            {overview.totalResponses}
          </span>
          <span className="text-muted-foreground type-caption">Verified workspace users</span>
        </Card>

        <Card className="gap-2 p-5">
          <span className="text-muted-foreground type-caption">4–5★ Promoter Share</span>
          <span className="text-foreground type-display-s font-mono">
            {overview.promoterPercent}%
          </span>
          <span className="text-success type-caption">Positive satisfaction score</span>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="gap-4 p-6 lg:col-span-6">
          <h2 className="type-heading-s text-foreground">Star Rating Breakdown</h2>
          <div className="flex flex-col gap-3">
            {overview.distribution.map((row) => (
              <div key={row.stars} className="flex items-center gap-3">
                <span className="w-12 shrink-0 text-xs font-semibold text-[var(--cf-text-primary)]">
                  {row.stars} ★
                </span>
                <div className="bg-sunken h-2.5 flex-1 overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full bg-amber-400"
                    style={{ width: `${row.percent}%` }}
                  />
                </div>
                <span className="text-muted-foreground w-16 shrink-0 text-right font-mono text-xs">
                  {row.count} ({row.percent}%)
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="gap-4 p-6 lg:col-span-6">
          <h2 className="type-heading-s text-foreground">Top Feature Requests</h2>
          {overview.topFeatureRequests.length === 0 ? (
            <p className="text-muted-foreground type-body-s">No feature votes submitted yet.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {overview.topFeatureRequests.map((item) => (
                <div
                  key={item.feature}
                  className="flex items-center justify-between rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] px-3.5 py-2.5"
                >
                  <span className="text-foreground type-body-s-strong">{item.feature}</span>
                  <Badge tone="accent">{item.count} votes</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {(["all", 5, 4, 3, 2, 1] as const).map((s) => (
              <button
                key={String(s)}
                type="button"
                onClick={() => setStarFilter(s)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                  starFilter === s
                    ? "border-[var(--cf-royal)] bg-[var(--cf-royal)] text-[var(--cf-text-on-royal)]"
                    : "border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] text-[var(--cf-text-secondary)]",
                )}
              >
                {s === "all" ? "All ratings" : `${s} ★`}
              </button>
            ))}
          </div>

          <Select
            aria-label="Filter by trigger moment"
            value={triggerFilter}
            onChange={(e) => setTriggerFilter(e.target.value)}
            className="h-9 w-auto text-xs font-medium"
          >
            <option value="all">All trigger moments</option>
            <option value="first_publish">First publish</option>
            <option value="first_export">First export</option>
            <option value="milestone_usage">Milestone usage</option>
            <option value="manual">Manual sidebar button</option>
          </Select>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-border/70 border-b">
                <th className="text-tertiary type-overline py-2.5 pr-3">User</th>
                <th className="text-tertiary type-overline px-3 py-2.5">Rating &amp; Tags</th>
                <th className="text-tertiary type-overline px-3 py-2.5">Use Case &amp; Next Feature</th>
                <th className="text-tertiary type-overline px-3 py-2.5">Comment</th>
                <th className="text-tertiary type-overline py-2.5 pl-3 text-right">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-muted-foreground type-body-s py-8 text-center">
                    No feedback responses match the selected filter.
                  </td>
                </tr>
              ) : (
                filtered.map((entry) => (
                  <tr key={entry.id}>
                    <td className="py-3 pr-3 align-top">
                      <Link
                        href={`/admin/users/${entry.userId}`}
                        className="text-foreground hover:text-primary type-body-s-strong block hover:underline"
                      >
                        {entry.userName}
                      </Link>
                      <span className="text-muted-foreground type-caption block">
                        {entry.userEmail} · {entry.planTier.toUpperCase()}
                      </span>
                    </td>

                    <td className="px-3 py-3 align-top">
                      <div className="flex items-center gap-1 font-semibold text-xs text-[var(--cf-text-primary)]">
                        <Star className="size-3.5 fill-amber-400 text-amber-400" />
                        <span>{entry.rating} / 5</span>
                        <span className="text-muted-foreground font-normal">
                          · {entry.triggerMoment.replace("_", " ")}
                        </span>
                      </div>
                      {entry.sentimentTags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {entry.sentimentTags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-xs border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] px-1.5 py-0.5 text-[0.6875rem]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-3 align-top">
                      <span className="text-foreground type-caption block font-medium">
                        {entry.primaryUseCase ?? "—"}
                      </span>
                      {entry.topFeatureRequest && (
                        <span className="text-[var(--cf-royal-text)] type-caption block">
                          Next: {entry.topFeatureRequest}
                        </span>
                      )}
                    </td>

                    <td className="text-muted-foreground type-body-s max-w-xs px-3 py-3 align-top">
                      {entry.comment ?? "—"}
                    </td>

                    <td className="text-tertiary type-caption py-3 pl-3 text-right align-top">
                      {formatRelativeActivity(entry.createdAtIso)}
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
