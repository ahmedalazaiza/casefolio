import type { Metadata } from "next";
import { BarChart3, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getWorkspaceAnalyticsOverview } from "@/lib/analytics/page-views";
import { requireSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Analytics — Casefolio",
};

function formatPublishedDate(iso: string | null): string {
  if (!iso) return "Draft";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function WorkspaceAnalyticsOverviewPage() {
  const { user } = await requireSession("/analytics");
  const overview = await getWorkspaceAnalyticsOverview(user.id);

  return (
    <div
      data-testid="workspace-analytics-overview"
      className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-8 px-2 py-4 sm:px-6 sm:py-8 lg:px-8"
    >
      {/* Page Header (Matches Figma 2:8707) */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-tertiary type-overline">ANALYTICS</span>
          <h1 className="text-foreground type-display-m">All published case studies</h1>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link href="/published">Manage Published Links</Link>
        </Button>
      </div>

      {/* 3 KPI Cards (Matches Figma 2:8711) */}
      <div className="grid gap-4 md:grid-cols-3">
        <article
          data-testid="overview-kpi-total-views"
          className="border-border bg-elevated flex flex-col gap-2 rounded-2xl border p-6"
        >
          <span className="text-tertiary type-overline">TOTAL VIEWS</span>
          <span
            data-testid="overview-total-views-value"
            className="text-foreground type-display-m"
          >
            {overview.totalViews30d.toLocaleString()}
          </span>
          <span className="text-muted-foreground type-caption">Last 30 days</span>
        </article>

        <article
          data-testid="overview-kpi-published"
          className="border-border bg-elevated flex flex-col gap-2 rounded-2xl border p-6"
        >
          <span className="text-tertiary type-overline">PUBLISHED</span>
          <span className="text-foreground type-display-m">{overview.publishedCount}</span>
          <span className="text-muted-foreground type-caption">
            of {overview.totalProjectsCount} project
            {overview.totalProjectsCount === 1 ? "" : "s"}
          </span>
        </article>

        <article
          data-testid="overview-kpi-top-page"
          className="border-border bg-elevated flex min-w-0 flex-col gap-2 rounded-2xl border p-6"
        >
          <span className="text-tertiary type-overline">TOP PAGE</span>
          <span className="text-foreground type-heading-l truncate">
            {overview.topPage ? overview.topPage.projectName : "—"}
          </span>
          <span className="text-muted-foreground type-caption">
            {overview.topPage
              ? `${overview.topPage.views30d.toLocaleString()} view${overview.topPage.views30d === 1 ? "" : "s"}`
              : "Publish a project to start tracking"}
          </span>
        </article>
      </div>

      {/* Case studies table (Matches Figma 2:8724) */}
      {overview.projects.length === 0 ? (
        <section className="border-border bg-elevated flex flex-col items-center justify-center gap-3 rounded-2xl border py-16 text-center">
          <BarChart3 className="text-tertiary size-7" />
          <h2 className="text-foreground type-heading-s">No case studies yet</h2>
          <p className="text-muted-foreground type-body-s max-w-md">
            Create and publish your first case study to track views, unique visitors, and top
            traffic sources.
          </p>
          <Button asChild size="sm">
            <Link href="/new">New case study</Link>
          </Button>
        </section>
      ) : (
        <section
          data-testid="overview-projects-table"
          className="border-border bg-elevated w-full max-w-full min-w-0 overflow-x-auto rounded-2xl border"
        >
          <table className="w-full min-w-[600px] border-collapse text-left">
            <thead>
              <tr className="border-border border-b">
                <th className="text-tertiary type-overline px-6 py-4">CASE STUDY</th>
                <th className="text-tertiary type-overline px-6 py-4">VIEWS</th>
                <th className="text-tertiary type-overline px-6 py-4">VISITORS</th>
                <th className="text-tertiary type-overline px-6 py-4">PUBLISHED</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {overview.projects.map((row) => (
                <tr
                  key={row.projectId}
                  data-testid="overview-project-row"
                  data-project-id={row.projectId}
                  className="hover:bg-surface/60 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Link
                        href={`/projects/${row.projectId}/analytics`}
                        className="text-foreground hover:text-primary type-body-m-strong transition-colors"
                      >
                        {row.projectName}
                      </Link>
                      {row.isPublished ? (
                        <Badge tone="published">
                          {row.visibility === "unlisted" ? "Unlisted" : "Public"}
                        </Badge>
                      ) : (
                        <Badge tone="draft">Draft</Badge>
                      )}
                      {row.isPublished && row.slug && (
                        <Link
                          href={`/p/${row.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open live page for ${row.projectName}`}
                          className="text-tertiary hover:text-foreground inline-flex items-center"
                        >
                          <ExternalLink className="size-3.5" />
                        </Link>
                      )}
                    </div>
                  </td>
                  <td className="text-foreground type-body-m px-6 py-4">
                    {row.views30d.toLocaleString()}
                  </td>
                  <td className="text-foreground type-body-m px-6 py-4">
                    {row.visitors30d.toLocaleString()}
                  </td>
                  <td className="text-muted-foreground type-body-s px-6 py-4">
                    {row.isPublished ? (
                      formatPublishedDate(row.publishedAtIso)
                    ) : (
                      <Link
                        href={`/projects/${row.projectId}/share`}
                        className="text-primary hover:underline"
                      >
                        Publish →
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
