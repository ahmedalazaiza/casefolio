"use client";

import type { ProjectType } from "@casefolio/db";
import {
  AlertTriangle,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Monitor,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Share2,
  Smartphone,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteProjectAction,
  duplicateProjectAction,
  renameProjectAction,
} from "@/lib/projects/actions";
import type { DashboardProjectItem } from "@/lib/projects/dashboard-types";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "draft" | "published";
type TypeFilter = "all" | ProjectType;
type SortMode = "updated" | "created" | "name";

const EMPTY_STATE_HINTS = [
  {
    step: "01",
    title: "Pick a template",
    description: "Mobile app or Website, built by the Casefolio team.",
  },
  {
    step: "02",
    title: "Fill the slots",
    description: "Edit colours, fonts and text. Upload screenshots.",
  },
  {
    step: "03",
    title: "Publish or export",
    description: "Public page on Casefolio, or download PNG / PDF.",
  },
] as const;

const ARTWORK_PALETTES = [
  {
    surface: "bg-accent",
    glyph: "text-accent-foreground",
    leftBar: "bg-primary",
  },
  {
    surface: "bg-warning-soft",
    glyph: "text-warning",
    leftBar: "bg-warning",
  },
  {
    surface: "bg-[var(--tmpl-bg)]",
    glyph: "text-[var(--tmpl-primary)]",
    leftBar: "bg-[var(--tmpl-primary)]",
  },
  {
    surface: "bg-success-soft",
    glyph: "text-success",
    leftBar: "bg-success",
  },
] as const;

function formatProjectTypeLabel(type: ProjectType): string {
  if (type === "web") return "Website";
  if (type === "both") return "Mobile + Web";
  return "Mobile app";
}

function formatRelativeEdited(iso: string): string {
  const updatedMs = new Date(iso).getTime();
  if (Number.isNaN(updatedMs)) return "Edited recently";
  const diffSec = Math.max(0, Math.floor((Date.now() - updatedMs) / 1000));
  if (diffSec < 60) return "Edited just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Edited ${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `Edited ${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return "Edited yesterday";
  if (diffDays < 30) return `Edited ${diffDays} days ago`;
  return `Edited ${new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  })}`;
}

function resolveProjectStatusBadge(project: DashboardProjectItem): {
  label: string;
  tone: BadgeProps["tone"];
  isPublished: boolean;
} {
  if (project.visibility === "public" && project.publishedAtIso) {
    return { label: "Published", tone: "published", isPublished: true };
  }
  if (project.visibility === "unlisted" && project.publishedAtIso) {
    return { label: "Unlisted", tone: "accent", isPublished: true };
  }
  return { label: "Draft", tone: "draft", isPublished: false };
}

export interface DashboardProjectsClientProps {
  initialProjects: DashboardProjectItem[];
}

export function DashboardProjectsClient({ initialProjects }: DashboardProjectsClientProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<DashboardProjectItem[]>(initialProjects);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("updated");
  const [searchQuery, setSearchQuery] = useState("");

  // Rename modal state (Figma 2:2783)
  const [renameTarget, setRenameTarget] = useState<DashboardProjectItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  // Delete modal state (Figma 2:2980)
  const [deleteTarget, setDeleteTarget] = useState<DashboardProjectItem | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteExportsChecked, setDeleteExportsChecked] = useState(true);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Duplicate busy id
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const counts = useMemo(() => {
    let published = 0;
    let draft = 0;
    for (const proj of projects) {
      if (resolveProjectStatusBadge(proj).isPublished) {
        published += 1;
      } else {
        draft += 1;
      }
    }
    return { all: projects.length, published, draft };
  }, [projects]);

  const visibleProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return projects
      .filter((proj) => {
        const badge = resolveProjectStatusBadge(proj);
        if (statusFilter === "published" && !badge.isPublished) return false;
        if (statusFilter === "draft" && badge.isPublished) return false;
        if (typeFilter !== "all" && proj.type !== typeFilter) return false;
        if (q) {
          const hay = `${proj.name} ${proj.templateName} ${proj.slug ?? ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortMode === "name") {
          return a.name.localeCompare(b.name);
        }
        if (sortMode === "created") {
          return new Date(b.createdAtIso).getTime() - new Date(a.createdAtIso).getTime();
        }
        return new Date(b.updatedAtIso).getTime() - new Date(a.updatedAtIso).getTime();
      });
  }, [projects, searchQuery, sortMode, statusFilter, typeFilter]);

  function openRenameModal(project: DashboardProjectItem) {
    setRenameTarget(project);
    setRenameValue(project.name);
    setRenameError(null);
  }

  function openDeleteModal(project: DashboardProjectItem) {
    setDeleteTarget(project);
    setDeleteConfirmText("");
    setDeleteExportsChecked(true);
    setDeleteError(null);
  }

  async function handleRenameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!renameTarget) return;
    setRenameBusy(true);
    setRenameError(null);

    try {
      const res = await renameProjectAction({
        projectId: renameTarget.id,
        name: renameValue,
      });

      if (!res.ok) {
        setRenameError(res.error);
        return;
      }

      setProjects((prev) =>
        prev.map((item) =>
          item.id === res.projectId
            ? { ...item, name: res.name, updatedAtIso: res.updatedAtIso }
            : item,
        ),
      );
      toast.success(`Renamed to “${res.name}”`);
      setRenameTarget(null);
      router.refresh();
    } catch {
      setRenameError("Could not rename project. Please try again.");
    } finally {
      setRenameBusy(false);
    }
  }

  async function handleDuplicate(project: DashboardProjectItem) {
    setDuplicatingId(project.id);
    try {
      const res = await duplicateProjectAction({ projectId: project.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      setProjects((prev) => [res.project, ...prev]);
      toast.success(`Created “${res.project.name}”`);
      router.refresh();
    } catch {
      toast.error("Could not duplicate project.");
    } finally {
      setDuplicatingId(null);
    }
  }

  async function handleDeleteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError(null);

    try {
      const res = await deleteProjectAction({
        projectId: deleteTarget.id,
        confirmName: deleteConfirmText,
        deleteExports: deleteExportsChecked,
      });

      if (!res.ok) {
        setDeleteError(res.error);
        return;
      }

      const removedName = deleteTarget.name;
      setProjects((prev) => prev.filter((item) => item.id !== res.deletedProjectId));
      toast.success(`Deleted “${removedName}”`);
      setDeleteTarget(null);
      router.refresh();
    } catch {
      setDeleteError("Could not delete project. Please try again.");
    } finally {
      setDeleteBusy(false);
    }
  }

  function handleClearFilters() {
    setSearchQuery("");
    setStatusFilter("all");
    setTypeFilter("all");
  }

  // Empty state matching Figma 2:2172 1:1
  if (projects.length === 0) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-9">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2.5">
            <Eyebrow className="w-fit">Case Study Builder</Eyebrow>
            <h1 className="type-display-m sm:type-display-l text-foreground">Your case studies</h1>
            <p className="text-muted-foreground type-body-m">
              Turn finished projects into polished, publishable stories.
            </p>
          </div>

          <Button asChild size="lg" className="w-fit">
            <Link href="/new">
              <Plus className="size-4" />
              New project
            </Link>
          </Button>
        </header>

        <section
          data-testid="dashboard-empty-state"
          aria-labelledby="empty-dashboard-heading"
          className="border-border/80 bg-elevated shadow-card flex flex-col items-center justify-between gap-12 rounded-3xl border px-6 py-16 text-center sm:px-14 sm:py-20"
        >
          {/* Layered Aa card illustration matching Figma 2:2258 */}
          <div className="flex flex-col items-center gap-6">
            <div aria-hidden="true" className="relative flex h-44 w-64 items-center justify-center">
              <div className="bg-accent/80 absolute h-34 w-48 -rotate-4 rounded-2xl" />
              <div className="bg-sunken absolute h-34 w-48 translate-x-2 translate-y-1 rotate-3 rounded-2xl" />
              <div className="border-border/80 bg-elevated shadow-float relative flex h-34 w-48 flex-col justify-between rounded-2xl border p-5 text-left">
                <span className="text-accent-foreground type-display-m leading-none">Aa</span>
                <div className="flex flex-col gap-2">
                  <span className="bg-sunken block h-2 w-28 rounded-full" />
                  <span className="bg-sunken block h-2 w-18 rounded-full" />
                </div>
              </div>
            </div>

            <div className="flex max-w-lg flex-col gap-2.5">
              <h2 id="empty-dashboard-heading" className="text-foreground type-heading-l">
                Your first case study starts here
              </h2>
              <p className="text-muted-foreground type-body-m">
                Create a project, pick a Casefolio template and drop in your screens. Publish it on
                Casefolio or export it as PNG / PDF.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <Button size="lg" asChild>
                <Link href="/new">
                  <Plus className="size-4" />
                  Create your first project
                </Link>
              </Button>
              <Button variant="secondary" size="lg" asChild>
                <Link href="/templates">Browse templates</Link>
              </Button>
            </div>
          </div>

          {/* 3-step hint strip matching Figma 2:2280 */}
          <div className="grid w-full max-w-4xl grid-cols-1 gap-4 pt-2 text-left sm:grid-cols-3">
            {EMPTY_STATE_HINTS.map((hint) => (
              <div
                key={hint.step}
                className="border-border/70 bg-surface/70 flex flex-col gap-1.5 rounded-2xl border p-5"
              >
                <span className="text-primary type-overline font-mono">{hint.step}</span>
                <h3 className="text-foreground type-body-m-strong">{hint.title}</h3>
                <p className="text-muted-foreground type-body-s">{hint.description}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  // Populated dashboard matching Figma 2:2003, 2:2583, 2:3534, 2:3694
  const hasFilters =
    searchQuery.trim().length > 0 || statusFilter !== "all" || typeFilter !== "all";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      {/* Header + status segments + New project CTA (Figma 2:2076) */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2.5">
          <Eyebrow className="w-fit">Case Study Builder</Eyebrow>
          <h1 className="type-display-m sm:type-display-l text-foreground">Your case studies</h1>
          <p className="text-muted-foreground type-body-m">
            Turn finished projects into polished, publishable stories.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="Filter projects by status"
            className="border-border/70 bg-sunken/80 inline-flex items-center gap-1 rounded-full border p-1"
          >
            {(
              [
                { id: "all", label: `All · ${counts.all}` },
                { id: "draft", label: `Drafts · ${counts.draft}` },
                { id: "published", label: `Published · ${counts.published}` },
              ] as const
            ).map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setStatusFilter(tab.id)}
                  className={cn(
                    "type-body-s-strong focus-visible:ring-ring/40 rounded-full px-4 py-1.5 transition-all outline-none focus-visible:ring-2",
                    active
                      ? "bg-elevated text-foreground shadow-card"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <Button asChild size="lg">
            <Link href="/new">
              <Plus className="size-4" />
              New project
            </Link>
          </Button>
        </div>
      </header>

      {/* Search, type filter, sort & quick-create bar (Figma 2:3534) */}
      <div className="border-border/70 bg-elevated/85 shadow-card flex flex-col gap-3 rounded-3xl border p-3 backdrop-blur-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
          />
          <input
            type="search"
            aria-label="Search projects"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search projects…"
            className="border-border/80 bg-surface/80 text-foreground placeholder:text-muted-foreground focus-visible:ring-ring/40 type-body-s h-10 w-full rounded-full border pr-4 pl-10 transition-colors outline-none focus-visible:bg-elevated focus-visible:ring-2"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <label className="sr-only" htmlFor="dashboard-type-filter">
            Filter by project type
          </label>
          <select
            id="dashboard-type-filter"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
            className="border-border/80 bg-surface/80 text-foreground focus-visible:ring-ring/40 type-body-s h-10 rounded-full border px-4 outline-none focus-visible:ring-2"
          >
            <option value="all">Type: Any</option>
            <option value="mobile">Type: Mobile app</option>
            <option value="web">Type: Website</option>
            <option value="both">Type: Mobile + Web</option>
          </select>

          <label className="sr-only" htmlFor="dashboard-sort-select">
            Sort projects
          </label>
          <select
            id="dashboard-sort-select"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
            className="border-border/80 bg-surface/80 text-foreground focus-visible:ring-ring/40 type-body-s h-10 rounded-full border px-4 outline-none focus-visible:ring-2"
          >
            <option value="updated">Sort: Last edited</option>
            <option value="created">Sort: Newest</option>
            <option value="name">Sort: Name (A–Z)</option>
          </select>

          <div className="border-border/70 hidden items-center gap-1.5 border-l pl-3 xl:flex">
            <span className="text-muted-foreground type-caption">Quick create:</span>
            <Link
              href="/new?type=mobile"
              className="border-border/80 bg-surface hover:bg-elevated text-foreground type-caption inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 shadow-2xs transition-colors"
            >
              <Smartphone className="size-3" />
              Mobile
            </Link>
            <Link
              href="/new?type=web"
              className="border-border/80 bg-surface hover:bg-elevated text-foreground type-caption inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 shadow-2xs transition-colors"
            >
              <Monitor className="size-3" />
              Website
            </Link>
          </div>
        </div>
      </div>

      {searchQuery.trim() && visibleProjects.length > 0 && (
        <p className="text-muted-foreground type-body-s -mt-2">
          {visibleProjects.length} {visibleProjects.length === 1 ? "result" : "results"} for “
          {searchQuery.trim()}”
        </p>
      )}

      {/* No search results matching Figma 2:3694 */}
      {visibleProjects.length === 0 && hasFilters ? (
        <div
          data-testid="dashboard-no-results"
          className="border-border/80 bg-elevated shadow-card flex flex-col items-center justify-center gap-3.5 rounded-3xl border px-6 py-16 text-center"
        >
          <span
            aria-hidden="true"
            className="bg-sunken text-muted-foreground inline-flex size-14 items-center justify-center rounded-2xl"
          >
            <Search className="size-6" />
          </span>
          <h2 className="text-foreground type-heading-m">
            {searchQuery.trim()
              ? `No projects match “${searchQuery.trim()}”`
              : "No matching projects"}
          </h2>
          <p className="text-muted-foreground type-body-s">Try another name, or clear filters.</p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleClearFilters}
            className="mt-1"
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {visibleProjects.map((project, idx) => {
            const palette = ARTWORK_PALETTES[idx % ARTWORK_PALETTES.length]!;
            const badge = resolveProjectStatusBadge(project);
            const subtitle = `${formatProjectTypeLabel(project.type)} · ${formatRelativeEdited(project.updatedAtIso)}`;
            const isDuplicating = duplicatingId === project.id;

            return (
              <article
                key={project.id}
                data-slot="project-card"
                data-project-id={project.id}
                className="border-border/80 bg-elevated text-card-foreground shadow-card hover:border-border-strong hover:shadow-float group relative flex min-w-0 flex-col gap-3.5 rounded-3xl border p-3.5 transition-all duration-200 hover:-translate-y-0.5"
              >
                <Link
                  href={`/editor/${project.id}`}
                  aria-label={`Open ${project.name} in editor`}
                  className="focus-visible:ring-ring/40 block overflow-hidden rounded-2xl outline-none focus-visible:ring-2"
                >
                  <div
                    className={`relative h-48 w-full overflow-hidden rounded-2xl ${palette.surface}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`type-heading-l absolute top-5 left-5 select-none ${palette.glyph}`}
                    >
                      Aa
                    </span>
                    <div
                      aria-hidden="true"
                      className={`absolute right-34 bottom-0 h-32 w-24 rounded-t-xl transition-transform duration-300 group-hover:-translate-y-1 ${palette.leftBar}`}
                    />
                    <div
                      aria-hidden="true"
                      className="bg-elevated shadow-card border-border/60 absolute right-5 bottom-0 h-36 w-26 rounded-t-xl border border-b-0 transition-transform duration-300 group-hover:-translate-y-1.5"
                    />
                  </div>
                </Link>

                <div className="flex min-w-0 flex-col gap-1 px-1.5 pb-1.5">
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <Link
                      href={`/editor/${project.id}`}
                      className="text-foreground type-heading-s hover:text-primary min-w-0 truncate transition-colors"
                    >
                      {project.name}
                    </Link>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <Badge tone={badge.tone}>{badge.label}</Badge>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Actions for ${project.name}`}
                            disabled={isDuplicating}
                            className="text-muted-foreground hover:bg-surface hover:text-foreground focus-visible:ring-ring/40 inline-flex size-8 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2"
                          >
                            {isDuplicating ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="size-4" />
                            )}
                          </button>
                        </DropdownMenuTrigger>

                        {/* Context menu matching Figma 2:2583 */}
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem asChild>
                            <Link href={`/editor/${project.id}`}>
                              <ExternalLink className="size-4" />
                              <span>Open editor</span>
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => openRenameModal(project)}>
                            <Pencil className="size-4" />
                            <span>Rename</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={isDuplicating}
                            onSelect={() => void handleDuplicate(project)}
                          >
                            <Copy className="size-4" />
                            <span>Duplicate</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/projects/${project.id}/share`}>
                              <Share2 className="size-4" />
                              <span>Share &amp; publish</span>
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/projects/${project.id}/exports`}>
                              <Download className="size-4" />
                              <span>Exports</span>
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => openDeleteModal(project)}
                          >
                            <Trash2 className="size-4" />
                            <span>Delete</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <p className="text-muted-foreground type-body-s truncate">{subtitle}</p>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Rename modal matching Figma 2:2783 */}
      <Dialog
        open={Boolean(renameTarget)}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
            <DialogDescription>
              The public URL slug won’t change unless you edit it in Share settings.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRenameSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rename-project-input">Project name</Label>
              <Input
                id="rename-project-input"
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                required
                minLength={2}
                maxLength={120}
                autoFocus
              />
            </div>

            {renameError && (
              <p
                role="alert"
                className="border-destructive/30 bg-destructive-soft text-destructive type-body-s rounded-lg border px-3 py-2"
              >
                {renameError}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setRenameTarget(null)}
                disabled={renameBusy}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={renameBusy}>
                {renameBusy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save name"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation modal matching Figma 2:2980 */}
      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="bg-destructive-soft text-destructive inline-flex size-10 shrink-0 items-center justify-center rounded-lg"
              >
                <AlertTriangle className="size-5" />
              </span>
              <div className="flex flex-col gap-1">
                <DialogTitle>Delete “{deleteTarget?.name ?? "project"}”?</DialogTitle>
                <DialogDescription>
                  This also unpublishes its public page and removes uploaded images permanently.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleDeleteSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="delete-confirm-input">Type the project name to confirm</Label>
              <Input
                id="delete-confirm-input"
                value={deleteConfirmText}
                onChange={(event) => setDeleteConfirmText(event.target.value)}
                placeholder={deleteTarget?.name ?? ""}
                required
                autoFocus
              />
            </div>

            <label className="text-foreground type-body-s flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={deleteExportsChecked}
                onChange={(event) => setDeleteExportsChecked(event.target.checked)}
                className="accent-primary size-4 rounded-xs"
              />
              <span>Also delete exported files</span>
            </label>

            {deleteError && (
              <p
                role="alert"
                className="border-destructive/30 bg-destructive-soft text-destructive type-body-s rounded-lg border px-3 py-2"
              >
                {deleteError}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteBusy}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={
                  deleteBusy ||
                  deleteConfirmText.trim().toLowerCase() !==
                    (deleteTarget?.name ?? "").trim().toLowerCase()
                }
              >
                {deleteBusy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Deleting…
                  </>
                ) : (
                  "Delete project"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
