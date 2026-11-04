"use client";

import {
  AlertCircle,
  Archive,
  ArrowLeft,
  CheckCircle2,
  GitBranchPlus,
  Globe,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { TemplatePuckRenderer } from "@/components/editor/puck-config";
import { Badge, ProBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { suggestNextMinorSemver } from "@/lib/template/semver";
import type {
  AdminTemplateDetail,
  CreateTemplateVersionResult,
  TemplateLifecycleActionResult,
} from "@/lib/template/types";
import { cn } from "@/lib/utils";

function formatProjectTypeLabel(type: AdminTemplateDetail["type"]): string {
  if (type === "mobile") return "Mobile app";
  if (type === "web") return "Website";
  return "Both";
}

export interface TemplateDetailClientProps {
  detail: AdminTemplateDetail;
  publishVersionAction: (payload: {
    templateId: string;
    versionId: string;
  }) => Promise<TemplateLifecycleActionResult>;
  archiveAction: (payload: { templateId: string }) => Promise<TemplateLifecycleActionResult>;
  unarchiveAction: (payload: { templateId: string }) => Promise<TemplateLifecycleActionResult>;
  createVersionAction: (payload: {
    templateId: string;
    version: string;
    changelog: string;
    rawJson: string;
    publishImmediately: boolean;
  }) => Promise<CreateTemplateVersionResult>;
}

export function TemplateDetailClient({
  detail,
  publishVersionAction,
  archiveAction,
  unarchiveAction,
  createVersionAction,
}: TemplateDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const initialSelectedId = detail.currentVersionId ?? detail.versions[0]?.id ?? "";
  const [selectedVersionId, setSelectedVersionId] = useState(initialSelectedId);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  const highestVersion = detail.versions[0]?.version ?? detail.currentVersion ?? "1.0.0";
  const [newVersionDialogOpen, setNewVersionDialogOpen] = useState(false);
  const [nextSemver, setNextSemver] = useState(() => suggestNextMinorSemver(highestVersion));
  const [nextChangelog, setNextChangelog] = useState("");
  const [nextRawJson, setNextRawJson] = useState(() => detail.versions[0]?.rawJson ?? "");
  const [publishImmediately, setPublishImmediately] = useState(false);
  const [versionModalError, setVersionModalError] = useState<string | null>(null);

  const selectedVersion = useMemo(
    () => detail.versions.find((v) => v.id === selectedVersionId) ?? detail.versions[0] ?? null,
    [detail.versions, selectedVersionId],
  );

  function handlePublishVersion(versionId: string) {
    setFeedbackError(null);
    setFeedbackSuccess(null);

    startTransition(async () => {
      const res = await publishVersionAction({
        templateId: detail.id,
        versionId,
      });
      if (!res.ok) {
        setFeedbackError(res.error);
        return;
      }
      setFeedbackSuccess("Template version published to the user library.");
      router.refresh();
    });
  }

  function handleArchive() {
    setFeedbackError(null);
    setFeedbackSuccess(null);

    startTransition(async () => {
      const res = await archiveAction({ templateId: detail.id });
      if (!res.ok) {
        setFeedbackError(res.error);
        return;
      }
      setFeedbackSuccess("Template archived and hidden from the user library.");
      router.refresh();
    });
  }

  function handleUnarchive() {
    setFeedbackError(null);
    setFeedbackSuccess(null);

    startTransition(async () => {
      const res = await unarchiveAction({ templateId: detail.id });
      if (!res.ok) {
        setFeedbackError(res.error);
        return;
      }
      setFeedbackSuccess("Template restored to Draft status.");
      router.refresh();
    });
  }

  function handleCreateNewVersion() {
    setVersionModalError(null);

    startTransition(async () => {
      const res = await createVersionAction({
        templateId: detail.id,
        version: nextSemver,
        changelog: nextChangelog,
        rawJson: nextRawJson,
        publishImmediately,
      });

      if (!res.ok) {
        const detailMsg = res.issues[0]?.message ?? res.error;
        setVersionModalError(detailMsg);
        return;
      }

      setNewVersionDialogOpen(false);
      setSelectedVersionId(res.versionId);
      setNextSemver(suggestNextMinorSemver(res.version));
      setNextChangelog("");
      setFeedbackSuccess(
        publishImmediately
          ? `Published new version v${res.version}.`
          : `Created draft version v${res.version}.`,
      );
      router.refresh();
    });
  }

  const isSelectedActivePublished =
    detail.status === "published" && selectedVersion?.id === detail.currentVersionId;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/templates">
            <ArrowLeft className="size-4" />
            All templates
          </Link>
        </Button>
      </div>

      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-foreground type-heading-l">{detail.name}</h1>
            <Badge
              tone={
                detail.status === "published"
                  ? "published"
                  : detail.status === "draft"
                    ? "draft"
                    : "neutral"
              }
            >
              {detail.status === "published"
                ? "Published"
                : detail.status === "draft"
                  ? "Draft"
                  : "Archived"}
            </Badge>
            {detail.tier === "pro" && <ProBadge />}
          </div>
          <p className="text-muted-foreground type-body-m">
            {formatProjectTypeLabel(detail.type)} ·{" "}
            {detail.currentVersion ? `v${detail.currentVersion}` : "No active version"} · Used in{" "}
            {detail.totalProjectCount} {detail.totalProjectCount === 1 ? "project" : "projects"}
            {detail.categoryName ? ` · ${detail.categoryName}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Dialog open={newVersionDialogOpen} onOpenChange={setNewVersionDialogOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="secondary">
                <GitBranchPlus className="size-4" />
                New version
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Upload new semantic version</DialogTitle>
                <DialogDescription>
                  Existing projects stay pinned to the version they started with.
                </DialogDescription>
              </DialogHeader>

              {versionModalError && (
                <div
                  role="alert"
                  className="border-destructive/30 bg-destructive-soft text-destructive type-body-s rounded-lg border p-3"
                >
                  {versionModalError}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="new-semver" className="text-foreground type-body-s-strong">
                    Semantic version *
                  </label>
                  <Input
                    id="new-semver"
                    value={nextSemver}
                    onChange={(event) => setNextSemver(event.target.value)}
                    placeholder="1.1.0"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="new-changelog" className="text-foreground type-body-s-strong">
                    Changelog
                  </label>
                  <Input
                    id="new-changelog"
                    value={nextChangelog}
                    onChange={(event) => setNextChangelog(event.target.value)}
                    placeholder="Refined gallery spacing and tokens"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="new-version-json" className="text-foreground type-body-s-strong">
                  Template JSON
                </label>
                <textarea
                  id="new-version-json"
                  rows={8}
                  value={nextRawJson}
                  onChange={(event) => setNextRawJson(event.target.value)}
                  className="border-input bg-background text-foreground type-body-s focus-visible:ring-ring/40 w-full rounded-lg border p-3 font-mono outline-none focus-visible:ring-2"
                />
              </div>

              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={publishImmediately}
                  onChange={(event) => setPublishImmediately(event.target.checked)}
                  className="size-4 rounded border"
                />
                <span className="text-foreground type-body-s">
                  Publish immediately as the active library version
                </span>
              </label>

              <DialogFooter>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setNewVersionDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="button" disabled={isPending} onClick={handleCreateNewVersion}>
                  {isPending ? "Saving..." : `Save v${nextSemver}`}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {detail.status === "archived" ? (
            <Button type="button" variant="secondary" disabled={isPending} onClick={handleUnarchive}>
              <RotateCcw className="size-4" />
              Restore to draft
            </Button>
          ) : (
            <Button type="button" variant="secondary" disabled={isPending} onClick={handleArchive}>
              <Archive className="size-4" />
              Archive
            </Button>
          )}

          {selectedVersion && (
            <Button
              type="button"
              disabled={isPending || isSelectedActivePublished}
              onClick={() => handlePublishVersion(selectedVersion.id)}
            >
              <Globe className="size-4" />
              {isSelectedActivePublished
                ? `Published (v${selectedVersion.version})`
                : `Publish v${selectedVersion.version}`}
            </Button>
          )}
        </div>
      </header>

      {feedbackError && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive-soft flex items-center gap-2.5 rounded-xl border p-4"
        >
          <AlertCircle className="text-destructive size-5 shrink-0" />
          <span className="text-destructive type-body-s-strong">{feedbackError}</span>
        </div>
      )}

      {feedbackSuccess && (
        <div
          role="status"
          className="border-success/30 bg-success-soft flex items-center gap-2.5 rounded-xl border p-4"
        >
          <CheckCircle2 className="text-success size-5 shrink-0" />
          <span className="text-foreground type-body-s-strong">{feedbackSuccess}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        <section className="border-border bg-card flex flex-col gap-4 rounded-xl border p-5 lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-foreground type-heading-s">
              Live preview {selectedVersion ? `· v${selectedVersion.version}` : ""}
            </h2>
            <span className="text-tertiary type-caption">
              Rendered via constrained Casefolio Puck config
            </span>
          </div>

          <div className="border-border max-h-[44rem] overflow-y-auto rounded-xl border">
            {selectedVersion?.document ? (
              <TemplatePuckRenderer document={selectedVersion.document} />
            ) : (
              <div className="text-muted-foreground type-body-s p-10 text-center">
                No valid template document found for this version.
              </div>
            )}
          </div>
        </section>

        <aside className="border-border bg-card flex flex-col justify-between gap-5 rounded-xl border p-6 lg:col-span-4">
          <div className="flex flex-col gap-4">
            <h2 className="text-foreground type-heading-s">Version history</h2>

            <ul className="flex flex-col gap-3">
              {detail.versions.map((ver) => {
                const isCurrent = ver.id === detail.currentVersionId;
                const isSelected = ver.id === selectedVersion?.id;
                return (
                  <li
                    key={ver.id}
                    className={cn(
                      "flex flex-col gap-2 rounded-lg border p-3.5 transition-colors",
                      isSelected
                        ? "border-primary bg-surface"
                        : "border-border bg-background hover:border-border-strong",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedVersionId(ver.id)}
                        className="text-foreground type-body-s-strong text-left font-mono"
                      >
                        v{ver.version}
                      </button>

                      <div className="flex items-center gap-1.5">
                        {isCurrent && detail.status === "published" && (
                          <Badge tone="published">Active</Badge>
                        )}
                        {isCurrent && detail.status === "draft" && (
                          <Badge tone="draft">Draft</Badge>
                        )}
                        {ver.pinnedProjectCount > 0 && (
                          <Badge tone="neutral" withDot={false}>
                            {ver.pinnedProjectCount} pinned
                          </Badge>
                        )}
                      </div>
                    </div>

                    {ver.changelog && (
                      <p className="text-muted-foreground type-body-s">{ver.changelog}</p>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-tertiary type-caption">
                        {new Date(ver.createdAtIso).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>

                      {!(isCurrent && detail.status === "published") && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          onClick={() => handlePublishVersion(ver.id)}
                        >
                          Publish v{ver.version}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="border-border text-tertiary type-caption border-t pt-4">
            Projects keep the version they started with; publishing a new version does not alter
            existing projects.
          </p>
        </aside>
      </div>
    </div>
  );
}
