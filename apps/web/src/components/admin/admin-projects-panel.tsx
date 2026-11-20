"use client";

import {
  Archive,
  ExternalLink,
  EyeOff,
  FolderKanban,
  RotateCcw,
  Search,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { TemplateThumbnail } from "@/components/templates/template-thumbnail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Input } from "@/components/ui/input";
import type {
  AdminProjectListItem,
  AdminProjectsOverview,
} from "@/lib/admin/projects-types";
import { formatRelativeActivity } from "@/lib/admin/users-types";
import { cn } from "@/lib/utils";

type ProjectFilterTab = "all" | "public" | "private" | "archived" | "takedown" | "team";

export function AdminProjectsPanel({
  initialOverview,
}: {
  initialOverview: AdminProjectsOverview;
}) {
  const [overview, setOverview] = useState<AdminProjectsOverview>(initialOverview);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ProjectFilterTab>("all");
  const [isPending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return overview.projects.filter((p) => {
      if (filter === "public" && p.visibility !== "public") return false;
      if (filter === "private" && p.visibility !== "private") return false;
      if (filter === "archived" && !p.archivedAtIso) return false;
      if (filter === "takedown" && !p.suspendedReason) return false;
      if (filter === "team" && p.workspaceKind !== "team") return false;
      if (q) {
        const hay = `${p.name} ${p.slug ?? ""} ${p.ownerName} ${p.ownerEmail} ${p.templateName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [overview.projects, search, filter]);

  function runProjectMutation(
    project: AdminProjectListItem,
    action: "unpublish" | "takedown" | "restore" | "archive" | "unarchive" | "delete",
  ) {
    setErrorMessage(null);
    setStatusMessage(null);
    startTransition(async () => {
      const response =
        action === "delete"
          ? await fetch("/api/admin/projects", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ projectId: project.id }),
            })
          : await fetch("/api/admin/projects", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action,
                projectId: project.id,
              }),
            });

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        overview?: AdminProjectsOverview;
      };
      if (!response.ok || !payload.ok) {
        setErrorMessage(payload.error ?? "Failed to apply project action.");
        return;
      }
      if (payload.overview) {
        setOverview(payload.overview);
      }
      setStatusMessage(`Applied "${action}" to "${project.name}".`);
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-1.5">
          <Eyebrow icon={<FolderKanban className="size-3.5" />}>
            Platform Case Studies
          </Eyebrow>
          <h1 className="text-foreground type-display-m">
            All Platform Projects ({overview.summary.total})
          </h1>
          <p className="text-muted-foreground type-body-s max-w-2xl">
            Inspect every case study created across personal and Team workspaces, jump directly to its owner profile, or moderate and manage publication state.
          </p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="p-4">
          <span className="text-muted-foreground type-caption">Total Projects</span>
          <span className="text-foreground type-display-s mt-1">{overview.summary.total}</span>
        </Card>
        <Card className="p-4">
          <span className="text-muted-foreground type-caption">Published Public</span>
          <span className="text-foreground type-display-s mt-1">{overview.summary.published}</span>
        </Card>
        <Card className="p-4">
          <span className="text-muted-foreground type-caption">Private Drafts</span>
          <span className="text-foreground type-display-s mt-1">{overview.summary.draft}</span>
        </Card>
        <Card className="p-4">
          <span className="text-muted-foreground type-caption">Team Projects</span>
          <span className="text-foreground type-display-s mt-1">{overview.summary.team}</span>
        </Card>
        <Card className="p-4">
          <span className="text-muted-foreground type-caption">Frozen / Takedown</span>
          <span className="text-foreground type-display-s mt-1">
            {overview.summary.takedownOrSuspended}
          </span>
        </Card>
      </div>

      <Card className="gap-4 p-5">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div className="relative w-full md:max-w-sm">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              aria-label="Search projects or owners"
              placeholder="Search project, slug, owner, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: "all", label: "All" },
                { id: "public", label: "Published" },
                { id: "private", label: "Drafts" },
                { id: "team", label: "Team" },
                { id: "archived", label: "Archived" },
                { id: "takedown", label: "Suspended" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                  filter === tab.id
                    ? "border-[var(--cf-royal)] bg-[var(--cf-royal)] text-[var(--cf-text-on-royal)]"
                    : "border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] text-[var(--cf-text-secondary)] hover:text-[var(--cf-text-primary)]",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {errorMessage && (
          <div role="alert" className="text-destructive type-body-s">
            {errorMessage}
          </div>
        )}
        {statusMessage && (
          <div role="status" className="text-success type-body-s font-medium">
            {statusMessage}
          </div>
        )}

        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[780px] border-collapse text-left">
            <thead>
              <tr className="border-border/70 border-b">
                <th className="text-tertiary type-overline py-2.5 pr-3">Case Study</th>
                <th className="text-tertiary type-overline px-3 py-2.5">Owner Profile</th>
                <th className="text-tertiary type-overline px-3 py-2.5">Template &amp; Workspace</th>
                <th className="text-tertiary type-overline px-3 py-2.5">Status</th>
                <th className="text-tertiary type-overline px-3 py-2.5 text-right">Traffic</th>
                <th className="text-tertiary type-overline py-2.5 pl-3 text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-muted-foreground type-body-s py-10 text-center">
                    No matching case studies found.
                  </td>
                </tr>
              ) : (
                filtered.map((proj) => (
                  <tr key={proj.id} className="hover:bg-surface/50 transition-colors">
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-3">
                        <div className="size-10 shrink-0 overflow-hidden rounded-lg border border-[var(--cf-border-subtle)]">
                          <TemplateThumbnail
                            coverUrl={proj.templateCoverUrl}
                            name={proj.templateName}
                            className="size-full"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-foreground type-body-s-strong truncate">
                            {proj.name}
                          </p>
                          <p className="text-muted-foreground type-caption truncate font-mono">
                            {proj.slug ? `/p/${proj.slug}` : "no-slug"} · Updated{" "}
                            {formatRelativeActivity(proj.updatedAtIso)}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-3">
                      <Link
                        href={`/admin/users/${proj.ownerId}`}
                        data-testid={`project-owner-link-${proj.id}`}
                        className="text-foreground hover:text-primary type-body-s-strong block underline-offset-4 hover:underline"
                      >
                        {proj.ownerName}
                      </Link>
                      <span className="text-muted-foreground type-caption block">
                        {proj.ownerEmail} · {proj.ownerPlan.toUpperCase()}
                      </span>
                    </td>

                    <td className="px-3 py-3">
                      <span className="text-foreground type-body-s block">
                        {proj.templateName}
                      </span>
                      <span className="text-muted-foreground type-caption block">
                        {proj.workspaceKind === "team"
                          ? `Team: ${proj.orgName ?? "Shared"}`
                          : "Personal"}
                      </span>
                    </td>

                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Badge
                          tone={
                            proj.suspendedReason
                              ? "danger"
                              : proj.visibility === "public"
                                ? "published"
                                : "neutral"
                          }
                        >
                          {proj.suspendedReason
                            ? "Suspended"
                            : proj.visibility === "public"
                              ? "Published"
                              : proj.visibility === "unlisted"
                                ? "Unlisted"
                                : "Draft"}
                        </Badge>
                        {proj.archivedAtIso && <Badge tone="draft">Archived</Badge>}
                      </div>
                    </td>

                    <td className="px-3 py-3 text-right">
                      <span className="text-foreground type-body-s block font-mono">
                        {proj.views.toLocaleString("en-US")} views
                      </span>
                      <span className="text-muted-foreground type-caption block font-mono">
                        {proj.exports} exports
                      </span>
                    </td>

                    <td className="py-3 pl-3 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {proj.slug && (
                          <Button asChild variant="ghost" size="sm" title="View public link">
                            <Link href={`/p/${proj.slug}`} target="_blank">
                              <ExternalLink className="size-3.5" />
                            </Link>
                          </Button>
                        )}
                        {proj.visibility !== "private" && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={isPending}
                            title="Unpublish"
                            onClick={() => runProjectMutation(proj, "unpublish")}
                          >
                            <EyeOff className="size-3.5" />
                          </Button>
                        )}
                        {proj.suspendedReason ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={isPending}
                            title="Restore access"
                            onClick={() => runProjectMutation(proj, "restore")}
                          >
                            <RotateCcw className="size-3.5" />
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={isPending}
                            title="Moderation takedown"
                            onClick={() => runProjectMutation(proj, "takedown")}
                          >
                            <ShieldAlert className="size-3.5" />
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          title={proj.archivedAtIso ? "Unarchive" : "Archive"}
                          onClick={() =>
                            runProjectMutation(
                              proj,
                              proj.archivedAtIso ? "unarchive" : "archive",
                            )
                          }
                        >
                          <Archive className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          title="Delete permanently"
                          className="text-destructive"
                          onClick={() => runProjectMutation(proj, "delete")}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
