"use client";

import { Eye, Lock, RotateCcw, Search, Smartphone, Globe, Layers } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { UpgradePromptDialog } from "@/components/billing/upgrade-prompt-dialog";
import { TemplatePuckRenderer } from "@/components/editor/puck-config";
import { Badge, ProBadge } from "@/components/ui/badge";
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
import { can } from "@/lib/entitlements";
import type { TemplateProjectType, TemplateTier } from "@/lib/template/schema";
import type { PublishedTemplateItem } from "@/lib/template/types";
import { cn } from "@/lib/utils";

export type UserPlanTier = "free" | "pro" | "team";

export interface LibraryCategoryOption {
  id: string;
  name: string;
  slug: string;
}

export interface LibraryFilterState {
  type: "all" | TemplateProjectType;
  categorySlug: "all" | string;
  tier: "all" | TemplateTier;
  search: string;
}

export function filterPublishedTemplates(
  templates: readonly PublishedTemplateItem[],
  filters: LibraryFilterState,
): PublishedTemplateItem[] {
  const query = filters.search.trim().toLowerCase();

  return templates.filter((item) => {
    if (filters.type !== "all" && item.type !== filters.type) {
      return false;
    }
    if (filters.categorySlug !== "all" && item.categorySlug !== filters.categorySlug) {
      return false;
    }
    if (filters.tier !== "all" && item.tier !== filters.tier) {
      return false;
    }
    if (query) {
      const haystack = `${item.name} ${item.slug} ${item.categoryName ?? ""}`.toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }
    return true;
  });
}

function formatTypeLabel(type: TemplateProjectType): string {
  if (type === "mobile") return "Mobile app";
  if (type === "web") return "Website";
  return "Both";
}

function TypeIcon({ type }: { type: TemplateProjectType }) {
  if (type === "mobile") return <Smartphone className="size-3.5" />;
  if (type === "web") return <Globe className="size-3.5" />;
  return <Layers className="size-3.5" />;
}

const TYPE_OPTIONS: ReadonlyArray<{ value: "all" | TemplateProjectType; label: string }> = [
  { value: "all", label: "All types" },
  { value: "mobile", label: "Mobile app" },
  { value: "web", label: "Website" },
  { value: "both", label: "Both" },
];

const TIER_OPTIONS: ReadonlyArray<{ value: "all" | TemplateTier; label: string }> = [
  { value: "all", label: "All plans" },
  { value: "free", label: "Free" },
  { value: "pro", label: "Pro" },
];

export interface TemplateLibraryClientProps {
  templates: PublishedTemplateItem[];
  categories: LibraryCategoryOption[];
  userPlan: UserPlanTier;
  isAuthenticated: boolean;
}

export function TemplateLibraryClient({
  templates,
  categories,
  userPlan,
  isAuthenticated,
}: TemplateLibraryClientProps) {
  const [typeFilter, setTypeFilter] = useState<"all" | TemplateProjectType>("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | string>("all");
  const [tierFilter, setTierFilter] = useState<"all" | TemplateTier>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewItem, setPreviewItem] = useState<PublishedTemplateItem | null>(null);
  const [upgradeTemplateName, setUpgradeTemplateName] = useState<string | null>(null);

  const canUseProTemplates = can(userPlan, "pro_templates");

  const filteredTemplates = useMemo(
    () =>
      filterPublishedTemplates(templates, {
        type: typeFilter,
        categorySlug: categoryFilter,
        tier: tierFilter,
        search: searchQuery,
      }),
    [templates, typeFilter, categoryFilter, tierFilter, searchQuery],
  );

  const hasActiveFilters =
    typeFilter !== "all" ||
    categoryFilter !== "all" ||
    tierFilter !== "all" ||
    searchQuery.trim().length > 0;

  function resetFilters() {
    setTypeFilter("all");
    setCategoryFilter("all");
    setTierFilter("all");
    setSearchQuery("");
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-1.5">
          <span className="text-tertiary type-overline">Case Study Templates</span>
          <h1 className="text-foreground type-display-m">Template library</h1>
          <p className="text-muted-foreground type-body-m max-w-2xl">
            Curated, slot-locked layouts built by the Casefolio team. Pick a template, drop in your
            screens, and publish or export in minutes.
          </p>
        </div>

        <Badge tone={canUseProTemplates ? "pro" : "neutral"} className="w-fit">
          {canUseProTemplates ? `${userPlan.toUpperCase()} plan` : "Free plan"}
        </Badge>
      </header>

      <section
        aria-label="Template library filters"
        className="border-border bg-card flex flex-col gap-4 rounded-xl border p-4 sm:p-5"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-xs">
            <Search className="text-tertiary pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              aria-label="Search templates"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div
              role="group"
              aria-label="Filter by project type"
              className="border-border bg-sunken inline-flex flex-wrap gap-1 rounded-lg border p-1"
            >
              {TYPE_OPTIONS.map((opt) => {
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

            <div
              role="group"
              aria-label="Filter by plan tier"
              className="border-border bg-sunken inline-flex flex-wrap gap-1 rounded-lg border p-1"
            >
              {TIER_OPTIONS.map((opt) => {
                const active = tierFilter === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setTierFilter(opt.value)}
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

        <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t pt-3.5">
          <div
            role="group"
            aria-label="Filter by category"
            className="flex flex-wrap items-center gap-2"
          >
            <button
              type="button"
              aria-pressed={categoryFilter === "all"}
              onClick={() => setCategoryFilter("all")}
              className={cn(
                "rounded-full border px-3 py-1 transition-colors",
                categoryFilter === "all"
                  ? "border-primary bg-accent text-accent-foreground type-caption"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground type-caption",
              )}
            >
              All categories
            </button>

            {categories.map((cat) => {
              const active = categoryFilter === cat.slug;
              return (
                <button
                  key={cat.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategoryFilter(cat.slug)}
                  className={cn(
                    "rounded-full border px-3 py-1 transition-colors",
                    active
                      ? "border-primary bg-accent text-accent-foreground type-caption"
                      : "border-border bg-surface text-muted-foreground hover:text-foreground type-caption",
                  )}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>

          {hasActiveFilters && (
            <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
              <RotateCcw className="size-3.5" />
              Reset filters
            </Button>
          )}
        </div>
      </section>

      {filteredTemplates.length === 0 ? (
        <div className="border-border bg-card flex flex-col items-center justify-center gap-3 rounded-xl border p-12 text-center">
          <h2 className="text-foreground type-heading-s">No matching templates</h2>
          <p className="text-muted-foreground type-body-s max-w-md">
            Try adjusting or resetting your type, category, and plan filters.
          </p>
          {hasActiveFilters && (
            <Button type="button" variant="secondary" size="sm" onClick={resetFilters}>
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((item) => {
            const isLocked = item.tier === "pro" && !canUseProTemplates;
            const useHref = isAuthenticated
              ? `/new?template=${encodeURIComponent(item.slug)}`
              : `/sign-up?template=${encodeURIComponent(item.slug)}`;

            return (
              <article
                key={item.id}
                data-slot="library-template-card"
                data-template-slug={item.slug}
                data-tier={item.tier}
                data-locked={isLocked ? "true" : "false"}
                className="border-border bg-card shadow-card hover:border-border-strong flex flex-col justify-between gap-4 rounded-xl border p-4 transition-colors"
              >
                <div className="flex flex-col gap-3.5">
                  <div
                    style={{
                      backgroundColor: item.document.template.theme.colors.background,
                      color: item.document.template.theme.colors.text,
                    }}
                    className="border-border/30 relative flex aspect-[4/3] w-full flex-col justify-between overflow-hidden rounded-lg border p-5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="bg-background/85 text-foreground type-caption inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 backdrop-blur-xs">
                        <TypeIcon type={item.type} />
                        {formatTypeLabel(item.type)}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {item.tier === "pro" ? (
                          <ProBadge />
                        ) : (
                          <Badge tone="published">Free</Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="type-overline opacity-75">
                        {item.categoryName ?? "Case Study"} · v{item.version}
                      </span>
                      <span className="type-heading-m line-clamp-2">
                        {item.document.puck.root.props.title}
                      </span>
                    </div>

                    {isLocked && (
                      <div
                        data-testid={`pro-lock-badge-${item.slug}`}
                        className="bg-inverse/90 text-inverse-foreground type-caption absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1"
                      >
                        <Lock className="size-3" />
                        <span>Locked on Free</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1 px-1">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-foreground type-heading-s truncate">{item.name}</h2>
                      <span className="text-tertiary type-caption shrink-0">
                        {item.sectionCount} sections · {item.slotCount} slots
                      </span>
                    </div>
                    <p className="text-muted-foreground type-body-s">
                      {item.categoryName ?? "General"} · {formatTypeLabel(item.type)}
                    </p>
                  </div>
                </div>

                <div className="border-border flex items-center gap-2 border-t pt-3">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="flex-1"
                    onClick={() => setPreviewItem(item)}
                  >
                    <Eye className="size-4" />
                    Preview
                  </Button>

                  {isLocked ? (
                    <Button asChild variant="outline" size="sm" className="flex-1">
                      <Link
                        href={isAuthenticated ? "/account/billing" : "/sign-up"}
                        onClick={(event) => {
                          if (isAuthenticated) {
                            event.preventDefault();
                            setUpgradeTemplateName(item.name);
                          }
                        }}
                      >
                        <Lock className="size-3.5" />
                        Upgrade for Pro
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild size="sm" className="flex-1">
                      <Link href={useHref}>Use template</Link>
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog
        open={previewItem !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewItem(null);
        }}
      >
        <DialogContent className="max-w-5xl">
          {previewItem && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2.5">
                  <DialogTitle>{previewItem.name}</DialogTitle>
                  {previewItem.tier === "pro" ? (
                    <ProBadge />
                  ) : (
                    <Badge tone="published">Free</Badge>
                  )}
                  <Badge tone="neutral" withDot={false}>
                    {formatTypeLabel(previewItem.type)}
                  </Badge>
                </div>
                <DialogDescription>
                  {previewItem.categoryName ?? "Case Study"} · v{previewItem.version} ·{" "}
                  {previewItem.sectionCount} sections · {previewItem.slotCount} ratio-locked image
                  slots
                </DialogDescription>
              </DialogHeader>

              <div className="border-border max-h-[65vh] overflow-y-auto rounded-xl border">
                <TemplatePuckRenderer document={previewItem.document} />
              </div>

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setPreviewItem(null)}>
                  Close preview
                </Button>
                {previewItem.tier === "pro" && !canUseProTemplates ? (
                  <Button asChild>
                    <Link
                      href={isAuthenticated ? "/account/billing" : "/sign-up"}
                      onClick={(event) => {
                        if (isAuthenticated) {
                          event.preventDefault();
                          const tplName = previewItem.name;
                          setPreviewItem(null);
                          setUpgradeTemplateName(tplName);
                        }
                      }}
                    >
                      <Lock className="size-4" />
                      Upgrade to Pro to unlock
                    </Link>
                  </Button>
                ) : (
                  <Button asChild>
                    <Link
                      href={
                        isAuthenticated
                          ? `/new?template=${encodeURIComponent(previewItem.slug)}`
                          : `/sign-up?template=${encodeURIComponent(previewItem.slug)}`
                      }
                    >
                      Use {previewItem.name}
                    </Link>
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <UpgradePromptDialog
        open={upgradeTemplateName !== null}
        onOpenChange={(open) => {
          if (!open) setUpgradeTemplateName(null);
        }}
        featureTitle={
          upgradeTemplateName
            ? `Unlock the ${upgradeTemplateName} Pro template`
            : "Unlock Pro templates"
        }
        featureDescription="Upgrade to Casefolio Pro to build with every curated Pro layout, create unlimited projects, and export watermark-free PDFs."
      />
    </div>
  );
}
