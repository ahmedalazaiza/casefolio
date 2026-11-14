import { desc, eq } from "@casefolio/db";
import { ArrowRight, Download, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Eyebrow } from "@/components/ui/eyebrow";
import { requireSession } from "@/lib/auth/session";
import { db, dbSchema } from "@/lib/db";
import { EXPORT_PRESETS } from "@/lib/exports/types";

export const dynamic = "force-dynamic";

export default async function WorkspaceExportsHistoryPage() {
  const { user } = await requireSession("/exports");

  const rows = await db
    .select({
      exportJob: dbSchema.exportsTable,
      projectName: dbSchema.projects.name,
      projectId: dbSchema.projects.id,
    })
    .from(dbSchema.exportsTable)
    .innerJoin(dbSchema.projects, eq(dbSchema.exportsTable.projectId, dbSchema.projects.id))
    .where(eq(dbSchema.projects.ownerId, user.id))
    .orderBy(desc(dbSchema.exportsTable.createdAt))
    .limit(50);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 sm:gap-8">
      <header className="v3-pattern-grid relative flex flex-wrap items-end justify-between gap-5 overflow-hidden rounded-2xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-6 sm:p-8">
        <div className="flex flex-col gap-2.5">
          <Eyebrow className="w-fit">
            Render Archive
          </Eyebrow>
          <h1 className="v3-display-l text-[var(--cf-text-primary)]">
            Studio exports
          </h1>
          <p className="max-w-xl text-sm text-[var(--cf-text-secondary)] sm:text-base">
            Download past PNG, PDF, and Behance 1440w exports across all your case studies.
          </p>
        </div>
        <Link href="/dashboard" className="v3-btn-secondary">
          <span>Go to Projects</span>
        </Link>
      </header>

      {rows.length === 0 ? (
        <div className="v3-pattern-dots-light flex flex-col items-center justify-center gap-5 rounded-2xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-6 py-20 text-center">
          <span className="inline-flex size-16 items-center justify-center rounded-xl bg-[var(--cf-royal)] text-[var(--cf-text-on-royal)]">
            <Download className="size-7" />
          </span>
          <div className="flex flex-col gap-2">
            <p className="v3-heading-m text-[var(--cf-text-primary)]">No exports yet</p>
            <p className="max-w-md text-sm leading-relaxed text-[var(--cf-text-secondary)]">
              Open any project in the editor and click Export to generate PNG, PDF, or Behance
              presentations.
            </p>
          </div>
          <Link href="/dashboard" className="v3-btn-primary mt-1">
            <span>Browse Projects</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[2rem] border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)]">
          <div className="flex items-center justify-between border-b border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] px-6 py-3">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-[var(--cf-ink)] px-2 py-0.5 font-mono text-[0.6875rem] font-bold text-[var(--cf-text-on-ink)] uppercase">
                QUEUE
              </span>
              <span className="font-mono text-[0.6875rem] font-semibold tracking-wider text-[var(--cf-text-tertiary)] uppercase">
                exports.casefolio.app
              </span>
            </div>
            <span className="rounded-md border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-2.5 py-0.5 font-mono text-[0.6875rem] font-bold text-[var(--cf-text-primary)]">
              {rows.length} rendered
            </span>
          </div>

          <div className="divide-y divide-[var(--cf-border-subtle)] px-6 py-2 sm:px-8">
            {rows.map(({ exportJob, projectName, projectId }, index) => {
              const preset = EXPORT_PRESETS.find((p) => p.format === exportJob.format);
              const downloadUrl =
                exportJob.status === "completed" && exportJob.r2Key
                  ? `/api/exports/${exportJob.id}/download`
                  : null;

              return (
                <div
                  key={exportJob.id}
                  className="flex flex-wrap items-center justify-between gap-4 py-4"
                >
                  <div className="flex items-start gap-3.5">
                    <span className="mt-0.5 rounded-lg bg-[var(--cf-royal-soft)] px-2 py-1 font-mono text-xs font-bold text-[var(--cf-royal-text)]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="v3-heading-s text-[var(--cf-text-primary)]">
                          {projectName}
                        </span>
                        <Badge tone="neutral" withDot={false}>
                          {preset?.label ?? exportJob.format}
                        </Badge>
                        <Badge
                          tone={
                            exportJob.status === "completed"
                              ? "published"
                              : exportJob.status === "failed"
                                ? "danger"
                                : "draft"
                          }
                        >
                          {exportJob.status === "completed" ? "Ready" : exportJob.status}
                        </Badge>
                      </div>
                      <span className="font-mono text-xs text-[var(--cf-text-secondary)]">
                        {exportJob.createdAt.toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/projects/${projectId}/exports`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] px-3.5 text-xs font-semibold text-[var(--cf-text-primary)] transition-colors hover:border-[var(--cf-royal-border)] hover:bg-[var(--cf-royal-soft)]"
                    >
                      <ExternalLink className="size-3.5 text-[var(--cf-royal-text)]" />
                      <span>Project Exports</span>
                    </Link>
                    {downloadUrl && (
                      <a
                        href={downloadUrl}
                        download
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[var(--cf-royal)] px-3.5 text-xs font-semibold text-[var(--cf-text-on-royal)] transition-all hover:-translate-y-0.5 hover:bg-[var(--cf-bg-action-hover)] hover:shadow-[var(--cf-shadow-hover)]"
                      >
                        <Download className="size-3.5 text-[var(--cf-bg-accent)]" />
                        <span>Download</span>
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

