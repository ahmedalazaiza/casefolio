"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, ProBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TemplateProjectType, TemplateStatus } from "@/lib/template/schema";
import type { AdminTemplateSummary } from "@/lib/template/types";
import { cn } from "@/lib/utils";

const TYPE_FILTER_OPTIONS: ReadonlyArray<{ value: "all" | TemplateProjectType; label: string }> = [
  { value: "all", label: "All" },
  { value: "mobile", label: "Mobile app" },
  { value: "web", label: "Website" },
  { value: "both", label: "Both" },
];

const STATUS_FILTER_OPTIONS: ReadonlyArray<{ value: "all" | TemplateStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
];

function formatProjectTypeLabel(type: TemplateProjectType): string {
  if (type === "mobile") return "Mobile app";
  if (type === "web") return "Website";
  return "Both";
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

export function AdminTemplatesList({ templates }: { templates: AdminTemplateSummary[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | TemplateProjectType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | TemplateStatus>("all");

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return templates.filter((item) => {
      if (typeFilter !== "all" && item.type !== typeFilter) {
        return false;
      }
      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }
      if (q) {
        const hay = `${item.name} ${item.slug} ${item.categoryName ?? ""}`.toLowerCase();
        if (!hay.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [templates, searchQuery, typeFilter, statusFilter]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1">
          <h1 className="text-foreground type-heading-l">Templates</h1>
          <p className="text-muted-foreground type-body-m">
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

      <section
        aria-label="Template filters"
        className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
      >
        <div className="flex w-full flex-col gap-1.5 lg:max-w-xs">
          <label htmlFor="admin-template-search" className="text-foreground type-body-s-strong">
            Search
          </label>
          <div className="relative">
            <Search className="text-tertiary pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              id="admin-template-search"
              placeholder="Search name, slug, or category..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-foreground type-body-s-strong">Type</span>
            <div
              role="group"
              aria-label="Filter by type"
              className="border-border bg-sunken inline-flex flex-wrap gap-1 rounded-lg border p-1"
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
                      "rounded-md px-3 py-1.5 transition-colors",
                      active
                        ? "bg-elevated text-foreground shadow-card type-body-s-strong"
                        : "text-muted-foreground hover:text-foreground type-body-s",
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-foreground type-body-s-strong">Status</span>
            <div
              role="group"
              aria-label="Filter by status"
              className="border-border bg-sunken inline-flex flex-wrap gap-1 rounded-lg border p-1"
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
                      "rounded-md px-3 py-1.5 transition-colors",
                      active
                        ? "bg-elevated text-foreground shadow-card type-body-s-strong"
                        : "text-muted-foreground hover:text-foreground type-body-s",
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <div className="border-border bg-card overflow-x-auto rounded-xl border">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-border bg-surface border-b">
              <th className="text-tertiary type-overline px-5 py-3">Template</th>
              <th className="text-tertiary type-overline px-4 py-3">Type</th>
              <th className="text-tertiary type-overline px-4 py-3">Status</th>
              <th className="text-tertiary type-overline px-4 py-3">Version</th>
              <th className="text-tertiary type-overline px-4 py-3">Sections</th>
              <th className="text-tertiary type-overline px-4 py-3">Slots</th>
              <th className="text-tertiary type-overline px-4 py-3">Updated</th>
              <th className="text-tertiary type-overline px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
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
                    <div className="flex items-center gap-2.5">
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
                  </td>
                  <td className="text-muted-foreground type-body-s px-4 py-4">
                    {formatProjectTypeLabel(item.type)}
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="text-foreground type-caption px-4 py-4 font-mono">
                    {item.currentVersion ? `v${item.currentVersion}` : "—"}
                  </td>
                  <td className="text-muted-foreground type-body-s px-4 py-4">
                    {item.sectionCount}
                  </td>
                  <td className="text-muted-foreground type-body-s px-4 py-4">{item.slotCount}</td>
                  <td className="text-tertiary type-caption px-4 py-4">
                    {new Date(item.updatedAtIso).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Button asChild variant="secondary" size="sm">
                      <Link href={`/admin/templates/${item.id}`}>Manage</Link>
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
