"use client";

import type { PlanTier } from "@casefolio/db";
import {
  ArrowRight,
  Eye,
  Globe,
  Layers,
  LayoutTemplate,
  Lock,
  Monitor,
  RotateCcw,
  Search,
  Smartphone,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { trackClientProductEvent } from "@/components/analytics/posthog-provider";
import { UpgradePromptDialog } from "@/components/billing/upgrade-prompt-dialog";
import { TemplatePuckRenderer } from "@/components/editor/puck-config";
import { SectionStackSheet } from "@/components/marketing/motion";
import { TemplateThumbnail } from "@/components/templates/template-thumbnail";
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
import { Eyebrow } from "@/components/ui/eyebrow";
import { can } from "@/lib/entitlements";
import type { TemplateProjectType, TemplateTier } from "@/lib/template/schema";
import type { PublishedTemplateItem } from "@/lib/template/types";
import { cn } from "@/lib/utils";

export type UserPlanTier = PlanTier;

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
  const [previewViewport, setPreviewViewport] = useState<"desktop" | "mobile">("desktop");
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

  const totalSlots = useMemo(
    () => templates.reduce((sum, item) => sum + item.slotCount, 0),
    [templates],
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

  const filterDock = (
    <aside
      aria-label="Template library filters"
      className="flex flex-col gap-5 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-4 sm:p-5 lg:sticky lg:top-24"
    >
      <div className="flex items-center justify-between gap-2 border-b border-[var(--cf-border-subtle)] pb-3.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--cf-text-primary)]">
            Filters
          </span>
          <span className="rounded-md border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] px-2 py-0.5 font-mono text-[0.6875rem] font-semibold text-[var(--cf-text-secondary)] tabular-nums">
            {filteredTemplates.length}/{templates.length}
          </span>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="focus-visible:ring-ring/40 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-[var(--cf-text-secondary)] transition-colors outline-none hover:bg-[var(--cf-bg-surface)] hover:text-[var(--cf-text-primary)] focus-visible:ring-2"
          >
            <RotateCcw className="size-3" />
            <span>Reset filters</span>
          </button>
        )}
      </div>

      {/* Studio Search Input */}
      <div className="flex flex-col gap-2">
        <span className="v3-label text-[var(--cf-text-tertiary)] uppercase">
          Search
        </span>
        <div className="relative flex w-full items-center">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 size-3.5 text-[var(--cf-text-tertiary)]"
          />
          <input
            type="search"
            aria-label="Search templates"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="focus-visible:ring-ring/40 h-9 w-full rounded-lg border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] pr-8 pl-9 text-xs text-[var(--cf-text-primary)] placeholder:text-[var(--cf-text-tertiary)] transition-colors outline-none focus-visible:border-[var(--cf-border-strong)] focus-visible:bg-[var(--cf-bg-elevated)] focus-visible:ring-2"
          />
          {searchQuery.trim().length > 0 && (
            <button
              type="button"
              aria-label="Clear template search"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 inline-flex size-6 items-center justify-center rounded-md text-[var(--cf-text-tertiary)] transition-colors hover:bg-[var(--cf-bg-surface)] hover:text-[var(--cf-text-primary)]"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Platform Filter */}
      <div className="flex flex-col gap-2 border-t border-[var(--cf-border-subtle)] pt-4">
        <span className="v3-label text-[var(--cf-text-tertiary)] uppercase">
          Platform
        </span>
        <div
          role="group"
          aria-label="Filter by project type"
          className="flex flex-col gap-1"
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
                  "focus-visible:ring-ring/40 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors outline-none focus-visible:ring-2",
                  active
                    ? "bg-[var(--cf-ink)] text-[var(--cf-text-on-ink)]"
                    : "text-[var(--cf-text-secondary)] hover:bg-[var(--cf-bg-surface)] hover:text-[var(--cf-text-primary)]",
                )}
              >
                {opt.value !== "all" ? (
                  <TypeIcon type={opt.value} />
                ) : (
                  <LayoutTemplate className="size-3.5" aria-hidden="true" />
                )}
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Plan Tier Filter */}
      <div className="flex flex-col gap-2 border-t border-[var(--cf-border-subtle)] pt-4">
        <span className="v3-label text-[var(--cf-text-tertiary)] uppercase">
          Plan tier
        </span>
        <div
          role="group"
          aria-label="Filter by plan tier"
          className="grid grid-cols-3 gap-1 rounded-lg border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] p-1"
        >
          {TIER_OPTIONS.map((opt) => {
            const active = tierFilter === opt.value;
            const isProOption = opt.value === "pro";
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={active}
                onClick={() => setTierFilter(opt.value)}
                className={cn(
                  "focus-visible:ring-ring/40 inline-flex items-center justify-center gap-1 rounded-md px-1.5 py-1.5 text-[0.6875rem] font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-2",
                  active
                    ? "bg-[var(--cf-ink)] text-[var(--cf-text-on-ink)]"
                    : "text-[var(--cf-text-secondary)] hover:bg-[var(--cf-bg-elevated)] hover:text-[var(--cf-text-primary)]",
                )}
              >
                {isProOption && (
                  <Sparkles className="size-3 shrink-0" aria-hidden="true" />
                )}
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-col gap-2 border-t border-[var(--cf-border-subtle)] pt-4">
        <span className="v3-label text-[var(--cf-text-tertiary)] uppercase">
          Category
        </span>
        <div
          role="group"
          aria-label="Filter by category"
          className="flex flex-col gap-1"
        >
          <button
            type="button"
            aria-pressed={categoryFilter === "all"}
            onClick={() => setCategoryFilter("all")}
            className={cn(
              "focus-visible:ring-ring/40 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors outline-none focus-visible:ring-2",
              categoryFilter === "all"
                ? "bg-[var(--cf-ink)] text-[var(--cf-text-on-ink)]"
                : "text-[var(--cf-text-secondary)] hover:bg-[var(--cf-bg-surface)] hover:text-[var(--cf-text-primary)]",
            )}
          >
            <span>All categories</span>
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
                  "focus-visible:ring-ring/40 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors outline-none focus-visible:ring-2",
                  active
                    ? "bg-[var(--cf-ink)] text-[var(--cf-text-on-ink)]"
                    : "text-[var(--cf-text-secondary)] hover:bg-[var(--cf-bg-surface)] hover:text-[var(--cf-text-primary)]",
                )}
              >
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );

  const catalogGrid =
    filteredTemplates.length === 0 ? (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-12 text-center sm:p-16">
        <span
          aria-hidden="true"
          className="inline-flex size-12 items-center justify-center rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] text-[var(--cf-text-primary)]"
        >
          <Search className="size-5" />
        </span>
        <div className="flex flex-col gap-1.5">
          <h2 className="v3-heading-s text-[var(--cf-text-primary)]">No matching templates</h2>
          <p className="v3-body-s max-w-md text-[var(--cf-text-secondary)]">
            No templates match your current search or filters. Try resetting the
            platform, category, or plan selection.
          </p>
        </div>
        {hasActiveFilters && (
          <Button type="button" variant="secondary" size="sm" onClick={resetFilters}>
            <RotateCcw className="size-3.5" />
            Clear filters
          </Button>
        )}
      </div>
    ) : (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filteredTemplates.map((item, idx) => {
          const isLocked = item.tier === "pro" && !canUseProTemplates;
          const useHref = isAuthenticated
            ? `/new?template=${encodeURIComponent(item.slug)}`
            : `/sign-up?template=${encodeURIComponent(item.slug)}`;
          const indexLabel = String(idx + 1).padStart(2, "0");
          const themeColors = item.document.template.theme.colors;

          return (
            <article
              key={item.id}
              data-slot="library-template-card"
              data-template-slug={item.slug}
              data-tier={item.tier}
              data-locked={isLocked ? "true" : "false"}
              className="group flex flex-col justify-between gap-3.5 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--cf-border-strong)] hover:shadow-[var(--cf-shadow-hover)]"
            >
              <div className="flex flex-col gap-3.5">
                {/* Architectural Spec Frame */}
                <div className="overflow-hidden rounded-md border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)]">
                  <div className="flex items-center justify-between gap-2 border-b border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-2.5 py-1.5">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="inline-flex shrink-0 items-center rounded-xs border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] px-1.5 py-0.5 font-mono text-[0.625rem] font-semibold text-[var(--cf-text-primary)]">
                        {indexLabel}
                      </span>
                      <span className="inline-flex items-center gap-1 truncate text-[0.6875rem] font-medium text-[var(--cf-text-secondary)]">
                        <TypeIcon type={item.type} />
                        <span className="truncate">{formatTypeLabel(item.type)}</span>
                      </span>
                    </div>

                    <div className="flex shrink-0 items-center">
                      {item.tier === "pro" ? (
                        <ProBadge />
                      ) : (
                        <Badge tone="published">Free</Badge>
                      )}
                    </div>
                  </div>

                  <div className="relative aspect-[16/10] w-full overflow-hidden">
                    <TemplateThumbnail
                      testId={`library-template-thumb-${item.slug}`}
                      coverUrl={item.coverUrl}
                      slug={item.slug}
                      name={item.name}
                      theme={{
                        bg: themeColors.background,
                        fg: themeColors.text,
                        accent: themeColors.primary,
                      }}
                      className="size-full"
                      imageClassName="group-hover:scale-[1.03]"
                    />

                    {isLocked && (
                      <div
                        data-testid={`pro-lock-badge-${item.slug}`}
                        className="bg-inverse/90 text-inverse-foreground type-caption absolute right-2.5 bottom-2.5 z-10 inline-flex items-center gap-1 rounded-md px-2.5 py-1"
                      >
                        <Lock className="size-3" />
                        <span>Locked on Free</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Metadata & Palette Strip */}
                <div className="flex flex-col gap-1.5 px-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="v3-dashboard-card-title truncate text-[var(--cf-text-primary)]">
                      {item.name}
                    </h2>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className="size-3 rounded-full border border-[var(--cf-border-subtle)]"
                        style={{ backgroundColor: themeColors.background }}
                      />
                      <span
                        aria-hidden="true"
                        className="size-3 rounded-full border border-[var(--cf-border-subtle)]"
                        style={{ backgroundColor: themeColors.primary }}
                      />
                      <span className="rounded-xs border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] px-1.5 py-0.5 font-mono text-[0.625rem] font-semibold text-[var(--cf-text-secondary)]">
                        v{item.version}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--cf-text-secondary)]">
                    <span className="font-medium text-[var(--cf-text-primary)]">
                      {item.categoryName ?? "General"}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{item.sectionCount} sections</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.slotCount} slots</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 border-t border-[var(--cf-border-subtle)] pt-3">
                <button
                  type="button"
                  onClick={() => setPreviewItem(item)}
                  className="focus-visible:ring-ring/40 inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] px-3 text-xs font-semibold whitespace-nowrap text-[var(--cf-text-primary)] transition-colors outline-none hover:border-[var(--cf-border-strong)] hover:bg-[var(--cf-bg-surface)] focus-visible:ring-2"
                >
                  <Eye className="size-3.5 shrink-0" />
                  <span>Preview</span>
                </button>

                {isLocked ? (
                  <Link
                    href={isAuthenticated ? "/account/billing" : "/sign-up"}
                    onClick={(event) => {
                      if (isAuthenticated) {
                        event.preventDefault();
                        setUpgradeTemplateName(item.name);
                      }
                    }}
                    className="focus-visible:ring-ring/40 inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--cf-ink)] px-3 text-xs font-semibold whitespace-nowrap text-[var(--cf-text-on-ink)] transition-opacity outline-none hover:opacity-90 focus-visible:ring-2"
                  >
                    <Lock className="size-3 shrink-0" />
                    <span>Upgrade for Pro</span>
                  </Link>
                ) : (
                  <Link
                    href={useHref}
                    onClick={() =>
                      trackClientProductEvent("template_selected", {
                        templateSlug: item.slug,
                        templateTier: item.tier,
                        projectType: item.type,
                        surface: "library_card",
                      })
                    }
                    className="focus-visible:ring-ring/40 group/btn inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--cf-ink)] px-3 text-xs font-semibold whitespace-nowrap text-[var(--cf-text-on-ink)] transition-opacity outline-none hover:opacity-90 focus-visible:ring-2"
                  >
                    <span>Use template</span>
                    <ArrowRight className="size-3.5 shrink-0 transition-transform duration-200 group-hover/btn:translate-x-0.5" />
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>
    );

  const modals = (
    <>
      <Dialog
        open={previewItem !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewItem(null);
        }}
      >
        <DialogContent className="w-[96vw] max-w-[96vw] sm:max-w-[1480px]">
          {previewItem && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <DialogTitle>{previewItem.name}</DialogTitle>
                    {previewItem.tier === "pro" ? (
                      <ProBadge />
                    ) : (
                      <Badge tone="published">Free</Badge>
                    )}
                    <Badge tone="accent" withDot={false}>
                      {formatTypeLabel(previewItem.type)}
                    </Badge>
                  </div>

                  <div
                    role="group"
                    aria-label="Preview viewport mode"
                    className="inline-flex items-center gap-1 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] p-1"
                  >
                    <button
                      type="button"
                      data-testid="template-preview-viewport-desktop"
                      aria-pressed={previewViewport === "desktop"}
                      onClick={() => setPreviewViewport("desktop")}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                        previewViewport === "desktop"
                          ? "bg-[var(--cf-royal)] text-[var(--cf-text-on-royal)]"
                          : "text-[var(--cf-text-secondary)] hover:text-[var(--cf-text-primary)]",
                      )}
                    >
                      <Monitor className="size-3.5" />
                      Web View
                    </button>
                    <button
                      type="button"
                      data-testid="template-preview-viewport-mobile"
                      aria-pressed={previewViewport === "mobile"}
                      onClick={() => setPreviewViewport("mobile")}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                        previewViewport === "mobile"
                          ? "bg-[var(--cf-royal)] text-[var(--cf-text-on-royal)]"
                          : "text-[var(--cf-text-secondary)] hover:text-[var(--cf-text-primary)]",
                      )}
                    >
                      <Smartphone className="size-3.5" />
                      Mobile View
                    </button>
                  </div>
                </div>
                <DialogDescription>
                  {previewItem.categoryName ?? "Case Study"} · v{previewItem.version} ·{" "}
                  {previewItem.sectionCount} sections · {previewItem.slotCount} ratio-locked screen
                  slots
                </DialogDescription>
              </DialogHeader>

              <div className="max-h-[72vh] overflow-y-auto rounded-2xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)]">
                <div
                  className={cn(
                    "mx-auto",
                    previewViewport === "mobile"
                      ? "w-[390px] max-w-full py-4"
                      : "w-full max-w-[1440px]",
                  )}
                >
                  <TemplatePuckRenderer
                    document={previewItem.document}
                    viewport={previewViewport}
                    className={
                      previewViewport === "mobile"
                        ? "rounded-[24px] border border-[var(--cf-border-subtle)]"
                        : "rounded-none"
                    }
                  />
                </div>
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
                      onClick={() =>
                        trackClientProductEvent("template_selected", {
                          templateSlug: previewItem.slug,
                          templateTier: previewItem.tier,
                          projectType: previewItem.type,
                          surface: "library_preview",
                        })
                      }
                    >
                      Use {previewItem.name}
                      <ArrowRight className="size-4" />
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
        featureDescription="Upgrade to Casefolio Pro ($7.99/mo · 2 months free on annual) to unlock all Pro templates, build up to 10 rotatable Case Studies with custom URLs, and export high-resolution PNG, Behance, and PDF files without watermarks."
      />
    </>
  );

  if (isAuthenticated) {
    const isTeamsPlan = userPlan === "team" || userPlan === "plus";
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-5">
        <header className="v3-pattern-grid flex flex-col justify-between gap-3 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-5 py-4 sm:flex-row sm:items-center sm:px-6">
          <div className="flex flex-col items-start gap-1">
            <Eyebrow icon={<LayoutTemplate />} className="px-2.5 py-0.5 text-[0.6875rem]">
              Curated Studio Library
            </Eyebrow>
            <h1 className="v3-dashboard-title text-[var(--cf-text-primary)]">
              Template library
            </h1>
            <p className="max-w-2xl text-xs text-[var(--cf-text-secondary)] sm:text-sm">
              Choose a template, place your screens in ratio-locked mockups, and publish or export
              in minutes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge
              tone="neutral"
              className="w-fit border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] text-[var(--cf-text-primary)]"
            >
              {isTeamsPlan
                ? "Teams plan"
                : canUseProTemplates
                  ? "PRO plan"
                  : "Free plan"}
            </Badge>
            <span className="rounded-md border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] px-2.5 py-1 font-mono text-xs font-semibold text-[var(--cf-text-secondary)] tabular-nums">
              {filteredTemplates.length}/{templates.length} layouts
            </span>
          </div>
        </header>

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[14.5rem_minmax(0,1fr)] xl:grid-cols-[15.5rem_minmax(0,1fr)]">
          {filterDock}
          <div className="min-w-0">{catalogGrid}</div>
        </div>
        {modals}
      </div>
    );
  }

  return (
    <div className="relative flex flex-col overflow-x-clip">
      {/* 1. Public Architectural Royal Grid Hero */}
      <section className="v3-pattern-grid relative z-10 overflow-hidden pt-12 pb-16 sm:pt-16 sm:pb-20 lg:pt-20 lg:pb-24">
        <div className="v3-container flex flex-col items-center text-center">
          <Eyebrow step="01">Curated Case Study Library</Eyebrow>

          <h1 className="v3-display-xl mt-5 text-balance text-[var(--cf-text-primary)]">
            Template <span className="v3-sticker-lime">library</span>
          </h1>

          <p className="v3-body-l mt-5 max-w-2xl text-pretty text-[var(--cf-text-secondary)]">
            Ready-made UI/UX case study layouts crafted by designers. Choose a
            template, place your screens in ratio-locked mockups, and publish or
            export in minutes.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-3.5 py-1.5 text-xs font-semibold text-[var(--cf-text-primary)]">
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-[var(--cf-royal)]"
              />
              <span>{templates.length} Curated Layouts</span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-3.5 py-1.5 text-xs font-semibold text-[var(--cf-text-secondary)]">
              <span>{totalSlots}+ Ratio-Locked Slots</span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-3.5 py-1.5 text-xs font-semibold text-[var(--cf-text-secondary)]">
              <span>Live Link · PNG · Behance · PDF</span>
            </span>
          </div>
        </div>
      </section>

      {/* 2. Overlapping Elevated Studio Catalog Sheet */}
      <SectionStackSheet
        overlapY={48}
        startScale={0.982}
        className="z-20 -mt-8 lg:-mt-12"
      >
        <div className="v3-sheet-elevated rounded-t-[2rem] border-t border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] pt-10 pb-20 sm:rounded-t-[2.75rem] sm:pt-14 sm:pb-24 lg:rounded-t-[3.5rem]">
          <div className="mx-auto grid w-full max-w-[84rem] grid-cols-1 items-start gap-6 px-5 sm:px-8 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-7 lg:px-10">
            {filterDock}
            <div className="min-w-0">{catalogGrid}</div>
          </div>
        </div>
      </SectionStackSheet>

      {/* 3. Overlapping Electric Royal Blue Launch Sheet + Dual Signature Ribbon */}
      <SectionStackSheet
        overlapY={44}
        startScale={0.985}
        className="z-30 -mt-8 lg:-mt-12"
      >
        <section className="v3-pattern-dots-dark v3-sheet-royal overflow-hidden rounded-t-[2rem] pt-14 sm:rounded-t-[2.75rem] lg:rounded-t-[3.5rem] lg:pt-20">
          <div className="v3-container flex flex-col items-center pb-14 text-center lg:pb-20">
            <span className="v3-label mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--cf-border-on-royal)] bg-[var(--cf-bg-inverse-elevated)] px-3.5 py-1 text-[var(--cf-bg-accent)] uppercase">
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-[var(--cf-bg-accent)]"
              />
              <span>02 · Ready to Build</span>
            </span>
            <h2 className="v3-display-l max-w-2xl text-[var(--cf-text-inverse)]">
              Pick a layout and ship your{" "}
              <span className="v3-sticker-lime">next story</span> today
            </h2>
            <p className="v3-body-l mt-4 max-w-xl text-[var(--cf-text-inverse-muted)]">
              Start free with 1 lifetime Case Study credit—no credit card required. Drop in your
              screens and publish a shareable link in minutes.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/sign-up"
                className="v3-btn-lime focus-visible:ring-ring/40 outline-none focus-visible:ring-2"
              >
                <span>Start free</span>
                <ArrowRight className="size-4 stroke-[2.5]" />
              </Link>
              <Link
                href="/pricing"
                className="v3-btn-secondary focus-visible:ring-ring/40 outline-none focus-visible:ring-2"
              >
                <span>Compare plans</span>
              </Link>
            </div>
          </div>

          <div aria-hidden="true" className="flex flex-col">
            <div className="h-1.5 w-full bg-[var(--cf-royal)]" />
            <div className="h-2 w-full bg-[var(--cf-bg-accent)]" />
          </div>
        </section>
      </SectionStackSheet>

      {modals}
    </div>
  );
}
