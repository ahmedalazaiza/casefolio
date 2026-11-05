"use client";

import {
  AlertCircle,
  Archive,
  ArrowLeft,
  CheckCircle2,
  GitBranchPlus,
  Globe,
  RotateCcw,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { TemplatePuckRenderer } from "@/components/editor/puck-config";
import { Badge, ProBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  DeleteTemplateActionResult,
  TemplateLifecycleActionResult,
} from "@/lib/template/types";
import { cn } from "@/lib/utils";

const DETAIL_TABS = [
  { id: "preview", label: "Preview" },
  { id: "sections", label: "Sections" },
  { id: "slots", label: "Image slots" },
  { id: "style", label: "Style" },
  { id: "usage", label: "Usage" },
] as const;

type DetailTabId = (typeof DETAIL_TABS)[number]["id"];

function formatProjectTypeLabel(type: AdminTemplateDetail["type"]): string {
  if (type === "mobile") return "Mobile app";
  if (type === "web") return "Website";
  return "Mobile + Web";
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
  deleteAction?: (payload: {
    templateId: string;
    confirmName: string;
  }) => Promise<DeleteTemplateActionResult>;
}

export function TemplateDetailClient({
  detail,
  publishVersionAction,
  archiveAction,
  unarchiveAction,
  createVersionAction,
  deleteAction,
}: TemplateDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const initialSelectedId = detail.currentVersionId ?? detail.versions[0]?.id ?? "";
  const [selectedVersionId, setSelectedVersionId] = useState(initialSelectedId);
  const [activeTab, setActiveTab] = useState<DetailTabId>("preview");
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  const highestVersion = detail.versions[0]?.version ?? detail.currentVersion ?? "1.0.0";
  const [newVersionDialogOpen, setNewVersionDialogOpen] = useState(false);
  const [nextSemver, setNextSemver] = useState(() => suggestNextMinorSemver(highestVersion));
  const [nextChangelog, setNextChangelog] = useState("");
  const [nextRawJson, setNextRawJson] = useState(() => detail.versions[0]?.rawJson ?? "");
  const [publishImmediately, setPublishImmediately] = useState(false);
  const [versionModalError, setVersionModalError] = useState<string | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  function handleDeleteTemplate() {
    if (!deleteAction) return;
    setDeleteError(null);

    startTransition(async () => {
      const res = await deleteAction({
        templateId: detail.id,
        confirmName: deleteConfirmName,
      });
      if (!res.ok) {
        setDeleteError(res.error);
        return;
      }
      setDeleteDialogOpen(false);
      if (res.mode === "deleted") {
        router.push("/admin/templates");
        router.refresh();
      } else {
        setFeedbackSuccess("Template retired and archived; existing projects remain intact.");
        router.refresh();
      }
    });
  }

  const isSelectedActivePublished =
    detail.status === "published" && selectedVersion?.id === detail.currentVersionId;

  const doc = selectedVersion?.document ?? null;
  const slotEntries = useMemo(
    () => (doc ? Object.entries(doc.template.slots) : []),
    [doc],
  );
  const usedProjects = detail.usedInProjects ?? [];

  return (
    <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/templates">
            <ArrowLeft className="size-4" />
            All templates
          </Link>
        </Button>
      </div>

      {/* Page header (Figma 32:7992) */}
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-col gap-1.5">
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
          <p className="text-muted-foreground type-body-s">
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
                  className="border-input bg-background text-foreground type-mono-s focus-visible:ring-ring/40 w-full rounded-lg border p-3 outline-none focus-visible:ring-2"
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

          {deleteAction && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isPending}
              onClick={() => {
                setDeleteConfirmName("");
                setDeleteError(null);
                setDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="size-4" />
              Delete
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

      {/* Segmented tabs (Figma 32:8008) */}
      <div>
        <div
          role="tablist"
          aria-label="Template detail views"
          className="border-border bg-elevated inline-flex flex-wrap gap-1 rounded-full border p-1"
        >
          {DETAIL_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "focus-visible:ring-ring/40 rounded-full px-3.5 py-1.5 transition-colors outline-none focus-visible:ring-2",
                  active
                    ? "bg-primary text-primary-foreground type-caption"
                    : "text-muted-foreground hover:text-foreground type-caption",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

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

      {/* Two-column body (Figma 32:8019) */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card variant="flat" className="min-w-0 gap-4 p-5 lg:col-span-8">
          {activeTab === "preview" && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-foreground type-heading-s">
                  Live preview {selectedVersion ? `· v${selectedVersion.version}` : ""}
                </h2>
                <span className="text-tertiary type-caption">
                  Rendered via constrained Casefolio Puck config
                </span>
              </div>

              <div className="border-border max-h-176 overflow-y-auto rounded-xl border">
                {doc ? (
                  <TemplatePuckRenderer document={doc} />
                ) : (
                  <div className="text-muted-foreground type-body-s p-10 text-center">
                    No valid template document found for this version.
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === "sections" && (
            <>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-foreground type-heading-s">
                  Sections ({doc?.puck.content.length ?? 0})
                </h2>
                <Badge tone="neutral">Fixed constrained layout</Badge>
              </div>
              {doc ? (
                <div className="divide-border divide-y">
                  {doc.puck.content.map((block, idx) => {
                    const isHidden = Boolean(block.props.hidden);
                    return (
                      <div
                        key={block.props.id}
                        className="flex flex-wrap items-center justify-between gap-3 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-tertiary type-mono-s w-6">{idx + 1}.</span>
                          <div className="flex flex-col">
                            <span className="text-foreground type-body-s-strong">{block.type}</span>
                            <span className="text-tertiary type-mono-s">
                              {block.props.id} · bg:{block.props.background}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge tone={isHidden ? "neutral" : "published"}>
                            {isHidden ? "Hidden by default" : "Visible by default"}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground type-body-s">No sections available.</p>
              )}
            </>
          )}

          {activeTab === "slots" && (
            <>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-foreground type-heading-s">
                  Image slot definitions ({slotEntries.length})
                </h2>
                <span className="text-tertiary type-caption">Aspect ratios locked in editor</span>
              </div>
              {slotEntries.length === 0 ? (
                <p className="text-muted-foreground type-body-s">
                  No image slot definitions in this version.
                </p>
              ) : (
                <div className="w-full max-w-full overflow-x-auto">
                  <table className="w-full min-w-120 border-collapse text-left">
                    <thead>
                      <tr className="border-border border-b">
                        <th className="text-tertiary type-overline py-2 pr-4">Slot key</th>
                        <th className="text-tertiary type-overline px-4 py-2">Device frame</th>
                        <th className="text-tertiary type-overline px-4 py-2">Locked ratio</th>
                        <th className="text-tertiary type-overline py-2 pl-4 text-right">
                          Min width
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-border divide-y">
                      {slotEntries.map(([slotKey, slotDef]) => (
                        <tr key={slotKey}>
                          <td className="text-foreground type-mono-s py-3 pr-4">{slotKey}</td>
                          <td className="text-foreground type-body-s px-4 py-3 capitalize">
                            {slotDef.device ?? "none"}
                          </td>
                          <td className="px-4 py-3">
                            <Badge tone="accent">{slotDef.ratio}</Badge>
                          </td>
                          <td className="text-muted-foreground type-mono-s py-3 pl-4 text-right">
                            {slotDef.minWidth}px
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {activeTab === "style" && (
            <>
              <h2 className="text-foreground type-heading-s">Style token defaults</h2>
              {doc ? (
                <div className="flex flex-col gap-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="border-border bg-surface flex items-center justify-between rounded-lg border p-4">
                      <span className="text-muted-foreground type-caption">Heading font</span>
                      <span className="text-foreground type-body-s-strong">
                        {doc.template.theme.fonts.heading.family}
                      </span>
                    </div>
                    <div className="border-border bg-surface flex items-center justify-between rounded-lg border p-4">
                      <span className="text-muted-foreground type-caption">Body font</span>
                      <span className="text-foreground type-body-s-strong">
                        {doc.template.theme.fonts.body.family}
                      </span>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {Object.entries(doc.template.theme.colors).map(([tokenKey, value]) => (
                      <div
                        key={tokenKey}
                        className="border-border bg-surface flex items-center justify-between rounded-lg border p-3.5"
                      >
                        <span className="text-muted-foreground type-caption">{tokenKey}</span>
                        <span className="text-foreground type-mono-s">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground type-body-s">No theme tokens defined.</p>
              )}
            </>
          )}

          {activeTab === "usage" && (
            <>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-foreground type-heading-s">
                  Project usage ({detail.totalProjectCount})
                </h2>
                <Badge tone="neutral">
                  {usedProjects.length} recent{" "}
                  {usedProjects.length === 1 ? "project" : "projects"}
                </Badge>
              </div>
              {usedProjects.length === 0 ? (
                <p className="text-muted-foreground type-body-s py-6 text-center">
                  No designer projects have used this template yet.
                </p>
              ) : (
                <div className="w-full max-w-full overflow-x-auto">
                  <table className="w-full min-w-120 border-collapse text-left">
                    <thead>
                      <tr className="border-border border-b">
                        <th className="text-tertiary type-overline py-2 pr-4">Project</th>
                        <th className="text-tertiary type-overline px-4 py-2">Author</th>
                        <th className="text-tertiary type-overline px-4 py-2">Pinned version</th>
                        <th className="text-tertiary type-overline py-2 pl-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-border divide-y">
                      {usedProjects.map((proj) => (
                        <tr key={proj.id}>
                          <td className="py-3 pr-4">
                            {proj.visibility === "public" && proj.slug ? (
                              <Link
                                href={`/p/${proj.slug}`}
                                className="text-foreground hover:text-primary type-body-s-strong"
                              >
                                {proj.name}
                              </Link>
                            ) : (
                              <span className="text-foreground type-body-s-strong">
                                {proj.name}
                              </span>
                            )}
                          </td>
                          <td className="text-muted-foreground type-body-s px-4 py-3">
                            {proj.ownerName}
                          </td>
                          <td className="text-foreground type-mono-s px-4 py-3">
                            v{proj.version}
                          </td>
                          <td className="py-3 pl-4 text-right">
                            <Badge
                              tone={proj.visibility === "public" ? "published" : "neutral"}
                            >
                              {proj.visibility === "public" ? "Published" : proj.visibility}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </Card>

        <Card variant="flat" className="min-w-0 justify-between gap-5 p-6 lg:col-span-4">
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
                        className="text-foreground type-mono-s text-left font-medium"
                      >
                        v{ver.version}
                      </button>

                      <div className="flex items-center gap-1.5">
                        {isCurrent && detail.status === "published" && (
                          <Badge tone="published">Live</Badge>
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
        </Card>
      </div>

      {/* Delete confirm modal */}
      {deleteAction && (
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Delete “{detail.name}”?</DialogTitle>
              <DialogDescription>
                {detail.totalProjectCount > 0
                  ? `This template is used by ${detail.totalProjectCount} project${detail.totalProjectCount === 1 ? "" : "s"}. They keep working, but nobody can pick it again. This can’t be undone.`
                  : "This permanently deletes the template and all of its versions. This can’t be undone."}
              </DialogDescription>
            </DialogHeader>

            {deleteError && (
              <div
                role="alert"
                className="border-destructive/30 bg-destructive-soft text-destructive type-body-s rounded-lg border px-3 py-2"
              >
                {deleteError}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="detail-delete-confirm" className="text-foreground type-caption">
                Type <span className="type-body-s-strong">{detail.name}</span> to confirm
              </label>
              <Input
                id="detail-delete-confirm"
                value={deleteConfirmName}
                onChange={(event) => setDeleteConfirmName(event.target.value)}
                placeholder={detail.name}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={isPending || deleteConfirmName.trim() !== detail.name.trim()}
                onClick={handleDeleteTemplate}
              >
                {isPending ? "Deleting..." : "Delete template"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
