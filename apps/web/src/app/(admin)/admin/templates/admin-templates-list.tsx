"use client";

import {
  Archive,
  ExternalLink,
  LayoutTemplate,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { TemplateThumbnail } from "@/components/templates/template-thumbnail";
import { Badge, ProBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
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
import type { TemplateProjectType, TemplateStatus, TemplateTier } from "@/lib/template/schema";
import {
  filterAdminTemplates,
  type AdminTemplateFilterState,
  type AdminTemplateSummary,
  type DeleteTemplateActionResult,
  type TemplateLifecycleActionResult,
} from "@/lib/template/types";
import { cn } from "@/lib/utils";

const TYPE_FILTER_OPTIONS: ReadonlyArray<{ value: "all" | TemplateProjectType; label: string }> = [
  { value: "all", label: "All" },
  { value: "mobile", label: "Mobile app" },
  { value: "web", label: "Website" },
  { value: "both", label: "Mobile + Web" },
];

const STATUS_FILTER_OPTIONS: ReadonlyArray<{ value: "all" | TemplateStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
];

const TIER_FILTER_OPTIONS: ReadonlyArray<{ value: "all" | TemplateTier; label: string }> = [
  { value: "all", label: "All" },
  { value: "free", label: "Free" },
  { value: "pro", label: "Pro" },
];

function formatProjectTypeLabel(type: TemplateProjectType): string {
  if (type === "mobile") return "Mobile app";
  if (type === "web") return "Website";
  return "Mobile + Web";
}

function formatRelativeUpdated(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 24) return "Today";
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) return `${diffWeeks}w ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function StatusBadge({ status }: { status: TemplateStatus }) {
  if (status === "published") {
    return <Badge tone="published">Published</Badge>;
  }
  if (status === "draft") {
    return <Badge tone="draft">Draft</Badge>;
  }
  return <Badge tone="neutral">Archived</Badge>;
}

export interface AdminCategoryOption {
  id: string;
  name: string;
  slug: string;
}

export interface AdminTemplatesListProps {
  templates: AdminTemplateSummary[];
  categories?: AdminCategoryOption[];
  initialFilters?: Partial<AdminTemplateFilterState>;
  archiveAction?: (payload: { templateId: string }) => Promise<TemplateLifecycleActionResult>;
  unarchiveAction?: (payload: { templateId: string }) => Promise<TemplateLifecycleActionResult>;
  deleteAction?: (payload: {
    templateId: string;
    confirmName: string;
  }) => Promise<DeleteTemplateActionResult>;
}

export function AdminTemplatesList({
  templates,
  categories = [],
  initialFilters,
  archiveAction,
  unarchiveAction,
  deleteAction,
}: AdminTemplatesListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [searchQuery, setSearchQuery] = useState(initialFilters?.searchQuery ?? "");
  const [typeFilter, setTypeFilter] = useState<"all" | TemplateProjectType>(
    initialFilters?.type ?? "all",
  );
  const [statusFilter, setStatusFilter] = useState<"all" | TemplateStatus>(
    initialFilters?.status ?? "all",
  );
  const [categoryFilter, setCategoryFilter] = useState<string>(
    initialFilters?.categorySlug ?? "all",
  );
  const [tierFilter, setTierFilter] = useState<"all" | TemplateTier>(
    initialFilters?.tier ?? "all",
  );

  const [deleteTarget, setDeleteTarget] = useState<AdminTemplateSummary | null>(null);
  const [confirmNameInput, setConfirmNameInput] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const categoryOptions = useMemo(() => {
    const bySlug = new Map<string, string>();
    for (const c of categories) {
      bySlug.set(c.slug, c.name);
    }
    for (const t of templates) {
      if (t.categorySlug && t.categoryName && !bySlug.has(t.categorySlug)) {
        bySlug.set(t.categorySlug, t.categoryName);
      }
    }
    return Array.from(bySlug.entries()).map(([slug, name]) => ({ slug, name }));
  }, [categories, templates]);

  const filtered = useMemo(
    () =>
      filterAdminTemplates(templates, {
        searchQuery,
        type: typeFilter,
        status: statusFilter,
        categorySlug: categoryFilter,
        tier: tierFilter,
      }),
    [templates, searchQuery, typeFilter, statusFilter, categoryFilter, tierFilter],
  );

  function handleArchiveToggle(item: AdminTemplateSummary) {
    setActionError(null);
    startTransition(async () => {
      const fn = item.status === "archived" ? unarchiveAction : archiveAction;
      if (!fn) return;
      const res = await fn({ templateId: item.id });
      if (!res.ok) {
        setActionError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function openDeleteDialog(item: AdminTemplateSummary) {
    setDeleteTarget(item);
    setConfirmNameInput("");
    setActionError(null);
  }

  function handleConfirmDelete() {
    if (!deleteTarget || !deleteAction) return;
    setActionError(null);
    startTransition(async () => {
      const res = await deleteAction({
        templateId: deleteTarget.id,
        confirmName: confirmNameInput,
      });
      if (!res.ok) {
        setActionError(res.error);
        return;
      }
      setDeleteTarget(null);
      setConfirmNameInput("");
      router.refresh();
    });
  }

  // Empty state (Figma 31:7117 — Admin — Templates — Empty)
  if (templates.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-8">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="flex min-w-0 flex-col gap-2">
            <Eyebrow className="w-fit">Template Library</Eyebrow>
            <h1 className="text-foreground type-display-m">Templates</h1>
            <p className="text-muted-foreground type-body-s">
              Templates designed by the Casefolio team.
            </p>
          </div>
        </header>

        <Card
          data-testid="admin-templates-empty-state"
          className="items-center justify-center gap-4 px-6 py-20 text-center"
        >
          <div className="bg-accent/70 text-primary flex size-14 items-center justify-center rounded-2xl">
            <LayoutTemplate className="size-6" />
          </div>
          <div className="flex max-w-md flex-col gap-1.5">
            <h2 className="text-foreground type-heading-m">No templates yet</h2>
            <p className="text-muted-foreground type-body-s">
              Upload your first template so designers can start building case studies.
            </p>
          </div>
          <Button asChild size="lg">
            <Link href="/admin/templates/new">
              <Plus className="size-4" />
              Upload template
            </Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="flex min-w-0 flex-col gap-2">
          <Eyebrow className="w-fit">Template Library</Eyebrow>
          <h1 className="text-foreground type-display-m">Templates</h1>
          <p className="text-muted-foreground type-body-s">
            Templates designed by the Casefolio team. Users only see Published.
          </p>
        </div>

        <Button asChild>
          <Link href="/admin/templates/new">
            <Plus className="size-4" />
            Upload template
          </Link>
        </Button>
      </header>

      {actionError && !deleteTarget && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive-soft text-destructive type-body-s rounded-2xl border px-4 py-3"
        >
          {actionError}
        </div>
      )}

      {/* Filters (Figma 31:6973 + C-902 search + status/type/category/tier) */}
      <Card aria-label="Template filters" className="p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex w-full min-w-0 flex-col gap-1.5 xl:max-w-xs">
            <label htmlFor="admin-template-search" className="text-foreground type-caption">
              Search
            </label>
            <div className="relative">
              <Search className="text-tertiary pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
              <Input
                id="admin-template-search"
                placeholder="Search name, slug, or category..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="rounded-full pl-9"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-foreground type-caption">Type</span>
              <div
                role="group"
                aria-label="Filter by type"
                className="border-border/70 bg-sunken/80 inline-flex flex-wrap gap-1 rounded-full border p-1"
              >
                {TYPE_FILTER_OPTIONS.map((opt) => {
                  const active = typeFilter === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setTypeFilter(opt.value)}
                      className={cn(
                        "rounded-full px-3 py-1 transition-all",
                        active
                          ? "bg-elevated text-foreground shadow-card type-caption font-medium"
                          : "text-muted-foreground hover:text-foreground type-caption",
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-foreground type-caption">Status</span>
              <div
                role="group"
                aria-label="Filter by status"
                className="border-border/70 bg-sunken/80 inline-flex flex-wrap gap-1 rounded-full border p-1"
              >
                {STATUS_FILTER_OPTIONS.map((opt) => {
                  const active = statusFilter === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setStatusFilter(opt.value)}
                      className={cn(
                        "rounded-full px-3 py-1 transition-all",
                        active
                          ? "bg-elevated text-foreground shadow-card type-caption font-medium"
                          : "text-muted-foreground hover:text-foreground type-caption",
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-foreground type-caption">Tier</span>
              <div
                role="group"
                aria-label="Filter by tier"
                className="border-border/70 bg-sunken/80 inline-flex flex-wrap gap-1 rounded-full border p-1"
              >
                {TIER_FILTER_OPTIONS.map((opt) => {
                  const active = tierFilter === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setTierFilter(opt.value)}
                      className={cn(
                        "rounded-full px-3 py-1 transition-all",
                        active
                          ? "bg-elevated text-foreground shadow-card type-caption font-medium"
                          : "text-muted-foreground hover:text-foreground type-caption",
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="admin-template-category" className="text-foreground type-caption">
                Category
              </label>
              <select
                id="admin-template-category"
                aria-label="Filter by category"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="border-border/80 bg-elevated text-foreground type-caption focus-visible:ring-ring/40 h-9 rounded-full border px-3.5 shadow-xs outline-none focus-visible:ring-2"
              >
                <option value="all">All categories</option>
                {categoryOptions.map((cat) => (
                  <option key={cat.slug} value={cat.slug}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Templates table (Figma 31:7003) */}
      <Card className="min-w-0 gap-0 overflow-hidden p-0">
        <div className="w-full max-w-full overflow-x-auto">
          <table className="w-full min-w-180 border-collapse text-left">
            <thead>
              <tr className="border-border/70 bg-surface/60 border-b">
                <th className="text-tertiary type-overline px-5 py-3.5">Template</th>
                <th className="text-tertiary type-overline px-4 py-3.5">Type</th>
                <th className="text-tertiary type-overline px-4 py-3.5">Status</th>
                <th className="text-tertiary type-overline px-4 py-3.5">Version</th>
                <th className="text-tertiary type-overline px-4 py-3.5">Sections</th>
                <th className="text-tertiary type-overline px-4 py-3.5">Slots</th>
                <th className="text-tertiary type-overline px-4 py-3.5">Updated</th>
                <th className="text-tertiary type-overline px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-border/70 divide-y">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-muted-foreground type-body-s px-5 py-10 text-center">
                    No templates match the active filters.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-surface/60 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3.5">
                        <Link
                          href={`/admin/templates/${item.id}`}
                          aria-label={`View ${item.name} details`}
                          className="shrink-0"
                        >
                          <TemplateThumbnail
                            testId={`admin-template-row-thumb-${item.slug}`}
                            coverUrl={item.coverUrl}
                            slug={item.slug}
                            name={item.name}
                            hideFallbackLabel
                            className="border-border/80 aspect-[4/3] w-16 rounded-xl border p-2 shadow-2xs"
                          />
                        </Link>
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/admin/templates/${item.id}`}
                            className="text-foreground hover:text-primary type-body-s-strong transition-colors"
                          >
                            {item.name}
                          </Link>
                          {item.tier === "pro" && <ProBadge />}
                          {item.categoryName && (
                            <span className="text-tertiary type-caption">· {item.categoryName}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="text-muted-foreground type-body-s px-4 py-4">
                      {formatProjectTypeLabel(item.type)}
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="text-foreground type-mono-s px-4 py-4">
                      {item.currentVersion ? `v${item.currentVersion}` : "—"}
                    </td>
                    <td className="text-muted-foreground type-body-s px-4 py-4">
                      {item.sectionCount}
                    </td>
                    <td className="text-muted-foreground type-body-s px-4 py-4">{item.slotCount}</td>
                    <td className="text-tertiary type-caption px-4 py-4">
                      {formatRelativeUpdated(item.updatedAtIso)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button asChild variant="secondary" size="sm">
                          <Link href={`/admin/templates/${item.id}`}>Manage</Link>
                        </Button>

                        {(archiveAction || unarchiveAction || deleteAction) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={`Actions for ${item.name}`}
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/admin/templates/${item.id}`}>
                                  <ExternalLink className="size-4" />
                                  Open template detail
                                </Link>
                              </DropdownMenuItem>
                              {(archiveAction || unarchiveAction) && (
                                <DropdownMenuItem
                                  disabled={isPending}
                                  onSelect={() => handleArchiveToggle(item)}
                                >
                                  {item.status === "archived" ? (
                                    <>
                                      <RotateCcw className="size-4" />
                                      Restore to draft
                                    </>
                                  ) : (
                                    <>
                                      <Archive className="size-4" />
                                      Archive template
                                    </>
                                  )}
                                </DropdownMenuItem>
                              )}
                              {deleteAction && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onSelect={() => openDeleteDialog(item)}
                                  >
                                    <Trash2 className="size-4" />
                                    Delete template…
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-tertiary type-caption">
        Showing {filtered.length} of {templates.length}{" "}
        {templates.length === 1 ? "template" : "templates"}
      </p>

      {/* Delete confirm modal (Figma 32:8045) */}
      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setConfirmNameInput("");
            setActionError(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete “{deleteTarget?.name}”?</DialogTitle>
            <DialogDescription>
              {(deleteTarget?.projectCount ?? 0) > 0
                ? `This template is used by ${deleteTarget?.projectCount} project${deleteTarget?.projectCount === 1 ? "" : "s"}. They keep working, but nobody can pick it again. This can’t be undone.`
                : "This permanently deletes the template and all of its versions. This can’t be undone."}
            </DialogDescription>
          </DialogHeader>

          {actionError && (
            <div
              role="alert"
              className="border-destructive/30 bg-destructive-soft text-destructive type-body-s rounded-lg border px-3 py-2"
            >
              {actionError}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="delete-template-confirm" className="text-foreground type-caption">
              Type <span className="type-body-s-strong">{deleteTarget?.name}</span> to confirm
            </label>
            <Input
              id="delete-template-confirm"
              value={confirmNameInput}
              onChange={(event) => setConfirmNameInput(event.target.value)}
              placeholder={deleteTarget?.name ?? ""}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDeleteTarget(null);
                setConfirmNameInput("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending || confirmNameInput.trim() !== (deleteTarget?.name.trim() ?? "")}
              onClick={handleConfirmDelete}
            >
              {isPending ? "Deleting..." : "Delete template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
