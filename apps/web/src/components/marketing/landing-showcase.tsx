"use client";

import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Eye,
  FileText,
  Layers,
  Monitor,
  Palette,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  Float,
  Parallax,
  ScrollRise,
} from "@/components/marketing/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  LandingPlatformSnapshot,
  LandingTemplateShowcaseItem,
} from "@/lib/marketing/landing-stats";
import { cn } from "@/lib/utils";

export const LANDING_MAX_TEMPLATES = 6;

const STUDIO_STAGE_MODES = [
  {
    id: "canvas",
    label: "Editor canvas",
    note: "14 narrative beats · live desktop & mobile switcher",
  },
  {
    id: "screens",
    label: "Mobile spreads",
    note: "9:19.5 iPhone 16 Pro frames · zero crop distortion",
  },
  {
    id: "export",
    label: "Multi-target bundle",
    note: "Live URL · 1400px Behance PNG · print-sharp A4 PDF",
  },
] as const;

export function HeroDevice({
  snapshot,
  children,
}: {
  snapshot: LandingPlatformSnapshot;
  children: ReactNode;
}) {
  const [stageMode, setStageMode] =
    useState<(typeof STUDIO_STAGE_MODES)[number]["id"]>("canvas");

  return (
    <div className="relative mx-auto w-full max-w-6xl">
      {/* Asymmetric floating screen satellites */}
      <div className="pointer-events-none absolute top-14 -left-10 z-20 hidden xl:block">
        <Parallax distance={-30}>
          <Float amplitude={6} duration={5.4}>
            <div className="obsidian-surface obsidian-hairline w-44 -rotate-6 overflow-hidden rounded-2xl border p-2">
              <div className="bg-inverse overflow-hidden rounded-xl border border-border/30">
                <img
                  src="/templates/cinema/screen-seats.svg"
                  alt=""
                  className="aspect-9/16 w-full object-cover"
                />
              </div>
              <div className="mt-2 flex items-center justify-between px-1">
                <span className="type-caption font-medium text-inherit">
                  Cinema mobile
                </span>
                <span className="obsidian-muted font-mono text-xs">
                  9:19.5
                </span>
              </div>
            </div>
          </Float>
        </Parallax>
      </div>

      <div className="pointer-events-none absolute top-24 -right-10 z-20 hidden xl:block">
        <Parallax distance={32}>
          <Float amplitude={7} duration={6.1}>
            <div className="obsidian-surface obsidian-hairline w-56 rotate-3 overflow-hidden rounded-2xl border p-2.5">
              <div className="overflow-hidden rounded-xl border border-border/30">
                <img
                  src="/templates/atlas/hero-planner.svg"
                  alt=""
                  className="aspect-16/10 w-full object-cover"
                />
              </div>
              <div className="mt-2 flex items-center justify-between px-1">
                <span className="type-caption font-medium text-inherit">
                  Atlas travel spread
                </span>
                <span className="obsidian-muted font-mono text-xs">
                  16:10
                </span>
              </div>
            </div>
          </Float>
        </Parallax>
      </div>

      {/* Main Dark Studio Workbench Frame */}
      <div className="obsidian-card obsidian-hairline relative overflow-hidden rounded-2xl border sm:rounded-[1.75rem]">
        {/* Interactive Top Studio Control Bar */}
        <div className="obsidian-hairline flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="hidden gap-1.5 sm:flex" aria-hidden="true">
              <span className="size-2.5 rounded-full bg-current opacity-30" />
              <span className="size-2.5 rounded-full bg-current opacity-30" />
              <span className="size-2.5 rounded-full bg-current opacity-30" />
            </span>
            <span className="obsidian-muted font-mono text-xs">
              studio.casefolio.app / cinema
            </span>
          </div>

          <div
            role="tablist"
            aria-label="Hero showcase view"
            className="obsidian-hairline flex flex-wrap items-center gap-1 rounded-2xl border p-1 sm:rounded-full"
          >
            {STUDIO_STAGE_MODES.map((mode) => {
              const active = stageMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStageMode(mode.id)}
                  className={cn(
                    "type-caption cursor-pointer rounded-full px-3 py-1 font-medium transition-all",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-inherit opacity-75 hover:opacity-100",
                  )}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Stage Viewport */}
        <div className="relative p-2.5 sm:p-4">
          {stageMode === "canvas" ? (
            <div className="relative">
              {children}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-2 pt-1 pb-1">
                <p className="obsidian-muted type-caption">
                  {STUDIO_STAGE_MODES[0].note}
                </p>
                <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                  <span className="obsidian-hairline rounded-full border px-2.5 py-0.5 text-inherit">
                    {snapshot.publishedTemplatesCount} templates
                  </span>
                  <span className="obsidian-hairline rounded-full border px-2.5 py-0.5 text-inherit">
                    {snapshot.deviceFramesCount} locked frames
                  </span>
                  <span className="obsidian-hairline rounded-full border px-2.5 py-0.5 text-inherit">
                    AA contrast checked
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {stageMode === "screens" ? (
            <div className="grid grid-cols-1 gap-4 p-2 sm:grid-cols-3 sm:p-4">
              {[
                {
                  src: "/templates/cinema/screen-seats.svg",
                  title: "Cinema — Seat selection",
                  spec: "iPhone 16 Pro · 9:19.5",
                },
                {
                  src: "/landing/orbit-home.svg",
                  title: "Orbit — Payoff balance",
                  spec: "Mobile App · 9:19.5",
                },
                {
                  src: "/templates/pulse/hero-workout.svg",
                  title: "Pulse — Workout ring",
                  spec: "Wellness UI · 9:19.5",
                },
              ].map((screen) => (
                <div
                  key={screen.title}
                  className="obsidian-hairline flex flex-col gap-3 rounded-2xl border p-3"
                >
                  <img
                    src={screen.src}
                    alt={screen.title}
                    className="aspect-9/16 max-h-80 w-full rounded-xl object-cover"
                  />
                  <div className="flex items-center justify-between gap-2 px-1">
                    <span className="type-caption font-medium text-inherit">
                      {screen.title}
                    </span>
                    <span className="obsidian-muted font-mono text-xs">
                      {screen.spec}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {stageMode === "export" ? (
            <div className="grid grid-cols-1 items-center gap-6 p-3 sm:p-6 lg:grid-cols-12">
              <div className="overflow-hidden rounded-xl border obsidian-hairline lg:col-span-7">
                <img
                  src="/landing/export-bundle-preview.svg"
                  alt="Behance 1400px strip, 2x Retina PNG, and A4 PDF bundle export preview"
                  className="aspect-16/9 w-full object-cover"
                />
              </div>
              <div className="flex flex-col gap-4 text-left lg:col-span-5">
                <p className="obsidian-muted type-overline">
                  One draft, three outputs
                </p>
                <h3 className="font-display text-2xl font-semibold text-inherit">
                  Stop duplicating Figma pages for Behance and PDFs.
                </h3>
                <ul className="divide-y obsidian-hairline flex flex-col border-y">
                  {[
                    ["Hosted Portfolio Link", "casefolio.app/p/your-work"],
                    ["Behance 1400px Slice Pack", "Lossless vertical PNGs"],
                    ["Recruiter Deck PDF", "Print-sharp A4 pagination"],
                  ].map(([title, meta]) => (
                    <li
                      key={title}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <span className="type-body-s-strong text-inherit">
                        {title}
                      </span>
                      <span className="obsidian-muted font-mono text-xs">
                        {meta}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const MARQUEE_PLATES = [
  {
    slug: "cinema",
    name: "Cinema",
    tag: "Mobile · Entertainment",
    src: "/templates/cinema/cover.svg",
  },
  {
    slug: "orbit",
    name: "Orbit",
    tag: "Fintech · App",
    src: "/templates/orbit/cover.svg",
  },
  {
    slug: "meridian-pro",
    name: "Meridian",
    tag: "B2B SaaS",
    src: "/templates/meridian-pro/cover.svg",
  },
  {
    slug: "atlas",
    name: "Atlas",
    tag: "Hybrid Travel",
    src: "/templates/atlas/cover.svg",
  },
  {
    slug: "northwind",
    name: "Northwind",
    tag: "Web Logistics",
    src: "/templates/northwind/cover.svg",
  },
  {
    slug: "pulse",
    name: "Pulse",
    tag: "Health UI",
    src: "/templates/pulse/cover.svg",
  },
] as const;

export function WorkMarquee({ templates }: { templates: LandingTemplateShowcaseItem[] }) {
  const items =
    templates.length > 0
      ? templates.slice(0, 6).map((t) => ({
          slug: t.slug,
          name: t.name,
          tag: t.categoryName,
          src: t.coverSrc,
        }))
      : MARQUEE_PLATES;

  return (
    <div
      aria-label="Case study gallery preview reel"
      className="casefolio-marquee relative w-full overflow-hidden py-5"
    >
      <div className="casefolio-marquee-track gap-5 pr-5">
        {[0, 1].map((dup) => (
          <div
            key={dup}
            aria-hidden={dup === 1 ? true : undefined}
            className="flex shrink-0 items-center gap-5"
          >
            {items.map((item) => (
              <Link
                key={`${dup}-${item.slug}`}
                href={`/templates/${item.slug}`}
                tabIndex={dup === 1 ? -1 : undefined}
                className="obsidian-card obsidian-hairline group relative flex w-64 shrink-0 flex-col overflow-hidden rounded-2xl border transition-transform duration-300 hover:-translate-y-1 sm:w-72"
              >
                <div className="aspect-4/3 overflow-hidden">
                  <img
                    src={item.src}
                    alt={dup === 0 ? `${item.name} case study layout` : ""}
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="obsidian-hairline flex items-center justify-between gap-2 border-t px-3.5 py-2.5">
                  <span className="type-body-s-strong text-inherit">
                    {item.name}
                  </span>
                  <span className="obsidian-muted font-mono text-xs">
                    {item.tag}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function HowItWorksStage({
  snapshot,
}: {
  snapshot: LandingPlatformSnapshot;
}) {
  const steps = [
    {
      num: "01",
      title: "Lock your frame ratio",
      description:
        "Choose mobile, desktop, or hybrid proportions once. Every uploaded UI export stays razor-sharp.",
      chips: ["9:19.5 Mobile", "16:10 MacBook"],
    },
    {
      num: "02",
      title: "Pick an editorial pacing skeleton",
      description: `Open any of our ${snapshot.publishedTemplatesCount} studio-crafted skeletons with ${snapshot.sectionPresetsCount} modular blocks ready.`,
      chips: ["Hero", "Problem", "Outcome"],
    },
    {
      num: "03",
      title: "Drop screens & tune tokens",
      description:
        "Drop raw Figma exports in and switch color palettes or type pairs while WCAG contrast verifies live.",
      chips: ["AA 11.4:1", "Token lock"],
    },
    {
      num: "04",
      title: "Publish URL or ship slices",
      description:
        "Push live onto casefolio.app (or custom domain on Plus) and download 1400px Behance PNGs & A4 PDFs.",
      chips: ["Live URL", "Behance PNG", "A4 PDF"],
    },
  ] as const;

  return (
    <div
      data-testid="how-it-works-stage"
      className="border-border divide-border grid grid-cols-1 divide-y border-y sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-y-0"
    >
      {steps.map((step, idx) => (
        <ScrollRise key={step.num} y={12} className="h-full">
          <article
            data-testid={`how-it-works-step-${idx + 1}`}
            className="hover:bg-surface/70 flex h-full flex-col justify-between gap-8 px-5 py-8 transition-colors sm:px-6 sm:py-10"
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-display text-muted-foreground select-none text-5xl leading-none font-bold tracking-tighter tabular-nums sm:text-6xl">
                  {step.num}
                </span>
                <span className="text-primary font-mono text-xs font-medium uppercase">
                  Beat {step.num}
                </span>
              </div>

              <h3 className="type-heading-m text-foreground">{step.title}</h3>
              <p className="text-muted-foreground type-body-s leading-relaxed">
                {step.description}
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-2">
              {step.chips.map((chip) => (
                <span
                  key={chip}
                  className="border-border bg-elevated text-foreground rounded-full border px-2.5 py-0.5 font-mono text-xs"
                >
                  {chip}
                </span>
              ))}
            </div>
          </article>
        </ScrollRise>
      ))}
    </div>
  );
}

const WORKBENCH_MODES = [
  {
    id: "wheel",
    num: "01",
    label: "3D-fanned mockups",
    headline: "Drop flat Figma PNGs into proportioned screens",
    detail:
      "iPhone 16 Pro, Android, iPad & MacBook Pro shells automatically respect safe zones — no stretched thumbnails or manual drop shadows.",
    statLabel: "Device Library",
    statValue: "7 frames locked",
    badge: "Zero crop math",
  },
  {
    id: "tokens",
    num: "02",
    label: "Live brand & contrast",
    headline: "Switch themes globally without breaking readability",
    detail:
      "Swap surface contrast, primary accent ink, and editorial serif pairings in one click while WCAG AA checks validate every headline.",
    statLabel: "Pre-publish Guard",
    statValue: "AA Contrast Pass",
    badge: "Contrast-verified",
  },
  {
    id: "narrative",
    num: "03",
    label: "Structured story rails",
    headline: "Sequence context, trade-offs & outcomes effortlessly",
    detail:
      "Toggle Discovery, Research, Flow, and Metrics blocks on or off — the rhythm and vertical breathing room re-balance automatically.",
    statLabel: "Modular Blocks",
    statValue: "13 UX block types",
    badge: "Recruiter-paced",
  },
  {
    id: "export",
    num: "04",
    label: "Clean single-click delivery",
    headline: "Ship to live web, Behance 1400px, and A4 PDFs",
    detail:
      "Every export renders straight from the live layout tree so serif italics, code metrics, and crisp device bezels match 1:1.",
    statLabel: "Output Targets",
    statValue: "Web · PNG · PDF",
    badge: "Same source engine",
  },
] as const;

export function ObsidianWorkflowStage({
  snapshot,
}: {
  snapshot: LandingPlatformSnapshot;
}) {
  const [activeId, setActiveId] =
    useState<(typeof WORKBENCH_MODES)[number]["id"]>("wheel");

  const active =
    WORKBENCH_MODES.find((item) => item.id === activeId) ?? WORKBENCH_MODES[0];

  return (
    <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
      {/* Left 8 cols: Framer-inspired live interactive stage canvas */}
      <div className="obsidian-card obsidian-hairline flex flex-col justify-between gap-6 rounded-[1.75rem] border p-5 sm:p-8 lg:col-span-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {WORKBENCH_MODES.map((mode) => {
              const isSelected = mode.id === active.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setActiveId(mode.id)}
                  className={cn(
                    "type-caption cursor-pointer rounded-full border px-3.5 py-1.5 font-medium transition-all",
                    isSelected
                      ? "bg-primary text-primary-foreground border-transparent"
                      : "obsidian-hairline text-inherit opacity-80 hover:opacity-100",
                  )}
                >
                  <span className="mr-1.5 font-mono opacity-95">
                    {mode.num}
                  </span>
                  {mode.label}
                </button>
              );
            })}
          </div>
          <span className="obsidian-hairline rounded-full border px-3 py-1 font-mono text-xs text-inherit opacity-85">
            {active.badge}
          </span>
        </div>

        {/* Dynamic Stage Visual matching Framer interactive ImageWheel / Sandbox feel */}
        <div className="obsidian-hairline relative flex min-h-80 items-center justify-center overflow-hidden rounded-2xl border bg-background/5 p-6 sm:min-h-[24rem]">
          {active.id === "wheel" ? (
            <div className="grid w-full grid-cols-1 items-center gap-4 sm:grid-cols-3">
              <div className="hidden -rotate-6 overflow-hidden rounded-2xl border obsidian-hairline shadow-card transition-transform duration-500 hover:rotate-0 sm:block">
                <img
                  src="/templates/cinema/screen-showtimes.svg"
                  alt="Cinema showtimes mobile frame"
                  className="aspect-9/16 max-h-64 w-full object-cover"
                />
              </div>
              <div className="z-10 overflow-hidden rounded-2xl border-2 border-primary shadow-overlay transition-transform duration-500 hover:scale-[1.03]">
                <img
                  src="/templates/cinema/screen-seats.svg"
                  alt="Cinema active iPhone 16 Pro seat picker screen"
                  className="aspect-9/16 max-h-72 w-full object-cover"
                />
              </div>
              <div className="hidden rotate-6 overflow-hidden rounded-2xl border obsidian-hairline shadow-card transition-transform duration-500 hover:rotate-0 sm:block">
                <img
                  src="/landing/orbit-home.svg"
                  alt="Orbit fintech home frame"
                  className="aspect-9/16 max-h-64 w-full object-cover"
                />
              </div>
            </div>
          ) : null}

          {active.id === "tokens" ? (
            <div className="grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="obsidian-hairline flex flex-col justify-between gap-4 rounded-xl border p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-inherit opacity-75">
                    Curated Palette Tokens
                  </span>
                  <span className="text-primary font-mono text-xs font-semibold">
                    {snapshot.curatedPalettesCount} presets
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ["Primary", "AA 11.4:1", "bg-primary"],
                    ["Surface", "AA 15.2:1", "bg-surface"],
                    ["Ink", "AAA 19.1:1", "bg-inverse"],
                  ].map(([name, ratio, cls]) => (
                    <div
                      key={name}
                      className="obsidian-hairline flex flex-col gap-2 rounded-lg border p-2.5"
                    >
                      <span className={cn("h-7 w-full rounded", cls)} />
                      <span className="type-caption font-medium text-inherit">
                        {name}
                      </span>
                      <span className="obsidian-muted font-mono text-xs">
                        {ratio}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="obsidian-hairline flex flex-col justify-between gap-4 rounded-xl border p-4">
                <span className="font-mono text-xs text-inherit opacity-75">
                  Editorial Font Pairing ({snapshot.curatedFontPairsCount} pairs)
                </span>
                <div>
                  <p className="font-display text-2xl font-bold text-inherit">
                    Plus Jakarta Sans
                  </p>
                  <p className="font-display text-3xl font-bold tracking-tight text-inherit">
                    Instrument Serif Italic
                  </p>
                </div>
                <p className="obsidian-muted font-mono text-xs">
                  Optical sizes &amp; line-height pre-tuned
                </p>
              </div>
            </div>
          ) : null}

          {active.id === "narrative" ? (
            <div className="w-full max-w-xl space-y-2.5">
              {[
                ["01", "Hero & Context Role", "Pinned", true],
                ["02", "User Pain Points & Constraint", "Enabled", true],
                ["03", "System Flow & Information Architecture", "Enabled", true],
                ["04", "Final High-Fidelity Screens", "Enabled", true],
                ["05", "Quantified Adoption Outcome", "Enabled", true],
              ].map(([idx, label, state]) => (
                <div
                  key={String(idx)}
                  className="obsidian-hairline flex items-center justify-between rounded-xl border px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="obsidian-muted font-mono text-xs">
                      {idx}
                    </span>
                    <span className="type-body-s-strong text-inherit">
                      {label}
                    </span>
                  </div>
                  <span className="bg-primary/20 rounded-full px-2.5 py-0.5 font-mono text-xs text-inherit">
                    {state}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {active.id === "export" ? (
            <div className="grid w-full items-center gap-5 sm:grid-cols-2">
              <img
                src="/landing/export-bundle-preview.svg"
                alt="Export formats preview"
                className="aspect-16/9 w-full rounded-xl border obsidian-hairline object-cover"
              />
              <div className="flex flex-col gap-2.5">
                <p className="font-display text-xl font-semibold text-inherit">
                  Identical pixels across every channel
                </p>
                <p className="obsidian-muted type-body-s">
                  Generate web links, Behance 1400px stitched PNG series, and A4
                  recruiter PDF decks from the exact same component render tree.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <h3 className="font-display text-2xl font-semibold text-inherit sm:text-3xl">
              {active.headline}
            </h3>
            <p className="obsidian-muted type-body-s mt-1.5">
              {active.detail}
            </p>
          </div>
          <Button variant="accent" size="default" asChild className="rounded-full px-5">
            <Link href="/sign-up">
              <span>Open live editor</span>
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Right 4 cols: Framer-inspired live telemetry & quick-jump Inspector */}
      <aside className="obsidian-card obsidian-hairline flex flex-col justify-between gap-6 rounded-[1.75rem] border p-5 sm:p-7 lg:col-span-4">
        <div className="flex flex-col gap-5">
          <div className="obsidian-hairline flex items-center justify-between border-b pb-4">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-primary" />
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-inherit">
                Studio Inspector
              </span>
            </div>
            <span className="bg-success/20 text-inherit rounded-full px-2.5 py-0.5 font-mono text-xs">
              v1.0 Live
            </span>
          </div>

          <div className="obsidian-hairline rounded-2xl border p-4">
            <p className="obsidian-muted font-mono text-xs uppercase">
              {active.statLabel}
            </p>
            <p className="font-display mt-1 text-2xl font-bold text-inherit">
              {active.statValue}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="obsidian-muted mb-1 font-mono text-xs uppercase">
              Jump to capability
            </p>
            {WORKBENCH_MODES.map((mode) => {
              const selected = mode.id === active.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setActiveId(mode.id)}
                  className={cn(
                    "obsidian-hairline flex cursor-pointer items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-colors",
                    selected
                      ? "border-primary bg-primary/15 text-inherit"
                      : "text-inherit opacity-80 hover:opacity-100",
                  )}
                >
                  <span className="type-body-s-strong">{mode.label}</span>
                  <Check
                    className={cn(
                      "size-4 shrink-0 transition-opacity",
                      selected ? "opacity-100" : "opacity-25",
                    )}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <div className="obsidian-hairline flex flex-col gap-2.5 border-t pt-4">
          <Button variant="secondary" size="default" asChild className="w-full rounded-full">
            <Link href="/templates">
              <span>Inspect all {snapshot.publishedTemplatesCount} templates</span>
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
          <p className="obsidian-muted type-caption text-center">
            Try interactive flows live before signup
          </p>
        </div>
      </aside>
    </div>
  );
}

export function TemplateStack({
  templates,
}: {
  templates: LandingTemplateShowcaseItem[];
}) {
  const showcase = templates.slice(0, LANDING_MAX_TEMPLATES);

  return (
    <div
      data-testid="landing-template-showcase"
      className="grid w-full grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3"
    >
      {showcase.map((template, idx) => (
        <ScrollRise key={template.slug} y={14}>
          <article
            data-stack-card=""
            className="group flex h-full flex-col justify-between gap-4"
          >
            <div className="flex flex-col gap-4">
                {/* Minimalist browser artboard frame */}
              <div className="border-border bg-elevated hover:border-primary hover:shadow-[var(--cf-shadow-hover)] relative overflow-hidden rounded-2xl border transition-all duration-300">
                <div className="border-border bg-surface/80 flex items-center justify-between gap-2 border-b px-3.5 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="hidden gap-1 sm:flex" aria-hidden="true">
                      <span className="bg-border-strong size-2 rounded-full" />
                      <span className="bg-border-strong size-2 rounded-full" />
                      <span className="bg-border-strong size-2 rounded-full" />
                    </span>
                    <span className="text-muted-foreground truncate font-mono text-xs">
                      {template.slug}.casefolio.app
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge
                      tone={template.tier === "pro" ? "accent" : "neutral"}
                      className="text-xs uppercase"
                    >
                      {template.tier === "pro" ? "Pro" : "Free"}
                    </Badge>
                  </div>
                </div>

                <Link
                  href={`/templates/${template.slug}`}
                  className="relative block aspect-4/3 overflow-hidden bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <img
                    src={template.coverSrc}
                    alt={`Preview ${template.name} — ${template.headline}`}
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />

                  {template.previewSecondarySrc ? (
                    <div className="border-border/80 bg-elevated/95 pointer-events-none absolute right-3 bottom-3 w-24 translate-y-2 overflow-hidden rounded-xl border p-1 opacity-90 shadow-overlay transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                      <img
                        src={template.previewSecondarySrc}
                        alt=""
                        className="aspect-9/16 w-full rounded-lg object-cover"
                      />
                    </div>
                  ) : null}
                </Link>
              </div>

              {/* Editorial index & summary without puffy card boxes */}
              <div className="flex flex-col gap-1.5 px-1">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-muted-foreground font-mono text-xs">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <h3 className="font-display text-foreground text-xl font-semibold tracking-tight">
                      {template.name}
                    </h3>
                  </div>
                  <span className="text-muted-foreground font-mono text-xs">
                    {template.categoryName} ·{" "}
                    {template.type === "both"
                      ? "Mobile + Web"
                      : template.type === "mobile"
                        ? "Mobile"
                        : "Web"}
                  </span>
                </div>
                <p className="text-muted-foreground type-body-s line-clamp-2">
                  {template.summary}
                </p>
              </div>
            </div>

            <div className="border-border flex items-center justify-between gap-2 border-t pt-3.5 px-1">
              <span className="text-muted-foreground font-mono text-xs">
                {template.sectionCount} sections · {template.slotCount} slots
              </span>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" asChild className="rounded-full">
                  <Link href={`/templates/${template.slug}`}>
                    <Eye className="size-3.5" />
                    <span>Preview</span>
                  </Link>
                </Button>
                <Button variant="default" size="sm" asChild className="rounded-full">
                  <Link href={`/new?template=${template.slug}`}>
                    <span>Use</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          </article>
        </ScrollRise>
      ))}
    </div>
  );
}

export function FeatureColumns({
  snapshot,
}: {
  snapshot: LandingPlatformSnapshot;
}) {
  const [sampleBlocks, setSampleBlocks] = useState([
    { name: "Problem statement & context", enabled: true },
    { name: "Information architecture", enabled: true },
    { name: "Key UI decisions", enabled: true },
    { name: "Outcome metrics", enabled: true },
  ]);

  const toggleBlock = (index: number) => {
    setSampleBlocks((prev) =>
      prev.map((block, idx) =>
        idx === index ? { ...block, enabled: !block.enabled } : block,
      ),
    );
  };

  return (
    <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-12">
      {/* Left sticky Pixpa-inspired editorial anchor */}
      <div className="flex flex-col items-start gap-5 lg:sticky lg:top-24 lg:col-span-5">
        <div className="border-border bg-surface w-full overflow-hidden rounded-2xl border p-3">
          <img
            src="/templates/meridian-pro/cover.svg"
            alt="Meridian dashboard case study composition"
            className="aspect-4/3 w-full rounded-xl object-cover"
          />
        </div>
        <h3 className="font-display text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
          Zero fiddly margin math between desktop and mobile screens.
        </h3>
        <p className="text-muted-foreground type-body-m">
          Drop raw Figma frames straight from your exports folder. Device
          viewports, safe-zones, type hierarchy, and contrast stay locked across
          all {snapshot.publishedTemplatesCount} layouts.
        </p>
        <Button variant="default" size="lg" asChild className="rounded-full px-6">
          <Link href="/templates">
            <span>Inspect responsive specs</span>
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>

      {/* Right staggered interactive proof bands */}
      <div className="divide-border flex flex-col divide-y border-y border-border lg:col-span-7">
        <div className="flex flex-col gap-5 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex max-w-md flex-col gap-2">
            <span className="text-primary inline-flex items-center gap-2 font-mono text-xs font-medium uppercase">
              <Smartphone className="size-4" />
              Ratio-locked frames
            </span>
            <h4 className="type-heading-m text-foreground">
              {snapshot.deviceFramesCount} device mockups with crisp safe-zones
            </h4>
            <p className="text-muted-foreground type-body-s">
              Match iPhone 16 Pro, Android, iPad &amp; MacBook Pro shells without
              manually masking rounded corners or scaling screenshots twice.
            </p>
          </div>
          <div className="border-border bg-surface flex w-full shrink-0 items-center justify-between gap-4 rounded-xl border p-3 sm:w-52">
            <img
              src="/landing/orbit-home.svg"
              alt="Orbit mobile preview"
              className="aspect-9/16 h-28 rounded-lg object-cover"
            />
            <div className="flex flex-col gap-1 font-mono text-xs">
              <span className="text-foreground font-semibold">9:19.5</span>
              <span className="text-muted-foreground">Zero blur</span>
              <span className="text-primary">Locked ✓</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex max-w-md flex-col gap-2">
            <span className="text-primary inline-flex items-center gap-2 font-mono text-xs font-medium uppercase">
              <Palette className="size-4" />
              Contrast &amp; font pairs
            </span>
            <h4 className="type-heading-m text-foreground">
              {snapshot.curatedPalettesCount} palettes +{" "}
              {snapshot.curatedFontPairsCount} font pairings checked live
            </h4>
            <p className="text-muted-foreground type-body-s">
              Switch accent ink and surface themes once; optical sizing and WCAG
              readability stay verified across light and dark spreads.
            </p>
          </div>
          <div className="border-border bg-surface flex w-full shrink-0 flex-col gap-2 rounded-xl border p-3.5 sm:w-52">
            {[
              ["Heading Ink", "AA 14.8:1"],
              ["Muted Body", "AA 7.1:1"],
              ["Button Fill", "AA 8.6:1"],
            ].map(([token, score]) => (
              <div
                key={token}
                className="flex items-center justify-between font-mono text-xs"
              >
                <span className="text-foreground">{token}</span>
                <span className="text-primary font-semibold">{score}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-5 py-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex max-w-md flex-col gap-1">
              <span className="text-primary inline-flex items-center gap-2 font-mono text-xs font-medium uppercase">
                <Layers className="size-4" />
                Modular narrative engine
              </span>
              <h4 className="type-heading-m text-foreground">
                Try toggling story beats live
              </h4>
            </div>
            <span className="text-muted-foreground font-mono text-xs">
              {sampleBlocks.filter((b) => b.enabled).length} of{" "}
              {sampleBlocks.length} active
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {sampleBlocks.map((block, index) => (
              <button
                key={block.name}
                type="button"
                onClick={() => toggleBlock(index)}
                className={cn(
                  "flex cursor-pointer items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-all",
                  block.enabled
                    ? "border-primary/45 bg-elevated text-foreground"
                    : "border-border bg-surface/60 text-muted-foreground",
                )}
              >
                <span className="type-body-s-strong">{block.name}</span>
                <span
                  className={cn(
                    "font-mono text-xs",
                    block.enabled ? "text-primary font-semibold" : "opacity-60",
                  )}
                >
                  {block.enabled ? "ON" : "OFF"}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function FeatureList() {
  const specs = [
    {
      num: "01",
      icon: <Monitor className="size-4" />,
      title: "Same DOM from editor to publish",
      detail:
        "Preview desktop and mobile breakpoints using the exact component renderer that serves your live portfolio and downloads.",
    },
    {
      num: "02",
      icon: <Sparkles className="size-4" />,
      title: "Instant autosave & safe versions",
      detail:
        "Experiment with pacing edits, duplicate sections, or rewrite framing copy without fearing accidental formatting damage.",
    },
    {
      num: "03",
      icon: <FileText className="size-4" />,
      title: "Pre-publish quality checks",
      detail:
        "Missing image slots, clipped text boundaries, and low-contrast palettes are caught cleanly before recruiters open your link.",
    },
  ] as const;

  return (
    <div className="border-border divide-border mt-14 grid grid-cols-1 divide-y border-y lg:grid-cols-3 lg:divide-x lg:divide-y-0">
      {specs.map((spec) => (
        <div key={spec.num} className="flex flex-col gap-3 px-4 py-7 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <span className="text-primary inline-flex items-center gap-2 font-mono text-xs font-semibold">
              {spec.icon}
              {spec.num}
            </span>
            <CheckCircle2 className="text-muted-foreground size-4" />
          </div>
          <h4 className="type-heading-s text-foreground">{spec.title}</h4>
          <p className="text-muted-foreground type-body-s">{spec.detail}</p>
        </div>
      ))}
    </div>
  );
}

export function CtaStage({
  children,
}: {
  snapshot: LandingPlatformSnapshot;
  children: ReactNode;
}) {
  return (
    <ScrollRise y={18}>
      <div className="bg-studio-matrix relative overflow-hidden rounded-[2rem] border obsidian-hairline p-7 sm:rounded-[2.75rem] sm:p-12 lg:p-14">
        <div className="relative z-10">{children}</div>
      </div>
    </ScrollRise>
  );
}
