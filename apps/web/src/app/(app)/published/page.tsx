import { ArrowRight, BarChart3, ExternalLink, Globe, Settings2 } from "lucide-react";
import Link from "next/link";
import { TemplateThumbnail } from "@/components/templates/template-thumbnail";
import { Badge } from "@/components/ui/badge";
import { Eyebrow } from "@/components/ui/eyebrow";
import { requireSession } from "@/lib/auth/session";
import { listDashboardProjectsForUser } from "@/lib/projects/dashboard";

export const dynamic = "force-dynamic";

export default async function WorkspacePublishedPagesList() {
  const { user, session } = await requireSession("/published");

  const workspaceProjects = await listDashboardProjectsForUser(
    user.id,
    session.activeOrganizationId ?? null,
    { includeArchived: false },
  );

  const liveProjects = workspaceProjects
    .filter(
      (project) =>
        (project.visibility === "public" || project.visibility === "unlisted") &&
        Boolean(project.publishedAtIso) &&
        Boolean(project.slug),
    )
    .sort((a, b) => {
      const aTime = a.publishedAtIso ? new Date(a.publishedAtIso).getTime() : 0;
      const bTime = b.publishedAtIso ? new Date(b.publishedAtIso).getTime() : 0;
      return bTime - aTime;
    });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-5">
      <header className="relative flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-1">
          <Eyebrow className="w-fit px-2.5 py-0.5 text-[0.6875rem]">
            Live Portfolio
          </Eyebrow>
          <h1 className="v3-dashboard-title text-[var(--cf-text-primary)]">
            Published case studies
          </h1>
          <p className="max-w-xl text-xs text-[var(--cf-text-secondary)] sm:text-sm">
            Manage live share links and discovery settings across your active workspace.
          </p>
        </div>
        <Link href="/dashboard" className="v3-btn-secondary h-9 px-3.5 py-2 text-xs font-semibold">
          <span>All Projects</span>
        </Link>
      </header>

      {liveProjects.length === 0 ? (
        <div className="v3-pattern-dots-light flex flex-col items-center justify-center gap-4 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-6 py-12 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-xl bg-[var(--cf-royal)] text-[var(--cf-text-on-royal)]">
            <Globe className="size-5" />
          </span>
          <div className="flex flex-col gap-1.5">
            <p className="v3-dashboard-section-title text-[var(--cf-text-primary)]">
              No published case studies yet
            </p>
            <p className="max-w-md text-xs leading-relaxed text-[var(--cf-text-secondary)] sm:text-sm">
              Open any project and click Publish to go live with a shareable /p/ link and OpenGraph
              social previews — or unlock custom /p/your-slug URLs on Pro &amp; Teams.
            </p>
          </div>
          <Link href="/dashboard" className="v3-btn-primary mt-0.5 h-9 px-4 py-2 text-xs font-semibold">
            <span>Go to Projects</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {liveProjects.map((project, index) => {
            const stepNum = String(index + 1).padStart(2, "0");
            return (
              <article
                key={project.id}
                className="flex flex-col overflow-hidden rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] transition-all hover:border-[var(--cf-royal)]"
              >
                <div className="flex items-center justify-between border-b border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] px-4 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="rounded border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-1.5 py-0.5 font-mono text-[0.65rem] font-bold text-[var(--cf-text-primary)]">
                      {stepNum}
                    </span>
                    <span className="truncate font-mono text-[0.6875rem] font-medium text-[var(--cf-text-secondary)]">
                      casefolio.app/p/{project.slug}
                    </span>
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-3.5 p-4 sm:p-5">
                  <div className="flex items-center gap-3.5">
                    <TemplateThumbnail
                      coverUrl={project.thumbnailUrl ?? project.templateCoverUrl ?? undefined}
                      slug={project.templateSlug}
                      name={project.name}
                      hideFallbackLabel
                      className="aspect-[16/10] w-24 shrink-0 overflow-hidden rounded-lg border border-[var(--cf-border-subtle)]"
                    />
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="v3-dashboard-card-title truncate text-[var(--cf-text-primary)]">
                          {project.name}
                        </span>
                        <Badge tone="published">
                          {project.visibility === "unlisted" ? "Unlisted" : "Public"}
                        </Badge>
                      </div>
                      <span className="font-mono text-xs text-[var(--cf-text-secondary)]">
                        {project.templateName}
                      </span>
                    </div>
                  </div>

                  <div className="mt-auto flex flex-wrap items-center justify-end gap-2 border-t border-[var(--cf-border-subtle)] pt-4">
                    <Link
                      href={`/projects/${project.id}/analytics`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] px-3.5 text-xs font-semibold text-[var(--cf-text-primary)] transition-colors hover:border-[var(--cf-royal)] hover:bg-[var(--cf-bg-surface)]"
                    >
                      <BarChart3 className="size-3.5 text-[var(--cf-royal-text)]" />
                      <span>Analytics</span>
                    </Link>
                    <Link
                      href={`/projects/${project.id}/share`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] px-3.5 text-xs font-semibold text-[var(--cf-text-primary)] transition-colors hover:border-[var(--cf-royal)] hover:bg-[var(--cf-bg-surface)]"
                    >
                      <Settings2 className="size-3.5 text-[var(--cf-royal-text)]" />
                      <span>Share Settings</span>
                    </Link>
                    <Link
                      href={`/p/${project.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[var(--cf-royal)] px-3.5 text-xs font-semibold text-[var(--cf-text-on-royal)] transition-all hover:bg-[var(--cf-bg-action-hover)]"
                    >
                      <ExternalLink className="size-3.5 text-[var(--cf-bg-accent)]" />
                      <span>Open Live</span>
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

