import { ArrowRight, Download, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Eyebrow } from "@/components/ui/eyebrow";
import { requireSession } from "@/lib/auth/session";
import { listWorkspaceExportsHistoryForUser } from "@/lib/exports/service";
import { EXPORT_PRESETS } from "@/lib/exports/types";

export const dynamic = "force-dynamic";

export default async function WorkspaceExportsHistoryPage() {
  const { user, session } = await requireSession("/exports");
  const activeOrgId = session.activeOrganizationId ?? null;
  const rows = await listWorkspaceExportsHistoryForUser(user.id, activeOrgId);
  const now = new Date();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-5">
      <header className="relative flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-[0.5625rem] border border-[var(--cf-lp-card-border)] bg-[var(--cf-lp-card)] px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-1">
          <Eyebrow className="w-fit px-2.5 py-0.5 text-[0.6875rem]">Render Archive</Eyebrow>
          <h1 className="v3-dashboard-title text-[var(--cf-text-primary)]">Studio exports</h1>
          <p className="max-w-xl text-xs text-[var(--cf-text-secondary)] sm:text-sm">
            Download past Layerat full case study packs, PNG, and PDF exports across your active workspace.
          </p>
        </div>
        <Link href="/dashboard" className="v3-btn-secondary h-9 px-3.5 py-2 text-xs font-semibold">
          <span>Go to Projects</span>
        </Link>
      </header>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-[0.5625rem] border border-[var(--cf-lp-card-border)] bg-[var(--cf-lp-card)] px-6 py-12 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-[0.5rem] bg-[var(--cf-lp-dark)] text-[var(--cf-lp-lime)]">
            <Download className="size-5" />
          </span>
          <div className="flex flex-col gap-1.5">
            <p className="v3-dashboard-section-title text-[var(--cf-text-primary)]">No exports yet</p>
            <p className="max-w-md text-xs leading-relaxed text-[var(--cf-text-secondary)] sm:text-sm">
              Open any project in the editor and click Export to package your full case study for
              Layerat or generate PNG and PDF presentations.
            </p>
          </div>
          <Link href="/dashboard" className="v3-btn-primary mt-0.5 h-9 px-4 py-2 text-xs font-semibold">
            <span>Browse Projects</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[0.5625rem] border border-[var(--cf-lp-card-border)] bg-[var(--cf-lp-card)]">
          <div className="flex items-center justify-between border-b border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] px-5 py-2.5">
            <div className="flex items-center gap-2">
              <span className="rounded bg-[var(--cf-ink)] px-2 py-0.5 font-mono text-[0.65rem] font-bold text-[var(--cf-text-on-ink)] uppercase">
                QUEUE
              </span>
              <span className="font-mono text-[0.6875rem] font-semibold tracking-wider text-[var(--cf-text-tertiary)] uppercase">
                exports.casefolio.app
              </span>
            </div>
            <span className="rounded border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-2 py-0.5 font-mono text-[0.6875rem] font-bold text-[var(--cf-text-primary)]">
              {rows.length} rendered
            </span>
          </div>

          <div className="divide-y divide-[var(--cf-border-subtle)] px-5 py-1.5 sm:px-6">
            {rows.map(({ exportJob, projectName, projectId }, index) => {
              const preset = EXPORT_PRESETS.find((p) => p.format === exportJob.format);
              const isExpired = Boolean(
                exportJob.expiresAt && exportJob.expiresAt.getTime() <= now.getTime(),
              );
              const downloadUrl =
                exportJob.status === "completed" && exportJob.r2Key && !isExpired
                  ? `/api/exports/${exportJob.id}/download`
                  : null;

              return (
                <div
                  key={exportJob.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3.5"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 rounded-md bg-[var(--cf-royal-soft)] px-2 py-0.5 font-mono text-xs font-bold text-[var(--cf-royal-text)]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="v3-dashboard-card-title text-[var(--cf-text-primary)]">
                          {projectName}
                        </span>
                        <Badge tone="neutral" withDot={false}>
                          {preset?.label ?? exportJob.format}
                        </Badge>
                        {exportJob.status === "completed" && isExpired ? (
                          <Badge tone="neutral" withDot={false}>
                            Expired
                          </Badge>
                        ) : (
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
                        )}
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
                      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--cf-border-strong)] bg-[var(--cf-bg-elevated)] px-3.5 text-xs font-medium text-[var(--cf-text-primary)] transition-colors hover:bg-[var(--cf-bg-surface)]"
                    >
                      <ExternalLink className="size-3.5 text-[var(--cf-text-secondary)]" />
                      <span>Project Exports</span>
                    </Link>
                    {downloadUrl && (
                      <a
                        href={downloadUrl}
                        download
                        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--cf-lp-action)] px-4 text-xs font-medium text-[var(--cf-lp-on-action)] transition-all hover:bg-[var(--cf-lp-action-hover)]"
                      >
                        <Download className="size-3.5" />
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
