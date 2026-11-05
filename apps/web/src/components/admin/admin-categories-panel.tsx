"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  slugifyCategory,
  type AdminCategoriesOverview,
  type AdminCategoryItem,
} from "@/lib/admin/categories-types";
import { cn } from "@/lib/utils";

type ViewTab = "all" | "types" | "categories";

export function AdminCategoriesPanel({
  initialOverview,
}: {
  initialOverview: AdminCategoriesOverview;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [overview, setOverview] = useState<AdminCategoriesOverview>(initialOverview);
  const [activeTab, setActiveTab] = useState<ViewTab>("all");

  const firstCat = initialOverview.categories[0] ?? null;
  const [mode, setMode] = useState<"create" | "edit">(firstCat ? "edit" : "create");
  const [selectedId, setSelectedId] = useState<string | null>(firstCat?.id ?? null);
  const [nameInput, setNameInput] = useState(firstCat?.name ?? "");
  const [slugInput, setSlugInput] = useState(firstCat?.slug ?? "");
  const [sortInput, setSortInput] = useState(String(firstCat?.sort ?? 10));
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(Boolean(firstCat));

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function selectCategoryForEdit(cat: AdminCategoryItem) {
    setMode("edit");
    setSelectedId(cat.id);
    setNameInput(cat.name);
    setSlugInput(cat.slug);
    setSortInput(String(cat.sort));
    setSlugManuallyEdited(true);
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function startNewCategory() {
    const nextSort =
      overview.categories.length === 0
        ? 10
        : Math.max(...overview.categories.map((c) => c.sort)) + 10;
    setMode("create");
    setSelectedId(null);
    setNameInput("");
    setSlugInput("");
    setSortInput(String(nextSort));
    setSlugManuallyEdited(false);
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function handleNameChange(value: string) {
    setNameInput(value);
    if (!slugManuallyEdited) {
      setSlugInput(slugifyCategory(value));
    }
  }

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const parsedSort = Number.parseInt(sortInput, 10);
    const safeSort = Number.isFinite(parsedSort) && parsedSort >= 0 ? parsedSort : 10;

    startTransition(async () => {
      const response =
        mode === "create"
          ? await fetch("/api/admin/categories", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: nameInput.trim(),
                slug: slugInput.trim() || undefined,
                sort: safeSort,
              }),
            })
          : await fetch("/api/admin/categories", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "update",
                id: selectedId,
                name: nameInput.trim(),
                slug: slugInput.trim(),
                sort: safeSort,
              }),
            });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        overview?: AdminCategoriesOverview;
        category?: AdminCategoryItem;
      };

      if (!response.ok || !payload.overview) {
        setErrorMessage(payload.error ?? "Failed to save category.");
        return;
      }

      setOverview(payload.overview);
      if (mode === "create" && payload.category) {
        selectCategoryForEdit(payload.category);
        setSuccessMessage(`Created category “${payload.category.name}”.`);
      } else {
        setSuccessMessage("Category saved and synced to template library filters.");
      }
      router.refresh();
    });
  }

  function handleMove(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= overview.categories.length) return;

    const reordered = [...overview.categories];
    const [moved] = reordered.splice(index, 1);
    if (!moved) return;
    reordered.splice(nextIndex, 0, moved);

    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const response = await fetch("/api/admin/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reorder",
          orderedIds: reordered.map((c) => c.id),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        overview?: AdminCategoriesOverview;
      };
      if (!response.ok || !payload.overview) {
        setErrorMessage(payload.error ?? "Failed to reorder categories.");
        return;
      }
      setOverview(payload.overview);
      setSuccessMessage("Category order updated.");
      router.refresh();
    });
  }

  function handleDelete(categoryId: string) {
    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const response = await fetch("/api/admin/categories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: categoryId }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        overview?: AdminCategoriesOverview;
      };
      if (!response.ok || !payload.overview) {
        setErrorMessage(payload.error ?? "Failed to delete category.");
        return;
      }
      setOverview(payload.overview);
      const next = payload.overview.categories[0] ?? null;
      if (next) {
        selectCategoryForEdit(next);
      } else {
        startNewCategory();
      }
      setSuccessMessage("Category deleted.");
      router.refresh();
    });
  }

  const selectedCategory = overview.categories.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6">
      {/* Page header (Figma 32:8761) */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-foreground type-heading-l">Categories &amp; types</h1>
          <p className="text-muted-foreground type-body-s">
            Template types and categories shown in the picker.
          </p>
        </div>

        <Button type="button" onClick={startNewCategory}>
          <Plus className="size-4" />
          Add category
        </Button>
      </header>

      {/* Tabs (Figma 33:8304) */}
      <div>
        <div
          role="tablist"
          aria-label="Categories and types view"
          className="border-border bg-elevated inline-flex flex-wrap gap-1 rounded-full border p-1"
        >
          {(
            [
              { id: "all", label: "All" },
              { id: "categories", label: "Categories" },
              { id: "types", label: "Types" },
            ] as const
          ).map((tab) => {
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

      {errorMessage && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive-soft text-destructive type-body-s rounded-lg border px-4 py-3"
        >
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="border-success/30 bg-success-soft text-foreground type-body-s rounded-lg border px-4 py-3"
        >
          {successMessage}
        </div>
      )}

      {/* Types summary table (Figma 33:8314) */}
      {(activeTab === "all" || activeTab === "types") && (
        <Card variant="flat" className="min-w-0 overflow-hidden">
          <div className="w-full max-w-full overflow-x-auto">
            <table className="w-full min-w-140 border-collapse text-left">
              <thead>
                <tr className="border-border bg-surface border-b">
                  <th className="text-tertiary type-overline px-5 py-3">Type</th>
                  <th className="text-tertiary type-overline px-4 py-3">Templates</th>
                  <th className="text-tertiary type-overline px-4 py-3">Projects</th>
                  <th className="text-tertiary type-overline px-4 py-3">Status</th>
                  <th className="text-tertiary type-overline px-5 py-3 text-right">Order</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {overview.types.map((t) => (
                  <tr key={t.type} className="hover:bg-surface/60 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex flex-col">
                        <span className="text-foreground type-body-s-strong">{t.label}</span>
                        <span className="text-muted-foreground type-caption">{t.description}</span>
                      </div>
                    </td>
                    <td className="text-foreground type-body-s px-4 py-4">{t.templateCount}</td>
                    <td className="text-foreground type-body-s px-4 py-4">{t.projectCount}</td>
                    <td className="px-4 py-4">
                      <Badge tone="published">Active</Badge>
                    </td>
                    <td className="text-muted-foreground type-mono-s px-5 py-4 text-right">
                      {t.order}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Categories CRUD + Ordering area (Figma 33:8430) */}
      {(activeTab === "all" || activeTab === "categories") && (
        <div className="grid gap-6 lg:grid-cols-12">
          <Card variant="flat" className="min-w-0 gap-4 p-6 lg:col-span-7">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-foreground type-heading-s">
                Categories ({overview.categories.length})
              </h2>
              <Button type="button" variant="secondary" size="sm" onClick={startNewCategory}>
                <Plus className="size-3.5" />
                New category
              </Button>
            </div>

            {overview.categories.length === 0 ? (
              <p className="text-muted-foreground type-body-s py-6 text-center">
                No categories created yet. Add your first category to populate library filters.
              </p>
            ) : (
              <ul className="divide-border flex flex-col divide-y" data-testid="admin-categories-list">
                {overview.categories.map((cat, idx) => {
                  const isSelected = mode === "edit" && selectedId === cat.id;
                  return (
                    <li
                      key={cat.id}
                      className={cn(
                        "flex flex-wrap items-center justify-between gap-3 py-3 transition-colors",
                        isSelected && "bg-surface/80 -mx-2 rounded-md px-2",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="text-tertiary type-mono-s w-6 shrink-0">{idx + 1}.</span>
                        <div className="flex min-w-0 flex-col">
                          <span className="text-foreground type-body-s-strong truncate">
                            {cat.name}
                          </span>
                          <span className="text-tertiary type-mono-s truncate">{cat.slug}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge tone="neutral">
                          {cat.templateCount} {cat.templateCount === 1 ? "template" : "templates"}
                        </Badge>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={isPending || idx === 0}
                          aria-label={`Move ${cat.name} up`}
                          onClick={() => handleMove(idx, -1)}
                        >
                          <ArrowUp className="size-4" />
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={isPending || idx === overview.categories.length - 1}
                          aria-label={`Move ${cat.name} down`}
                          onClick={() => handleMove(idx, 1)}
                        >
                          <ArrowDown className="size-4" />
                        </Button>

                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => selectCategoryForEdit(cat)}
                        >
                          Edit
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card variant="flat" className="min-w-0 gap-4 p-6 lg:col-span-5">
            <h2 className="text-foreground type-heading-s">
              {mode === "create"
                ? "New category"
                : `Edit category · ${selectedCategory?.name ?? ""}`}
            </h2>

            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="cat-name-input" className="text-foreground type-caption">
                  Category name
                </label>
                <Input
                  id="cat-name-input"
                  value={nameInput}
                  onChange={(event) => handleNameChange(event.target.value)}
                  placeholder="e.g. Fintech"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="cat-slug-input" className="text-foreground type-caption">
                  URL &amp; filter slug
                </label>
                <Input
                  id="cat-slug-input"
                  value={slugInput}
                  onChange={(event) => {
                    setSlugManuallyEdited(true);
                    setSlugInput(event.target.value);
                  }}
                  placeholder="e.g. fintech"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="cat-sort-input" className="text-foreground type-caption">
                  Display sort order
                </label>
                <Input
                  id="cat-sort-input"
                  type="number"
                  min={0}
                  max={9999}
                  value={sortInput}
                  onChange={(event) => setSortInput(event.target.value)}
                />
              </div>

              <p className="text-muted-foreground type-caption">
                Categories appear in ascending sort order in the template library picker.
              </p>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <div className="flex items-center gap-2">
                  <Button type="submit" disabled={isPending || !nameInput.trim()}>
                    {isPending
                      ? "Saving..."
                      : mode === "create"
                        ? "Create category"
                        : "Save changes"}
                  </Button>
                  {mode === "edit" && (
                    <Button type="button" variant="secondary" onClick={startNewCategory}>
                      Cancel
                    </Button>
                  )}
                </div>

                {mode === "edit" && selectedCategory && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={isPending || selectedCategory.templateCount > 0}
                    title={
                      selectedCategory.templateCount > 0
                        ? "Reassign or archive templates using this category first"
                        : "Delete category"
                    }
                    onClick={() => handleDelete(selectedCategory.id)}
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </Button>
                )}
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
