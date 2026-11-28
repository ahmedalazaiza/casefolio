"use client";

import type { SpaceVisibility } from "@casefolio/db";
import {
  ArrowRight,
  Check,
  FolderKanban,
  FolderPlus,
  Layers,
  Loader2,
  Lock,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { SpaceWithUsageItem, WorkspaceSwitcherState } from "@/lib/workspaces/service";

export interface SpacesManagementClientProps {
  workspace: WorkspaceSwitcherState["activeWorkspace"];
  initialSpaces: SpaceWithUsageItem[];
  initialActiveSpaceId: string;
}

export function SpacesManagementClient({
  workspace,
  initialSpaces,
  initialActiveSpaceId,
}: SpacesManagementClientProps) {
  const router = useRouter();
  const [spaces, setSpaces] = useState<SpaceWithUsageItem[]>(initialSpaces);
  const [activeSpaceId, setActiveSpaceId] = useState<string>(initialActiveSpaceId || "all");
  const [switchingSpaceId, setSwitchingSpaceId] = useState<string | null>(null);

  // Create Space modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createVisibility, setCreateVisibility] = useState<SpaceVisibility>("private");
  const [selectAfterCreate, setSelectAfterCreate] = useState(true);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Rename Space modal
  const [renameTarget, setRenameTarget] = useState<SpaceWithUsageItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  // Visibility transition modal (Team workspaces)
  const [transitionTarget, setTransitionTarget] = useState<SpaceWithUsageItem | null>(null);
  const [transitionConfirmed, setTransitionConfirmed] = useState(false);
  const [transitionBusy, setTransitionBusy] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  // Delete Space modal
  const [deleteTarget, setDeleteTarget] = useState<SpaceWithUsageItem | null>(null);
  const [destinationSpaceId, setDestinationSpaceId] = useState<string>("");
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canManageTeamSpaces = workspace.role === "owner" || workspace.role === "admin";
  const selectedSpace = spaces.find((s) => s.id === activeSpaceId) ?? null;

  async function selectActiveSpace(spaceId: string, options?: { navigateDashboard?: boolean }) {
    setSwitchingSpaceId(spaceId);
    try {
      const response = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "select_space", spaceId }),
      });
      const json = (await response.json()) as {
        ok?: boolean;
        activeSpaceId?: string;
        error?: string;
      };
      if (!response.ok || !json.ok) {
        toast.error(json.error ?? "Could not change active space.");
        return;
      }
      const nextId = json.activeSpaceId ?? spaceId;
      setActiveSpaceId(nextId);
      const chosen = spaces.find((s) => s.id === nextId);
      toast.success(
        nextId === "all"
          ? "Showing projects across all visible spaces"
          : `Switched active space to “${chosen?.name ?? "Space"}”`,
      );
      if (options?.navigateDashboard) {
        router.push("/dashboard");
      }
      router.refresh();
    } catch {
      toast.error("Network error while updating active space.");
    } finally {
      setSwitchingSpaceId(null);
    }
  }

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateBusy(true);
    setCreateError(null);
    try {
      const response = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          workspaceId: workspace.workspaceId,
          name: createName.trim(),
          visibility: workspace.kind === "team" ? createVisibility : "private",
        }),
      });
      const json = (await response.json()) as {
        ok?: boolean;
        space?: SpaceWithUsageItem;
        error?: string;
      };
      if (!response.ok || !json.ok || !json.space) {
        setCreateError(json.error ?? "Could not create space.");
        return;
      }

      const created: SpaceWithUsageItem = {
        ...json.space,
        projectCount: 0,
        activeProjectCount: 0,
        publishedProjectCount: 0,
        updatedAtIso: new Date().toISOString(),
      };
      setSpaces((prev) => [...prev, created]);
      setCreateName("");
      setCreateOpen(false);
      toast.success(`Created space “${created.name}”`);

      if (selectAfterCreate) {
        await selectActiveSpace(created.id);
      } else {
        router.refresh();
      }
    } catch {
      setCreateError("Network error while creating space.");
    } finally {
      setCreateBusy(false);
    }
  }

  async function handleRenameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!renameTarget) return;
    setRenameBusy(true);
    setRenameError(null);
    try {
      const response = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rename",
          spaceId: renameTarget.id,
          name: renameValue.trim(),
        }),
      });
      const json = (await response.json()) as {
        ok?: boolean;
        space?: SpaceWithUsageItem;
        error?: string;
      };
      if (!response.ok || !json.ok || !json.space) {
        setRenameError(json.error ?? "Could not rename space.");
        return;
      }
      setSpaces((prev) =>
        prev.map((sp) => (sp.id === renameTarget.id ? { ...sp, name: json.space!.name } : sp)),
      );
      toast.success(`Renamed space to “${json.space.name}”`);
      setRenameTarget(null);
      router.refresh();
    } catch {
      setRenameError("Network error while renaming space.");
    } finally {
      setRenameBusy(false);
    }
  }

  async function handleTransitionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!transitionTarget) return;
    const targetVisibility: SpaceVisibility =
      transitionTarget.visibility === "private" ? "shared" : "private";
    setTransitionBusy(true);
    setTransitionError(null);
    try {
      const response = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "transition_visibility",
          spaceId: transitionTarget.id,
          targetVisibility,
          confirmed: transitionConfirmed,
        }),
      });
      const json = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !json.ok) {
        setTransitionError(json.error ?? "Could not update space visibility.");
        return;
      }
      setSpaces((prev) =>
        prev.map((sp) =>
          sp.id === transitionTarget.id
            ? {
                ...sp,
                visibility: targetVisibility,
                publishedProjectCount:
                  targetVisibility === "private" ? 0 : sp.publishedProjectCount,
              }
            : sp,
        ),
      );
      toast.success(
        targetVisibility === "shared"
          ? `“${transitionTarget.name}” is now Shared with teammates`
          : `“${transitionTarget.name}” is now Private`,
      );
      setTransitionTarget(null);
      setTransitionConfirmed(false);
      router.refresh();
    } catch {
      setTransitionError("Network error while updating visibility.");
    } finally {
      setTransitionBusy(false);
    }
  }

  function openDeleteDialog(space: SpaceWithUsageItem) {
    const candidates = spaces.filter((s) => s.id !== space.id);
    const defaultCandidate = candidates.find((s) => s.isDefault) ?? candidates[0] ?? null;
    setDeleteTarget(space);
    setDestinationSpaceId(defaultCandidate?.id ?? "");
    setDeleteConfirmed(false);
    setDeleteError(null);
  }

  async function handleDeleteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const response = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          spaceId: deleteTarget.id,
          ...(deleteTarget.projectCount > 0 && destinationSpaceId
            ? { moveProjectsToSpaceId: destinationSpaceId }
            : {}),
        }),
      });
      const json = (await response.json()) as {
        ok?: boolean;
        movedProjectsCount?: number;
        error?: string;
      };
      if (!response.ok || !json.ok) {
        setDeleteError(json.error ?? "Could not delete space.");
        return;
      }

      const movedCount = json.movedProjectsCount ?? 0;
      setSpaces((prev) =>
        prev
          .filter((sp) => sp.id !== deleteTarget.id)
          .map((sp) =>
            sp.id === destinationSpaceId
              ? { ...sp, projectCount: sp.projectCount + movedCount }
              : sp,
          ),
      );
      if (activeSpaceId === deleteTarget.id) {
        setActiveSpaceId("all");
      }
      toast.success(
        movedCount > 0
          ? `Deleted “${deleteTarget.name}” and moved ${movedCount} ${movedCount === 1 ? "project" : "projects"}`
          : `Deleted space “${deleteTarget.name}”`,
      );
      setDeleteTarget(null);
      router.refresh();
    } catch {
      setDeleteError("Network error while deleting space.");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-col justify-between gap-4 border-b border-[var(--cf-lp-cream-divider)] pb-5 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-1.5">
          <p className="cf-lp-kicker text-[var(--cf-lp-kicker-muted)]">
            SPACES &nbsp;/&nbsp;{" "}
            {workspace.kind === "personal" ? "PERSONAL WORKSPACE" : workspace.name.toUpperCase()}
          </p>
          <h1 className="font-editorial text-[2.25rem] leading-[0.98] font-normal tracking-[-0.04em] text-[var(--cf-lp-ink)] sm:text-[3rem]">
            Manage <span className="italic">spaces.</span>
          </h1>
          <p className="max-w-xl text-[0.875rem] text-[var(--cf-lp-subtle)]">
            Create spaces to organize case studies, update visibility, rename or delete spaces, and
            switch your active space anytime from the top workspace menu.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {selectedSpace && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={switchingSpaceId === "all"}
              onClick={() => void selectActiveSpace("all")}
            >
              Show all spaces
            </Button>
          )}
          <Button
            type="button"
            data-testid="spaces-create-button"
            onClick={() => {
              setCreateName("");
              setCreateVisibility("private");
              setCreateError(null);
              setCreateOpen(true);
            }}
          >
            <FolderPlus className="size-4" />
            <span>New space</span>
          </Button>
        </div>
      </header>

      <section
        aria-label="Workspace spaces list"
        className="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        {spaces.map((space) => {
          const isActive = activeSpaceId === space.id;
          const canEditOrDelete =
            workspace.kind === "personal" || space.isMine || canManageTeamSpaces;
          const canDelete = canEditOrDelete && !space.isDefault && spaces.length > 1;
          const isSwitching = switchingSpaceId === space.id;

          return (
            <article
              key={space.id}
              data-testid={`space-card-${space.id}`}
              className={cn(
                "flex flex-col justify-between gap-4 rounded-[0.625rem] border p-5 transition-colors",
                isActive
                  ? "border-[var(--cf-lp-ink)] bg-[var(--cf-bg-surface)]"
                  : "border-[var(--cf-lp-card-border)] bg-[var(--cf-lp-card)]",
              )}
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--cf-lp-card-border)] bg-[var(--cf-bg-canvas)] text-[var(--cf-lp-ink)]"
                    >
                      {space.visibility === "private" ? (
                        <Lock className="size-4" />
                      ) : (
                        <Users className="size-4" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-[1rem] font-semibold text-[var(--cf-lp-ink)]">
                        {space.name}
                      </h2>
                      <p className="text-[0.75rem] text-[var(--cf-lp-subtle)]">
                        {space.visibility === "private"
                          ? "Private space · Visible only to owner"
                          : "Shared space · Visible to workspace teammates"}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                    {space.isDefault && <Badge tone="neutral">Default</Badge>}
                    {isActive && <Badge tone="published">Active</Badge>}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-[0.75rem] text-[var(--cf-lp-subtle)]">
                  <span className="inline-flex items-center gap-1.5 font-mono">
                    <FolderKanban className="size-3.5" />
                    {space.projectCount} {space.projectCount === 1 ? "project" : "projects"}
                  </span>
                  {space.publishedProjectCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--cf-lp-green-pill-bg)] px-2 py-0.5 text-[0.6875rem] font-semibold text-[var(--cf-lp-green-pill-fg)]">
                      {space.publishedProjectCount} published
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--cf-border-subtle)] pt-3.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={isActive ? "secondary" : "default"}
                    disabled={isSwitching}
                    onClick={() =>
                      void selectActiveSpace(isActive ? "all" : space.id, {
                        navigateDashboard: false,
                      })
                    }
                  >
                    {isSwitching ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : isActive ? (
                      <>
                        <Check className="size-3.5" />
                        <span>Selected</span>
                      </>
                    ) : (
                      <>
                        <Layers className="size-3.5" />
                        <span>Use space</span>
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={isSwitching}
                    onClick={() =>
                      void selectActiveSpace(space.id, { navigateDashboard: true })
                    }
                  >
                    <span>Open projects</span>
                    <ArrowRight className="size-3.5" />
                  </Button>
                </div>

                {canEditOrDelete && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setRenameTarget(space);
                        setRenameValue(space.name);
                        setRenameError(null);
                      }}
                    >
                      <Pencil className="size-3.5" />
                      <span>Rename</span>
                    </Button>

                    {workspace.kind === "team" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setTransitionTarget(space);
                          setTransitionConfirmed(false);
                          setTransitionError(null);
                        }}
                      >
                        {space.visibility === "private" ? (
                          <>
                            <Users className="size-3.5" />
                            <span>Make shared</span>
                          </>
                        ) : (
                          <>
                            <Lock className="size-3.5" />
                            <span>Make private</span>
                          </>
                        )}
                      </Button>
                    )}

                    {canDelete && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        data-testid={`delete-space-${space.id}`}
                        className="text-destructive hover:text-destructive"
                        onClick={() => openDeleteDialog(space)}
                      >
                        <Trash2 className="size-3.5" />
                        <span>Delete</span>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </section>

      {/* Create Space Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create a space</DialogTitle>
            <DialogDescription>
              {workspace.kind === "team"
                ? "Private spaces remain invisible to teammates. Shared spaces let workspace members collaborate on projects."
                : "Organize projects into dedicated spaces inside your Personal Workspace."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="spaces-create-name">Space name</Label>
              <Input
                id="spaces-create-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Mobile Portfolio"
                minLength={2}
                maxLength={60}
                required
                autoFocus
              />
            </div>

            {workspace.kind === "team" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="spaces-create-visibility">Visibility</Label>
                <Select
                  id="spaces-create-visibility"
                  value={createVisibility}
                  onChange={(e) => setCreateVisibility(e.target.value as SpaceVisibility)}
                >
                  <option value="private">Private Space (only you)</option>
                  {canManageTeamSpaces && (
                    <option value="shared">Shared Team Space (all workspace members)</option>
                  )}
                </Select>
              </div>
            )}

            <label className="text-foreground flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={selectAfterCreate}
                onChange={(e) => setSelectAfterCreate(e.target.checked)}
                className="accent-primary size-4 rounded-xs"
              />
              <span>Switch top active space to this space after creation</span>
            </label>

            {createError && (
              <p role="alert" className="text-destructive type-caption">
                {createError}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCreateOpen(false)}
                disabled={createBusy}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createBusy || createName.trim().length < 2}>
                {createBusy ? "Creating…" : "Create space"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rename Space Modal */}
      <Dialog
        open={Boolean(renameTarget)}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rename space</DialogTitle>
            <DialogDescription>
              Update how “{renameTarget?.name ?? "space"}” appears in your top switcher and project
              cards.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRenameSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="spaces-rename-input">Space name</Label>
              <Input
                id="spaces-rename-input"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                minLength={2}
                maxLength={60}
                required
                autoFocus
              />
            </div>

            {renameError && (
              <p role="alert" className="text-destructive type-caption">
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
              <Button type="submit" disabled={renameBusy || renameValue.trim().length < 2}>
                {renameBusy ? "Saving…" : "Save name"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Transition Visibility Modal */}
      <Dialog
        open={Boolean(transitionTarget)}
        onOpenChange={(open) => {
          if (!open) setTransitionTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {transitionTarget?.visibility === "private"
                ? `Make “${transitionTarget.name}” Shared?`
                : `Make “${transitionTarget?.name ?? "space"}” Private?`}
            </DialogTitle>
            <DialogDescription>
              {transitionTarget?.visibility === "private"
                ? "All workspace Owners, Admins, and Members will gain access to projects inside this space."
                : "Projects in this space will become invisible to teammates, active collaborator leases will be revoked, and published projects in this space will be unpublished."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleTransitionSubmit} className="flex flex-col gap-4">
            <label className="text-foreground type-body-s flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={transitionConfirmed}
                onChange={(e) => setTransitionConfirmed(e.target.checked)}
                className="accent-primary mt-1 size-4 rounded-xs"
              />
              <span>
                I understand the visibility and publishing changes for projects in this space.
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
                onClick={() => setTransitionTarget(null)}
                disabled={transitionBusy}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={transitionBusy || !transitionConfirmed}>
                {transitionBusy ? "Updating…" : "Confirm visibility"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Space Modal */}
      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete “{deleteTarget?.name ?? "space"}”?</DialogTitle>
            <DialogDescription>
              {deleteTarget && deleteTarget.projectCount > 0
                ? `This space currently contains ${deleteTarget.projectCount} ${deleteTarget.projectCount === 1 ? "project" : "projects"}. Choose which space should receive them before deleting.`
                : "This space has no projects and will be removed permanently."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDeleteSubmit} className="flex flex-col gap-4">
            {deleteTarget && deleteTarget.projectCount > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="spaces-delete-destination">Move projects to</Label>
                <Select
                  id="spaces-delete-destination"
                  value={destinationSpaceId}
                  onChange={(e) => setDestinationSpaceId(e.target.value)}
                >
                  {spaces
                    .filter((s) => s.id !== deleteTarget.id)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.visibility === "private" ? "Private" : "Shared"})
                      </option>
                    ))}
                </Select>
              </div>
            )}

            <label className="text-foreground type-body-s flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={deleteConfirmed}
                onChange={(e) => setDeleteConfirmed(e.target.checked)}
                className="accent-primary mt-1 size-4 rounded-xs"
              />
              <span>Confirm deleting “{deleteTarget?.name ?? "space"}”.</span>
            </label>

            {deleteError && (
              <p role="alert" className="text-destructive type-caption">
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
                  !deleteConfirmed ||
                  (Boolean(deleteTarget?.projectCount) && !destinationSpaceId)
                }
              >
                {deleteBusy ? "Deleting…" : "Delete space"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
