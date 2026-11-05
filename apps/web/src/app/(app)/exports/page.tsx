import { desc, eq } from "@casefolio/db";
import { Download, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-foreground type-display-m">Exports</h1>
          <p className="text-muted-foreground type-body-s">
            Download past PNG, PDF, and Behance exports across all your case studies.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/dashboard">Go to Projects</Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="border-border bg-elevated flex flex-col items-center justify-center gap-3 rounded-2xl border py-16 text-center">
          <p className="text-foreground type-heading-s">No exports yet</p>
          <p className="text-muted-foreground type-body-s max-w-md">
            Open any project in the editor and click Export to generate PNG, PDF, or Behance
            presentations.
          </p>
          <Button asChild size="sm">
            <Link href="/dashboard">Browse Projects</Link>
          </Button>
        </div>
      ) : (
        <div className="border-border bg-elevated divide-border divide-y rounded-2xl border p-6">
          {rows.map(({ exportJob, projectName, projectId }) => {
            const preset = EXPORT_PRESETS.find((p) => p.format === exportJob.format);
            const downloadUrl =
              exportJob.status === "completed" && exportJob.r2Key
                ? `/api/exports/${exportJob.id}/download`
                : null;

            return (
              <div
                key={exportJob.id}
                className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-foreground type-body-m-strong">{projectName}</span>
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
                  <span className="text-tertiary type-caption">
                    {exportJob.createdAt.toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/projects/${projectId}/exports`}>
                      <ExternalLink className="size-3.5" />
                      <span>Project Exports</span>
                    </Link>
                  </Button>
                  {downloadUrl && (
                    <Button asChild variant="secondary" size="sm">
                      <a href={downloadUrl} download>
                        <Download className="size-3.5" />
                        <span>Download</span>
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
