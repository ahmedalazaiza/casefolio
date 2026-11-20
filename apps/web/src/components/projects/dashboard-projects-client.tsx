"use client";

import type { ProjectType, SpaceVisibility } from "@casefolio/db";
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  Copy,
  Download,
  ExternalLink,
  FolderInput,
  FolderPlus,
  Loader2,
  Lock,
  Monitor,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Share2,
  Smartphone,
  Sparkles,
  Trash2,
  Users,
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
import type { SpaceSummaryItem, WorkspaceSwitcherState } from "@/lib/workspaces/service";

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
    description: "Share a live link on Casefolio or download PNG, Behance, and PDF files.",
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
}

export function DashboardProjectsClient({
  initialProjects,
  workspaceContext,
  lifetimeProjectsCreated,
}: DashboardProjectsClientProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<DashboardProjectItem[]>(initialProjects);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [spaceFilter, setSpaceFilter] = useState<string>("all");
  const [sortMode, setSortMode] = useState<SortMode>("updated");
  const [searchQuery, setSearchQuery] = useState("");
  const [switchingWorkspace, setSwitchingWorkspace] = useState(false);

  useEffect(() => {
    setProjects(initialProjects);
  }, [initialProjects]);

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

  // Create Space modal state
  const [createSpaceOpen, setCreateSpaceOpen] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [newSpaceVisibility, setNewSpaceVisibility] = useState<SpaceVisibility>("private");
  const [createSpaceBusy, setCreateSpaceBusy] = useState(false);
  const [createSpaceError, setCreateSpaceError] = useState<string | null>(null);

  // Transition Space Visibility modal state
  const [transitionSpaceTarget, setTransitionSpaceTarget] = useState<SpaceSummaryItem | null>(null);
  const [transitionConfirmed, setTransitionConfirmed] = useState(false);
  const [transitionBusy, setTransitionBusy] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

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

  async function handleCreateSpaceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeWorkspace) return;
    setCreateSpaceBusy(true);
    setCreateSpaceError(null);
    try {
      const response = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          workspaceId: activeWorkspace.workspaceId,
          name: newSpaceName.trim(),
          visibility: activeWorkspace.kind === "team" ? newSpaceVisibility : "private",
        }),
      });
      const json = (await response.json()) as {
        ok: boolean;
        space?: SpaceSummaryItem;
        error?: string;
      };
      if (!response.ok || !json.ok) {
        setCreateSpaceError(json.error ?? "Could not create space.");
        return;
      }
      toast.success(`Created space “${newSpaceName.trim()}”`);
      setNewSpaceName("");
      setCreateSpaceOpen(false);
      if (json.space?.id) {
        setSpaceFilter(json.space.id);
      }
      router.refresh();
    } catch {
      setCreateSpaceError("Network error while creating space.");
    } finally {
      setCreateSpaceBusy(false);
    }
  }

  async function handleTransitionSpaceVisibilitySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!transitionSpaceTarget) return;
    const targetVis: SpaceVisibility =
      transitionSpaceTarget.visibility === "private" ? "shared" : "private";
    setTransitionBusy(true);
    setTransitionError(null);
    try {
      const response = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "transition_visibility",
          spaceId: transitionSpaceTarget.id,
          targetVisibility: targetVis,
          confirmed: transitionConfirmed,
        }),
      });
      const json = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !json.ok) {
        setTransitionError(json.error ?? "Could not update space visibility.");
        return;
      }
      toast.success(
        targetVis === "shared"
          ? `“${transitionSpaceTarget.name}” is now Shared with teammates`
          : `“${transitionSpaceTarget.name}” is now Private (projects unpublished & collaborator sessions revoked)`,
      );
      setTransitionSpaceTarget(null);
      setTransitionConfirmed(false);
      router.refresh();
    } catch {
      setTransitionError("Network error while updating space visibility.");
    } finally {
      setTransitionBusy(false);
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
    setSpaceFilter("all");
  }

  const workspaceBar = workspaceContext && activeWorkspace && (
    <div className="flex flex-col gap-3">
      {workspaceContext.recoverySpacesCount > 0 && (
        <div
          data-testid="dashboard-recovery-banner"
          className="border-primary/30 bg-accent/40 flex flex-col justify-between gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center"
        >
          <div className="flex items-center gap-2.5">
            <ArchiveRestore className="text-primary size-4 shrink-0" />
            <p className="text-foreground type-body-s">
              You have{" "}
              <span className="font-semibold">{workspaceContext.recoverySpacesCount}</span>{" "}
              departed-team private{" "}
              {workspaceContext.recoverySpacesCount === 1 ? "space" : "spaces"} available in your
              90-day Recovery Portal.
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
          className="border-destructive/40 bg-destructive-soft text-foreground flex flex-col justify-between gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center"
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
                Opening, editing, publishing, and exporting Team projects is locked until the Team
                Owner renews Teams. Each member still keeps 1 Case Study in their Personal Workspace.
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="secondary">
            <Link href="/account/billing">Manage billing</Link>
          </Button>
        </div>
      )}

      <div
        data-testid="dashboard-workspace-bar"
        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-3.5 py-2.5"
      >
        {/* Visually hidden select retained for E2E automation while UI workspace switcher + quotas live in Top Navbar */}
        <label htmlFor="dashboard-workspace-select" className="sr-only">
          Active workspace
        </label>
        <select
          id="dashboard-workspace-select"
          data-testid="dashboard-workspace-select"
          disabled={switchingWorkspace}
          value={activeWorkspace.organizationId ?? "personal"}
          onChange={(e) =>
            handleSwitchWorkspace(e.target.value === "personal" ? null : e.target.value)
          }
          className="sr-only"
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

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.6875rem] font-semibold tracking-wider text-[var(--cf-text-tertiary)] uppercase">
            Spaces
          </span>
          {spaces.length > 0 && (
            <div
              role="group"
              aria-label="Filter by space"
              className="flex flex-wrap items-center gap-1 rounded-lg border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] p-0.5"
            >
              <button
                type="button"
                onClick={() => setSpaceFilter("all")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                  spaceFilter === "all"
                    ? "bg-[var(--cf-ink)] text-[var(--cf-text-on-ink)]"
                    : "text-[var(--cf-text-secondary)] hover:text-[var(--cf-text-primary)]",
                )}
              >
                All visible spaces
              </button>
              {spaces.map((sp) => (
                <button
                  key={sp.id}
                  type="button"
                  onClick={() => setSpaceFilter(sp.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                    spaceFilter === sp.id
                      ? "bg-[var(--cf-ink)] text-[var(--cf-text-on-ink)]"
                      : "text-[var(--cf-text-secondary)] hover:text-[var(--cf-text-primary)]",
                  )}
                >
                  {sp.visibility === "private" ? (
                    <Lock className="size-3" />
                  ) : (
                    <Users className="size-3" />
                  )}
                  <span>{sp.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {activeWorkspace.kind === "team" &&
            selectedSpaceObj &&
            (selectedSpaceObj.isMine ||
              activeWorkspace.role === "owner" ||
              activeWorkspace.role === "admin") && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                data-testid="dashboard-transition-space-button"
                className="h-7 rounded-lg border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] px-2.5 text-xs"
                onClick={() => {
                  setTransitionSpaceTarget(selectedSpaceObj);
                  setTransitionConfirmed(false);
                  setTransitionError(null);
                }}
              >
                {selectedSpaceObj.visibility === "private" ? (
                  <>
                    <Users className="size-3" />
                    Make Shared
                  </>
                ) : (
                  <>
                    <Lock className="size-3" />
                    Make Private
                  </>
                )}
              </Button>
            )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-testid="dashboard-create-space-button"
            className="h-7 rounded-lg border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] px-2.5 text-xs"
            onClick={() => {
              setNewSpaceVisibility("private");
              setCreateSpaceError(null);
              setCreateSpaceOpen(true);
            }}
          >
            <FolderPlus className="size-3" />
            New space
          </Button>
        </div>
      </div>
    </div>
  );

  const createProjectHref =
    spaceFilter !== "all" ? `/new?spaceId=${encodeURIComponent(spaceFilter)}` : "/new";

  const spaceDialogs = (
    <>
      {/* Create Space Dialog */}
      <Dialog open={createSpaceOpen} onOpenChange={setCreateSpaceOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create a space</DialogTitle>
            <DialogDescription>
              {activeWorkspace?.kind === "team"
                ? "Private Spaces are strictly invisible to teammates, Admins, and Owners. Shared Spaces let your team co-edit drafts."
                : "Organize projects into dedicated spaces inside your Personal Workspace."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSpaceSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-space-name-input">Space name</Label>
              <Input
                id="new-space-name-input"
                value={newSpaceName}
                onChange={(e) => setNewSpaceName(e.target.value)}
                placeholder="Q4 Portfolio Explorations"
                minLength={2}
                maxLength={60}
                required
              />
            </div>

            {activeWorkspace?.kind === "team" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-space-visibility-select">Visibility</Label>
                <select
                  id="new-space-visibility-select"
                  value={newSpaceVisibility}
                  onChange={(e) => setNewSpaceVisibility(e.target.value as SpaceVisibility)}
                  className="border-input bg-elevated text-foreground type-body-s h-10 rounded-xl border px-3"
                >
                  <option value="private">Private Space (only you — 404 to teammates)</option>
                  {(activeWorkspace.role === "owner" || activeWorkspace.role === "admin") && (
                    <option value="shared">Shared Team Space (visible to all members)</option>
                  )}
                </select>
              </div>
            )}

            {createSpaceError && (
              <p role="alert" className="text-destructive type-caption">
                {createSpaceError}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCreateSpaceOpen(false)}
                disabled={createSpaceBusy}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createSpaceBusy}>
                {createSpaceBusy ? "Creating…" : "Create space"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Transition Space Visibility Dialog (`Spec §10.4 & §10.5`) */}
      <Dialog
        open={Boolean(transitionSpaceTarget)}
        onOpenChange={(open) => {
          if (!open) setTransitionSpaceTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {transitionSpaceTarget?.visibility === "private"
                ? `Make “${transitionSpaceTarget.name}” Shared?`
                : `Make “${transitionSpaceTarget?.name ?? "space"}” Private?`}
            </DialogTitle>
            <DialogDescription>
              {transitionSpaceTarget?.visibility === "private"
                ? "All workspace Owners, Admins, and Members will gain access to projects, drafts, and assets inside this space."
                : "Projects in this space will become invisible (404) to teammates, active collaborator edit leases will be revoked immediately, and any published projects in this space will be unpublished."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleTransitionSpaceVisibilitySubmit} className="flex flex-col gap-4">
            <label className="text-foreground type-body-s flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={transitionConfirmed}
                onChange={(e) => setTransitionConfirmed(e.target.checked)}
                className="accent-primary mt-1 size-4 rounded-xs"
              />
              <span>
                I understand the visibility and publishing changes for all projects in this space.
              </span>
            </label>

            {transitionError && (
              <p role="alert" className="text-destructive type-caption">
                {transitionError}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setTransitionSpaceTarget(null)}
                disabled={transitionBusy}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={transitionBusy || !transitionConfirmed}>
                {transitionBusy ? "Updating…" : "Confirm visibility change"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Move Project Between Spaces Dialog */}
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
              <select
                id="move-destination-space-select"
                value={destinationSpaceId}
                onChange={(e) => setDestinationSpaceId(e.target.value)}
                className="border-input bg-elevated text-foreground type-body-s h-10 rounded-xl border px-3"
              >
                {spaces
                  .filter((sp) => sp.id !== moveTarget?.spaceId)
                  .map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.name} ({sp.visibility === "private" ? "Private" : "Shared"})
                    </option>
                  ))}
              </select>
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
    </>
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
      <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:gap-5">
        {workspaceBar}

        {isFreeLifetimeCreditExhausted && (
          <div
            role="status"
            data-testid="dashboard-free-lifetime-used-banner"
            className="border-warning/40 bg-warning-soft text-foreground flex flex-col justify-between gap-4 rounded-xl border p-3.5 sm:flex-row sm:items-center"
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

        <header className="v3-pattern-grid relative flex flex-col gap-1 overflow-hidden rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-5 py-4 sm:px-6">
          <Eyebrow className="w-fit px-2.5 py-0.5 text-[0.6875rem]">
            Case Study Builder
          </Eyebrow>
          <h1 className="v3-dashboard-title text-[var(--cf-text-primary)]">
            Your case studies
          </h1>
          <p className="text-xs text-[var(--cf-text-secondary)] sm:text-sm">
            Turn finished projects into polished, publishable stories.
          </p>
        </header>

        <section
          data-testid="dashboard-empty-state"
          aria-labelledby="empty-dashboard-heading"
          className="v3-pattern-dots-light flex flex-col items-center justify-between gap-7 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-5 py-8 text-center sm:px-10 sm:py-10"
        >
          <div className="flex flex-col items-center gap-4">
            <div aria-hidden="true" className="grid w-full max-w-64 grid-cols-3 gap-2">
              <div className="flex h-20 flex-col justify-between rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] p-2.5 text-left">
                <span className="font-mono text-[0.6875rem] font-bold text-[var(--cf-royal-text)]">
                  01
                </span>
                <span className="font-display text-xs font-bold text-[var(--cf-text-primary)]">
                  Template
                </span>
              </div>
              <div className="flex h-20 flex-col justify-between rounded-xl bg-[var(--cf-royal)] p-2.5 text-left text-[var(--cf-text-on-royal)]">
                <span className="font-mono text-[0.6875rem] font-bold text-[var(--cf-bg-accent)]">
                  02
                </span>
                <span className="font-display text-xs font-bold">Screens</span>
              </div>
              <div className="flex h-20 flex-col justify-between rounded-xl bg-[var(--cf-bg-accent)] p-2.5 text-left text-[var(--cf-text-on-accent)]">
                <span className="font-mono text-[0.6875rem] font-bold">03</span>
                <span className="font-display text-xs font-bold">Publish</span>
              </div>
            </div>

            <div className="flex max-w-md flex-col gap-1.5">
              <h2
                id="empty-dashboard-heading"
                className="v3-dashboard-section-title text-[var(--cf-text-primary)]"
              >
                Your first case study starts here
              </h2>
              <p className="text-xs leading-relaxed text-[var(--cf-text-secondary)] sm:text-sm">
                Create a project, pick a curated Casefolio template, and drop in your screens.
                Publish a live link or export high-resolution PNG and PDF files.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-0.5">
              <Link
                href={createProjectHref}
                className="v3-btn-primary h-9 px-4 py-2 text-xs font-semibold"
              >
                <span>Create your first project</span>
                <span className="inline-flex size-5 items-center justify-center rounded bg-[var(--cf-bg-accent)] text-[var(--cf-text-on-accent)]">
                  <Plus className="size-3" />
                </span>
              </Link>
              <Link
                href="/templates"
                className="v3-btn-secondary h-9 px-4 py-2 text-xs font-semibold"
              >
                Browse templates
              </Link>
            </div>
          </div>

          <div className="grid w-full max-w-4xl grid-cols-1 gap-3 text-left sm:grid-cols-3">
            {EMPTY_STATE_HINTS.map((hint, index) => (
              <div
                key={hint.step}
                className="flex flex-col gap-2 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] p-4"
              >
                <span
                  className={cn(
                    "inline-flex w-fit items-center rounded-md px-2 py-0.5 text-[0.6875rem] font-bold tracking-wider uppercase",
                    index === 1
                      ? "bg-[var(--cf-bg-accent)] text-[var(--cf-text-on-accent)]"
                      : "bg-[var(--cf-royal)] text-[var(--cf-text-on-royal)]",
                  )}
                >
                  {hint.step}
                </span>
                <h3 className="v3-dashboard-card-title text-[var(--cf-text-primary)]">
                  {hint.title}
                </h3>
                <p className="text-xs leading-relaxed text-[var(--cf-text-secondary)]">
                  {hint.description}
                </p>
              </div>
            ))}
          </div>
        </section>

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
          className="border-warning/40 bg-warning-soft text-foreground flex flex-col justify-between gap-4 rounded-xl border p-3.5 sm:flex-row sm:items-center"
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

      {/* Compact Studio Header Banner + Quick Create + New Project CTA */}
      <header className="v3-pattern-grid relative flex flex-col gap-3 overflow-hidden rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-col gap-1">
          <Eyebrow className="w-fit px-2.5 py-0.5 text-[0.6875rem]">
            Case Study Builder
          </Eyebrow>
          <h1 className="v3-dashboard-title text-[var(--cf-text-primary)]">
            Your case studies
          </h1>
          <p className="text-xs text-[var(--cf-text-secondary)] sm:text-sm">
            Turn finished projects into polished, publishable stories.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden items-center gap-1.5 sm:flex">
            <Link
              href="/new?type=mobile"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] px-3 text-xs font-semibold text-[var(--cf-text-secondary)] transition-colors hover:border-[var(--cf-royal)] hover:bg-[var(--cf-royal-soft)] hover:text-[var(--cf-royal-text)]"
            >
              <Smartphone className="size-3.5 text-[var(--cf-royal-text)]" />
              <span>Mobile</span>
            </Link>
            <Link
              href="/new?type=web"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] px-3 text-xs font-semibold text-[var(--cf-text-secondary)] transition-colors hover:border-[var(--cf-royal)] hover:bg-[var(--cf-royal-soft)] hover:text-[var(--cf-royal-text)]"
            >
              <Monitor className="size-3.5 text-[var(--cf-royal-text)]" />
              <span>Website</span>
            </Link>
          </div>

          <Link
            href={createProjectHref}
            className="v3-btn-primary h-9 px-3.5 py-2 text-xs font-semibold"
          >
            <span>New project</span>
            <span className="inline-flex size-5 items-center justify-center rounded bg-[var(--cf-bg-accent)] text-[var(--cf-text-on-accent)]">
              <Plus className="size-3" />
            </span>
          </Link>
        </div>
      </header>

      {/* Unified Filter & Search Toolbar (Status Tabs + Search + Type + Sort) */}
      <div
        data-testid="dashboard-filter-toolbar"
        className="flex flex-col gap-2.5 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-3 lg:flex-row lg:items-center lg:justify-between"
      >
        <div
          role="group"
          aria-label="Filter projects by status"
          className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] p-0.5"
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
                  "focus-visible:ring-ring/40 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors outline-none focus-visible:ring-2",
                  active
                    ? "bg-[var(--cf-ink)] text-[var(--cf-text-on-ink)]"
                    : "text-[var(--cf-text-secondary)] hover:text-[var(--cf-text-primary)]",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-44 flex-1 sm:w-56 sm:flex-initial">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-[var(--cf-text-tertiary)]"
            />
            <input
              type="search"
              aria-label="Search projects"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search projects…"
              className="focus-visible:ring-ring/40 h-9 w-full rounded-lg border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] pr-3 pl-8 text-xs text-[var(--cf-text-primary)] placeholder:text-[var(--cf-text-tertiary)] transition-colors outline-none focus-visible:border-[var(--cf-royal)] focus-visible:bg-[var(--cf-bg-elevated)] focus-visible:ring-2"
            />
          </div>

          <label className="sr-only" htmlFor="dashboard-type-filter">
            Filter by project type
          </label>
          <select
            id="dashboard-type-filter"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
            className="focus-visible:ring-ring/40 h-9 rounded-lg border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] px-2.5 text-xs font-medium text-[var(--cf-text-primary)] outline-none focus-visible:border-[var(--cf-royal)] focus-visible:ring-2"
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
            className="focus-visible:ring-ring/40 h-9 rounded-lg border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] px-2.5 text-xs font-medium text-[var(--cf-text-primary)] outline-none focus-visible:border-[var(--cf-royal)] focus-visible:ring-2"
          >
            <option value="updated">Sort: Last edited</option>
            <option value="created">Sort: Newest</option>
            <option value="name">Sort: Name (A–Z)</option>
          </select>

          {hasFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="focus-visible:ring-ring/40 inline-flex h-9 items-center rounded-lg border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] px-2.5 text-xs font-semibold text-[var(--cf-royal-text)] transition-colors outline-none hover:border-[var(--cf-royal)] hover:bg-[var(--cf-royal-soft)] focus-visible:ring-2"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {searchQuery.trim() && visibleProjects.length > 0 && (
        <p className="text-muted-foreground type-body-s -mt-2">
          {visibleProjects.length} {visibleProjects.length === 1 ? "result" : "results"} for “
          {searchQuery.trim()}”
        </p>
      )}

      {/* No search results */}
      {visibleProjects.length === 0 && hasFilters ? (
        <div
          data-testid="dashboard-no-results"
          className="v3-pattern-dots-light flex flex-col items-center justify-center gap-3 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-6 py-12 text-center"
        >
          <span
            aria-hidden="true"
            className="inline-flex size-11 items-center justify-center rounded-xl bg-[var(--cf-royal-soft)] text-[var(--cf-royal-text)]"
          >
            <Search className="size-5" />
          </span>
          <h2 className="v3-dashboard-section-title text-[var(--cf-text-primary)]">
            {searchQuery.trim()
              ? `No projects match “${searchQuery.trim()}”`
              : "No matching projects"}
          </h2>
          <p className="text-xs text-[var(--cf-text-secondary)]">
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
          {visibleProjects.map((project, idx) => {
            const palette = ARTWORK_PALETTES[idx % ARTWORK_PALETTES.length]!;
            const badge = resolveProjectStatusBadge(project);
            const spaceLabel =
              project.spaceName && (spaces.length > 1 || project.workspaceKind === "team")
                ? ` · ${project.spaceVisibility === "shared" ? "Shared" : "Private"}: ${project.spaceName}`
                : "";
            const subtitle = `${formatProjectTypeLabel(project.type)} · ${formatRelativeEdited(project.updatedAtIso, mountedNowMs)}${spaceLabel}`;
            const isBusy = busyProjectId === project.id;
            const isProjectLocked = Boolean(
              project.isLockedByDowngrade || project.isLockedByTeamSubscription,
            );
            const canDeleteLocked =
              project.workspaceKind !== "team" || activeWorkspace?.role === "owner";
            const indexLabel = String(idx + 1).padStart(2, "0");
            const windowPath = project.slug ? `p/${project.slug}` : `draft/${project.templateName.toLowerCase()}`;

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
                  "group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] text-card-foreground transition-all duration-200",
                  isProjectLocked
                    ? "opacity-90"
                    : "hover:-translate-y-0.5 hover:border-[var(--cf-royal)] hover:shadow-[var(--cf-shadow-hover)]",
                )}
              >
                {/* Architectural Spec Bar */}
                <div className="flex items-center justify-between gap-2 border-b border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] px-3.5 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="inline-flex h-5 shrink-0 items-center rounded border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-1.5 font-mono text-[0.65rem] font-bold tracking-wider text-[var(--cf-text-primary)] uppercase">
                      {indexLabel}
                    </span>
                    <span className="truncate font-mono text-[0.6875rem] text-[var(--cf-text-tertiary)]">
                      {windowPath}
                    </span>
                  </div>
                </div>

                <div className="p-3 pb-0">
                  {isProjectLocked ? (
                    <button
                      type="button"
                      onClick={handleLockedProjectClick}
                      aria-label={`${project.name} is locked — click to renew or upgrade`}
                      className="focus-visible:ring-ring/40 relative block w-full cursor-pointer overflow-hidden rounded-xl border border-[var(--cf-border-subtle)] text-left outline-none focus-visible:ring-2"
                    >
                      {project.thumbnailUrl || project.templateCoverUrl || project.templateSlug ? (
                        <TemplateThumbnail
                          testId={`dashboard-project-thumb-${project.id}`}
                          coverUrl={project.thumbnailUrl ?? project.templateCoverUrl}
                          slug={project.templateSlug}
                          name={project.name}
                          className="aspect-[16/10] w-full grayscale-[35%] opacity-75"
                        />
                      ) : (
                        <div
                          className={`relative aspect-[16/10] w-full overflow-hidden opacity-75 grayscale-[35%] ${palette.surface}`}
                        />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/25 backdrop-blur-[1px]">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--cf-bg-elevated)] px-3 py-1.5 text-xs font-bold text-[var(--cf-text-primary)] shadow-sm">
                          <Lock className="size-3.5 text-warning" />
                          <span>Locked · Renew to open</span>
                        </span>
                      </div>
                    </button>
                  ) : (
                    <Link
                      href={`/editor/${project.id}`}
                      aria-label={`Open ${project.name} in editor`}
                      className="focus-visible:ring-ring/40 block overflow-hidden rounded-xl border border-[var(--cf-border-subtle)] outline-none focus-visible:ring-2"
                    >
                      {project.thumbnailUrl || project.templateCoverUrl || project.templateSlug ? (
                        <TemplateThumbnail
                          testId={`dashboard-project-thumb-${project.id}`}
                          coverUrl={project.thumbnailUrl ?? project.templateCoverUrl}
                          slug={project.templateSlug}
                          name={project.name}
                          className="aspect-[16/10] w-full"
                          imageClassName="group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div
                          className={`relative aspect-[16/10] w-full overflow-hidden ${palette.surface}`}
                        >
                          <span
                            aria-hidden="true"
                            className={`type-heading-l absolute top-5 left-5 select-none ${palette.glyph}`}
                          >
                            Aa
                          </span>
                          <div
                            aria-hidden="true"
                            className="absolute right-30 bottom-0 h-32 w-24 rounded-t-xl bg-[var(--cf-royal)] transition-transform duration-300 group-hover:-translate-y-1"
                          />
                          <div
                            aria-hidden="true"
                            className="absolute right-20 bottom-0 h-22 w-14 rounded-t-xl bg-[var(--cf-bg-accent)] transition-transform duration-300 group-hover:-translate-y-2"
                          />
                          <div
                            aria-hidden="true"
                            className="bg-elevated border-border/60 absolute right-4 bottom-0 h-36 w-26 rounded-t-xl border border-b-0 transition-transform duration-300 group-hover:-translate-y-1.5"
                          />
                        </div>
                      )}
                    </Link>
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 p-3.5 pt-3">
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    {isProjectLocked ? (
                      <button
                        type="button"
                        onClick={handleLockedProjectClick}
                        className="v3-dashboard-card-title min-w-0 truncate text-left text-[var(--cf-text-secondary)] transition-colors hover:text-[var(--cf-royal)]"
                      >
                        {project.name}
                      </button>
                    ) : (
                      <Link
                        href={`/editor/${project.id}`}
                        className="v3-dashboard-card-title min-w-0 truncate text-[var(--cf-text-primary)] transition-colors hover:text-[var(--cf-royal)]"
                      >
                        {project.name}
                      </Link>
                    )}

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
                            className="focus-visible:ring-ring/40 inline-flex size-8 items-center justify-center rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] text-[var(--cf-text-secondary)] transition-colors outline-none hover:border-[var(--cf-royal)] hover:bg-[var(--cf-royal-soft)] hover:text-[var(--cf-royal-text)] focus-visible:ring-2"
                          >
                            {isBusy ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="size-4" />
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

                  <div className="flex items-center justify-between gap-2 border-t border-[var(--cf-border-subtle)]/70 pt-2">
                    <p className="v3-body-s truncate text-[var(--cf-text-secondary)]">{subtitle}</p>
                    <span className="shrink-0 rounded-md bg-[var(--cf-bg-canvas)] px-2 py-0.5 text-[0.6875rem] font-semibold text-[var(--cf-text-tertiary)]">
                      {project.templateName}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

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
              className="border-warning/40 bg-warning-soft text-foreground flex items-start gap-2.5 rounded-xl border p-3.5"
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
