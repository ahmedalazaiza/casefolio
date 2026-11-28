"use client";

import type { ProjectType } from "@casefolio/db";
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ArrowRight,
  ArrowUpRight,
  Copy,
  Download,
  ExternalLink,
  FolderInput,
  Lightbulb,
  Loader2,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Share2,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { UpgradePromptDialog } from "@/components/billing/upgrade-prompt-dialog";
import { TemplateThumbnail } from "@/components/templates/template-thumbnail";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  deleteProjectAction,
  duplicateProjectAction,
  renameProjectAction,
} from "@/lib/projects/actions";
import type { DashboardProjectItem } from "@/lib/projects/dashboard-types";
import { cn } from "@/lib/utils";
import type { WorkspaceSwitcherState } from "@/lib/workspaces/service";

type StatusFilter = "all" | "draft" | "published" | "archived";
type TypeFilter = "all" | ProjectType;
type SortMode = "updated" | "created" | "name";

const EMPTY_STATE_HINTS = [
  {
    step: "01",
    title: "Pick a template",
    description: "Mobile app, Website, or hybrid layouts crafted by the Casefolio team.",
  },
  {
    step: "02",
    title: "Fill the slots",
    description: "Customize colors, fonts, and copy, then drop screens into device frames.",
  },
  {
    step: "03",
    title: "Publish or export",
    description: "Share a live link on Casefolio or export your full case study to Layerat, PNG, and PDF.",
  },
] as const;

const ARTWORK_PALETTES = [
  {
    surface: "bg-[var(--cf-lp-lime)] text-[var(--cf-lp-on-lime)]",
    glyph: "text-[var(--cf-lp-on-lime)]",
    frameBg: "bg-[var(--cf-lp-card)] border-[var(--cf-lp-ink)] text-[var(--cf-lp-ink)]",
    tagline: "Tell the story behind the work.",
  },
  {
    surface: "bg-[var(--cf-lp-mauve)] text-[var(--cf-lp-mauve-ink)]",
    glyph: "text-[var(--cf-lp-mauve-ink)]",
    frameBg: "bg-[var(--cf-lp-dark)] border-[var(--cf-lp-dark-rule)] text-[var(--cf-lp-dark-ink)]",
    tagline: "Every decision, made clear.",
  },
  {
    surface: "bg-[var(--cf-lp-cobalt)] text-[var(--cf-lp-cream-elevated)]",
    glyph: "text-[var(--cf-lp-cream-elevated)]",
    frameBg: "bg-[var(--cf-lp-cobalt-tile)] border-[var(--cf-lp-cobalt-tile-border)] text-[var(--cf-lp-cream-elevated)]",
    tagline: "Built for mobile clarity.",
  },
  {
    surface: "bg-[var(--cf-lp-peach)] text-[var(--cf-lp-ink)]",
    glyph: "text-[var(--cf-lp-ink)]",
    frameBg: "bg-[var(--cf-lp-cream-elevated)] border-[var(--cf-lp-ink)] text-[var(--cf-lp-ink)]",
    tagline: "Objects for quiet focus.",
  },
] as const;

function formatProjectTypeLabel(type: ProjectType): string {
  if (type === "web") return "Website";
  if (type === "both") return "Mobile + Web";
  return "Mobile app";
}

function formatRelativeEdited(iso: string, nowMs: number | null): string {
  const parsed = new Date(iso);
  const updatedMs = parsed.getTime();
  if (Number.isNaN(updatedMs)) return "Edited recently";
  if (nowMs === null) {
    return `Edited ${parsed.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      timeZone: "UTC",
    })}`;
  }
  const diffSec = Math.max(0, Math.floor((nowMs - updatedMs) / 1000));
  if (diffSec < 60) return "Edited just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Edited ${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `Edited ${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return "Edited yesterday";
  if (diffDays < 30) return `Edited ${diffDays} days ago`;
  return `Edited ${parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  })}`;
}

function resolveProjectStatusBadge(project: DashboardProjectItem): {
  label: string;
  tone: BadgeProps["tone"];
  isPublished: boolean;
  isArchived: boolean;
} {
  if (project.archivedAtIso) {
    return { label: "Archived", tone: "neutral", isPublished: false, isArchived: true };
  }
  if (project.visibility === "public" && project.publishedAtIso) {
    return { label: "Published", tone: "published", isPublished: true, isArchived: false };
  }
  if (project.visibility === "unlisted" && project.publishedAtIso) {
    return { label: "Unlisted", tone: "accent", isPublished: true, isArchived: false };
  }
  return { label: "Draft", tone: "draft", isPublished: false, isArchived: false };
}

export interface DashboardProjectsClientProps {
  initialProjects: DashboardProjectItem[];
  workspaceContext?: WorkspaceSwitcherState;
  lifetimeProjectsCreated?: number;
  initialSpaceId?: string;
}

export function DashboardProjectsClient({
  initialProjects,
  workspaceContext,
  lifetimeProjectsCreated,
  initialSpaceId = "all",
}: DashboardProjectsClientProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<DashboardProjectItem[]>(initialProjects);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [spaceFilter, setSpaceFilter] = useState<string>(initialSpaceId || "all");
  const [sortMode, setSortMode] = useState<SortMode>("updated");
  const [searchQuery, setSearchQuery] = useState("");
  const [switchingWorkspace, setSwitchingWorkspace] = useState(false);

  useEffect(() => {
    setProjects(initialProjects);
  }, [initialProjects]);

  useEffect(() => {
    setSpaceFilter(initialSpaceId || "all");
  }, [initialSpaceId]);

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

  // Move Project between spaces modal state
  const [moveTarget, setMoveTarget] = useState<DashboardProjectItem | null>(null);
  const [destinationSpaceId, setDestinationSpaceId] = useState<string>("");
  const [moveConfirmed, setMoveConfirmed] = useState(false);
  const [moveBusy, setMoveBusy] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  // Busy action ID & downgrade upgrade modal
  const [busyProjectId, setBusyProjectId] = useState<string | null>(null);
  const [downgradeUpgradeOpen, setDowngradeUpgradeOpen] = useState(false);
  const [deletedInSessionCount, setDeletedInSessionCount] = useState(0);

  const lockedByDowngradeCount = useMemo(
    () => projects.filter((p) => p.isLockedByDowngrade && !p.archivedAtIso).length,
    [projects],
  );

  const activeWorkspace = workspaceContext?.activeWorkspace ?? null;
  const spaces = workspaceContext?.spaces ?? [];
  const selectedSpaceObj = spaces.find((s) => s.id === spaceFilter) ?? null;

  const counts = useMemo(() => {
    let activeAll = 0;
    let published = 0;
    let draft = 0;
    let archived = 0;
    for (const proj of projects) {
      if (spaceFilter !== "all" && proj.spaceId !== spaceFilter) continue;
      const badge = resolveProjectStatusBadge(proj);
      if (badge.isArchived) {
        archived += 1;
      } else {
        activeAll += 1;
        if (badge.isPublished) {
          published += 1;
        } else {
          draft += 1;
        }
      }
    }
    return { all: activeAll, published, draft, archived };
  }, [projects, spaceFilter]);

  const visibleProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return projects
      .filter((proj) => {
        if (spaceFilter !== "all" && proj.spaceId !== spaceFilter) return false;
        const badge = resolveProjectStatusBadge(proj);
        if (statusFilter === "archived") {
          if (!badge.isArchived) return false;
        } else {
          if (badge.isArchived) return false;
          if (statusFilter === "published" && !badge.isPublished) return false;
          if (statusFilter === "draft" && badge.isPublished) return false;
        }
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
  }, [projects, searchQuery, sortMode, spaceFilter, statusFilter, typeFilter]);

  const [mountedNowMs, setMountedNowMs] = useState<number | null>(null);
  useEffect(() => {
    setMountedNowMs(Date.now());
  }, []);

  async function handleSwitchWorkspace(nextOrgId: string | null) {
    setSwitchingWorkspace(true);
    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: nextOrgId }),
      });
      const json = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !json.ok) {
        toast.error(json.error ?? "Could not switch workspace.");
        return;
      }
      setSpaceFilter("all");
      router.refresh();
    } catch {
      toast.error("Network error while switching workspace.");
    } finally {
      setSwitchingWorkspace(false);
    }
  }

  function openMoveModal(project: DashboardProjectItem) {
    const candidate = spaces.find((s) => s.id !== project.spaceId);
    setMoveTarget(project);
    setDestinationSpaceId(candidate?.id ?? "");
    setMoveConfirmed(false);
    setMoveError(null);
  }

  async function handleMoveProjectSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!moveTarget || !destinationSpaceId) return;
    setMoveBusy(true);
    setMoveError(null);
    try {
      const response = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "move_project",
          projectId: moveTarget.id,
          destinationSpaceId,
          confirmed: moveConfirmed,
        }),
      });
      const json = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !json.ok) {
        setMoveError(json.error ?? "Could not move project.");
        return;
      }
      toast.success("Moved project to selected space");
      setMoveTarget(null);
      router.refresh();
    } catch {
      setMoveError("Network error while moving project.");
    } finally {
      setMoveBusy(false);
    }
  }

  async function handleArchiveToggle(project: DashboardProjectItem) {
    const isArchived = Boolean(project.archivedAtIso);
    setBusyProjectId(project.id);
    try {
      const response = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: isArchived ? "unarchive_project" : "archive_project",
          projectId: project.id,
        }),
      });
      const json = (await response.json()) as {
        ok: boolean;
        archivedAtIso?: string | null;
        error?: string;
      };
      if (!response.ok || !json.ok) {
        toast.error(json.error ?? "Could not update project archive status.");
        return;
      }
      setProjects((prev) =>
        prev.map((item) =>
          item.id === project.id
            ? {
                ...item,
                archivedAtIso: isArchived ? null : (json.archivedAtIso ?? new Date().toISOString()),
                visibility: isArchived ? item.visibility : "private",
                publishedAtIso: isArchived ? item.publishedAtIso : null,
              }
            : item,
        ),
      );
      const isFreeWorkspace = (activeWorkspace?.plan ?? "free") === "free";
      toast.success(
        isArchived
          ? `Restored “${project.name}” to active drafts`
          : isFreeWorkspace
            ? `Archived “${project.name}” (archiving on Free does not grant an extra lifetime Case Study credit)`
            : `Archived “${project.name}” (frees an active project slot)`,
      );
      router.refresh();
    } catch {
      toast.error("Network error while updating archive state.");
    } finally {
      setBusyProjectId(null);
    }
  }

  async function handleCopyToPersonal(project: DashboardProjectItem) {
    setBusyProjectId(project.id);
    try {
      const response = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "copy_project",
          projectId: project.id,
        }),
      });
      const json = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !json.ok) {
        toast.error(json.error ?? "Could not copy project to Personal Workspace.");
        return;
      }
      toast.success(`Copied “${project.name}” to your Personal Workspace`);
      router.refresh();
    } catch {
      toast.error("Network error while copying project.");
    } finally {
      setBusyProjectId(null);
    }
  }

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
    setBusyProjectId(project.id);
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
      setBusyProjectId(null);
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
      setDeletedInSessionCount((prev) => prev + 1);
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
    if (spaceFilter !== "all") {
      setSpaceFilter("all");
      void fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "select_space", spaceId: "all" }),
      })
        .then(() => router.refresh())
        .catch(() => {});
    }
  }

  const workspaceBar = workspaceContext && activeWorkspace && (
    <>
      {/* Visually hidden select retained for E2E automation while UI workspace & space switcher live in Top Navbar */}
      <div className="sr-only top-0 left-0">
        <label htmlFor="dashboard-workspace-select">Active workspace</label>
        <select
          id="dashboard-workspace-select"
          data-testid="dashboard-workspace-select"
          className="sr-only"
          disabled={switchingWorkspace || mountedNowMs === null}
          value={activeWorkspace.organizationId ?? "personal"}
          onChange={(e) =>
            handleSwitchWorkspace(e.target.value === "personal" ? null : e.target.value)
          }
        >
          {workspaceContext.workspaces.map((ws) => (
            <option key={ws.workspaceId} value={ws.organizationId ?? "personal"}>
              {ws.kind === "personal"
                ? `Personal Workspace (${ws.plan.toUpperCase()})`
                : ws.plan === "team" || ws.plan === "plus"
                  ? `${ws.name} · Teams (${ws.paidSeats} ${ws.paidSeats === 1 ? "seat" : "seats"})`
                  : `${ws.name} · Team (Unfunded)`}
            </option>
          ))}
        </select>
      </div>

      {(workspaceContext.recoverySpacesCount > 0 || activeWorkspace.isFrozen) && (
        <div className="flex flex-col gap-3">
          {workspaceContext.recoverySpacesCount > 0 && (
            <div
              data-testid="dashboard-recovery-banner"
              className="border-primary/30 bg-accent/40 flex flex-col justify-between gap-3 rounded-xl border p-4 sm:flex-row sm:items-center"
            >
              <div className="flex items-center gap-2.5">
                <ArchiveRestore className="text-primary size-4 shrink-0" />
                <p className="text-foreground type-body-s">
                  You have{" "}
                  <span className="font-semibold">{workspaceContext.recoverySpacesCount}</span>{" "}
                  departed-team private{" "}
                  {workspaceContext.recoverySpacesCount === 1 ? "space" : "spaces"} available in
                  your 90-day Recovery Portal.
                </p>
              </div>
              <Button asChild size="sm" variant="secondary">
                <Link href="/account/recovery">Open Recovery Portal</Link>
              </Button>
            </div>
          )}

          {activeWorkspace.isFrozen && (
            <div
              role="alert"
              data-testid="dashboard-frozen-banner"
              className="border-destructive/40 bg-destructive-soft text-foreground flex flex-col justify-between gap-3 rounded-xl border p-4 sm:flex-row sm:items-center"
            >
              <div className="flex items-start gap-2.5">
                <Lock className="text-destructive mt-0.5 size-4 shrink-0" />
                <div className="flex flex-col gap-0.5">
                  <p className="type-body-s-strong">
                    Team workspace locked (
                    {activeWorkspace.frozenReason === "past_due_over_10_days" ||
                    activeWorkspace.frozenReason === "past_due_over_7_days" ||
                    activeWorkspace.frozenReason === "past_due_expired"
                      ? "10-day renewal grace ended"
                      : "Team subscription ended"}
                    )
                  </p>
                  <p className="text-muted-foreground type-caption">
                    Opening, editing, publishing, and exporting Team projects is locked until the
                    Team Owner renews Teams. Each member still keeps 1 Case Study in their Personal
                    Workspace.
                  </p>
                </div>
              </div>
              <Button asChild size="sm" variant="secondary">
                <Link href="/account/billing">Manage billing</Link>
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );

  const createProjectHref =
    spaceFilter !== "all" ? `/new?spaceId=${encodeURIComponent(spaceFilter)}` : "/new";

  const spaceDialogs = (
    <Dialog
      open={Boolean(moveTarget)}
      onOpenChange={(open) => {
        if (!open) setMoveTarget(null);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Move “{moveTarget?.name ?? "project"}”</DialogTitle>
          <DialogDescription>
            Choose a destination space in this workspace. Moving between Private and Shared spaces
            updates teammate visibility immediately.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleMoveProjectSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="move-destination-space-select">Destination space</Label>
            <Select
              id="move-destination-space-select"
              value={destinationSpaceId}
              onChange={(e) => setDestinationSpaceId(e.target.value)}
            >
              {spaces
                .filter((sp) => sp.id !== moveTarget?.spaceId)
                .map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.name} ({sp.visibility === "private" ? "Private" : "Shared"})
                  </option>
                ))}
            </Select>
          </div>

          <label className="text-foreground type-body-s flex items-start gap-2.5">
            <input
              type="checkbox"
              checked={moveConfirmed}
              onChange={(e) => setMoveConfirmed(e.target.checked)}
              className="accent-primary mt-1 size-4 rounded-xs"
            />
            <span>Confirm moving this project and updating its space permissions.</span>
          </label>

          {moveError && (
            <p role="alert" className="text-destructive type-caption">
              {moveError}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setMoveTarget(null)}
              disabled={moveBusy}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={moveBusy || !destinationSpaceId || !moveConfirmed}
            >
              {moveBusy ? "Moving…" : "Move project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  const effectiveLifetimeProjectsCreated = Math.max(
    lifetimeProjectsCreated ?? activeWorkspace?.usage.lifetimeProjectsCreated ?? 0,
    projects.length + deletedInSessionCount,
  );
  const isFreeLifetimeCreditExhausted =
    (activeWorkspace?.plan ?? "free") === "free" && effectiveLifetimeProjectsCreated >= 1;

  // Empty state — Studio Stage + Numbered Bento Steps
  if (projects.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-4 sm:gap-5">
        {workspaceBar}

        {isFreeLifetimeCreditExhausted && (
          <div
            role="status"
            data-testid="dashboard-free-lifetime-used-banner"
            className="border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] text-foreground flex flex-col justify-between gap-4 rounded-xl border p-3.5 sm:flex-row sm:items-center"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" />
              <div className="flex flex-col gap-0.5">
                <span className="type-body-s-strong">
                  1 of 1 lifetime Free Case Study credit used
                </span>
                <span className="text-muted-foreground type-caption">
                  Deleting a project on Free does not restore your lifetime credit. Upgrade to
                  Casefolio Pro ($7.99/mo · 2 months free on annual) for up to 10 rotatable Case
                  Studies, custom URLs, and watermark-free exports.
                </span>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              data-testid="empty-lifetime-upgrade-btn"
              onClick={() => setDowngradeUpgradeOpen(true)}
            >
              <Sparkles className="size-3.5" />
              Upgrade to Pro — $7.99/mo
            </Button>
          </div>
        )}

        <header className="flex flex-col gap-2 py-2">
          <p className="cf-lp-kicker text-[var(--cf-lp-kicker-muted)]">
            YOUR STUDIO &nbsp;/&nbsp; CASEFOLIO
          </p>
          <h1 className="font-editorial text-[2.25rem] leading-[0.96] font-normal tracking-[-0.045em] text-[var(--cf-lp-ink)] sm:text-[3.25rem]">
            Make your work <span className="italic">worth remembering.</span>
          </h1>
          <p className="max-w-lg text-[0.875rem] text-[var(--cf-lp-subtle)]">
            Turn finished products into polished, publishable stories.
          </p>
        </header>

        <section
          data-testid="dashboard-empty-state"
          aria-labelledby="empty-dashboard-heading"
          className="flex flex-col items-center justify-between gap-7 rounded-[0.5625rem] border border-[var(--cf-lp-card-border)] bg-[var(--cf-lp-card)] px-5 py-9 text-center sm:px-10 sm:py-11"
        >
          <div className="flex flex-col items-center gap-4">
            <div aria-hidden="true" className="grid w-full max-w-64 grid-cols-3 gap-2">
              <div className="flex h-20 flex-col justify-between rounded-[0.5rem] border border-[var(--cf-lp-card-border)] bg-[var(--cf-bg-surface)] p-2.5 text-left">
                <span className="font-mono text-[0.6875rem] font-medium text-[var(--cf-lp-subtle)]">
                  01
                </span>
                <span className="font-editorial text-[0.875rem] text-[var(--cf-lp-ink)]">
                  Template
                </span>
              </div>
              <div className="flex h-20 flex-col justify-between rounded-[0.5rem] bg-[var(--cf-lp-lime)] p-2.5 text-left text-[var(--cf-lp-on-lime)]">
                <span className="font-mono text-[0.6875rem] font-medium opacity-75">
                  02
                </span>
                <span className="font-editorial text-[0.875rem]">Screens</span>
              </div>
              <div className="flex h-20 flex-col justify-between rounded-[0.5rem] bg-[var(--cf-lp-dark)] p-2.5 text-left text-[var(--cf-lp-dark-ink)]">
                <span className="font-mono text-[0.6875rem] font-medium text-[var(--cf-lp-lime)]">
                  03
                </span>
                <span className="font-editorial text-[0.875rem]">Publish</span>
              </div>
            </div>

            <div className="flex max-w-md flex-col gap-1.5">
              <h2
                id="empty-dashboard-heading"
                className="v3-dashboard-section-title text-[var(--cf-lp-ink)]"
              >
                Your first case study starts here
              </h2>
              <p className="text-[0.8125rem] leading-relaxed text-[var(--cf-lp-subtle)]">
                Create a project, pick a curated Casefolio template, and drop in your screens.
                Publish a live link or export high-resolution PNG and PDF files.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-0.5">
              <Link
                href={createProjectHref}
                className="v3-btn-primary h-10 px-4 py-2 text-xs font-semibold"
              >
                <Plus className="size-3.5" />
                <span>Create your first project</span>
              </Link>
              <Link
                href="/templates"
                className="v3-btn-secondary h-10 px-4 py-2 text-xs font-semibold"
              >
                Browse templates
              </Link>
            </div>
          </div>

          <div className="grid w-full max-w-4xl grid-cols-1 gap-3 text-left sm:grid-cols-3">
            {EMPTY_STATE_HINTS.map((hint) => (
              <div
                key={hint.step}
                className="flex flex-col gap-2 rounded-[0.5625rem] border border-[var(--cf-lp-card-border)] bg-[var(--cf-bg-canvas)] p-4"
              >
                <span className="inline-flex w-fit items-center rounded-[0.25rem] border border-[var(--cf-lp-card-border)] bg-[var(--cf-lp-card)] px-2 py-0.5 font-mono text-[0.625rem] font-medium text-[var(--cf-lp-subtle)]">
                  {hint.step}
                </span>
                <h3 className="font-editorial text-[1.0625rem] font-normal text-[var(--cf-lp-ink)]">
                  {hint.title}
                </h3>
                <p className="text-[0.75rem] leading-relaxed text-[var(--cf-lp-subtle)]">
                  {hint.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[0.5625rem] border border-[var(--cf-lp-card-border)] bg-[var(--cf-lp-card)] px-5 py-4">
          <div className="flex items-center gap-3.5">
            <span
              aria-hidden="true"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--cf-lp-lime)] text-[var(--cf-lp-on-lime)]"
            >
              <Lightbulb className="size-4" />
            </span>
            <div>
              <p className="font-editorial text-[0.9375rem] text-[var(--cf-lp-ink)]">
                Make the process visible.
              </p>
              <p className="text-[0.75rem] text-[var(--cf-lp-subtle)]">
                Stories with clear structure and rationale stand out across live links and exports.
              </p>
            </div>
          </div>
          <Link
            href="/help"
            className="inline-flex items-center gap-1.5 border-b border-[var(--cf-lp-border-strong)] pb-0.5 text-[0.75rem] font-medium text-[var(--cf-lp-ink)] hover:opacity-75"
          >
            <span>Read the studio guide</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>

        {spaceDialogs}

        <UpgradePromptDialog
          open={downgradeUpgradeOpen}
          onOpenChange={setDowngradeUpgradeOpen}
          featureTitle="Upgrade to Casefolio Pro"
          featureDescription="Upgrade to Casefolio Pro ($7.99/mo · $79.90/yr with 2 months free) for up to 10 rotatable Case Studies, custom Case Study URLs (/p/your-custom-slug), all Pro templates, and watermark-free exports."
        />
      </div>
    );
  }

  const hasFilters =
    searchQuery.trim().length > 0 ||
    statusFilter !== "all" ||
    typeFilter !== "all" ||
    spaceFilter !== "all";

  const statusTabs: Array<{ id: StatusFilter; label: string }> = [
    { id: "all", label: `All · ${counts.all}` },
    { id: "draft", label: `Drafts · ${counts.draft}` },
    { id: "published", label: `Published · ${counts.published}` },
    ...(counts.archived > 0
      ? [{ id: "archived" as const, label: `Archived · ${counts.archived}` }]
      : []),
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:gap-5">
      {workspaceBar}

      {lockedByDowngradeCount > 0 && (
        <div
          role="status"
          data-testid="dashboard-downgrade-lock-banner"
          className="border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] text-foreground flex flex-col justify-between gap-4 rounded-xl border p-3.5 sm:flex-row sm:items-center"
        >
          <div className="flex items-start gap-3">
            <Lock className="text-warning mt-0.5 size-4 shrink-0" />
            <div className="flex flex-col gap-0.5">
              <span className="type-body-s-strong">
                Free plan includes 1 active Case Study ({lockedByDowngradeCount} extra{" "}
                {lockedByDowngradeCount === 1 ? "Case Study" : "Case Studies"} safely locked)
              </span>
              <span className="text-muted-foreground type-caption">
                None of your work was deleted. Extra Case Studies stay strictly Locked (cannot be
                opened, edited, or exported) until you upgrade back to Casefolio Pro — paying
                immediately unlocks them and restores their links.
              </span>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            data-testid="downgrade-banner-upgrade-btn"
            onClick={() => setDowngradeUpgradeOpen(true)}
          >
            <Sparkles className="size-3.5" />
            Upgrade to Pro
          </Button>
        </div>
      )}

      {/* Studio Welcome Row + KPI Summary + Primary CTA */}
      <header className="grid gap-5 py-1 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="flex flex-col gap-2">
          <p className="cf-lp-kicker text-[var(--cf-lp-kicker-muted)]">
            YOUR STUDIO &nbsp;/&nbsp; CASEFOLIO
          </p>
          <h1 className="font-editorial text-[2.25rem] leading-[0.95] font-normal tracking-[-0.045em] text-[var(--cf-lp-ink)] sm:text-[3.5rem]">
            Make your work <span className="italic">worth remembering.</span>
          </h1>
          <p className="text-[0.875rem] text-[var(--cf-lp-subtle)]">
            Pick up where you left off, or turn something new into a story.
          </p>
        </div>

        <div className="flex flex-wrap items-stretch gap-3 sm:items-end">
          <div className="flex min-w-[13rem] flex-col justify-between rounded-[0.5625rem] border border-[var(--cf-lp-card-border)] bg-[var(--cf-lp-card)] px-4 py-3.5">
            <span className="font-mono text-[0.625rem] font-medium tracking-[0.1em] text-[var(--cf-lp-kicker-muted)] uppercase">
              PORTFOLIO STORIES
            </span>
            <div className="mt-1.5 flex items-baseline gap-2">
              <strong className="v3-dashboard-stat text-[var(--cf-lp-ink)] tabular-nums">
                {counts.all}
              </strong>
              <span className="inline-flex items-center rounded-full bg-[var(--cf-lp-green-pill-bg)] px-2 py-0.5 text-[0.6875rem] font-semibold text-[var(--cf-lp-green-pill-fg)]">
                {counts.published} live
              </span>
            </div>
            <span className="mt-0.5 text-[0.6875rem] text-[var(--cf-lp-subtle)]">
              Across active workspace projects
            </span>
          </div>

          <Link
            href={createProjectHref}
            className="v3-btn-primary h-[2.625rem] self-end px-4 py-2 text-[0.8125rem] font-semibold"
          >
            <Plus className="size-4" />
            <span>New project</span>
          </Link>
        </div>
      </header>

      {/* Case Studies Toolbar (Segmented Tabs + Search + Type + Sort) */}
      <div
        data-testid="dashboard-filter-toolbar"
        className="flex flex-col gap-3 pt-1 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-mono text-[0.75rem] font-medium tracking-[0.11em] text-[var(--cf-lp-ink)] uppercase">
            YOUR CASE STUDIES
          </h2>
          <span className="font-mono text-[0.6875rem] text-[var(--cf-lp-kicker-muted)]">
            {visibleProjects.length} {visibleProjects.length === 1 ? "story" : "stories"}
          </span>
          {selectedSpaceObj && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--cf-lp-card-border)] bg-[var(--cf-bg-surface)] px-2.5 py-0.5 text-[0.6875rem] font-medium text-[var(--cf-lp-ink)]">
              <span>Space: {selectedSpaceObj.name}</span>
              <Link
                href="/spaces"
                className="text-[var(--cf-lp-subtle)] underline underline-offset-2 hover:text-[var(--cf-lp-ink)]"
              >
                Manage
              </Link>
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Filter projects by status"
            className="inline-flex flex-wrap items-center gap-1 rounded-[0.375rem] border border-[var(--cf-lp-card-border)] bg-[var(--cf-lp-tab-track)] p-1"
          >
            {statusTabs.map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setStatusFilter(tab.id)}
                  className={cn(
                    "focus-visible:ring-ring/40 cursor-pointer rounded-[0.25rem] px-3 py-1 text-[0.75rem] font-medium transition-colors outline-none focus-visible:ring-2",
                    active
                      ? "bg-[var(--cf-lp-tab-active-bg)] font-semibold text-[var(--cf-lp-ink)]"
                      : "text-[var(--cf-lp-subtle)] hover:text-[var(--cf-lp-ink)]",
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="relative min-w-44 flex-1 sm:w-52 sm:flex-initial">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-[var(--cf-text-tertiary)]"
            />
            <input
              type="search"
              aria-label="Search projects"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search cases…"
              className="focus-visible:ring-ring/40 h-9 w-full rounded-[0.375rem] border border-[var(--cf-lp-input-border)] bg-[var(--cf-lp-input-bg)] pr-3 pl-8 text-xs text-[var(--cf-text-primary)] placeholder:text-[var(--cf-text-tertiary)] transition-colors outline-none focus-visible:border-[var(--cf-lp-ink)] focus-visible:ring-2"
            />
          </div>

          <label className="sr-only" htmlFor="dashboard-type-filter">
            Filter by project type
          </label>
          <Select
            id="dashboard-type-filter"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
            className="h-9 w-auto px-2.5 text-xs font-medium"
          >
            <option value="all">Type: Any</option>
            <option value="mobile">Type: Mobile app</option>
            <option value="web">Type: Website</option>
            <option value="both">Type: Mobile + Web</option>
          </Select>

          <label className="sr-only" htmlFor="dashboard-sort-select">
            Sort projects
          </label>
          <Select
            id="dashboard-sort-select"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
            className="h-9 w-auto px-2.5 text-xs font-medium"
          >
            <option value="updated">Sort: Last edited</option>
            <option value="created">Sort: Newest</option>
            <option value="name">Sort: Name (A–Z)</option>
          </Select>

          {hasFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="focus-visible:ring-ring/40 inline-flex h-9 items-center rounded-[0.375rem] border border-[var(--cf-lp-card-border)] bg-[var(--cf-lp-card)] px-2.5 text-xs font-semibold text-[var(--cf-lp-ink)] transition-colors outline-none hover:border-[var(--cf-lp-ink)] focus-visible:ring-2"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {searchQuery.trim() && visibleProjects.length > 0 && (
        <p className="text-muted-foreground type-body-s -mt-1">
          {visibleProjects.length} {visibleProjects.length === 1 ? "result" : "results"} for “
          {searchQuery.trim()}”
        </p>
      )}

      {/* No search results */}
      {visibleProjects.length === 0 && hasFilters ? (
        <div
          data-testid="dashboard-no-results"
          className="flex flex-col items-center justify-center gap-3 rounded-[0.5625rem] border border-[var(--cf-lp-card-border)] bg-[var(--cf-lp-card)] px-6 py-12 text-center"
        >
          <span
            aria-hidden="true"
            className="inline-flex size-11 items-center justify-center rounded-[0.5rem] bg-[var(--cf-bg-surface)] text-[var(--cf-lp-ink)]"
          >
            <Search className="size-5" />
          </span>
          <h2 className="v3-dashboard-section-title text-[var(--cf-lp-ink)]">
            {searchQuery.trim()
              ? `No projects match “${searchQuery.trim()}”`
              : "No matching projects"}
          </h2>
          <p className="text-xs text-[var(--cf-lp-subtle)]">
            Try another name, or clear filters.
          </p>
          <button
            type="button"
            onClick={handleClearFilters}
            className="v3-btn-secondary mt-1 h-8 px-3.5 py-1.5 text-xs font-semibold"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {!hasFilters && !activeWorkspace?.isFrozen && (
            <Link
              href={createProjectHref}
              className="group flex min-h-[19.5rem] flex-col items-center justify-center gap-2.5 rounded-[0.5625rem] border border-dashed border-[var(--cf-lp-card-border)] bg-[var(--cf-lp-card)] p-6 text-center transition-colors hover:border-[var(--cf-lp-ink)]"
            >
              <span
                aria-hidden="true"
                className="inline-flex size-10 items-center justify-center rounded-full border border-[var(--cf-lp-card-border)] bg-[var(--cf-bg-canvas)] text-[var(--cf-lp-ink)] transition-colors group-hover:bg-[var(--cf-lp-dark)] group-hover:text-[var(--cf-lp-lime)]"
              >
                <Plus className="size-4" />
              </span>
              <span className="font-editorial text-[1.125rem] text-[var(--cf-lp-ink)]">
                Begin a new story
              </span>
              <span className="max-w-[14rem] text-[0.75rem] leading-relaxed text-[var(--cf-lp-subtle)]">
                Start from a story-first template or blank canvas
              </span>
            </Link>
          )}

          {visibleProjects.map((project, idx) => {
            const palette = ARTWORK_PALETTES[idx % ARTWORK_PALETTES.length]!;
            const badge = resolveProjectStatusBadge(project);
            const spaceLabel =
              project.spaceName && (spaces.length > 1 || project.workspaceKind === "team")
                ? ` · ${project.spaceVisibility === "shared" ? "Shared" : "Private"}: ${project.spaceName}`
                : "";
            const subtitle = `${formatRelativeEdited(project.updatedAtIso, mountedNowMs)}${spaceLabel}`;
            const isBusy = busyProjectId === project.id;
            const isProjectLocked = Boolean(
              project.isLockedByDowngrade || project.isLockedByTeamSubscription,
            );
            const canDeleteLocked =
              project.workspaceKind !== "team" || activeWorkspace?.role === "owner";

            function handleLockedProjectClick() {
              if (project.isLockedByTeamSubscription) {
                toast.info(
                  activeWorkspace?.role === "owner"
                    ? "Renew Casefolio Teams in Billing settings to unlock Team projects."
                    : "This Team workspace is locked until the Team Owner renews Teams.",
                );
                if (activeWorkspace?.role === "owner") {
                  router.push("/account/billing");
                }
                return;
              }
              setDowngradeUpgradeOpen(true);
            }

            return (
              <article
                key={project.id}
                data-slot="project-card"
                data-project-id={project.id}
                className={cn(
                  "group relative flex min-h-[19.5rem] min-w-0 flex-col overflow-hidden rounded-[0.5625rem] border border-[var(--cf-lp-card-border)] bg-[var(--cf-lp-card)] text-card-foreground transition-colors duration-200",
                  isProjectLocked
                    ? "opacity-90"
                    : "hover:border-[var(--cf-lp-ink)]",
                )}
              >
                {isProjectLocked ? (
                  <button
                    type="button"
                    onClick={handleLockedProjectClick}
                    aria-label={`${project.name} is locked — click to renew or upgrade`}
                    className="focus-visible:ring-ring/40 relative block aspect-[16/10] w-full cursor-pointer overflow-hidden border-b border-[var(--cf-lp-card-border)] text-left outline-none focus-visible:ring-2"
                  >
                    {project.thumbnailUrl || project.templateCoverUrl || project.templateSlug ? (
                      <TemplateThumbnail
                        testId={`dashboard-project-thumb-${project.id}`}
                        coverUrl={project.thumbnailUrl ?? project.templateCoverUrl}
                        slug={project.templateSlug}
                        name={project.name}
                        className="size-full grayscale-[35%] opacity-75"
                      />
                    ) : (
                      <div
                        className={`relative size-full overflow-hidden opacity-75 grayscale-[35%] ${palette.surface}`}
                      />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/25 backdrop-blur-[1px]">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--cf-lp-card)] px-3 py-1.5 text-xs font-bold text-[var(--cf-lp-ink)]">
                        <Lock className="size-3.5 text-warning" />
                        <span>Locked · Renew to open</span>
                      </span>
                    </div>
                  </button>
                ) : (
                  <Link
                    href={`/editor/${project.id}`}
                    aria-label={`Open ${project.name} in editor`}
                    className="focus-visible:ring-ring/40 block aspect-[16/10] w-full overflow-hidden border-b border-[var(--cf-lp-card-border)] outline-none focus-visible:ring-2"
                  >
                    {project.thumbnailUrl || project.templateCoverUrl || project.templateSlug ? (
                      <TemplateThumbnail
                        testId={`dashboard-project-thumb-${project.id}`}
                        coverUrl={project.thumbnailUrl ?? project.templateCoverUrl}
                        slug={project.templateSlug}
                        name={project.name}
                        className="size-full"
                        imageClassName="group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div
                        aria-hidden="true"
                        className={`relative flex size-full items-center justify-between gap-3 overflow-hidden p-5 ${palette.surface}`}
                      >
                        <div className="flex flex-col justify-between self-stretch">
                          <span className="font-mono text-[0.5625rem] font-medium tracking-[0.1em] uppercase opacity-75">
                            CASE STUDY
                          </span>
                          <p
                            className={`font-editorial max-w-[11rem] text-[1.4375rem] leading-[1.02] tracking-[-0.03em] ${palette.glyph}`}
                          >
                            {palette.tagline}
                          </p>
                        </div>
                        <div
                          aria-hidden="true"
                          className={`flex h-36 w-24 shrink-0 rotate-3 flex-col justify-between rounded-[0.5rem] border p-2.5 transition-transform duration-300 group-hover:-translate-y-1 ${palette.frameBg}`}
                        >
                          <span className="font-mono text-[0.5rem] uppercase opacity-70">
                            STORY
                          </span>
                          <span className="h-2 w-10 rounded-full bg-current opacity-85" />
                          <span className="h-1.5 w-full rounded-full bg-current opacity-25" />
                          <span className="h-6 w-full rounded-[0.25rem] bg-current opacity-80" />
                        </div>
                      </div>
                    )}
                  </Link>
                )}

                <div className="flex min-w-0 flex-1 flex-col justify-between gap-2.5 p-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[0.625rem] font-medium tracking-[0.1em] text-[var(--cf-lp-kicker-muted)] uppercase">
                        {formatProjectTypeLabel(project.type)}
                      </span>
                      <span className="font-mono text-[0.625rem] text-[var(--cf-lp-kicker-muted)]">
                        {project.templateName}
                      </span>
                    </div>

                    <div className="flex min-w-0 items-center justify-between gap-2">
                      {isProjectLocked ? (
                        <button
                          type="button"
                          onClick={handleLockedProjectClick}
                          className="v3-dashboard-card-title min-w-0 truncate text-left text-[var(--cf-text-secondary)] transition-colors hover:text-[var(--cf-lp-ink)]"
                        >
                          {project.name}
                        </button>
                      ) : (
                        <Link
                          href={`/editor/${project.id}`}
                          className="v3-dashboard-card-title min-w-0 truncate text-[var(--cf-lp-ink)] transition-colors hover:underline"
                        >
                          {project.name}
                        </Link>
                      )}

                      {!isProjectLocked && (
                        <Link
                          href={`/editor/${project.id}`}
                          aria-hidden="true"
                          tabIndex={-1}
                          className="text-[var(--cf-lp-kicker-muted)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--cf-lp-ink)]"
                        >
                          <ArrowUpRight className="size-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-[var(--cf-lp-card-border)]/70 pt-2.5">
                    <p className="truncate text-[0.75rem] text-[var(--cf-lp-subtle)]">{subtitle}</p>

                    <div className="flex shrink-0 items-center gap-1.5">
                      {isProjectLocked ? (
                        <Badge tone="draft" data-testid={`project-locked-badge-${project.id}`}>
                          {project.isLockedByTeamSubscription
                            ? "Locked · Team paused"
                            : "Locked · Free limit"}
                        </Badge>
                      ) : (
                        <Badge tone={badge.tone}>{badge.label}</Badge>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Actions for ${project.name}`}
                            disabled={isBusy}
                            className="focus-visible:ring-ring/40 inline-flex size-7 cursor-pointer items-center justify-center rounded-[0.3125rem] border border-[var(--cf-lp-card-border)] bg-[var(--cf-bg-canvas)] text-[var(--cf-text-secondary)] transition-colors outline-none hover:border-[var(--cf-lp-ink)] hover:text-[var(--cf-lp-ink)] focus-visible:ring-2"
                          >
                            {isBusy ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <MoreHorizontal className="size-3.5" />
                            )}
                          </button>
                        </DropdownMenuTrigger>

                        {/* Context menu + Space & Archive actions */}
                        <DropdownMenuContent align="end" className="w-56">
                          {isProjectLocked ? (
                            <>
                              <DropdownMenuItem
                                data-testid={`unlock-project-${project.id}`}
                                onSelect={handleLockedProjectClick}
                              >
                                <Sparkles className="size-4" />
                                <span>
                                  {project.isLockedByTeamSubscription
                                    ? activeWorkspace?.role === "owner"
                                      ? "Renew Teams to unlock"
                                      : "Locked until Owner renews"
                                    : "Upgrade to unlock"}
                                </span>
                              </DropdownMenuItem>
                              {canDeleteLocked && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onSelect={() => openDeleteModal(project)}
                                  >
                                    <Trash2 className="size-4" />
                                    <span>Delete</span>
                                  </DropdownMenuItem>
                                </>
                              )}
                            </>
                          ) : (
                            <>
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
                                disabled={isBusy}
                                onSelect={() => void handleDuplicate(project)}
                              >
                                <Copy className="size-4" />
                                <span>Duplicate</span>
                              </DropdownMenuItem>
                              {spaces.length > 1 && (
                                <DropdownMenuItem onSelect={() => openMoveModal(project)}>
                                  <FolderInput className="size-4" />
                                  <span>Move to space…</span>
                                </DropdownMenuItem>
                              )}
                              {activeWorkspace?.kind === "team" && (
                                <DropdownMenuItem
                                  disabled={isBusy}
                                  onSelect={() => void handleCopyToPersonal(project)}
                                >
                                  <Copy className="size-4" />
                                  <span>Copy to Personal Workspace</span>
                                </DropdownMenuItem>
                              )}
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
                                disabled={isBusy}
                                onSelect={() => void handleArchiveToggle(project)}
                              >
                                {badge.isArchived ? (
                                  <>
                                    <ArchiveRestore className="size-4" />
                                    <span>Unarchive</span>
                                  </>
                                ) : (
                                  <>
                                    <Archive className="size-4" />
                                    <span>Archive</span>
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => openDeleteModal(project)}
                              >
                                <Trash2 className="size-4" />
                                <span>Delete</span>
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Bottom Studio Tip Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[0.5625rem] border border-[var(--cf-lp-card-border)] bg-[var(--cf-lp-card)] px-5 py-4">
        <div className="flex items-center gap-3.5">
          <span
            aria-hidden="true"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--cf-lp-lime)] text-[var(--cf-lp-on-lime)]"
          >
            <Lightbulb className="size-4" />
          </span>
          <div>
            <p className="font-editorial text-[0.9375rem] text-[var(--cf-lp-ink)]">
              Make the process visible.
            </p>
            <p className="text-[0.75rem] text-[var(--cf-lp-subtle)]">
              Stories with clear structure and rationale stand out across live links and exports.
            </p>
          </div>
        </div>
        <Link
          href="/help"
          className="inline-flex items-center gap-1.5 border-b border-[var(--cf-lp-border-strong)] pb-0.5 text-[0.75rem] font-medium text-[var(--cf-lp-ink)] hover:opacity-75"
        >
          <span>Read the studio guide</span>
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {spaceDialogs}

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

          {(activeWorkspace?.plan ?? "free") === "free" && (
            <div
              role="note"
              data-testid="free-delete-lifetime-warning"
              className="border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] text-foreground flex items-start gap-2.5 rounded-xl border p-3.5"
            >
              <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" />
              <div className="type-body-s flex flex-col gap-0.5">
                <span className="font-semibold">
                  Deleting this project on the Free plan will not restore your 1 lifetime free Case
                  Study credit.
                </span>
                <span className="text-muted-foreground type-caption">
                  To create another Case Study after deleting this one, you will need to upgrade to
                  Pro ($7.99/mo · 2 months free on annual).
                </span>
              </div>
            </div>
          )}

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
                disabled={deleteBusy || deleteConfirmText.trim() !== deleteTarget?.name.trim()}
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

      <UpgradePromptDialog
        open={downgradeUpgradeOpen}
        onOpenChange={setDowngradeUpgradeOpen}
        featureTitle="Unlock all your Case Studies"
        featureDescription="Upgrade to Casefolio Pro ($7.99/mo · $79.90/yr with 2 months free) for up to 10 rotatable Case Studies, custom Case Study URLs (/p/your-custom-slug), all Pro templates, and watermark-free exports."
      />
    </div>
  );
}
