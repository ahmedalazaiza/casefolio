"use client";

import {
  ArrowUpRight,
  Check,
  Eye,
  FileDown,
  Globe,
  History,
  Image as ImageIcon,
  Layers,
  LayoutTemplate,
  Lock,
  Palette,
  Rocket,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import Link from "next/link";
import {
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Float, Parallax, Reveal } from "@/components/marketing/motion";
import { TemplateThumbnail } from "@/components/templates/template-thumbnail";
import { Badge, ProBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ensureGsapPluginsRegistered,
  gsap,
  prefersReducedMotion,
  useGSAP,
} from "@/lib/animation/gsap";
import type {
  LandingPlatformSnapshot,
  LandingTemplateShowcaseItem,
} from "@/lib/marketing/landing-stats";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Shared floating UI card chrome                                              */
/* -------------------------------------------------------------------------- */

export function FloatCard({
  className,
  children,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "border-border/60 bg-elevated shadow-float rounded-2xl border p-4 text-left",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function CardLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-muted-foreground type-caption flex items-center gap-1.5">
      {children}
    </p>
  );
}

function formatPlatformLabel(type: "mobile" | "web" | "both"): string {
  if (type === "mobile") return "Mobile app";
  if (type === "web") return "Website";
  return "Mobile + Web";
}

/* -------------------------------------------------------------------------- */
/* Hero floaters                                                               */
/* -------------------------------------------------------------------------- */

export function HeroFloaters({
  snapshot,
}: {
  snapshot: LandingPlatformSnapshot;
}) {
  return (
    <>
      <Parallax
        distance={-36}
        rotate={-3}
        className="pointer-events-none absolute -bottom-5 -left-4 z-20 hidden w-60 lg:block xl:-left-10"
      >
        <Float amplitude={6}>
          <FloatCard>
            <CardLabel>
              <ShieldCheck className="text-success size-3.5" />
              Pre-publish check
            </CardLabel>
            <p className="type-heading-m text-foreground mt-2">6 / 6 ready</p>
            <div className="bg-sunken mt-3 h-1.5 overflow-hidden rounded-full">
              <div className="bg-success h-full w-full rounded-full" />
            </div>
          </FloatCard>
        </Float>
      </Parallax>

      <Parallax
        distance={-32}
        rotate={3}
        className="pointer-events-none absolute top-14 -right-4 z-20 hidden w-60 lg:block xl:-right-10"
      >
        <Float amplitude={7} duration={4.2}>
          <FloatCard>
            <CardLabel>
              <Globe className="text-primary size-3.5" />
              Public page
            </CardLabel>
            <p className="text-foreground type-body-s-strong mt-2 truncate font-mono">
              casefolio.app/p/cinema
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["PNG", "Behance", "A4 PDF"].slice(0, snapshot.exportFormatsCount).map(
                (format) => (
                  <span
                    key={format}
                    className="bg-sunken text-muted-foreground type-caption rounded-full px-2.5 py-0.5"
                  >
                    {format}
                  </span>
                ),
              )}
            </div>
          </FloatCard>
        </Float>
      </Parallax>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* How it works — interactive 4-step component-driven bento showcase           */
/* -------------------------------------------------------------------------- */

const CURATED_PALETTE_SWATCHES = [
  {
    id: "crimson",
    label: "Crimson Theater",
    token: "token.crimson",
    swatches: ["bg-destructive", "bg-warning", "bg-inverse", "bg-surface"],
  },
  {
    id: "indigo",
    label: "Indigo Studio",
    token: "token.indigo",
    swatches: ["bg-primary", "bg-accent", "bg-inverse", "bg-surface"],
  },
  {
    id: "emerald",
    label: "Emerald Signal",
    token: "token.emerald",
    swatches: ["bg-success", "bg-warning", "bg-inverse", "bg-surface"],
  },
] as const;

export function HowItWorksStage({
  snapshot,
}: {
  snapshot: LandingPlatformSnapshot;
}) {
  const [activeStep, setActiveStep] = useState<0 | 1 | 2 | 3>(0);
  const [selectedTypeIndex, setSelectedTypeIndex] = useState<number>(0);
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState<number>(0);
  const [selectedPaletteIndex, setSelectedPaletteIndex] = useState<number>(0);
  const [selectedVisibility, setSelectedVisibility] = useState<
    "Public" | "Unlisted" | "Private"
  >("Public");

  const previewTemplates = snapshot.templates.slice(0, 4);
  const activeTemplate =
    previewTemplates[selectedTemplateIndex] ??
    previewTemplates[0] ?? {
      slug: "cinema",
      name: "Cinema",
      type: "both" as const,
      categoryName: "Entertainment",
      tier: "free" as const,
      version: "1.0.0",
      sectionCount: 14,
      slotCount: 8,
      coverSrc: "/templates/cinema/cover.svg",
      headline: ".Cinema — Movie Ticket Booking Experience",
      summary: "End-to-end dark-room booking narrative.",
    };

  const activePalette =
    CURATED_PALETTE_SWATCHES[selectedPaletteIndex] ?? CURATED_PALETTE_SWATCHES[0];

  const typeRows: readonly {
    label: string;
    ratioHint: string;
    count: number;
    icon: ReactNode;
  }[] = [
    {
      label: "Mobile app",
      ratioHint: "9:19.5 · iPhone 16 Pro & Android",
      count: snapshot.mobileTemplatesCount,
      icon: <Smartphone className="size-4" />,
    },
    {
      label: "Website",
      ratioHint: "16:10 · Browser & MacBook Pro",
      count: snapshot.webTemplatesCount,
      icon: <Globe className="size-4" />,
    },
    {
      label: "Mobile + Web",
      ratioHint: "Multi-device · Synchronized frames",
      count: snapshot.crossPlatformTemplatesCount,
      icon: <Layers className="size-4" />,
    },
  ];

  const stepMeta = [
    {
      step: "01",
      title: "01 · Pick a type",
      shortLabel: "Pick a type",
      badgeText: `${snapshot.deviceFramesCount} device frames`,
      heading: "Choose your project format",
      description:
        "Select Mobile app, Website, or Cross-platform so Casefolio pre-locks your device bezels and slot aspect ratios.",
    },
    {
      step: "02",
      title: "02 · Pick a template",
      shortLabel: "Pick a template",
      badgeText: `${snapshot.publishedTemplatesCount} live templates`,
      heading: "Start from a curated template",
      description:
        "Every template includes a dedicated cover thumbnail, structured narrative sections, and version-pinned layout rules.",
    },
    {
      step: "03",
      title: "03 · Customize",
      shortLabel: "Customize slots & tokens",
      badgeText: `${snapshot.totalTemplateSlots} ratio-locked slots`,
      heading: "Drop in screens & tune tokens",
      description:
        "Snap your UI screenshots into ratio-locked slots and switch curated palettes, hardware bezels, and font pairs in one click.",
    },
    {
      step: "04",
      title: "04 · Publish or export",
      shortLabel: "Publish or export",
      badgeText: `${snapshot.exportFormatsCount} export formats`,
      heading: "Ship a live URL or export deck",
      description:
        "Publish an indexed casefolio.app page with automatic OpenGraph cards, or export pixel-identical PNG, Behance 1400px, and A4 PDF.",
    },
  ] as const;

  return (
    <div
      data-testid="how-it-works-stage"
      className="mx-auto flex w-full max-w-6xl flex-col gap-8 sm:gap-10"
    >
      {/* Interactive 4-Step Progress Rail */}
      <div
        role="tablist"
        aria-label="How Casefolio works steps"
        className="border-border/70 bg-elevated/90 shadow-card mx-auto grid w-full max-w-4xl grid-cols-2 gap-1.5 rounded-2xl border p-1.5 sm:grid-cols-4 sm:rounded-full"
      >
        {stepMeta.map((item, idx) => {
          const isCurrent = activeStep === idx;
          return (
            <button
              key={item.step}
              type="button"
              role="tab"
              aria-selected={isCurrent}
              onClick={() => setActiveStep(idx as 0 | 1 | 2 | 3)}
              className={cn(
                "focus-visible:ring-ring/40 flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-left transition-all duration-200 outline-none focus-visible:ring-2 sm:rounded-full sm:px-4",
                isCurrent
                  ? "bg-inverse text-inverse-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "type-caption inline-flex size-5 shrink-0 items-center justify-center rounded-full font-mono font-bold",
                  isCurrent
                    ? "bg-primary text-primary-foreground"
                    : "bg-sunken text-muted-foreground",
                )}
              >
                {item.step}
              </span>
              <span className="type-caption truncate font-semibold">
                {item.shortLabel}
              </span>
            </button>
          );
        })}
      </div>

      {/* 2x2 Component-Driven Step Bento Grid (ordered 01 -> 02 -> 03 -> 04, zero overlap) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
        {/* STEP 01 — Pick a type */}
        <article
          data-testid="how-it-works-step-1"
          onMouseEnter={() => setActiveStep(0)}
          className={cn(
            "bg-elevated shadow-card flex min-w-0 flex-col justify-between gap-6 rounded-3xl border p-6 transition-all duration-300 sm:p-8",
            activeStep === 0
              ? "border-primary/45 ring-primary/10 ring-4"
              : "border-border/70 hover:border-border-strong",
          )}
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="bg-accent text-accent-foreground type-caption inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold">
                <Smartphone className="size-3.5" />
                {stepMeta[0].title}
              </span>
              <Badge tone="neutral" withDot={false}>
                {stepMeta[0].badgeText}
              </Badge>
            </div>
            <h3 className="type-heading-m text-foreground mt-1">
              {stepMeta[0].heading}
            </h3>
            <p className="text-muted-foreground type-body-s">
              {stepMeta[0].description}
            </p>
          </div>

          <div className="bg-surface border-border/70 flex flex-col gap-2.5 rounded-2xl border p-4">
            <div className="flex items-center justify-between px-1 pb-1">
              <span className="text-tertiary type-caption font-mono uppercase">
                Project format preset
              </span>
              <span className="text-muted-foreground type-caption">
                {snapshot.publishedTemplatesCount} templates ready
              </span>
            </div>

            <ul className="flex flex-col gap-2">
              {typeRows.map((row, index) => {
                const selected = selectedTypeIndex === index;
                return (
                  <li key={row.label}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTypeIndex(index);
                        setActiveStep(0);
                      }}
                      className={cn(
                        "focus-visible:ring-ring/40 flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition-all outline-none focus-visible:ring-2",
                        selected
                          ? "border-primary/40 bg-elevated shadow-card text-foreground"
                          : "border-border/50 bg-elevated/55 text-muted-foreground hover:bg-elevated hover:text-foreground",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={cn(
                            "inline-flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors",
                            selected
                              ? "bg-primary text-primary-foreground"
                              : "bg-sunken text-muted-foreground",
                          )}
                        >
                          {row.icon}
                        </span>
                        <div className="flex min-w-0 flex-col">
                          <span className="text-foreground type-body-s-strong truncate">
                            {row.label}
                          </span>
                          <span className="text-muted-foreground type-caption truncate">
                            {row.ratioHint}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="bg-sunken text-muted-foreground type-caption rounded-full px-2.5 py-0.5 font-mono">
                          {row.count}
                        </span>
                        {selected && (
                          <Badge tone="published" withDot={false}>
                            Active
                          </Badge>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </article>

        {/* STEP 02 — Pick a template */}
        <article
          data-testid="how-it-works-step-2"
          onMouseEnter={() => setActiveStep(1)}
          className={cn(
            "bg-elevated shadow-card flex min-w-0 flex-col justify-between gap-6 rounded-3xl border p-6 transition-all duration-300 sm:p-8",
            activeStep === 1
              ? "border-primary/45 ring-primary/10 ring-4"
              : "border-border/70 hover:border-border-strong",
          )}
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="bg-accent text-accent-foreground type-caption inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold">
                <LayoutTemplate className="size-3.5" />
                {stepMeta[1].title}
              </span>
              <Badge tone="neutral" withDot={false}>
                {stepMeta[1].badgeText}
              </Badge>
            </div>
            <h3 className="type-heading-m text-foreground mt-1">
              {stepMeta[1].heading}
            </h3>
            <p className="text-muted-foreground type-body-s">
              {stepMeta[1].description}
            </p>
          </div>

          <div className="bg-surface border-border/70 flex flex-col gap-3.5 rounded-2xl border p-4">
            {/* Mini template selector pills */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {previewTemplates.map((tpl, idx) => {
                  const selected = idx === selectedTemplateIndex;
                  return (
                    <button
                      key={tpl.slug}
                      type="button"
                      onClick={() => {
                        setSelectedTemplateIndex(idx);
                        setActiveStep(1);
                      }}
                      className={cn(
                        "type-caption rounded-full px-3 py-1 font-semibold transition-all",
                        selected
                          ? "bg-inverse text-inverse-foreground shadow-2xs"
                          : "bg-elevated text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {tpl.name}
                    </button>
                  );
                })}
              </div>
              <span className="text-tertiary type-caption font-mono">
                v{activeTemplate.version}
              </span>
            </div>

            {/* Live TemplateThumbnail Component */}
            <div className="border-border/70 bg-elevated overflow-hidden rounded-xl border shadow-2xs">
              <TemplateThumbnail
                coverUrl={activeTemplate.coverSrc}
                slug={activeTemplate.slug}
                name={activeTemplate.name}
                loading="eager"
                className="aspect-16/10 w-full"
              />
              <div className="border-border/60 flex flex-wrap items-center justify-between gap-2 border-t px-3.5 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-foreground type-body-s-strong truncate">
                    {activeTemplate.name}
                  </span>
                  <span className="text-tertiary type-caption">·</span>
                  <span className="text-muted-foreground type-caption truncate">
                    {activeTemplate.categoryName}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="bg-sunken text-muted-foreground type-caption rounded-full px-2.5 py-0.5">
                    {activeTemplate.sectionCount} sections
                  </span>
                  <span className="bg-sunken text-muted-foreground type-caption rounded-full px-2.5 py-0.5">
                    {activeTemplate.slotCount} slots
                  </span>
                  {activeTemplate.tier === "pro" ? (
                    <ProBadge />
                  ) : (
                    <Badge tone="published" withDot={false}>
                      Free
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </article>

        {/* STEP 03 — Customize slots & tokens */}
        <article
          data-testid="how-it-works-step-3"
          onMouseEnter={() => setActiveStep(2)}
          className={cn(
            "bg-elevated shadow-card flex min-w-0 flex-col justify-between gap-6 rounded-3xl border p-6 transition-all duration-300 sm:p-8",
            activeStep === 2
              ? "border-primary/45 ring-primary/10 ring-4"
              : "border-border/70 hover:border-border-strong",
          )}
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="bg-accent text-accent-foreground type-caption inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold">
                <Palette className="size-3.5" />
                {stepMeta[2].title}
              </span>
              <Badge tone="neutral" withDot={false}>
                {stepMeta[2].badgeText}
              </Badge>
            </div>
            <h3 className="type-heading-m text-foreground mt-1">
              {stepMeta[2].heading}
            </h3>
            <p className="text-muted-foreground type-body-s">
              {stepMeta[2].description}
            </p>
          </div>

          <div className="bg-surface border-border/70 flex flex-col gap-3.5 rounded-2xl border p-4">
            {/* Ratio-locked slot status header */}
            <div className="border-border/70 bg-elevated flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3">
              <div className="flex items-center gap-2.5">
                <span className="bg-success-soft text-success inline-flex size-8 shrink-0 items-center justify-center rounded-lg">
                  <Check className="size-4" />
                </span>
                <div className="flex flex-col">
                  <span className="text-foreground type-body-s-strong">
                    Ratio-locked slots
                  </span>
                  <span className="text-muted-foreground type-caption">
                    {snapshot.totalTemplateSlots} screenshot slots across{" "}
                    {snapshot.publishedTemplatesCount} live templates
                  </span>
                </div>
              </div>
              <Badge tone="published">Verified</Badge>
            </div>

            {/* Interactive Theme Token Picker */}
            <div className="border-border/70 bg-elevated flex flex-col gap-2.5 rounded-xl border p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-foreground type-caption font-semibold">
                  Curated theme palette
                </span>
                <span className="text-tertiary type-caption font-mono">
                  {activePalette.token}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                {CURATED_PALETTE_SWATCHES.map((palette, idx) => {
                  const active = idx === selectedPaletteIndex;
                  return (
                    <button
                      key={palette.id}
                      type="button"
                      onClick={() => {
                        setSelectedPaletteIndex(idx);
                        setActiveStep(2);
                      }}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition-all",
                        active
                          ? "border-primary bg-surface shadow-2xs"
                          : "border-border/60 hover:border-border-strong",
                      )}
                    >
                      <span className="text-foreground type-caption truncate font-medium">
                        {palette.label.split(" ")[0]}
                      </span>
                      <span className="flex shrink-0 -space-x-1">
                        {palette.swatches.slice(0, 3).map((swatchClass) => (
                          <span
                            key={swatchClass}
                            className={cn(
                              "border-elevated size-3.5 rounded-full border",
                              swatchClass,
                            )}
                          />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="border-border/60 flex flex-wrap items-center justify-between gap-1.5 border-t pt-2.5">
                <div className="flex flex-wrap gap-1.5">
                  {["iPhone 16 Pro", "Android", "MacBook"].map((frame) => (
                    <span
                      key={frame}
                      className="bg-sunken text-muted-foreground type-caption rounded-full px-2.5 py-0.5"
                    >
                      {frame}
                    </span>
                  ))}
                </div>
                <span className="text-tertiary type-caption">
                  {snapshot.curatedPalettesCount} palettes ·{" "}
                  {snapshot.curatedFontPairsCount} font pairs
                </span>
              </div>
            </div>
          </div>
        </article>

        {/* STEP 04 — Publish or export */}
        <article
          data-testid="how-it-works-step-4"
          onMouseEnter={() => setActiveStep(3)}
          className={cn(
            "bg-elevated shadow-card flex min-w-0 flex-col justify-between gap-6 rounded-3xl border p-6 transition-all duration-300 sm:p-8",
            activeStep === 3
              ? "border-primary/45 ring-primary/10 ring-4"
              : "border-border/70 hover:border-border-strong",
          )}
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="bg-accent text-accent-foreground type-caption inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold">
                <Rocket className="size-3.5" />
                {stepMeta[3].title}
              </span>
              <Badge tone="neutral" withDot={false}>
                {stepMeta[3].badgeText}
              </Badge>
            </div>
            <h3 className="type-heading-m text-foreground mt-1">
              {stepMeta[3].heading}
            </h3>
            <p className="text-muted-foreground type-body-s">
              {stepMeta[3].description}
            </p>
          </div>

          <div className="bg-surface border-border/70 flex flex-col gap-3 rounded-2xl border p-4">
            {/* Live URL Bar */}
            <div className="border-border/70 bg-elevated flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5">
              <span className="text-foreground type-caption flex min-w-0 items-center gap-2 truncate font-mono">
                <Globe className="text-primary size-4 shrink-0" />
                <span className="truncate">
                  casefolio.app/p/{activeTemplate.slug}
                </span>
              </span>
              <Badge tone="published">Live · 200 OK</Badge>
            </div>

            {/* Visibility Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground type-caption">
                Visibility control
              </span>
              <div className="bg-elevated border-border/70 inline-flex gap-1 rounded-full border p-1">
                {(["Public", "Unlisted", "Private"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setSelectedVisibility(mode);
                      setActiveStep(3);
                    }}
                    className={cn(
                      "type-caption rounded-full px-2.5 py-0.5 font-medium transition-colors",
                      selectedVisibility === mode
                        ? "bg-inverse text-inverse-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Export Formats Row */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "PNG long", sub: "2x Retina" },
                { label: "Behance 1400", sub: "1400px Slice" },
                { label: "A4 PDF", sub: "Print Deck" },
              ].map((preset) => (
                <div
                  key={preset.label}
                  className="border-border/70 bg-elevated flex flex-col gap-0.5 rounded-xl border px-3 py-2"
                >
                  <span className="text-foreground type-caption flex items-center gap-1 font-semibold">
                    <FileDown className="text-primary size-3 shrink-0" />
                    <span className="truncate">{preset.label}</span>
                  </span>
                  <span className="text-tertiary type-caption">
                    {preset.sub}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Why Casefolio — three columns with soft visual panels                       */
/* -------------------------------------------------------------------------- */

function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="bg-surface border-border/60 relative h-72 overflow-hidden rounded-2xl border">
      <span
        aria-hidden="true"
        className="border-border absolute inset-y-0 left-[22%] border-l border-dashed"
      />
      <span
        aria-hidden="true"
        className="border-border absolute inset-x-0 top-[30%] border-t border-dashed"
      />
      {children}
    </div>
  );
}

function FeatureHead({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="bg-surface border-border/60 text-foreground inline-flex size-11 items-center justify-center rounded-xl border [&_svg]:size-5">
        {icon}
      </span>
      <h3 className="type-heading-m text-foreground mt-2">{title}</h3>
      <p className="text-muted-foreground type-body-m max-w-xs">
        {description}
      </p>
    </div>
  );
}

const SECTION_ROWS = [
  { label: "Hero", locked: true },
  { label: "Overview", locked: false },
  { label: "Problem", locked: false },
  { label: "Process", locked: false },
  { label: "Key screens", locked: false },
] as const;

export function FeatureColumns({
  snapshot,
}: {
  snapshot: LandingPlatformSnapshot;
}) {
  return (
    <Reveal
      stagger
      className="grid grid-cols-1 gap-x-8 gap-y-16 lg:grid-cols-3"
    >
      <div className="flex flex-col gap-8">
        <FeatureHead
          icon={<ImageIcon />}
          title="Drop screens into slots"
          description={`Ratio-locked slots and ${snapshot.deviceFramesCount} hardware frames keep every screenshot perfectly framed.`}
        />
        <Panel>
          <div className="absolute top-8 left-1/2 w-40 -translate-x-1/2 -rotate-6">
            <div className="bg-inverse border-border-strong shadow-float overflow-hidden rounded-3xl border-4 p-1">
              <img
                src="/landing/orbit-home.svg"
                alt="Orbit wallet screen inside an iPhone 16 Pro frame"
                className="aspect-9/19 w-full rounded-2xl object-cover"
              />
            </div>
          </div>
          <span className="bg-elevated shadow-float type-caption absolute bottom-4 left-4 rounded-full px-3 py-1">
            9:19.5 · iPhone 16 Pro
          </span>
        </Panel>
      </div>

      <div className="flex flex-col gap-8">
        <FeatureHead
          icon={<Palette />}
          title="Your colors and fonts"
          description={`${snapshot.curatedPalettesCount} curated palettes and ${snapshot.curatedFontPairsCount} font pairs, always contrast-checked.`}
        />
        <Panel>
          <FloatCard className="absolute top-10 left-1/2 w-[min(16rem,calc(100%-2rem))] -translate-x-1/2 rotate-3">
            <CardLabel>Theme tokens</CardLabel>
            <ul className="mt-3 flex flex-col gap-2">
              {[
                { name: "Primary", className: "bg-primary" },
                { name: "Accent", className: "bg-[var(--tmpl-secondary)]" },
                { name: "Highlight", className: "bg-[var(--tmpl-primary)]" },
                { name: "Surface", className: "bg-inverse" },
              ].map((token) => (
                <li
                  key={token.name}
                  className="type-caption flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <span className={cn("size-4 rounded-full", token.className)} />
                    {token.name}
                  </span>
                  <span className="text-tertiary font-mono">token</span>
                </li>
              ))}
            </ul>
          </FloatCard>
        </Panel>
      </div>

      <div className="flex flex-col gap-8">
        <FeatureHead
          icon={<Layers />}
          title="Sections your way"
          description={`${snapshot.sectionPresetsCount} narrative presets. Reorder, duplicate, or hide what you do not need.`}
        />
        <Panel>
          <FloatCard className="absolute top-8 left-1/2 w-[min(16rem,calc(100%-2rem))] -translate-x-1/2 -rotate-2 p-3">
            <ul className="flex flex-col gap-1.5">
              {SECTION_ROWS.map((row) => (
                <li
                  key={row.label}
                  className="bg-surface type-caption flex items-center justify-between rounded-xl px-3 py-2"
                >
                  <span>{row.label}</span>
                  {row.locked ? (
                    <Lock className="text-tertiary size-3.5" />
                  ) : (
                    <span className="bg-primary relative h-4 w-7 rounded-full">
                      <span className="bg-primary-foreground absolute top-0.5 right-0.5 size-3 rounded-full" />
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </FloatCard>
        </Panel>
      </div>
    </Reveal>
  );
}

export function FeatureList() {
  const items = [
    {
      icon: <Eye />,
      title: "Live preview",
      description:
        "Switch between 375px and 1440px with the exact renderer used for publish and export.",
    },
    {
      icon: <History />,
      title: "Autosave and versions",
      description:
        "Undo, redo, and autosave while every project stays pinned to its template version.",
    },
    {
      icon: <ShieldCheck />,
      title: "Pre-publish check",
      description:
        "Empty required slots and low-contrast tokens are caught before your page goes public.",
    },
  ] as const;

  return (
    <Reveal
      stagger
      className="border-border/60 mt-24 grid grid-cols-1 gap-x-8 gap-y-10 border-t pt-14 md:grid-cols-3"
    >
      {items.map((item) => (
        <div key={item.title} className="flex gap-4">
          <span className="bg-surface border-border/60 text-foreground inline-flex size-10 shrink-0 items-center justify-center rounded-xl border [&_svg]:size-4.5">
            {item.icon}
          </span>
          <div className="flex flex-col gap-1.5">
            <h3 className="type-heading-s text-foreground">{item.title}</h3>
            <p className="text-muted-foreground type-body-s">
              {item.description}
            </p>
          </div>
        </div>
      ))}
    </Reveal>
  );
}

/* -------------------------------------------------------------------------- */
/* Template showcase gallery with full 4:3 thumbnails                          */
/* -------------------------------------------------------------------------- */

export function TemplateStack({
  templates,
}: {
  templates: readonly LandingTemplateShowcaseItem[];
}) {
  const [active, setActive] = useState(0);
  const count = templates.length;

  if (count === 0) return null;

  return (
    <div
      data-testid="landing-template-showcase"
      className="flex w-full max-w-6xl flex-col items-center gap-8 sm:gap-10"
    >
      {/* Quick Template Selector Rail */}
      <div
        role="tablist"
        aria-label="Choose template"
        className="border-border/70 bg-elevated/90 shadow-card flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-2xl border p-1.5 sm:rounded-full"
      >
        {templates.map((template, index) => {
          const isSelected = index === active;
          return (
            <button
              key={template.slug}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setActive(index)}
              className={cn(
                "focus-visible:ring-ring/40 inline-flex items-center gap-2 rounded-xl px-3.5 py-2 transition-all outline-none focus-visible:ring-2 sm:rounded-full sm:px-4",
                isSelected
                  ? "bg-inverse text-inverse-foreground type-body-s-strong shadow-xs"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground type-body-s",
              )}
            >
              <span>{template.name}</span>
              <span
                className={cn(
                  "type-caption rounded-full px-2 py-0.5",
                  isSelected
                    ? "bg-inverse-foreground/15 text-inverse-foreground"
                    : "bg-sunken text-muted-foreground",
                )}
              >
                {template.categoryName}
              </span>
            </button>
          );
        })}
      </div>

      {/* Responsive Template Thumbnail Cards Grid (all templates visible & crisp) */}
      <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 lg:gap-8">
        {templates.map((template, index) => {
          const isHighlighted = index === active;
          return (
            <article
              key={template.slug}
              data-stack-card=""
              data-template-slug={template.slug}
              onClick={() => setActive(index)}
              className={cn(
                "group bg-elevated shadow-card flex min-w-0 flex-col justify-between overflow-hidden rounded-3xl border p-4 transition-all duration-300 sm:p-5",
                isHighlighted
                  ? "border-primary/45 shadow-float ring-primary/10 ring-4"
                  : "border-border/70 hover:border-border-strong hover:shadow-float",
              )}
            >
              {/* Browser / Studio Frame around the TemplateThumbnail */}
              <div className="border-border/70 bg-surface overflow-hidden rounded-2xl border">
                <div className="border-border/60 bg-elevated/90 flex items-center justify-between gap-2 border-b px-3.5 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="hidden items-center gap-1.5 sm:flex" aria-hidden="true">
                      <span className="bg-border-strong size-2 rounded-full" />
                      <span className="bg-border-strong size-2 rounded-full" />
                      <span className="bg-border-strong size-2 rounded-full" />
                    </span>
                    <span className="text-muted-foreground type-caption truncate font-mono">
                      casefolio.app/p/{template.slug}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="bg-sunken text-muted-foreground type-caption rounded-full px-2.5 py-0.5">
                      {formatPlatformLabel(template.type)}
                    </span>
                    <span className="bg-sunken text-tertiary type-caption hidden rounded-full px-2 py-0.5 font-mono sm:inline-flex">
                      v{template.version}
                    </span>
                  </div>
                </div>

                <TemplateThumbnail
                  coverUrl={template.coverSrc}
                  slug={template.slug}
                  name={template.name}
                  alt={`${template.name} template preview`}
                  loading="eager"
                  className="aspect-4/3 w-full"
                  imageClassName="group-hover:scale-[1.02]"
                />
              </div>

              {/* Card Details & Actions */}
              <div className="flex flex-1 flex-col justify-between gap-4 px-1 pt-5 pb-1">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <h3 className="type-heading-m text-foreground truncate">
                        {template.name}
                      </h3>
                      <span className="bg-sunken text-muted-foreground type-caption shrink-0 rounded-full px-2.5 py-0.5">
                        {template.categoryName}
                      </span>
                    </div>

                    {template.tier === "free" ? (
                      <Badge tone="published" withDot={false}>
                        Free
                      </Badge>
                    ) : (
                      <ProBadge />
                    )}
                  </div>

                  <p className="text-foreground type-body-s-strong line-clamp-1">
                    {template.headline}
                  </p>
                  <p className="text-muted-foreground type-body-s line-clamp-2">
                    {template.summary}
                  </p>
                </div>

                <div className="border-border/60 flex flex-wrap items-center justify-between gap-3 border-t pt-3.5">
                  <span className="text-tertiary type-caption font-mono">
                    {template.sectionCount} sections · {template.slotCount} ratio-locked slots
                  </span>

                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" asChild>
                      <Link href={`/templates?preview=${template.slug}`}>
                        <Eye className="size-3.5" />
                        <span>Preview</span>
                      </Link>
                    </Button>
                    <Button size="sm" asChild>
                      <Link href={`/new?template=${template.slug}`}>
                        <span>Use template</span>
                        <ArrowUpRight className="size-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Final CTA stage                                                             */
/* -------------------------------------------------------------------------- */

export function CtaStage({
  snapshot,
  children,
}: {
  snapshot: LandingPlatformSnapshot;
  children: ReactNode;
}) {
  const stageRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const stage = stageRef.current;
      if (!stage || prefersReducedMotion()) return;
      ensureGsapPluginsRegistered();

      gsap.fromTo(
        stage,
        { scale: 0.92, borderRadius: "4rem" },
        {
          scale: 1,
          borderRadius: "2.5rem",
          ease: "none",
          scrollTrigger: {
            trigger: stage,
            start: "top 100%",
            end: "top 45%",
            scrub: 0.8,
          },
        },
      );
    },
    { scope: stageRef },
  );

  const cinema = snapshot.templates[0];

  return (
    <div
      ref={stageRef}
      className="bg-wash-panel relative overflow-hidden rounded-3xl px-5 py-16 text-center sm:rounded-[2.5rem] sm:px-12 sm:py-28 lg:py-40"
    >
      <Parallax
        distance={-70}
        rotate={-6}
        className="absolute -top-2 -left-8 hidden w-60 md:block lg:left-10"
      >
        <Float amplitude={8}>
          <FloatCard className="-rotate-6">
            <CardLabel>Template</CardLabel>
            <p className="text-foreground type-body-s-strong mt-1.5">
              {cinema?.name ?? "Cinema"} · {cinema?.sectionCount ?? 14} sections
            </p>
            <div className="bg-inverse mt-3 overflow-hidden rounded-xl">
              <img
                src={cinema?.coverSrc ?? "/templates/cinema/cover.svg"}
                alt=""
                aria-hidden="true"
                className="aspect-16/10 w-full object-cover"
              />
            </div>
          </FloatCard>
        </Float>
      </Parallax>

      <Parallax
        distance={-100}
        rotate={7}
        className="absolute -top-4 -right-8 hidden w-56 md:block lg:right-10"
      >
        <Float amplitude={10} duration={4.4}>
          <FloatCard className="rotate-6">
            <CardLabel>
              <ShieldCheck className="text-success size-3.5" />
              Pre-publish check
            </CardLabel>
            <p className="type-heading-m text-foreground mt-2">6 / 6 ready</p>
          </FloatCard>
        </Float>
      </Parallax>

      <Parallax
        distance={-60}
        rotate={5}
        className="absolute -bottom-4 -left-6 hidden w-64 md:block lg:left-14"
      >
        <Float amplitude={9} duration={3.9}>
          <FloatCard className="rotate-3">
            <CardLabel>Export</CardLabel>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {["PNG long", "Behance 1400", "A4 PDF"].map((format) => (
                <span
                  key={format}
                  className="bg-sunken text-muted-foreground type-caption rounded-full px-2.5 py-0.5"
                >
                  {format}
                </span>
              ))}
            </div>
          </FloatCard>
        </Float>
      </Parallax>

      <Parallax
        distance={-110}
        rotate={-5}
        className="absolute -right-6 -bottom-6 hidden w-64 md:block lg:right-14"
      >
        <Float amplitude={10} duration={4.8}>
          <FloatCard className="-rotate-3">
            <CardLabel>
              <Globe className="text-primary size-3.5" />
              Public page
            </CardLabel>
            <p className="text-foreground type-body-s-strong mt-2 truncate font-mono">
              casefolio.app/p/you
            </p>
          </FloatCard>
        </Float>
      </Parallax>

      <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center gap-8">
        {children}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Hero device — tilts flat while the page scrolls                             */
/* -------------------------------------------------------------------------- */

export function HeroDevice({
  snapshot,
  children,
}: {
  snapshot: LandingPlatformSnapshot;
  children: ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const wrap = wrapRef.current;
      if (!wrap || prefersReducedMotion()) return;
      ensureGsapPluginsRegistered();

      const device = wrap.querySelector<HTMLElement>("[data-device]");
      if (!device) return;

      const isMobile = window.innerWidth < 768;
      gsap.fromTo(
        device,
        {
          rotateX: isMobile ? 6 : 14,
          scale: isMobile ? 0.97 : 0.92,
          y: isMobile ? 16 : 36,
          transformOrigin: "50% 0%",
        },
        {
          rotateX: 0,
          scale: 1,
          y: 0,
          ease: "none",
          scrollTrigger: {
            trigger: wrap,
            start: "top 92%",
            end: "top 30%",
            scrub: 0.8,
          },
        },
      );
    },
    { scope: wrapRef },
  );

  return (
    <div
      ref={wrapRef}
      className="relative mx-auto w-full max-w-6xl [perspective:1600px]"
    >
      <div
        data-device=""
        className="bg-inverse shadow-overlay rounded-2xl p-1.5 will-change-transform sm:rounded-[1.75rem] sm:p-2.5 lg:rounded-[2rem] lg:p-3"
      >
        <div className="bg-card relative overflow-hidden rounded-xl sm:rounded-2xl lg:rounded-3xl">
          <span
            aria-hidden="true"
            className="bg-border-strong absolute top-2 left-1/2 z-10 hidden size-1.5 -translate-x-1/2 rounded-full sm:block"
          />
          {children}
        </div>
      </div>
      <HeroFloaters snapshot={snapshot} />
    </div>
  );
}
