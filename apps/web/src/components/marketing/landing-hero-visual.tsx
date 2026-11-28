"use client";

import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpLeft,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Download,
  Eye,
  EyeOff,
  FileImage,
  FileText,
  Globe,
  Image as ImageIcon,
  Layers,
  Minus,
  Monitor,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Redo2,
  RotateCcw,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { EditorCanvasPreview } from "@/components/editor/editor-canvas-preview";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  HERO_CINEMA_DEFAULT_PUCK,
  HERO_CINEMA_DEFAULT_THEME,
  HERO_CINEMA_PALETTE_PRESETS,
  HERO_CINEMA_SLOTS,
  HERO_CINEMA_TEMPLATE_META,
} from "@/lib/marketing/hero-cinema-demo";
import type { LandingPublishedTemplateItem } from "@/lib/marketing/landing-stats";
import {
  collectProjectSlotStatus,
  formatSectionSummaryLabel,
  formatSectionTypeLabel,
  isSectionRequired,
  toggleSectionVisibility,
} from "@/lib/projects/types";
import {
  applyCuratedPalettePreset,
  CURATED_FONT_PAIRS,
  resolveFontDefinition,
} from "@/lib/template/curated-themes";
import type { PuckDocument, PuckSectionItem, TemplateTheme } from "@/lib/template/schema";
import {
  buildSlotMiniGradientStyle,
  extractRichTextParagraphs,
} from "@/lib/template/theme-vars";
import { cn } from "@/lib/utils";

type LeftPanelTab = "sections" | "style" | "content";
type RightPanelTab = "fields" | "slots";

interface HeroEditorSnapshot {
  puckData: PuckDocument;
  theme: TemplateTheme;
}

const MIN_HERO_ZOOM = 0.7;
const MAX_HERO_ZOOM = 1.25;
const HERO_ZOOM_STEP = 0.1;

function cloneHeroDocument(doc: PuckDocument): PuckDocument {
  return JSON.parse(JSON.stringify(doc)) as PuckDocument;
}

function cloneHeroTheme(theme: TemplateTheme): TemplateTheme {
  return JSON.parse(JSON.stringify(theme)) as TemplateTheme;
}

export function LandingHeroVisual({
  heroImageUrl = "",
  publishedTemplates = [],
}: {
  heroImageUrl?: string;
  publishedTemplates?: readonly LandingPublishedTemplateItem[];
} = {}) {
  const cleanHeroImageUrl = heroImageUrl.trim();
  const hasCustomImage = cleanHeroImageUrl.length > 0;
  const hasLiveTemplates = publishedTemplates.length > 0;

  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [leftTab, setLeftTab] = useState<LeftPanelTab>("sections");
  const [rightTab, setRightTab] = useState<RightPanelTab>("fields");
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [selectedSectionIndex, setSelectedSectionIndex] = useState(0);
  const [zoom, setZoom] = useState(1);

  const [puckData, setPuckData] = useState<PuckDocument>(() =>
    cloneHeroDocument(HERO_CINEMA_DEFAULT_PUCK),
  );
  const [theme, setTheme] = useState<TemplateTheme>(() =>
    cloneHeroTheme(HERO_CINEMA_DEFAULT_THEME),
  );
  const [history, setHistory] = useState<HeroEditorSnapshot[]>([]);
  const [future, setFuture] = useState<HeroEditorSnapshot[]>([]);

  const canvasScrollRef = useRef<HTMLDivElement | null>(null);

  const commitChange = useCallback(
    (nextPuck: PuckDocument, nextTheme: TemplateTheme) => {
      setHistory((prev) => [...prev.slice(-14), { puckData, theme }]);
      setFuture([]);
      setPuckData(nextPuck);
      setTheme(nextTheme);
    },
    [puckData, theme],
  );

  const handleUndo = useCallback(() => {
    setHistory((prev) => {
      const latest = prev[prev.length - 1];
      if (!latest) return prev;
      setFuture((f) => [{ puckData, theme }, ...f.slice(0, 14)]);
      setPuckData(latest.puckData);
      setTheme(latest.theme);
      return prev.slice(0, -1);
    });
  }, [puckData, theme]);

  const handleRedo = useCallback(() => {
    setFuture((prev) => {
      const [next, ...rest] = prev;
      if (!next) return prev;
      setHistory((h) => [...h.slice(-14), { puckData, theme }]);
      setPuckData(next.puckData);
      setTheme(next.theme);
      return rest;
    });
  }, [puckData, theme]);

  const scrollCanvasToSection = useCallback((index: number) => {
    requestAnimationFrame(() => {
      const container = canvasScrollRef.current;
      if (!container) return;
      const target = container.querySelector<HTMLElement>(
        `[data-editor-section-index="${index}"]`,
      );
      if (!target) return;
      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const nextTop = container.scrollTop + (targetRect.top - containerRect.top) - 12;
      container.scrollTo?.({ top: Math.max(0, nextTop), behavior: "smooth" });
    });
  }, []);

  const handleSelectSection = useCallback(
    (index: number) => {
      setSelectedSectionIndex(index);
      setRightTab("fields");
      setRightPanelOpen(true);
      scrollCanvasToSection(index);
    },
    [scrollCanvasToSection],
  );

  const updateSelectedSectionProp = useCallback(
    (patch: Record<string, unknown>) => {
      const current = puckData.content[selectedSectionIndex];
      if (!current) return;
      const nextContent = puckData.content.map((item, idx) =>
        idx === selectedSectionIndex
          ? ({ ...item, props: { ...item.props, ...patch } } as PuckSectionItem)
          : item,
      );
      commitChange({ ...puckData, content: nextContent }, theme);
    },
    [commitChange, puckData, selectedSectionIndex, theme],
  );

  const visibleSectionCount = useMemo(
    () => puckData.content.filter((item) => !item.props.hidden).length,
    [puckData.content],
  );

  const slotItems = useMemo(
    () => collectProjectSlotStatus(puckData, HERO_CINEMA_SLOTS),
    [puckData],
  );

  const filledSlotCount = useMemo(
    () => slotItems.filter((item) => item.filled).length,
    [slotItems],
  );

  const slotProgressPercent =
    slotItems.length > 0 ? Math.round((filledSlotCount / slotItems.length) * 100) : 100;

  const selectedSection = puckData.content[selectedSectionIndex] ?? puckData.content[0] ?? null;

  const activeFontPairId = useMemo(() => {
    const match = CURATED_FONT_PAIRS.find(
      (pair) =>
        pair.headingFamily === theme.fonts.heading.family &&
        pair.bodyFamily === theme.fonts.body.family,
    );
    return match?.id ?? "cinema-original";
  }, [theme.fonts.body.family, theme.fonts.heading.family]);

  const zoomPercent = Math.round(zoom * 100);

  if (hasCustomImage) {
    return (
      <figure
        aria-label="Preview of the Casefolio studio workspace"
        data-live-templates={hasLiveTemplates ? "true" : undefined}
        data-testid="hero-custom-image-frame"
        className="relative mx-auto w-full max-w-[66rem] select-none"
      >
        <div
          data-hero-card-center
          className="overflow-hidden rounded-[0.625rem] border-[1.5px] border-[var(--cf-lp-dark)] bg-[var(--cf-lp-cream-elevated)] shadow-[0_24px_60px_-28px_rgba(32,33,29,0.4)]"
        >
          <img
            src={cleanHeroImageUrl}
            alt="Casefolio studio case study builder workspace preview"
            className="block h-auto w-full object-cover"
          />
        </div>
      </figure>
    );
  }

  const showLeftSidebar = leftPanelOpen;
  const showRightSidebar = rightPanelOpen;

  return (
    <figure
      aria-label="Interactive preview of the Casefolio case-study editor"
      data-live-templates={hasLiveTemplates ? "true" : undefined}
      data-testid="hero-builder-preview"
      className="relative mx-auto w-full max-w-[70rem]"
    >
      {/* Floating monospaced studio callouts */}
      <div
        aria-hidden="true"
        className="pointer-events-none hidden items-center justify-between px-4 pb-3 lg:flex"
      >
        <span className="inline-flex -rotate-2 items-center gap-1.5 rounded-[0.3125rem] border border-[var(--cf-lp-dark)] bg-[var(--cf-lp-hero-sec-bg)] px-2.5 py-1 font-mono text-[0.6875rem] tracking-[0.06em] text-[var(--cf-lp-on-lime)]">
          Constrained builder
          <ArrowDownRight className="size-3" />
        </span>
        <span className="inline-flex rotate-2 items-center gap-1.5 rounded-[0.3125rem] border border-[var(--cf-lp-dark)] bg-[var(--cf-lp-hero-sec-bg)] px-2.5 py-1 font-mono text-[0.6875rem] tracking-[0.06em] text-[var(--cf-lp-on-lime)]">
          <ArrowUpLeft className="size-3" />
          Live {HERO_CINEMA_TEMPLATE_META.templateLabel} template
        </span>
      </div>

      {/* Main Studio Editor Shell matching /editor/[projectId] */}
      <div
        data-hero-card-center
        className="bg-surface text-foreground overflow-hidden rounded-[0.625rem] border-[1.5px] border-[var(--cf-lp-dark)] text-left shadow-[0_24px_60px_-28px_rgba(32,33,29,0.42)]"
      >
        {/* Top Editor Toolbar (exact mirror of ConstrainedEditor topbar) */}
        <header
          data-slot="editor-topbar"
          className="border-border/75 bg-elevated/95 flex h-14 items-center justify-between gap-3 border-b px-3 backdrop-blur-xl sm:px-4 xl:grid xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden xl:w-full">
            <Link
              href="/templates"
              aria-label="Browse Casefolio templates"
              title="Browse templates"
              className="border-border/80 bg-elevated text-foreground hover:bg-surface inline-flex size-8 shrink-0 items-center justify-center rounded-md border transition-colors"
            >
              <ArrowLeft className="size-3.5" />
            </Link>

            <button
              type="button"
              aria-label={leftPanelOpen ? "Close left panel" : "Open left panel"}
              aria-pressed={showLeftSidebar}
              onClick={() => setLeftPanelOpen((prev) => !prev)}
              className={cn(
                "hidden size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border transition-colors lg:inline-flex",
                showLeftSidebar
                  ? "border-border/80 bg-surface text-foreground hover:bg-sunken"
                  : "border-primary/40 bg-accent text-accent-foreground",
              )}
            >
              {showLeftSidebar ? (
                <PanelLeftClose className="size-3.5" />
              ) : (
                <PanelLeftOpen className="size-3.5" />
              )}
            </button>

            <div className="bg-border/70 hidden h-4 w-px shrink-0 lg:block" />

            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  title={puckData.root.props.title}
                  className="text-foreground font-display min-w-0 truncate text-xs font-semibold tracking-tight sm:text-sm"
                >
                  {puckData.root.props.title}
                </span>
                <Badge tone="neutral" withDot={false} className="hidden shrink-0 rounded-md sm:inline-flex">
                  {HERO_CINEMA_TEMPLATE_META.templateLabel}
                </Badge>
              </div>
              <span className="text-tertiary type-caption inline-flex items-center gap-1.5 truncate text-[0.6875rem]">
                <Cloud className="text-success size-3 shrink-0" />
                <span className="truncate">Saved · just now</span>
              </span>
            </div>
          </div>

          {/* Center Viewport Switch */}
          <div
            role="group"
            aria-label="Preview viewport"
            className="border-border/70 bg-surface hidden shrink-0 items-center rounded-lg border p-0.5 md:inline-flex xl:justify-self-center"
          >
            <button
              type="button"
              aria-pressed={viewport === "desktop"}
              onClick={() => setViewport("desktop")}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-all",
                viewport === "desktop"
                  ? "border-border bg-elevated text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              <Monitor className="size-3.5" />
              <span>Desktop</span>
            </button>
            <button
              type="button"
              aria-pressed={viewport === "mobile"}
              onClick={() => setViewport("mobile")}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-all",
                viewport === "mobile"
                  ? "border-border bg-elevated text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              <Smartphone className="size-3.5" />
              <span>Mobile</span>
            </button>
          </div>

          {/* Right Editor Actions */}
          <div className="flex shrink-0 items-center gap-1.5 xl:justify-self-end">
            <div className="border-border/75 bg-surface hidden items-center rounded-lg border p-0.5 sm:inline-flex">
              <button
                type="button"
                aria-label="Undo edit"
                disabled={history.length === 0}
                onClick={handleUndo}
                className="text-foreground hover:bg-elevated inline-flex size-7 cursor-pointer items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Undo2 className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label="Redo edit"
                disabled={future.length === 0}
                onClick={handleRedo}
                className="text-foreground hover:bg-elevated inline-flex size-7 cursor-pointer items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Redo2 className="size-3.5" />
              </button>
            </div>

            <Link
              href="/sign-up?template=cinema"
              aria-label="Preview case study — register or log in"
              title="Sign up or log in to preview"
              className="border-border-strong bg-elevated text-foreground hover:bg-surface hidden h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition-colors sm:inline-flex"
            >
              <Eye className="size-3.5" />
              <span>Preview</span>
            </Link>

            <Link
              href="/sign-up?template=cinema"
              aria-label="Export case study — register or log in"
              title="Sign up or log in to export"
              className="border-border-strong bg-elevated text-foreground hover:bg-surface hidden h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition-colors lg:inline-flex"
            >
              <Download className="size-3.5" />
              <span>Export</span>
            </Link>

            <Link
              href="/sign-up?template=cinema"
              aria-label="Publish case study — register or log in"
              title="Sign up or log in to publish"
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--cf-bg-action)] px-3 text-xs font-semibold text-[var(--cf-text-on-action)] transition-colors hover:bg-[var(--cf-bg-action-hover)]"
            >
              <Globe className="size-3.5" />
              <span>Publish</span>
            </Link>

            <button
              type="button"
              aria-label={rightPanelOpen ? "Close right panel" : "Open right panel"}
              aria-pressed={showRightSidebar}
              onClick={() => setRightPanelOpen((prev) => !prev)}
              className={cn(
                "hidden size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border transition-colors lg:inline-flex",
                showRightSidebar
                  ? "border-border/80 bg-surface text-foreground hover:bg-sunken"
                  : "border-primary/40 bg-accent text-accent-foreground",
              )}
            >
              {showRightSidebar ? (
                <PanelRightClose className="size-3.5" />
              ) : (
                <PanelRightOpen className="size-3.5" />
              )}
            </button>
          </div>
        </header>

        {/* 3-Column Studio Body matching ConstrainedEditor */}
        <div className="bg-background relative flex h-[31rem] min-h-0 flex-col sm:h-[35rem] lg:flex-row">
          {/* LEFT PANEL: Sections | Style | Content */}
          {showLeftSidebar && (
            <aside
              aria-label="Template outline and styles"
              className="border-border/75 bg-background hidden w-60 shrink-0 flex-col border-r lg:flex"
            >
              <div className="border-border/70 bg-elevated/60 flex shrink-0 items-center border-b px-2.5 py-2.5">
                <div
                  role="tablist"
                  aria-label="Editor sidebar tabs"
                  className="bg-surface border-border/60 grid flex-1 grid-cols-3 rounded-lg border p-0.5"
                >
                  {(
                    [
                      { key: "sections", label: "Sections", icon: Layers },
                      { key: "style", label: "Style", icon: Palette },
                      { key: "content", label: "Content", icon: FileText },
                    ] as const
                  ).map((tab) => {
                    const TabIcon = tab.icon;
                    const active = leftTab === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setLeftTab(tab.key)}
                        className={cn(
                          "inline-flex cursor-pointer items-center justify-center gap-1 rounded-md border py-1 text-[0.6875rem] font-medium transition-all",
                          active
                            ? "border-border bg-elevated text-foreground"
                            : "text-muted-foreground hover:text-foreground border-transparent",
                        )}
                      >
                        <TabIcon className="size-3 shrink-0" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {leftTab === "sections" && (
                  <div className="flex flex-col gap-2.5">
                    <div className="border-border/70 bg-elevated flex items-center justify-between rounded-xl border px-3 py-2.5">
                      <div>
                        <p className="text-foreground text-xs font-semibold">Sections</p>
                        <p className="text-tertiary text-[0.6875rem]">
                          {HERO_CINEMA_TEMPLATE_META.templateLabel} narrative flow
                        </p>
                      </div>
                      <Badge tone="neutral" withDot={false} className="rounded-md">
                        {visibleSectionCount}/{puckData.content.length}
                      </Badge>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      {puckData.content.map((section, idx) => {
                        const isSelected = selectedSectionIndex === idx;
                        const hidden = Boolean(section.props.hidden);
                        const required = isSectionRequired(section.type);
                        const label = formatSectionSummaryLabel(section);
                        const typeLabel = formatSectionTypeLabel(section.type);
                        return (
                          <div
                            key={section.props.id}
                            className={cn(
                              "flex items-center justify-between gap-2 rounded-xl border p-2.5 transition-all",
                              isSelected
                                ? "border-primary bg-accent/50"
                                : "border-border/70 bg-elevated hover:border-border-strong",
                              hidden && "opacity-60",
                            )}
                          >
                            <button
                              type="button"
                              aria-pressed={isSelected}
                              onClick={() => handleSelectSection(idx)}
                              className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left outline-none"
                            >
                              <span
                                className={cn(
                                  "inline-flex size-5.5 shrink-0 items-center justify-center rounded-md font-mono text-[0.625rem] font-medium",
                                  isSelected
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-surface text-tertiary",
                                )}
                              >
                                {String(idx + 1).padStart(2, "0")}
                              </span>
                              <span className="flex min-w-0 flex-col">
                                <span className="text-foreground truncate text-xs font-semibold">
                                  {label}
                                </span>
                                <span className="text-tertiary truncate text-[0.625rem]">
                                  {typeLabel}
                                </span>
                              </span>
                            </button>

                            {!required && (
                              <button
                                type="button"
                                aria-label={hidden ? `Show ${label}` : `Hide ${label}`}
                                onClick={() =>
                                  commitChange(toggleSectionVisibility(puckData, idx), theme)
                                }
                                className="text-tertiary hover:bg-surface hover:text-foreground inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors"
                              >
                                {hidden ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {leftTab === "style" && (
                  <div className="flex flex-col gap-3">
                    <div className="border-border/70 bg-elevated flex flex-col gap-2.5 rounded-xl border p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-foreground text-xs font-semibold">
                          Palette presets
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            commitChange(puckData, cloneHeroTheme(HERO_CINEMA_DEFAULT_THEME))
                          }
                          className="text-tertiary hover:text-foreground inline-flex cursor-pointer items-center gap-1 text-[0.6875rem] font-medium"
                        >
                          <RotateCcw className="size-3" />
                          <span>Reset</span>
                        </button>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        {HERO_CINEMA_PALETTE_PRESETS.map((preset) => {
                          const isCurrent =
                            preset.colors.primary?.toLowerCase() ===
                              theme.colors.primary?.toLowerCase() &&
                            preset.colors.background?.toLowerCase() ===
                              theme.colors.background?.toLowerCase();
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              aria-pressed={isCurrent}
                              onClick={() =>
                                commitChange(puckData, {
                                  ...theme,
                                  colors: applyCuratedPalettePreset(theme.colors, preset.colors),
                                })
                              }
                              className={cn(
                                "flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition-all",
                                isCurrent
                                  ? "border-primary bg-accent/50"
                                  : "border-border/70 bg-surface/60 hover:border-border-strong",
                              )}
                            >
                              <span className="text-foreground truncate text-xs font-medium">
                                {preset.name}
                              </span>
                              <span className="flex shrink-0 items-center gap-1">
                                <span
                                  aria-hidden="true"
                                  className="border-border/70 size-3.5 rounded-full border"
                                  style={{ backgroundColor: preset.colors.background }}
                                />
                                <span
                                  aria-hidden="true"
                                  className="border-border/70 size-3.5 rounded-full border"
                                  style={{ backgroundColor: preset.colors.primary }}
                                />
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="border-border/70 bg-elevated flex flex-col gap-2 rounded-xl border p-3">
                      <span className="text-foreground text-xs font-semibold">Font pairing</span>
                      <div className="flex flex-col gap-1.5">
                        {CURATED_FONT_PAIRS.slice(0, 4).map((pair) => {
                          const selected = activeFontPairId === pair.id;
                          return (
                            <button
                              key={pair.id}
                              type="button"
                              aria-pressed={selected}
                              onClick={() =>
                                commitChange(puckData, {
                                  ...theme,
                                  fonts: {
                                    heading: resolveFontDefinition(pair.headingFamily),
                                    body: resolveFontDefinition(pair.bodyFamily),
                                  },
                                })
                              }
                              className={cn(
                                "flex cursor-pointer flex-col rounded-lg border px-2.5 py-1.5 text-left transition-all",
                                selected
                                  ? "border-primary bg-accent/50"
                                  : "border-border/70 bg-surface/60 hover:border-border-strong",
                              )}
                            >
                              <span className="text-foreground truncate text-xs font-medium">
                                {pair.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {leftTab === "content" && (
                  <div className="flex flex-col gap-3">
                    <div className="border-border/70 bg-elevated flex flex-col gap-2.5 rounded-xl border p-3">
                      <Label htmlFor="hero-demo-project-title" className="text-xs font-semibold">
                        Case study title
                      </Label>
                      <Input
                        id="hero-demo-project-title"
                        value={puckData.root.props.title}
                        onChange={(e) =>
                          commitChange(
                            {
                              ...puckData,
                              root: {
                                ...puckData.root,
                                props: { ...puckData.root.props, title: e.target.value },
                              },
                            },
                            theme,
                          )
                        }
                        className="h-8 text-xs"
                      />
                      <div className="border-border/60 bg-surface/60 grid grid-cols-2 gap-2 rounded-md border p-2 text-[0.6875rem]">
                        <div>
                          <span className="text-tertiary block">Template</span>
                          <span className="text-foreground font-semibold">
                            {HERO_CINEMA_TEMPLATE_META.templateLabel}
                          </span>
                        </div>
                        <div>
                          <span className="text-tertiary block">Format</span>
                          <span className="text-foreground font-semibold capitalize">
                            {HERO_CINEMA_TEMPLATE_META.type}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </aside>
          )}

          {/* CENTER PANEL: Real Casefolio Template Live Canvas + Floating Zoom HUD */}
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div
              ref={canvasScrollRef}
              data-slot="editor-canvas"
              className="bg-editor-canvas min-h-0 flex-1 overflow-x-auto overflow-y-auto px-3 pt-3.5 pb-14 sm:px-5 sm:pt-4"
            >
              <div className="mb-3 flex flex-wrap items-center justify-center gap-2 text-center">
                <Badge tone="neutral" withDot={false} className="rounded-md">
                  {HERO_CINEMA_TEMPLATE_META.templateLabel} · v{HERO_CINEMA_TEMPLATE_META.version}
                </Badge>
                <span className="text-tertiary type-caption text-[0.6875rem]">
                  Live preview · same renderer as publish &amp; export
                </span>
              </div>

              <EditorCanvasPreview
                puckData={puckData}
                theme={theme}
                slots={HERO_CINEMA_SLOTS}
                projectType={HERO_CINEMA_TEMPLATE_META.type}
                viewport={viewport}
                zoom={zoom}
                selectedSectionIndex={selectedSectionIndex}
                onSelectSection={handleSelectSection}
              />
            </div>

            {/* Floating Zoom Controls (mirrors ConstrainedEditor) */}
            <div className="border-border/80 bg-elevated/95 absolute bottom-3 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-0.5 rounded-lg border p-1 backdrop-blur-xl">
              <button
                type="button"
                aria-label="Zoom out preview"
                disabled={zoom <= MIN_HERO_ZOOM}
                onClick={() =>
                  setZoom((prev) =>
                    Math.max(MIN_HERO_ZOOM, Math.round((prev - HERO_ZOOM_STEP) * 100) / 100),
                  )
                }
                className="text-foreground hover:bg-surface inline-flex size-6.5 cursor-pointer items-center justify-center rounded-md transition-colors disabled:opacity-40"
              >
                <Minus className="size-3" />
              </button>
              <button
                type="button"
                aria-label={`${zoomPercent}% — reset preview zoom`}
                onClick={() => setZoom(1)}
                className="text-foreground hover:bg-surface min-w-11 cursor-pointer rounded-md px-1.5 py-0.5 text-center font-mono text-[0.6875rem] font-medium"
              >
                {zoomPercent}%
              </button>
              <button
                type="button"
                aria-label="Zoom in preview"
                disabled={zoom >= MAX_HERO_ZOOM}
                onClick={() =>
                  setZoom((prev) =>
                    Math.min(MAX_HERO_ZOOM, Math.round((prev + HERO_ZOOM_STEP) * 100) / 100),
                  )
                }
                className="text-foreground hover:bg-surface inline-flex size-6.5 cursor-pointer items-center justify-center rounded-md transition-colors disabled:opacity-40"
              >
                <Plus className="size-3" />
              </button>
            </div>
          </div>

          {/* RIGHT INSPECTOR: Fields | Screenshots */}
          {showRightSidebar && (
            <aside
              aria-label="Section inspector"
              className="border-border/75 bg-background hidden w-64 shrink-0 flex-col border-l lg:flex"
            >
              <div className="border-border/70 bg-elevated/60 flex shrink-0 items-center border-b px-2.5 py-2.5">
                <div
                  role="tablist"
                  aria-label="Inspector tabs"
                  className="bg-surface border-border/60 grid flex-1 grid-cols-2 rounded-lg border p-0.5"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={rightTab === "fields"}
                    onClick={() => setRightTab("fields")}
                    className={cn(
                      "inline-flex cursor-pointer items-center justify-center gap-1 rounded-md border py-1 text-[0.6875rem] font-medium transition-all",
                      rightTab === "fields"
                        ? "border-border bg-elevated text-foreground"
                        : "text-muted-foreground hover:text-foreground border-transparent",
                    )}
                  >
                    <SlidersHorizontal className="size-3" />
                    <span>Fields</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={rightTab === "slots"}
                    onClick={() => setRightTab("slots")}
                    className={cn(
                      "inline-flex cursor-pointer items-center justify-center gap-1 rounded-md border py-1 text-[0.6875rem] font-medium transition-all",
                      rightTab === "slots"
                        ? "border-border bg-elevated text-foreground"
                        : "text-muted-foreground hover:text-foreground border-transparent",
                    )}
                  >
                    <ImageIcon className="size-3" />
                    <span>Screenshots</span>
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {rightTab === "fields" && selectedSection && (
                  <div className="flex flex-col gap-3">
                    <div className="border-border/70 bg-elevated flex flex-col gap-2 rounded-xl border p-3">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-tertiary font-mono text-[0.625rem] uppercase">
                          Section {selectedSectionIndex + 1} of {puckData.content.length}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            aria-label="Previous section"
                            disabled={selectedSectionIndex <= 0}
                            onClick={() => handleSelectSection(selectedSectionIndex - 1)}
                            className="border-border/70 bg-surface text-foreground hover:bg-sunken inline-flex size-5.5 cursor-pointer items-center justify-center rounded-md border disabled:opacity-35"
                          >
                            <ChevronLeft className="size-3" />
                          </button>
                          <button
                            type="button"
                            aria-label="Next section"
                            disabled={selectedSectionIndex >= puckData.content.length - 1}
                            onClick={() => handleSelectSection(selectedSectionIndex + 1)}
                            className="border-border/70 bg-surface text-foreground hover:bg-sunken inline-flex size-5.5 cursor-pointer items-center justify-center rounded-md border disabled:opacity-35"
                          >
                            <ChevronRight className="size-3" />
                          </button>
                        </div>
                      </div>
                      <h3 className="text-foreground truncate text-xs font-semibold">
                        {formatSectionSummaryLabel(selectedSection)}
                      </h3>
                    </div>

                    {"eyebrow" in selectedSection.props && (
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="hero-field-eyebrow" className="text-xs">
                          Eyebrow
                        </Label>
                        <Input
                          id="hero-field-eyebrow"
                          value={selectedSection.props.eyebrow ?? ""}
                          onChange={(e) => updateSelectedSectionProp({ eyebrow: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </div>
                    )}

                    {selectedSection.type === "Hero" && (
                      <>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="hero-field-title" className="text-xs">
                            Title
                          </Label>
                          <Input
                            id="hero-field-title"
                            value={selectedSection.props.title}
                            onChange={(e) => updateSelectedSectionProp({ title: e.target.value })}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="hero-field-subtitle" className="text-xs">
                            Subtitle
                          </Label>
                          <Textarea
                            id="hero-field-subtitle"
                            rows={3}
                            value={selectedSection.props.subtitle}
                            onChange={(e) =>
                              updateSelectedSectionProp({ subtitle: e.target.value })
                            }
                            className="min-h-16 text-xs"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label className="text-xs">Hero layout</Label>
                          <div className="grid grid-cols-3 gap-1">
                            {(["split-right", "centered", "split-left"] as const).map((layout) => (
                              <button
                                key={layout}
                                type="button"
                                aria-pressed={selectedSection.props.layout === layout}
                                onClick={() => updateSelectedSectionProp({ layout })}
                                className={cn(
                                  "cursor-pointer rounded-md border px-1.5 py-1.5 text-[0.625rem] font-medium capitalize transition-colors",
                                  selectedSection.props.layout === layout
                                    ? "border-primary bg-accent/50 text-foreground"
                                    : "border-border/70 bg-elevated text-muted-foreground hover:text-foreground",
                                )}
                              >
                                {layout.replace("split-", "")}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {selectedSection.type !== "Hero" && "heading" in selectedSection.props && (
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="hero-field-heading" className="text-xs">
                          Heading
                        </Label>
                        <Input
                          id="hero-field-heading"
                          value={selectedSection.props.heading ?? ""}
                          onChange={(e) => updateSelectedSectionProp({ heading: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </div>
                    )}

                    {"summary" in selectedSection.props && (
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="hero-field-summary" className="text-xs">
                          Summary
                        </Label>
                        <Textarea
                          id="hero-field-summary"
                          rows={4}
                          value={
                            typeof selectedSection.props.summary === "string"
                              ? selectedSection.props.summary
                              : extractRichTextParagraphs(selectedSection.props.summary).join(
                                  "\n\n",
                                )
                          }
                          onChange={(e) => updateSelectedSectionProp({ summary: e.target.value })}
                          className="min-h-20 text-xs"
                        />
                      </div>
                    )}

                    {"subtitle" in selectedSection.props && selectedSection.type !== "Hero" && (
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="hero-field-section-subtitle" className="text-xs">
                          Subtitle
                        </Label>
                        <Textarea
                          id="hero-field-section-subtitle"
                          rows={3}
                          value={selectedSection.props.subtitle ?? ""}
                          onChange={(e) => updateSelectedSectionProp({ subtitle: e.target.value })}
                          className="min-h-16 text-xs"
                        />
                      </div>
                    )}
                  </div>
                )}

                {rightTab === "slots" && (
                  <div className="flex flex-col gap-3">
                    <div className="border-border/70 bg-elevated flex flex-col gap-2 rounded-xl border p-3">
                      <div className="flex items-baseline justify-between">
                        <span className="text-foreground text-xs font-semibold">Screenshots</span>
                        <span className="text-foreground font-mono text-[0.6875rem] font-medium">
                          {filledSlotCount}/{slotItems.length} ready
                        </span>
                      </div>
                      <div className="bg-sunken h-1.5 w-full overflow-hidden rounded-full">
                        <div
                          className="bg-primary h-full rounded-full transition-all"
                          style={{ width: `${slotProgressPercent}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      {slotItems.map((slot) => (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => handleSelectSection(slot.sectionIndex)}
                          className="border-border/70 bg-elevated hover:border-border-strong flex cursor-pointer items-center justify-between gap-2 rounded-xl border p-2 text-left transition-colors"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              style={!slot.src ? buildSlotMiniGradientStyle(theme) : undefined}
                              className="border-border bg-surface inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border"
                            >
                              {slot.src ? (
                                <img
                                  src={slot.src}
                                  alt={slot.label}
                                  className="size-full object-cover"
                                />
                              ) : (
                                <ImageIcon className="size-3.5 opacity-80" />
                              )}
                            </span>
                            <div className="min-w-0">
                              <span className="text-foreground block truncate text-[0.6875rem] font-semibold">
                                {slot.label}
                              </span>
                              <span className="text-tertiary block truncate font-mono text-[0.625rem]">
                                {slot.ratio} · {slot.device}
                              </span>
                            </div>
                          </div>
                          <Badge tone={slot.filled ? "published" : "draft"} className="shrink-0 rounded-md">
                            {slot.filled ? "Filled" : "Empty"}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
      </div>
    </figure>
  );
}

export type V3TemplateVariant =
  | "salto"
  | "nove"
  | "arca"
  | "meridian"
  | "kuro"
  | "solace"
  | "ledger"
  | "veldt"
  | "orbit";

export function V3TemplateArtwork({
  variant,
  compact = false,
}: {
  variant: V3TemplateVariant;
  compact?: boolean;
}) {
  if (variant === "salto" || variant === "ledger" || variant === "veldt") {
    return (
      <div className="relative h-full w-full overflow-hidden rounded-[0.5rem] bg-[var(--cf-lp-cobalt)] p-4 text-[var(--cf-lp-cream-elevated)]">
        <div className="flex items-center justify-between font-mono text-[0.625rem] tracking-[0.11em] text-[var(--cf-lp-arch-periwinkle)] uppercase">
          <span>{variant === "salto" ? "SALTO" : variant.toUpperCase()}</span>
          <span>06:42</span>
        </div>
        <div
          className={cn(
            "mx-auto mt-3 flex flex-col justify-between rounded-[0.75rem] border border-[var(--cf-lp-cobalt-tile-border)] bg-[var(--cf-lp-cobalt-tile)] p-3.5",
            compact ? "min-h-[8.5rem]" : "min-h-[11rem]",
          )}
        >
          <p className="font-editorial text-[1.125rem] leading-[1.08] tracking-[-0.03em] text-[var(--cf-lp-cream-elevated)]">
            Find your
            <br />
            next trail.
          </p>
          <div className="mt-3 flex items-end justify-between border-t border-[var(--cf-lp-cobalt-tile-border)] pt-2">
            <div>
              <p className="font-mono text-[0.5625rem] tracking-[0.11em] text-[var(--cf-lp-arch-periwinkle)] uppercase">
                Elevation
              </p>
              <p className="font-mono text-[0.75rem] font-medium text-[var(--cf-lp-lime)]">
                1,284 m
              </p>
            </div>
            <span className="inline-flex h-5 items-center rounded-[0.25rem] bg-[var(--cf-lp-lime)] px-2 font-mono text-[0.5625rem] font-medium text-[var(--cf-lp-on-lime)]">
              LIVE
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "arca" || variant === "nove" || variant === "meridian") {
    return (
      <div className="relative flex h-full w-full flex-col justify-between overflow-hidden rounded-[0.5rem] bg-[var(--cf-lp-peach)] p-4 text-[var(--cf-lp-ink)]">
        <div className="rounded-[0.5rem] border border-[var(--cf-lp-ink)] bg-[var(--cf-lp-cream-elevated)] p-3.5">
          <div className="flex items-center justify-between border-b border-[var(--cf-lp-cream-divider)] pb-2">
            <span className="font-mono text-[0.5625rem] tracking-[0.11em] text-[var(--cf-lp-terracotta)] uppercase">
              {variant === "arca" ? "ARCA / HOME" : `${variant.toUpperCase()} / STUDIO`}
            </span>
            <span className="size-2 rounded-full bg-[var(--cf-lp-terracotta)]" />
          </div>
          <p
            className={cn(
              "mt-3 font-editorial leading-[1.08] tracking-[-0.035em] text-[var(--cf-lp-ink)]",
              compact ? "text-[1.0625rem]" : "text-[1.25rem]",
            )}
          >
            Objects for quiet living.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            <div className="h-8 rounded-[0.25rem] bg-[var(--cf-lp-terracotta)]" />
            <div className="h-8 rounded-[0.25rem] bg-[var(--cf-lp-surface)]" />
            <div className="h-8 rounded-[0.25rem] bg-[var(--cf-lp-dark)]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full flex-col justify-between overflow-hidden rounded-[0.5rem] border border-[var(--cf-lp-border)] bg-[var(--cf-lp-cream-elevated)] p-4 text-[var(--cf-lp-ink)]">
      <div className="grid grid-cols-3 gap-1.5">
        <div className="flex h-11 items-center justify-center rounded-[0.25rem] bg-[var(--cf-lp-lime)] font-editorial text-sm text-[var(--cf-lp-on-lime)]">
          Aa
        </div>
        <div className="flex h-11 items-center justify-center rounded-[0.25rem] bg-[var(--cf-lp-surface)] font-mono text-xs text-[var(--cf-lp-ink)]">
          12
        </div>
        <div className="flex h-11 items-center justify-center rounded-[0.25rem] bg-[var(--cf-lp-arch-periwinkle)] font-mono text-xs text-[var(--cf-lp-dark)]">
          #
        </div>
      </div>
      <div className="mt-3 rounded-[0.375rem] bg-[var(--cf-lp-dark)] p-3 text-[var(--cf-lp-dark-ink)]">
        <p className="font-mono text-[0.5625rem] tracking-[0.11em] text-[var(--cf-lp-lime)] uppercase">
          NORTH / DESIGN SYSTEM
        </p>
        <p className="mt-1 text-[0.75rem] text-[var(--cf-lp-dark-muted)]">
          Tokens, patterns, and components.
        </p>
      </div>
    </div>
  );
}

export function V3TemplatesPanelMedia() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <V3TemplateArtwork variant="salto" compact />
      <V3TemplateArtwork variant="arca" compact />
    </div>
  );
}

export function V3EditorSlotsPanelMedia() {
  return (
    <div className="rounded-[0.5rem] border border-[var(--cf-lp-border)] bg-[var(--cf-lp-cream-elevated)] p-4">
      <div className="flex items-center justify-between border-b border-[var(--cf-lp-cream-divider)] pb-2.5">
        <span className="font-mono text-[0.625rem] tracking-[0.11em] text-[var(--cf-lp-subtle)] uppercase">
          Locked frame slots
        </span>
        <span className="inline-flex items-center gap-1 rounded-[0.25rem] bg-[var(--cf-lp-lime)] px-2 py-0.5 font-mono text-[0.5625rem] font-medium text-[var(--cf-lp-on-lime)]">
          <Sparkles className="size-2.5" />
          AUTO-FIT
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <div className="rounded-[0.375rem] border border-[var(--cf-lp-border)] bg-[var(--cf-lp-cream)] p-2.5">
          <p className="font-mono text-[0.5625rem] text-[var(--cf-lp-subtle)] uppercase">
            16:10 Web
          </p>
          <p className="mt-1 text-[0.75rem] font-semibold text-[var(--cf-lp-ink)]">
            Desktop hero
          </p>
        </div>
        <div className="rounded-[0.375rem] border border-[var(--cf-lp-border)] bg-[var(--cf-lp-cream)] p-2.5">
          <p className="font-mono text-[0.5625rem] text-[var(--cf-lp-subtle)] uppercase">
            9:19.5 Mobile
          </p>
          <p className="mt-1 text-[0.75rem] font-semibold text-[var(--cf-lp-ink)]">
            iOS flow pair
          </p>
        </div>
      </div>
    </div>
  );
}

export function V3ShowcaseEditorPreview({
  activeTab = "layerat",
}: {
  activeTab?: "live" | "layerat" | "pdf" | "png";
}) {
  const channelLabel =
    activeTab === "pdf"
      ? "mono-case-study-a4.pdf"
      : activeTab === "png"
        ? "mono-presentation-2x.png"
        : activeTab === "layerat"
          ? "mono-layerat-full-case-study.zip"
          : "casefolio.app/p/mono-finance";

  const badgeText =
    activeTab === "pdf"
      ? "A4 VECTOR PDF"
      : activeTab === "png"
        ? "2× RETINA PNG"
        : activeTab === "layerat"
          ? "LAYERAT PACK"
          : "LIVE LINK";

  return (
    <div className="overflow-hidden rounded-[0.5625rem] border border-[var(--cf-lp-dark-rule)] bg-[var(--cf-lp-dark-elevated)]">
      {/* Top Output URL / Artifact Bar */}
      <div className="flex items-center justify-between gap-2 border-b border-[var(--cf-lp-dark-rule)] px-4 py-2.5">
        <span className="inline-flex min-w-0 items-center gap-2 truncate font-mono text-[0.6875rem] text-[var(--cf-lp-dark-ink)]">
          {activeTab === "layerat" ? (
            <Layers className="size-3.5 shrink-0 text-[var(--cf-lp-lime)]" />
          ) : activeTab === "pdf" ? (
            <FileText className="size-3.5 shrink-0 text-[var(--cf-lp-lime)]" />
          ) : activeTab === "png" ? (
            <FileImage className="size-3.5 shrink-0 text-[var(--cf-lp-lime)]" />
          ) : (
            <Globe className="size-3.5 shrink-0 text-[var(--cf-lp-lime)]" />
          )}
          <span className="truncate">{channelLabel}</span>
        </span>
        <span className="shrink-0 rounded-[0.25rem] bg-[var(--cf-lp-lime)] px-2 py-0.5 font-mono text-[0.5625rem] font-semibold text-[var(--cf-lp-on-lime)] uppercase">
          {badgeText}
        </span>
      </div>

      {/* Format-Specific Output Breakdown Canvas */}
      <div className="flex min-h-[21.5rem] flex-col justify-between gap-4 p-4 sm:p-5">
        {activeTab === "layerat" ? (
          <div className="flex flex-1 flex-col justify-between gap-4 rounded-[0.5rem] border border-[var(--cf-lp-dark-rule)] bg-[var(--cf-lp-dark)] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--cf-lp-dark-rule)] pb-3">
              <div>
                <p className="font-mono text-[0.625rem] tracking-[0.11em] text-[var(--cf-lp-lime)] uppercase">
                  Direct Portfolio Export · Layerat
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--cf-lp-dark-ink)]">
                  Complete case study packaged for layerat.com
                </p>
              </div>
              <span className="rounded-full border border-[var(--cf-lp-dark-rule)] bg-[var(--cf-lp-dark-elevated)] px-2.5 py-1 font-mono text-[0.625rem] text-[var(--cf-lp-lime)] uppercase">
                Full story · .zip
              </span>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-3">
              {[
                {
                  file: "01-layerat-1400px.png",
                  section: "Hero & Context",
                  detail: "Title, thesis & cover shot",
                  accentClass: "bg-[var(--cf-lp-lime)] text-[var(--cf-lp-on-lime)]",
                },
                {
                  file: "02-layerat-1400px.png",
                  section: "UX Flows & UI",
                  detail: "1,400px seamless screens",
                  accentClass: "bg-[var(--cf-lp-mauve)] text-[var(--cf-lp-mauve-ink)]",
                },
                {
                  file: "03-layerat-1400px.png",
                  section: "Impact & System",
                  detail: "Metrics & final tokens",
                  accentClass: "bg-[var(--cf-lp-peach)] text-[var(--cf-lp-on-lime)]",
                },
              ].map((slice) => (
                <div
                  key={slice.file}
                  className="flex flex-col justify-between gap-2.5 rounded-[0.4375rem] border border-[var(--cf-lp-dark-rule)] bg-[var(--cf-lp-dark-elevated)] p-3"
                >
                  <div className={cn("h-14 rounded-[0.3125rem] p-2.5", slice.accentClass)}>
                    <span className="block font-mono text-[0.5625rem] font-semibold uppercase opacity-80">
                      1400 × 1960
                    </span>
                    <span className="mt-1 block text-xs font-bold leading-tight">
                      {slice.section}
                    </span>
                  </div>
                  <div>
                    <p className="truncate font-mono text-[0.625rem] text-[var(--cf-lp-dark-ink)]">
                      {slice.file}
                    </p>
                    <p className="mt-0.5 text-[0.6875rem] text-[var(--cf-lp-dark-muted)]">
                      {slice.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-[var(--cf-lp-dark-rule)] pt-3">
              <div>
                <span className="block font-mono text-[0.5625rem] text-[var(--cf-lp-dark-muted)] uppercase">
                  Destination
                </span>
                <span className="text-xs font-semibold text-[var(--cf-lp-dark-ink)]">
                  Layerat Portfolio
                </span>
              </div>
              <div>
                <span className="block font-mono text-[0.5625rem] text-[var(--cf-lp-dark-muted)] uppercase">
                  Panel Width
                </span>
                <span className="text-xs font-semibold text-[var(--cf-lp-dark-ink)]">
                  1,400px seamless
                </span>
              </div>
              <div>
                <span className="block font-mono text-[0.5625rem] text-[var(--cf-lp-dark-muted)] uppercase">
                  Scope
                </span>
                <span className="text-xs font-semibold text-[var(--cf-lp-lime)]">
                  Full Case Study
                </span>
              </div>
            </div>
          </div>
        ) : activeTab === "live" ? (
          <div className="flex flex-1 flex-col justify-between gap-4 rounded-[0.5rem] border border-[var(--cf-lp-dark-rule)] bg-[var(--cf-lp-dark)] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[0.375rem] border border-[var(--cf-lp-dark-rule)] bg-[var(--cf-lp-dark-elevated)] px-3 py-2">
              <span className="font-mono text-[0.6875rem] text-[var(--cf-lp-dark-ink)]">
                https://casefolio.app/p/mono-finance
              </span>
              <span className="font-mono text-[0.625rem] text-[var(--cf-lp-lime)] uppercase">
                Custom Slug · SSL
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1.35fr_0.65fr]">
              <div className="flex flex-col justify-between gap-3 rounded-[0.4375rem] bg-[var(--cf-lp-cream-elevated)] p-3.5 text-[var(--cf-lp-ink)]">
                <div className="flex items-center justify-between font-mono text-[0.5625rem] text-[var(--cf-lp-subtle)] uppercase">
                  <span>Desktop · Responsive Web</span>
                  <span>16:10</span>
                </div>
                <div>
                  <p className="font-editorial text-xl leading-tight">
                    Mono — Calm personal finance
                  </p>
                  <p className="mt-1 text-xs text-[var(--cf-lp-muted)]">
                    Interactive live blocks, OpenGraph social cards, and NDA password guard.
                  </p>
                </div>
              </div>
              <div className="flex flex-col justify-between gap-2 rounded-[0.4375rem] border border-[var(--cf-lp-dark-rule)] bg-[var(--cf-lp-dark-elevated)] p-3">
                <span className="font-mono text-[0.5625rem] text-[var(--cf-lp-dark-muted)] uppercase">
                  Mobile view
                </span>
                <div className="rounded-[0.3125rem] bg-[var(--cf-lp-lime)] p-2.5 text-[var(--cf-lp-on-lime)]">
                  <span className="block font-mono text-[0.5625rem] font-semibold uppercase">
                    Auto reflow
                  </span>
                  <span className="mt-0.5 block text-xs font-bold">9:19.5 ready</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-[var(--cf-lp-dark-rule)] pt-3">
              <div>
                <span className="block font-mono text-[0.5625rem] text-[var(--cf-lp-dark-muted)] uppercase">
                  URL Style
                </span>
                <span className="text-xs font-semibold text-[var(--cf-lp-dark-ink)]">
                  /p/custom-slug
                </span>
              </div>
              <div>
                <span className="block font-mono text-[0.5625rem] text-[var(--cf-lp-dark-muted)] uppercase">
                  Privacy
                </span>
                <span className="text-xs font-semibold text-[var(--cf-lp-dark-ink)]">
                  Public or Password
                </span>
              </div>
              <div>
                <span className="block font-mono text-[0.5625rem] text-[var(--cf-lp-dark-muted)] uppercase">
                  Telemetry
                </span>
                <span className="text-xs font-semibold text-[var(--cf-lp-lime)]">
                  View Analytics
                </span>
              </div>
            </div>
          </div>
        ) : activeTab === "pdf" ? (
          <div className="flex flex-1 flex-col justify-between gap-4 rounded-[0.5rem] border border-[var(--cf-lp-dark-rule)] bg-[var(--cf-lp-dark)] p-4 sm:p-5">
            <div className="flex items-center justify-between border-b border-[var(--cf-lp-dark-rule)] pb-3">
              <div>
                <p className="font-mono text-[0.625rem] tracking-[0.11em] text-[var(--cf-lp-lime)] uppercase">
                  Paged A4 Document · .pdf
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--cf-lp-dark-ink)]">
                  Recruiter &amp; client deck with selectable typography
                </p>
              </div>
              <span className="rounded-full border border-[var(--cf-lp-dark-rule)] bg-[var(--cf-lp-dark-elevated)] px-2.5 py-1 font-mono text-[0.625rem] text-[var(--cf-lp-dark-ink)]">
                Up to 60 pp
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {[
                { page: "Page 01", title: "Executive Cover", note: "Vector serif" },
                { page: "Page 02", title: "Problem & Flows", note: "1:1 screen grids" },
                { page: "Page 03", title: "Impact & UI", note: "Zero clipping" },
              ].map((sheet) => (
                <div
                  key={sheet.page}
                  className="flex flex-col justify-between gap-3 rounded-[0.375rem] border border-[var(--cf-lp-border-strong)] bg-[var(--cf-lp-cream-elevated)] p-3 text-[var(--cf-lp-ink)]"
                >
                  <span className="font-mono text-[0.5625rem] text-[var(--cf-lp-subtle)] uppercase">
                    {sheet.page}
                  </span>
                  <div className="space-y-1.5">
                    <div className="h-1.5 w-4/5 rounded-full bg-[var(--cf-lp-ink)]" />
                    <div className="h-1.5 w-3/5 rounded-full bg-[var(--cf-lp-border-strong)]" />
                    <div className="h-8 rounded-[0.25rem] bg-[var(--cf-lp-surface)]" />
                  </div>
                  <div>
                    <p className="text-[0.6875rem] font-bold leading-tight">{sheet.title}</p>
                    <p className="font-mono text-[0.5625rem] text-[var(--cf-lp-muted)]">
                      {sheet.note}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-[var(--cf-lp-dark-rule)] pt-3">
              <div>
                <span className="block font-mono text-[0.5625rem] text-[var(--cf-lp-dark-muted)] uppercase">
                  Typography
                </span>
                <span className="text-xs font-semibold text-[var(--cf-lp-dark-ink)]">
                  Selectable Text
                </span>
              </div>
              <div>
                <span className="block font-mono text-[0.5625rem] text-[var(--cf-lp-dark-muted)] uppercase">
                  Layout
                </span>
                <span className="text-xs font-semibold text-[var(--cf-lp-dark-ink)]">
                  Auto-paginated A4
                </span>
              </div>
              <div>
                <span className="block font-mono text-[0.5625rem] text-[var(--cf-lp-dark-muted)] uppercase">
                  Branding
                </span>
                <span className="text-xs font-semibold text-[var(--cf-lp-lime)]">
                  Clean on Pro+
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col justify-between gap-4 rounded-[0.5rem] border border-[var(--cf-lp-dark-rule)] bg-[var(--cf-lp-dark)] p-4 sm:p-5">
            <div className="flex items-center justify-between border-b border-[var(--cf-lp-dark-rule)] pb-3">
              <div>
                <p className="font-mono text-[0.625rem] tracking-[0.11em] text-[var(--cf-lp-lime)] uppercase">
                  Continuous Long Canvas · .png
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--cf-lp-dark-ink)]">
                  Single-strip high-DPI presentation image
                </p>
              </div>
              <span className="rounded-full border border-[var(--cf-lp-dark-rule)] bg-[var(--cf-lp-dark-elevated)] px-2.5 py-1 font-mono text-[0.625rem] text-[var(--cf-lp-lime)]">
                1× / 2× Retina
              </span>
            </div>

            <div className="flex flex-col gap-2 rounded-[0.4375rem] border border-[var(--cf-lp-dark-rule)] bg-[var(--cf-lp-dark-elevated)] p-3.5">
              <div className="flex items-center justify-between font-mono text-[0.625rem] text-[var(--cf-lp-dark-muted)]">
                <span>WIDTH: 1,440px (1×) · 2,880px (2× Pro/Teams)</span>
                <span className="text-[var(--cf-lp-lime)]">LOSSLESS PNG</span>
              </div>
              <div className="grid grid-cols-4 gap-2 pt-1">
                <div className="h-14 rounded-[0.25rem] bg-[var(--cf-lp-lime)] p-2 text-[var(--cf-lp-on-lime)]">
                  <span className="font-mono text-[0.5625rem] font-semibold">01 INTRO</span>
                </div>
                <div className="h-14 rounded-[0.25rem] bg-[var(--cf-lp-cream-elevated)] p-2 text-[var(--cf-lp-ink)]">
                  <span className="font-mono text-[0.5625rem] font-semibold">02 AUDIT</span>
                </div>
                <div className="h-14 rounded-[0.25rem] bg-[var(--cf-lp-mauve)] p-2 text-[var(--cf-lp-mauve-ink)]">
                  <span className="font-mono text-[0.5625rem] font-semibold">03 SCREENS</span>
                </div>
                <div className="h-14 rounded-[0.25rem] bg-[var(--cf-lp-peach)] p-2 text-[var(--cf-lp-on-lime)]">
                  <span className="font-mono text-[0.5625rem] font-semibold">04 RESULTS</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-[var(--cf-lp-dark-rule)] pt-3">
              <div>
                <span className="block font-mono text-[0.5625rem] text-[var(--cf-lp-dark-muted)] uppercase">
                  Standard
                </span>
                <span className="text-xs font-semibold text-[var(--cf-lp-dark-ink)]">
                  1,440px (Free)
                </span>
              </div>
              <div>
                <span className="block font-mono text-[0.5625rem] text-[var(--cf-lp-dark-muted)] uppercase">
                  Retina 2×
                </span>
                <span className="text-xs font-semibold text-[var(--cf-lp-dark-ink)]">
                  2,880px (Pro+)
                </span>
              </div>
              <div>
                <span className="block font-mono text-[0.5625rem] text-[var(--cf-lp-dark-muted)] uppercase">
                  Ceiling
                </span>
                <span className="text-xs font-semibold text-[var(--cf-lp-lime)]">
                  Up to 120 MP
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
