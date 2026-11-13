"use client";

import type { ProjectType, SpaceVisibility } from "@casefolio/db";
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  Building2,
  CheckCircle2,
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
import { isUnlimitedProjectsLimit } from "@/lib/billing/plans";
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

function formatBytesCompact(bytes: number): string {
  const gb = 1024 * 1024 * 1024;
  const mb = 1024 * 1024;
  if (bytes >= gb) {
    return `${(bytes / gb).toFixed(bytes % gb === 0 ? 0 : 1)} GB`;
  }
  if (bytes >= mb) {
    return `${Math.round(bytes / mb)} MB`;
  }
  return `${Math.max(0, Math.round(bytes / 1024))} KB`;
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
}

export function DashboardProjectsClient({
  initialProjects,
  workspaceContext,
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

  const lockedByDowngradeCount = useMemo(
    () => projects.filter((p) => p.isLockedByDowngrade && !p.archivedAtIso).length,
    [projects],
  );

  async function handleSetActiveFreeProject(project: DashboardProjectItem) {
    setBusyProjectId(project.id);
    try {
      const res = await fetch("/api/paddle/seats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "keep_public_project",
          projectId: project.id,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        toast.error(json.error ?? "Could not switch active Case Study.");
        return;
      }
      setProjects((prev) =>
        prev.map((item) => {
          if (item.archivedAtIso || item.workspaceKind !== "personal") return item;
          const isChosen = item.id === project.id;
          return {
            ...item,
            isKeptActiveProject: isChosen,
            isLockedByDowngrade: !isChosen,
            visibility: isChosen ? item.visibility : "private",
            publishedAtIso: isChosen ? item.publishedAtIso : null,
          };
        }),
      );
      toast.success(`“${project.name}” is now your 1 active Case Study on Free.`);
      router.refresh();
    } catch {
      toast.error("Network error while switching active Case Study.");
    } finally {
      setBusyProjectId(null);
    }
  }

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
      toast.success(
        isArchived
          ? `Restored “${project.name}” to active drafts`
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
          className="border-warning/40 bg-warning-soft text-foreground flex flex-col justify-between gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center"
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="text-warning size-4 shrink-0" />
            <p className="type-body-s">
              This workspace is currently in read-only mode (
              {activeWorkspace.frozenReason === "past_due_expired"
                ? "past-due grace period ended"
                : "subscription inactive"}
              ). Existing projects remain safe and downloadable.
            </p>
          </div>
          <Button asChild size="sm" variant="secondary">
            <Link href="/account/billing">Manage billing</Link>
          </Button>
        </div>
      )}

      <div
        data-testid="dashboard-workspace-bar"
        className="border-border/70 bg-elevated/90 shadow-card flex flex-col gap-3 rounded-2xl border p-3.5"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Workspace Switcher + Space Pills */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2">
              <Building2 className="text-primary size-4 shrink-0" />
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
                className="border-border bg-surface text-foreground type-body-s-strong h-9 rounded-xl border px-3"
              >
                {workspaceContext.workspaces.map((ws) => (
                  <option key={ws.workspaceId} value={ws.organizationId ?? "personal"}>
                    {ws.kind === "personal"
                      ? `Personal Workspace (${ws.plan.toUpperCase()})`
                      : `${ws.name} · ${ws.plan === "plus" ? "Plus" : "Team"} (${ws.paidSeats} ${ws.paidSeats === 1 ? "seat" : "seats"})`}
                  </option>
                ))}
              </select>
            </div>

            {spaces.length > 0 && (
              <div
                role="group"
                aria-label="Filter by space"
                className="border-border/70 bg-sunken/70 flex flex-wrap items-center gap-1 rounded-xl border p-1"
              >
                <button
                  type="button"
                  onClick={() => setSpaceFilter("all")}
                  className={cn(
                    "type-caption rounded-lg px-2.5 py-1 font-medium transition-colors",
                    spaceFilter === "all"
                      ? "bg-elevated text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground",
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
                      "type-caption inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-medium transition-colors",
                      spaceFilter === sp.id
                        ? "bg-elevated text-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground",
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

            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid="dashboard-create-space-button"
              onClick={() => {
                setNewSpaceVisibility("private");
                setCreateSpaceError(null);
                setCreateSpaceOpen(true);
              }}
            >
              <FolderPlus className="size-3.5" />
              New space
            </Button>

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
                  onClick={() => {
                    setTransitionSpaceTarget(selectedSpaceObj);
                    setTransitionConfirmed(false);
                    setTransitionError(null);
                  }}
                >
                  {selectedSpaceObj.visibility === "private" ? (
                    <>
                      <Users className="size-3.5" />
                      Make Shared
                    </>
                  ) : (
                    <>
                      <Lock className="size-3.5" />
                      Make Private
                    </>
                  )}
                </Button>
              )}
          </div>

          {/* Numeric Quota Meters (`80%` soft warning / `100%` hard cap — Spec §5.9) */}
          <div className="text-muted-foreground type-caption flex flex-wrap items-center gap-3">
            <span
              className={cn(
                !isUnlimitedProjectsLimit(activeWorkspace.quotas.activeProjectsLimit) &&
                  activeWorkspace.usage.activeProjects >= activeWorkspace.quotas.activeProjectsLimit
                  ? "text-destructive font-medium"
                  : !isUnlimitedProjectsLimit(activeWorkspace.quotas.activeProjectsLimit) &&
                      activeWorkspace.usage.activeProjects /
                        Math.max(1, activeWorkspace.quotas.activeProjectsLimit) >=
                        0.8
                    ? "text-warning font-medium"
                    : "",
              )}
            >
              Active: {activeWorkspace.usage.activeProjects}/
              {isUnlimitedProjectsLimit(activeWorkspace.quotas.activeProjectsLimit)
                ? "Unlimited"
                : activeWorkspace.quotas.activeProjectsLimit}
            </span>
            <span>·</span>
            <span>
              Published: {activeWorkspace.usage.publishedProjects}/
              {isUnlimitedProjectsLimit(activeWorkspace.quotas.publishedProjectsLimit)
                ? "Unlimited"
                : activeWorkspace.quotas.publishedProjectsLimit}
            </span>
            <span>·</span>
            <span
              className={cn(
                activeWorkspace.usage.storageBytes >= activeWorkspace.quotas.storageBytesLimit
                  ? "text-destructive font-medium"
                  : activeWorkspace.usage.storageBytes /
                        Math.max(1, activeWorkspace.quotas.storageBytesLimit) >=
                      0.8
                    ? "text-warning font-medium"
                    : "",
              )}
            >
              Storage: {formatBytesCompact(activeWorkspace.usage.storageBytes)}/
              {formatBytesCompact(activeWorkspace.quotas.storageBytesLimit)}
            </span>
            <span>·</span>
            <span>
              Exports: {activeWorkspace.usage.monthlyExportsUsed}/
              {activeWorkspace.quotas.monthlyExportsLimit}
            </span>
          </div>
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

  // Empty state matching Figma 2:2172 1:1
  if (projects.length === 0) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-9">
        {workspaceBar}

        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2.5">
            <Eyebrow className="w-fit">Case Study Builder</Eyebrow>
            <h1 className="type-display-m sm:type-display-l text-foreground">Your case studies</h1>
            <p className="text-muted-foreground type-body-m">
              Turn finished projects into polished, publishable stories.
            </p>
          </div>

          <Button asChild size="lg" className="w-fit">
            <Link href={createProjectHref}>
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
                <Link href={createProjectHref}>
                  <Plus className="size-4" />
                  Create your first project
                </Link>
              </Button>
              <Button variant="secondary" size="lg" asChild>
                <Link href="/templates">Browse templates</Link>
              </Button>
            </div>
          </div>

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

        {spaceDialogs}
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
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      {workspaceBar}

      {lockedByDowngradeCount > 0 && (
        <div
          role="status"
          data-testid="dashboard-downgrade-lock-banner"
          className="border-warning/40 bg-warning-soft text-foreground flex flex-col justify-between gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center"
        >
          <div className="flex items-start gap-3">
            <Lock className="text-warning mt-0.5 size-4 shrink-0" />
            <div className="flex flex-col gap-0.5">
              <span className="type-body-s-strong">
                Free plan includes 1 active Case Study ({lockedByDowngradeCount} extra{" "}
                {lockedByDowngradeCount === 1 ? "Case Study" : "Case Studies"} safely locked)
              </span>
              <span className="text-muted-foreground type-caption">
                None of your work was deleted. Open any locked card&apos;s menu to switch your 1
                active Case Study, or upgrade to Casefolio Pro to unlock all Case Studies.
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
            className="border-border/70 bg-sunken/80 inline-flex flex-wrap items-center gap-1 rounded-full border p-1"
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
            <Link href={createProjectHref}>
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
            const spaceLabel =
              project.spaceName && (spaces.length > 1 || project.workspaceKind === "team")
                ? ` · ${project.spaceVisibility === "shared" ? "Shared" : "Private"}: ${project.spaceName}`
                : "";
            const subtitle = `${formatProjectTypeLabel(project.type)} · ${formatRelativeEdited(project.updatedAtIso, mountedNowMs)}${spaceLabel}`;
            const isBusy = busyProjectId === project.id;

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
                  {project.thumbnailUrl || project.templateCoverUrl || project.templateSlug ? (
                    <TemplateThumbnail
                      testId={`dashboard-project-thumb-${project.id}`}
                      coverUrl={project.thumbnailUrl ?? project.templateCoverUrl}
                      slug={project.templateSlug}
                      name={project.name}
                      className="h-48 w-full rounded-2xl"
                      imageClassName="group-hover:scale-[1.03]"
                    />
                  ) : (
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
                  )}
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
                      {project.isLockedByDowngrade ? (
                        <Badge tone="draft" data-testid={`project-locked-badge-${project.id}`}>
                          Locked · Free limit
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
                            className="text-muted-foreground hover:bg-surface hover:text-foreground focus-visible:ring-ring/40 inline-flex size-8 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2"
                          >
                            {isBusy ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="size-4" />
                            )}
                          </button>
                        </DropdownMenuTrigger>

                        {/* Context menu matching Figma 2:2583 + Space & Archive actions */}
                        <DropdownMenuContent align="end" className="w-56">
                          {project.isLockedByDowngrade && (
                            <>
                              <DropdownMenuItem
                                data-testid={`set-active-project-${project.id}`}
                                disabled={isBusy}
                                onSelect={() => void handleSetActiveFreeProject(project)}
                              >
                                <CheckCircle2 className="size-4" />
                                <span>Set as active Case Study</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          )}
                          <DropdownMenuItem asChild>
                            <Link href={`/editor/${project.id}`}>
                              <ExternalLink className="size-4" />
                              <span>{project.isLockedByDowngrade ? "View read-only" : "Open editor"}</span>
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
        featureDescription="Upgrade to Casefolio Pro ($9.99/mo or $7.99/mo billed annually) to unlock Unlimited Case Studies, edit & publish every project, and export without watermarks."
      />
    </div>
  );
}
