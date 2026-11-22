import type { Metadata } from "next";
import { ArrowRight, BarChart3, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Eyebrow } from "@/components/ui/eyebrow";
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
  const { user, session } = await requireSession("/analytics");
  const overview = await getWorkspaceAnalyticsOverview(
    user.id,
    new Date(),
    session.activeOrganizationId ?? null,
  );

  return (
    <div
      data-testid="workspace-analytics-overview"
      className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-4 sm:gap-5"
    >
      <header className="relative flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-1">
          <Eyebrow className="w-fit px-2.5 py-0.5 text-[0.6875rem]">
            {overview.workspaceKind === "team" && overview.workspaceName
              ? `Analytics · ${overview.workspaceName}`
              : "Analytics"}
          </Eyebrow>
          <h1 className="v3-dashboard-title text-[var(--cf-text-primary)]">
            All published case studies
          </h1>
          <p className="max-w-xl text-xs text-[var(--cf-text-secondary)] sm:text-sm">
            Privacy-first readership telemetry across your live portfolio links.
          </p>
        </div>
        <Link href="/published" className="v3-btn-secondary h-9 px-3.5 py-2 text-xs font-semibold">
          <span>Manage Published Links</span>
        </Link>
      </header>

      <div className="grid gap-3.5 md:grid-cols-3">
        <article
          data-testid="overview-kpi-total-views"
          className="v3-pattern-dots-dark v3-sheet-royal flex flex-col justify-between gap-2 rounded-xl border border-[var(--cf-border-on-royal)] p-4 sm:p-5"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[0.6875rem] font-bold tracking-wider text-[var(--cf-text-on-royal-muted)] uppercase">
              TOTAL VIEWS
            </span>
            <span className="rounded bg-[var(--cf-bg-accent)] px-1.5 py-0.5 font-mono text-[0.65rem] font-bold text-[var(--cf-text-on-accent)]">
              01
            </span>
          </div>
          <span
            data-testid="overview-total-views-value"
            className="v3-dashboard-stat text-[var(--cf-text-on-royal)]"
          >
            {overview.totalViews30d.toLocaleString()}
          </span>
          <span className="text-xs font-medium text-[var(--cf-text-on-royal-muted)]">
            Last 30 days
          </span>
        </article>

        <article
          data-testid="overview-kpi-published"
          className="flex flex-col justify-between gap-2 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-4 shadow-[var(--cf-shadow-soft)] sm:p-5"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[0.6875rem] font-bold tracking-wider text-[var(--cf-text-secondary)] uppercase">
              PUBLISHED
            </span>
            <span className="rounded bg-[var(--cf-royal-soft)] px-1.5 py-0.5 font-mono text-[0.65rem] font-bold text-[var(--cf-royal-text)]">
              02
            </span>
          </div>
          <span className="v3-dashboard-stat text-[var(--cf-text-primary)]">
            {overview.publishedCount}
          </span>
          <span className="text-xs font-medium text-[var(--cf-text-secondary)]">
            of {overview.totalProjectsCount} project
            {overview.totalProjectsCount === 1 ? "" : "s"}
          </span>
        </article>

        <article
          data-testid="overview-kpi-top-page"
          className="flex min-w-0 flex-col justify-between gap-2 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-4 shadow-[var(--cf-shadow-soft)] sm:p-5"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[0.6875rem] font-bold tracking-wider text-[var(--cf-text-secondary)] uppercase">
              TOP PAGE
            </span>
            <span className="rounded bg-[var(--cf-royal-soft)] px-1.5 py-0.5 font-mono text-[0.65rem] font-bold text-[var(--cf-royal-text)]">
              03
            </span>
          </div>
          <span className="v3-dashboard-section-title truncate text-[var(--cf-text-primary)]">
            {overview.topPage ? overview.topPage.projectName : "—"}
          </span>
          <span className="text-xs font-medium text-[var(--cf-text-secondary)]">
            {overview.topPage
              ? `${overview.topPage.views30d.toLocaleString()} view${overview.topPage.views30d === 1 ? "" : "s"}`
              : "Publish a project to start tracking"}
          </span>
        </article>
      </div>

      {overview.projects.length === 0 ? (
        <section className="v3-pattern-dots-light flex flex-col items-center justify-center gap-4 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-6 py-12 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-xl bg-[var(--cf-royal)] text-[var(--cf-text-on-royal)]">
            <BarChart3 className="size-5" />
          </span>
          <div className="flex flex-col gap-1.5">
            <h2 className="v3-dashboard-section-title text-[var(--cf-text-primary)]">
              No case studies yet
            </h2>
            <p className="max-w-md text-xs leading-relaxed text-[var(--cf-text-secondary)] sm:text-sm">
              Create and publish your first case study to track views, unique visitors, and top
              traffic sources.
            </p>
          </div>
          <Link href="/new" className="v3-btn-primary mt-0.5 h-9 px-4 py-2 text-xs font-semibold">
            <span>New case study</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </section>
      ) : (
        <section
          data-testid="overview-projects-table"
          className="w-full max-w-full min-w-0 overflow-x-auto rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)]"
        >
          <div className="flex items-center justify-between border-b border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] px-6 py-3">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-[var(--cf-royal)]" />
              <span className="size-2.5 rounded-full bg-[var(--cf-bg-accent)]" />
              <span className="ml-1 font-mono text-[0.6875rem] font-semibold tracking-wider text-[var(--cf-text-tertiary)] uppercase">
                analytics.casefolio.app/projects
              </span>
            </div>
            <span className="rounded-md bg-[var(--cf-royal-soft)] px-2.5 py-0.5 font-mono text-[0.6875rem] font-bold text-[var(--cf-royal-text)]">
              30-day window
            </span>
          </div>

          <table className="w-full min-w-[600px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)]/60">
                <th className="px-6 py-3.5 font-mono text-xs font-bold tracking-wider text-[var(--cf-text-secondary)] uppercase">
                  CASE STUDY
                </th>
                <th className="px-6 py-3.5 font-mono text-xs font-bold tracking-wider text-[var(--cf-text-secondary)] uppercase">
                  VIEWS
                </th>
                <th className="px-6 py-3.5 font-mono text-xs font-bold tracking-wider text-[var(--cf-text-secondary)] uppercase">
                  VISITORS
                </th>
                <th className="px-6 py-3.5 font-mono text-xs font-bold tracking-wider text-[var(--cf-text-secondary)] uppercase">
                  PUBLISHED
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--cf-border-subtle)]">
              {overview.projects.map((row) => (
                <tr
                  key={row.projectId}
                  data-testid="overview-project-row"
                  data-project-id={row.projectId}
                  className="transition-colors hover:bg-[var(--cf-bg-canvas)]"
                >
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Link
                        href={`/projects/${row.projectId}/analytics`}
                        className="font-semibold text-[var(--cf-text-primary)] transition-colors hover:text-[var(--cf-royal-text)]"
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
                          className="inline-flex items-center text-[var(--cf-text-tertiary)] hover:text-[var(--cf-royal-text)]"
                        >
                          <ExternalLink className="size-3.5" />
                        </Link>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-sm font-semibold text-[var(--cf-text-primary)]">
                    {row.views30d.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 font-mono text-sm font-semibold text-[var(--cf-text-primary)]">
                    {row.visitors30d.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--cf-text-secondary)]">
                    {row.isPublished ? (
                      formatPublishedDate(row.publishedAtIso)
                    ) : (
                      <Link
                        href={`/projects/${row.projectId}/share`}
                        className="font-semibold text-[var(--cf-royal-text)] hover:underline"
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
