"use client";

import { ArchiveRestore, Copy, Download, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export interface RecoverySpaceSummary {
  spaceId: string;
  spaceName: string;
  formerTeamName: string;
  departedAtIso: string | null;
  recoveryUntilIso: string | null;
  projects: Array<{
    id: string;
    name: string;
    type: string;
    updatedAtIso: string;
  }>;
}

export interface RecoveryPortalClientProps {
  recoverySpaces: RecoverySpaceSummary[];
}

function formatDateLabel(iso: string | null): string {
  if (!iso) return "90-day retention window";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function RecoveryPortalClient({ recoverySpaces }: RecoveryPortalClientProps) {
  const router = useRouter();
  const [busyProjectId, setBusyProjectId] = useState<string | null>(null);
  const [copiedMap, setCopiedMap] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function handleCopyToPersonal(projectId: string, projectName: string) {
    setBusyProjectId(projectId);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const response = await fetch("/api/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "copy_to_personal",
          projectId,
        }),
      });
      const json = (await response.json()) as {
        ok: boolean;
        copiedProjectId?: string;
        error?: string;
      };
      if (!response.ok || !json.ok || !json.copiedProjectId) {
        setErrorMessage(
          json.error ??
            "Could not copy project to your Personal Workspace. Check your active project or storage quota.",
        );
        return;
      }
      setCopiedMap((prev) => ({ ...prev, [projectId]: json.copiedProjectId! }));
      setStatusMessage(
        `Copied "${projectName}" into your Personal Workspace as a private draft.`,
      );
      router.refresh();
    } catch {
      setErrorMessage("Network error while copying project to your Personal Workspace.");
    } finally {
      setBusyProjectId(null);
    }
  }

  async function handleDownloadPortabilityJson(projectId: string) {
    setBusyProjectId(projectId);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const response = await fetch("/api/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "export_portability",
          projectId,
        }),
      });
      const json = (await response.json()) as {
        ok: boolean;
        filename?: string;
        payload?: Record<string, unknown>;
        error?: string;
      };
      if (!response.ok || !json.ok || !json.payload) {
        setErrorMessage(json.error ?? "Could not generate portability JSON bundle.");
        return;
      }

      const blob = new Blob([JSON.stringify(json.payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = json.filename ?? "casefolio-project-portability.json";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setStatusMessage("Downloaded data-portability JSON archive.");
    } catch {
      setErrorMessage("Network error while downloading portability JSON.");
    } finally {
      setBusyProjectId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6" data-testid="recovery-portal-panel">
      <Card className="border-border/80 bg-surface/60 flex items-start gap-3 p-5">
        <ShieldCheck className="text-primary mt-0.5 size-5 shrink-0" />
        <div className="flex flex-col gap-1">
          <p className="text-foreground type-body-s-strong">
            Invisible to former team Owners &amp; Admins
          </p>
          <p className="text-muted-foreground type-caption">
            When you leave or are removed from a team workspace, any Private Spaces you controlled
            are sealed in read-only recovery mode for at least 90 days. Former team Owners, Admins,
            and members receive a strict 404 on these projects and cannot inspect or claim them.
          </p>
        </div>
      </Card>

      {errorMessage && (
        <p role="alert" className="text-destructive type-caption">
          {errorMessage}
        </p>
      )}
      {statusMessage && (
        <p role="status" className="text-success type-caption">
          {statusMessage}
        </p>
      )}

      {recoverySpaces.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 p-10 text-center">
          <div className="bg-surface border-border flex size-11 items-center justify-center rounded-2xl border">
            <ArchiveRestore className="text-muted-foreground size-5" />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="text-foreground type-heading-s">No departed-team private spaces</h3>
            <p className="text-muted-foreground type-body-s max-w-md">
              If you ever leave or are removed from a Casefolio Teams workspace, your private case
              study drafts appear here automatically for 90 days so you can copy them into your
              Personal Workspace or download a JSON archive.
            </p>
          </div>
        </Card>
      ) : (
        recoverySpaces.map((space) => (
          <Card key={space.spaceId} className="flex flex-col gap-4 p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-foreground type-heading-s">{space.spaceName}</h3>
                  <Badge tone="draft">Read-only recovery</Badge>
                </div>
                <p className="text-muted-foreground type-caption">
                  Former workspace:{" "}
                  <span className="text-foreground font-medium">{space.formerTeamName}</span> ·
                  Available until{" "}
                  <span className="text-foreground font-medium">
                    {formatDateLabel(space.recoveryUntilIso)}
                  </span>
                </p>
              </div>
              <Badge tone="neutral">{space.projects.length} private projects</Badge>
            </div>

            {space.projects.length === 0 ? (
              <p className="text-muted-foreground type-caption">
                This private space had no saved projects when your membership ended.
              </p>
            ) : (
              <div className="divide-border/70 border-border/80 bg-surface/40 divide-y rounded-2xl border">
                {space.projects.map((project) => {
                  const copiedId = copiedMap[project.id];
                  const isBusy = busyProjectId === project.id;
                  return (
                    <div
                      key={project.id}
                      className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-foreground type-body-s-strong">{project.name}</span>
                        <span className="text-muted-foreground type-caption">
                          {project.type.toUpperCase()} · Last updated{" "}
                          {formatDateLabel(project.updatedAtIso)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {copiedId ? (
                          <Button asChild size="sm" variant="secondary">
                            <Link href={`/editor/${copiedId}`}>Open personal copy</Link>
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            disabled={isBusy}
                            onClick={() => handleCopyToPersonal(project.id, project.name)}
                          >
                            <Copy className="size-3.5" />
                            Copy to Personal Workspace
                          </Button>
                        )}

                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={isBusy}
                          onClick={() => handleDownloadPortabilityJson(project.id)}
                        >
                          <Download className="size-3.5" />
                          Download JSON
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  );
}

