"use client";

import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  Globe,
  History,
  Image as ImageIcon,
  Layers,
  Monitor,
  Palette,
  Presentation,
  Rocket,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TabletSmartphone,
  Trophy,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { LandingFaqAccordion } from "@/components/marketing/landing-faq-accordion";
import { LandingHeroMotion } from "@/components/marketing/landing-hero-motion";
import { LandingHeroVisual } from "@/components/marketing/landing-hero-visual";
import { LandingPricingSection } from "@/components/marketing/landing-pricing-section";
import {
  STUDIO_QUEST_MISSIONS,
  StudioQuestProvider,
  useStudioQuest,
} from "@/components/marketing/studio-quest-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TemplateTypeCard } from "@/components/ui/domain-cards";
import {
  ANIMATION_DISTANCES,
  ANIMATION_DURATIONS,
  ANIMATION_EASINGS,
  ANIMATION_STAGGERS,
  gsap,
  prefersReducedMotion,
  ScrollTrigger,
  useGSAP,
} from "@/lib/animation/gsap";
import type { LandingPlatformSnapshot } from "@/lib/marketing/landing-stats";
import { cn } from "@/lib/utils";

const SCREEN_WORKLOAD_PRESETS = [
  {
    screens: 6,
    label: "6 UI screens",
    manualSteps: "18 manual frame & crop steps",
    manualTime: "~9 hrs on a blank canvas",
    casefolioFlow: "6 ratio-locked drops · 1 click publish",
  },
  {
    screens: 12,
    label: "12 UI screens",
    manualSteps: "36 manual frame & export steps",
    manualTime: "~22 hrs aligning grids & PDFs",
    casefolioFlow: "12 ratio-locked drops · auto-responsive",
  },
  {
    screens: 18,
    label: "18 UI screens (.Cinema scale)",
    manualSteps: "54 manual mockup & slice steps",
    manualTime: "2–3 wks rebuilding layout & exports",
    casefolioFlow: "14 structured sections · instant PNG & PDF",
  },
] as const;

const WORKFLOW_QUEST_STEPS = [
  {
    step: "01",
    title: "Pick a type",
    badge: "Mobile · Website · Mobile + Web",
    description:
      "Select what you built so every ratio-locked slot, hardware bezel, and responsive grid matches your product from second one.",
    previewImage: "/landing/orbit-home.svg",
    previewCaption: "Auto-configures 9:19.5 mobile or 16:10 web slots",
    previewAspect: "mobile" as const,
  },
  {
    step: "02",
    title: "Pick a template",
    badge: "Versioned · Curated by Casefolio",
    description:
      "Start with a complete narrative arc — Hero, Overview, Pain Points, User Flow, Screen Showcase, and Quantified Results.",
    previewImage: "/templates/cinema/cover.svg",
    previewCaption: "Cinema v1.0.0 · 14 sections & 8 slots ready out of the box",
    previewAspect: "wide" as const,
  },
  {
    step: "03",
    title: "Customize",
    badge: "7 Device Mockups · Curated Tokens",
    description:
      "Drop screenshots into ratio-locked slots, switch between iPhone 16 Pro, Android, iPad, MacBook or Browser frames, and tune tokens.",
    previewImage: "/templates/cinema/screen-seats.svg",
    previewCaption: "Live seat-map screen inside iPhone 16 Pro Dynamic Island",
    previewAspect: "mobile" as const,
  },
  {
    step: "04",
    title: "Publish or export",
    badge: "Public URL · PNG · PDF · Behance",
    description:
      "Go live on casefolio.app/p/your-slug with OpenGraph previews, or export continuous PNGs and multi-page A4 PDFs from the same renderer.",
    previewImage: "/landing/export-bundle-preview.svg",
    previewCaption: "Identical output across web, Behance 1400px, and A4 PDF",
    previewAspect: "wide" as const,
  },
] as const;

const SAMPLE_PRO_REFERREERS = [
  { source: "Direct portfolio link (/p/slug)", detail: "Tracked on Free & Pro" },
  { source: "External referrer domain (e.g. linkedin.com)", detail: "Unlocked on Pro" },
  { source: "Reader country & 7d / 30d window", detail: "Zero cookies · SHA-256" },
] as const;

function SectionHeader({
  overline,
  title,
  description,
}: {
  overline: string;
  title: string;
  description?: string;
}) {
  return (
    <div
      data-animate-header
      className="mx-auto flex max-w-3xl flex-col items-center gap-3 text-center"
    >
      <span className="bg-accent text-accent-foreground type-overline inline-flex items-center gap-1.5 rounded-full px-3 py-1">
        {overline}
      </span>
      <h2 className="text-foreground type-display-m sm:type-display-l text-balance">
        {title}
      </h2>
      {description && (
        <p className="text-muted-foreground type-body-l max-w-2xl text-pretty">
          {description}
        </p>
      )}
    </div>
  );
}

function StatusPill({
  tone,
  children,
}: {
  tone: "success" | "accent" | "warning" | "neutral";
  children: ReactNode;
}) {
  const styles = {
    success: {
      pill: "bg-success-soft text-foreground",
      dot: "bg-success",
    },
    accent: {
      pill: "bg-accent text-accent-foreground",
      dot: "bg-accent-foreground",
    },
    warning: {
      pill: "bg-warning-soft text-foreground",
      dot: "bg-warning",
    },
    neutral: {
      pill: "bg-sunken text-muted-foreground",
      dot: "bg-muted-foreground",
    },
  }[tone];

  return (
    <span
      className={cn(
        "type-caption inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5",
        styles.pill,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", styles.dot)}
      />
      {children}
    </span>
  );
}

function StudioQuestHeroRibbon() {
  const { xp, maxXp, rank, completedIds } = useStudioQuest();
  const isComplete = xp >= maxXp;

  return (
    <div
      data-testid="studio-quest-ribbon"
      className="border-border bg-elevated/90 shadow-card mx-auto flex w-full max-w-4xl flex-col gap-3 rounded-2xl border p-3.5 backdrop-blur-sm sm:p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-full",
              isComplete
                ? "bg-success text-success-foreground"
                : "bg-primary text-primary-foreground",
            )}
          >
            {isComplete ? (
              <Trophy className="size-3.5" />
            ) : (
              <Zap className="size-3.5" />
            )}
          </span>
          <div className="text-left">
            <p className="text-foreground type-caption font-semibold">
              Lvl {rank.level} · {rank.title}
            </p>
            <p className="text-muted-foreground type-caption">
              Interactive Studio Quest · Complete 5 micro-actions on this page
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div
            role="progressbar"
            aria-label="Studio Quest XP"
            aria-valuenow={xp}
            aria-valuemin={0}
            aria-valuemax={maxXp}
            className="bg-sunken h-2 w-24 overflow-hidden rounded-full sm:w-32"
          >
            <div
              style={{ width: `${Math.min(100, (xp / maxXp) * 100)}%` }}
              className={cn(
                "h-full rounded-full transition-all duration-300",
                isComplete ? "bg-success" : "bg-primary",
              )}
            />
          </div>
          <span className="text-foreground font-mono type-caption font-semibold">
            {xp}/{maxXp} XP
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
        {STUDIO_QUEST_MISSIONS.map((mission) => {
          const done = completedIds.has(mission.id);
          return (
            <a
              key={mission.id}
              href={mission.targetAnchor}
              className={cn(
                "type-caption inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-all",
                done
                  ? "border-success/40 bg-success-soft text-foreground"
                  : "border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground",
              )}
            >
              {done ? (
                <Check className="text-success size-3" />
              ) : (
                <span className="bg-primary/60 size-1.5 rounded-full" />
              )}
              <span>{mission.shortLabel}</span>
              <span className="text-tertiary font-mono">+{mission.xp}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

function FloatingQuestHud() {
  const { xp, maxXp, rank, completedIds, lastUnlockedTitle } = useStudioQuest();
  const [expanded, setExpanded] = useState(false);
  const isComplete = xp >= maxXp;

  return (
    <aside
      aria-label="Studio Quest progress"
      className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-2 sm:right-6 sm:bottom-6"
    >
      {expanded && (
        <div className="border-border bg-elevated/95 shadow-overlay flex w-72 flex-col gap-3 rounded-2xl border p-4 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-foreground type-body-s-strong">
                Lvl {rank.level} · {rank.title}
              </p>
              <p className="text-muted-foreground type-caption">
                {completedIds.size} of {STUDIO_QUEST_MISSIONS.length} missions
                complete
              </p>
            </div>
            <span className="bg-accent text-accent-foreground font-mono type-caption rounded-full px-2.5 py-0.5">
              {xp} XP
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            {STUDIO_QUEST_MISSIONS.map((mission) => {
              const done = completedIds.has(mission.id);
              return (
                <a
                  key={mission.id}
                  href={mission.targetAnchor}
                  onClick={() => setExpanded(false)}
                  className={cn(
                    "type-caption flex items-center justify-between rounded-lg border px-2.5 py-2 transition-colors",
                    done
                      ? "border-success/35 bg-success-soft text-foreground"
                      : "border-border bg-surface text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="flex items-center gap-2 truncate">
                    {done ? (
                      <CheckCircle2 className="text-success size-3.5 shrink-0" />
                    ) : (
                      <span className="border-border-strong size-3.5 shrink-0 rounded-full border" />
                    )}
                    <span className="truncate">{mission.shortLabel}</span>
                  </span>
                  <span className="font-mono shrink-0">+{mission.xp} XP</span>
                </a>
              );
            })}
          </div>

          {isComplete && (
            <Button size="sm" asChild className="w-full">
              <Link href="/sign-up">
                <Trophy className="size-3.5" />
                <span>Claim 2 free projects</span>
              </Link>
            </Button>
          )}
        </div>
      )}

      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((prev) => !prev)}
        className={cn(
          "border-border bg-elevated/95 text-foreground shadow-overlay focus-visible:ring-ring/40 inline-flex items-center gap-2.5 rounded-full border px-3.5 py-2 backdrop-blur-xl transition-all outline-none focus-visible:ring-2",
          isComplete && "border-success/50",
        )}
      >
        <span
          className={cn(
            "inline-flex size-6 items-center justify-center rounded-full",
            isComplete
              ? "bg-success text-success-foreground"
              : "bg-primary text-primary-foreground",
          )}
        >
          {isComplete ? (
            <Trophy className="size-3.5" />
          ) : (
            <Zap className="size-3.5" />
          )}
        </span>
        <span className="type-caption font-medium">
          {lastUnlockedTitle && !expanded
            ? lastUnlockedTitle
            : `Studio XP · ${xp}/${maxXp}`}
        </span>
        {expanded ? (
          <ChevronDown className="text-muted-foreground size-3.5" />
        ) : (
          <ChevronUp className="text-muted-foreground size-3.5" />
        )}
      </button>
    </aside>
  );
}

function LandingExperienceInner({
  snapshot,
}: {
  snapshot: LandingPlatformSnapshot;
}) {
  const pageScopeRef = useRef<HTMLDivElement>(null);
  const { completeMission, completedIds, xp, maxXp } = useStudioQuest();

  const [workloadIndex, setWorkloadIndex] = useState(2);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [simulatedPublished, setSimulatedPublished] = useState(false);
  const [telemetryMode, setTelemetryMode] = useState<"live" | "schema">("live");

  const activeWorkload =
    SCREEN_WORKLOAD_PRESETS[workloadIndex] ?? SCREEN_WORKLOAD_PRESETS[2]!;
  const activeStep =
    WORKFLOW_QUEST_STEPS[activeStepIndex] ?? WORKFLOW_QUEST_STEPS[0]!;

  const editorFeatures = [
    {
      icon: ImageIcon,
      badge: `${snapshot.deviceFramesCount} device frames`,
      title: "Swap screens in slots",
      description:
        "Drop PNG, JPG, WebP or SVG into ratio-locked slots and switch between iPhone 16 Pro, Android, iPad, MacBook or Browser chrome.",
    },
    {
      icon: Palette,
      badge: `${snapshot.curatedPalettesCount} palettes · ${snapshot.curatedFontPairsCount} font pairs`,
      title: "Your colors & fonts",
      description:
        "Edit semantic theme tokens — primary, surface, background, text, and licensed heading & body font pairs with contrast checks.",
    },
    {
      icon: Layers,
      badge: `${snapshot.sectionPresetsCount} narrative presets`,
      title: "Sections your way",
      description:
        "Reorder, duplicate, hide optional sections, or insert User Flows, Staggered App Galleries, Personas, and Design Systems.",
    },
    {
      icon: Eye,
      badge: "375px + 1440px",
      title: "Live preview",
      description:
        "Switch instantly between Desktop and Mobile viewports rendered with the exact same engine used for publish and export.",
    },
    {
      icon: History,
      badge: "Undo · Redo · Autosave",
      title: "Autosave & versions",
      description:
        "Every edit autosaves cleanly with full undo/redo history while your project stays pinned to its exact template version.",
    },
    {
      icon: CheckCircle2,
      badge: "Zero broken layouts",
      title: "Pre-publish check",
      description:
        "Validates empty required screenshot slots, aspect ratios, and token contrast before your case study goes public.",
    },
  ] as const;

  useGSAP(
    () => {
      const scopeEl = pageScopeRef.current;
      if (!scopeEl || prefersReducedMotion()) return;

      const headers = scopeEl.querySelectorAll<HTMLElement>(
        "[data-animate-header]",
      );
      headers.forEach((header) => {
        ScrollTrigger.create({
          trigger: header,
          start: "top 95%",
          once: true,
          onEnter: () => {
            const rect = header.getBoundingClientRect();
            if (rect.top > window.innerHeight * 0.55) {
              gsap.fromTo(
                header,
                { opacity: 0, y: ANIMATION_DISTANCES.baseY },
                {
                  opacity: 1,
                  y: 0,
                  duration: ANIMATION_DURATIONS.base,
                  ease: ANIMATION_EASINGS.entrance,
                  clearProps: "transform,opacity",
                  overwrite: "auto",
                },
              );
            }
          },
        });
      });

      const grids = scopeEl.querySelectorAll<HTMLElement>(
        "[data-animate-grid]",
      );
      grids.forEach((grid) => {
        const items = Array.from(grid.children) as HTMLElement[];
        if (items.length === 0) return;

        ScrollTrigger.create({
          trigger: grid,
          start: "top 95%",
          once: true,
          onEnter: () => {
            const rect = grid.getBoundingClientRect();
            if (rect.top > window.innerHeight * 0.55) {
              gsap.fromTo(
                items,
                { opacity: 0, y: ANIMATION_DISTANCES.subtleY },
                {
                  opacity: 1,
                  y: 0,
                  duration: ANIMATION_DURATIONS.base,
                  stagger: ANIMATION_STAGGERS.tight,
                  ease: ANIMATION_EASINGS.entrance,
                  clearProps: "transform,opacity",
                  overwrite: "auto",
                },
              );
            }
          },
        });
      });

      const refreshTimer = window.setTimeout(() => {
        ScrollTrigger.refresh();
      }, 120);

      return () => {
        window.clearTimeout(refreshTimer);
      };
    },
    { scope: pageScopeRef },
  );

  const handleStepSelect = (index: number) => {
    setActiveStepIndex(index);
    completeMission("workflow-step");
  };

  const handleSimulatePublish = () => {
    setSimulatedPublished((prev) => !prev);
    completeMission("publish-launch");
  };

  const realPlatformSpecs = [
    {
      value: String(snapshot.publishedTemplatesCount),
      label: "Live published templates",
      detail: snapshot.templates.map((t) => t.name).join(" · "),
    },
    {
      value: String(snapshot.deviceFramesCount),
      label: "Hardware mockup models",
      detail: "iPhone 16 Pro · Android · iPad · MacBook · Browser",
    },
    {
      value: String(snapshot.sectionPresetsCount),
      label: "Structured section presets",
      detail: `${snapshot.sectionTypesCount} canonical section types`,
    },
    {
      value: String(snapshot.exportFormatsCount),
      label: "Pixel-identical export formats",
      detail: "Long PNG · Paged A4 PDF · Behance 1400px",
    },
  ] as const;

  return (
    <div ref={pageScopeRef} className="relative flex flex-col">
      {/* 1. Gamified Hero + Live Interactive Editor Playground */}
      <section className="bg-background relative overflow-hidden px-4 pt-10 pb-16 sm:px-6 lg:px-8 lg:pt-14 lg:pb-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_70%_55%_at_50%_20%,black,transparent)] opacity-70"
        />
        <div
          aria-hidden="true"
          className="bg-primary/10 pointer-events-none absolute top-6 left-1/2 h-72 w-3/4 max-w-4xl -translate-x-1/2 rounded-full blur-3xl"
        />

        <div className="relative z-10">
          <LandingHeroMotion visual={<LandingHeroVisual />}>
            <Badge tone="accent">
              {snapshot.publishedTemplatesCount} live templates ·{" "}
              {snapshot.deviceFramesCount} hardware frames · Free to start
            </Badge>

            <h1 className="text-foreground type-display-m sm:type-display-l lg:type-display-xl max-w-4xl text-balance">
              Turn finished projects into publishable case studies
            </h1>

            <p className="text-muted-foreground type-body-l max-w-2xl text-pretty">
              Pick a template crafted by the Casefolio team, snap your UI
              screens into ratio-locked device frames, tune your tokens — then
              publish a live URL or export PNG &amp; PDF in minutes.
            </p>

            <div className="flex w-full flex-col items-stretch justify-center gap-3 pt-1 sm:w-auto sm:flex-row sm:items-center">
              <Button size="lg" asChild>
                <Link href="/sign-up">
                  <Sparkles className="size-4" />
                  <span>Start free</span>
                </Link>
              </Button>
              <Button variant="secondary" size="lg" asChild>
                <Link href="/templates">
                  <span>Browse templates</span>
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>

            <p className="text-muted-foreground type-caption">
              {snapshot.freeProjectsIncluded} free case studies included · No
              credit card required
            </p>

            <StudioQuestHeroRibbon />
          </LandingHeroMotion>
        </div>
      </section>

      {/* 2. Real Live Architecture Spec Strip (Replaces removed fictional studio logos) */}
      <section
        aria-label="Platform architecture metrics"
        className="border-border bg-surface/60 border-y px-4 py-10 sm:px-6 lg:px-8"
      >
        <div
          data-animate-grid
          className="mx-auto grid max-w-7xl grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6"
        >
          {realPlatformSpecs.map((spec) => (
            <div
              key={spec.label}
              className="border-border bg-card flex flex-col gap-1.5 rounded-2xl border p-5"
            >
              <span className="text-primary type-display-m">{spec.value}</span>
              <span className="text-foreground type-body-s-strong">
                {spec.label}
              </span>
              <span className="text-muted-foreground type-caption">
                {spec.detail}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Problem Section + Interactive Screen Workload Reality Check */}
      <section className="bg-surface px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto flex max-w-7xl flex-col gap-12 lg:gap-14">
          <SectionHeader
            overline="The problem"
            title="Case studies take longer than the project"
            description="Designers finish the product UI, then lose weeks rebuilding grids, framing mockups by hand, and re-slicing exports from scratch."
          />

          {/* Interactive Workload Reality Calculator */}
          <div className="border-border bg-card shadow-card mx-auto flex w-full max-w-4xl flex-col gap-5 rounded-2xl border p-5 sm:p-7">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="text-foreground type-heading-s">
                  Compare the workflow for your project size
                </p>
                <p className="text-muted-foreground type-caption">
                  Select how many finished UI screens are sitting in your Figma
                  file:
                </p>
              </div>

              <div
                role="group"
                aria-label="Project screen count"
                className="bg-sunken border-border inline-flex items-center gap-1 rounded-full border p-1"
              >
                {SCREEN_WORKLOAD_PRESETS.map((preset, idx) => {
                  const selected = idx === workloadIndex;
                  return (
                    <button
                      key={preset.screens}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setWorkloadIndex(idx)}
                      className={cn(
                        "type-caption focus-visible:ring-ring/40 rounded-full px-3 py-1.5 transition-all outline-none focus-visible:ring-2",
                        selected
                          ? "bg-elevated text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {preset.screens} screens
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="border-destructive/25 bg-destructive-soft/60 flex flex-col gap-1.5 rounded-xl border p-4">
                <span className="text-destructive type-overline">
                  Manual Blank Canvas
                </span>
                <p className="text-foreground type-heading-m">
                  {activeWorkload.manualTime}
                </p>
                <p className="text-muted-foreground type-body-s">
                  {activeWorkload.manualSteps} across web, Behance &amp; PDF.
                </p>
              </div>

              <div className="border-success/35 bg-success-soft/70 flex flex-col gap-1.5 rounded-xl border p-4">
                <span className="text-success type-overline">
                  With Casefolio Slots
                </span>
                <p className="text-foreground type-heading-m">
                  Same afternoon
                </p>
                <p className="text-muted-foreground type-body-s">
                  {activeWorkload.casefolioFlow}
                </p>
              </div>
            </div>
          </div>

          <div
            data-animate-grid
            className="grid grid-cols-1 gap-6 md:grid-cols-3"
          >
            <article className="border-border bg-card flex flex-col gap-3 rounded-2xl border p-7">
              <p className="text-destructive type-display-m">Blank</p>
              <h3 className="text-foreground type-heading-s">
                Re-architecting every grid from zero
              </h3>
              <p className="text-muted-foreground type-body-s">
                Starting from an empty artboard forces you to invent typography
                scales, card spacing, and mobile breakpoints all over again.
              </p>
            </article>

            <article className="border-border bg-card flex flex-col gap-3 rounded-2xl border p-7">
              <p className="text-destructive type-display-m">Manual</p>
              <h3 className="text-foreground type-heading-s">
                Framing every screenshot by hand
              </h3>
              <p className="text-muted-foreground type-body-s">
                Dragging screens into device mockups one by one — and redoing
                every export the moment a single screen changes.
              </p>
            </article>

            <article className="border-border bg-card flex flex-col gap-3 rounded-2xl border p-7">
              <p className="text-destructive type-display-m">Fragmented</p>
              <h3 className="text-foreground type-heading-s">
                Inconsistent across projects
              </h3>
              <p className="text-muted-foreground type-body-s">
                Every case study ends up with different margins, fonts, and PDF
                dimensions instead of one cohesive body of work.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* 4. Interactive 4-Step Workflow Quest (#how-it-works) */}
      <section
        id="how-it-works"
        className="bg-background scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8 lg:py-28"
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-12 lg:gap-14">
          <SectionHeader
            overline="How it works · +20 XP Quest"
            title="From finished UI to case study in four steps"
            description="Click any checkpoint below to inspect the live workflow — no blank canvas, and every decision stays editable."
          />

          <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
            {/* Left: Interactive 4-step selector */}
            <div className="flex flex-col gap-3 lg:col-span-6">
              {WORKFLOW_QUEST_STEPS.map((item, idx) => {
                const selected = idx === activeStepIndex;
                return (
                  <button
                    key={item.step}
                    type="button"
                    onClick={() => handleStepSelect(idx)}
                    className={cn(
                      "focus-visible:ring-ring/40 flex flex-col gap-2 rounded-2xl border p-5 text-left transition-all outline-none focus-visible:ring-2",
                      selected
                        ? "border-primary bg-card shadow-card"
                        : "border-border bg-surface/60 hover:border-border-strong hover:bg-card",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "font-mono type-body-s-strong inline-flex size-9 items-center justify-center rounded-full transition-colors",
                            selected
                              ? "bg-primary text-primary-foreground"
                              : "bg-accent text-accent-foreground",
                          )}
                        >
                          {item.step}
                        </span>
                        <h3 className="text-foreground type-heading-s">
                          {item.title}
                        </h3>
                      </div>
                      <span className="text-muted-foreground type-caption hidden sm:inline">
                        {item.badge}
                      </span>
                    </div>
                    <p className="text-muted-foreground type-body-s pl-12">
                      {item.description}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Right: Live Visual Stage for Selected Step */}
            <div className="border-border bg-card shadow-card flex flex-col justify-between gap-5 overflow-hidden rounded-2xl border p-6 sm:p-7 lg:col-span-6">
              <div className="flex items-center justify-between gap-2">
                <StatusPill tone="accent">
                  Step {activeStep.step} · {activeStep.title}
                </StatusPill>
                {completedIds.has("workflow-step") ? (
                  <span className="text-success type-caption inline-flex items-center gap-1">
                    <CheckCircle2 className="size-3.5" /> +20 XP unlocked
                  </span>
                ) : (
                  <span className="text-muted-foreground type-caption">
                    Click another step for +20 XP
                  </span>
                )}
              </div>

              <div className="bg-sunken border-border flex flex-1 items-center justify-center overflow-hidden rounded-xl border p-5">
                {activeStep.previewAspect === "mobile" ? (
                  <div className="border-border-strong bg-inverse shadow-overlay w-52 overflow-hidden rounded-3xl border-4 p-1.5 sm:w-56">
                    <img
                      src={activeStep.previewImage}
                      alt={activeStep.previewCaption}
                      className="aspect-9/19 w-full rounded-2xl object-cover"
                    />
                  </div>
                ) : (
                  <img
                    src={activeStep.previewImage}
                    alt={activeStep.previewCaption}
                    className="max-h-80 w-full rounded-xl object-cover shadow-card"
                  />
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-muted-foreground type-caption">
                  {activeStep.previewCaption}
                </p>
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/new">
                    <span>Try step {activeStep.step}</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Template Types — Dynamic Real Counts from PostgreSQL */}
      <section className="bg-surface px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto flex max-w-7xl flex-col gap-12 lg:gap-14">
          <SectionHeader
            overline="Template types"
            title="Templates for what you actually design"
            description="Every count below reflects published templates live in the Casefolio database right now."
          />

          <div
            data-animate-grid
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
          >
            <TemplateTypeCard
              title="Mobile app"
              description="iOS & Android user journeys with iPhone 16 Pro, Notch & Android punch-hole slots."
              templateCount={snapshot.mobileTemplatesCount}
              icon={<Smartphone className="size-5" />}
            />
            <TemplateTypeCard
              title="Website"
              description="SaaS dashboards, marketing sites, and web apps wrapped in MacBook Pro & Browser frames."
              templateCount={snapshot.webTemplatesCount}
              icon={<Monitor className="size-5" />}
            />
            <TemplateTypeCard
              title="Mobile + Web"
              description="Cross-platform ecosystems combining mobile flows, design systems, and web views."
              templateCount={snapshot.crossPlatformTemplatesCount}
              icon={<TabletSmartphone className="size-5" />}
            />
            <TemplateTypeCard
              title="Brand & Deck"
              description="Visual identity systems, design language guides, and pitch narratives."
              footerLabel="In roadmap"
              state="coming-soon"
              icon={<Presentation className="size-5" />}
            />
          </div>
        </div>
      </section>

      {/* 6. Live Template Gallery — Real Published Templates & Real Artwork */}
      <section className="bg-background px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-12 lg:gap-14">
          <SectionHeader
            overline="Live template gallery"
            title="Start from a layout that already works"
            description={`${snapshot.publishedTemplatesCount} curated templates (${snapshot.totalTemplateSections} pre-built sections & ${snapshot.totalTemplateSlots} ratio-locked slots) ready to open today.`}
          />

          <div
            data-animate-grid
            className="grid w-full grid-cols-1 gap-6 md:grid-cols-3"
          >
            {snapshot.templates.map((tpl) => {
              const isMobileCover = tpl.type === "mobile";
              return (
                <article
                  key={tpl.slug}
                  className="border-border bg-card hover:border-border-strong shadow-card group flex flex-col justify-between gap-4 rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-1"
                >
                  <Link
                    href={`/new?template=${tpl.slug}`}
                    className="bg-inverse border-border relative flex h-64 items-center justify-center overflow-hidden rounded-xl border"
                  >
                    {isMobileCover ? (
                      <div className="flex items-end gap-3 pt-6">
                        <img
                          src={tpl.coverSrc}
                          alt={`${tpl.name} primary preview`}
                          className="border-border-strong/50 w-28 rounded-t-2xl border-x-2 border-t-2 object-cover shadow-overlay transition-transform duration-300 group-hover:-translate-y-1.5"
                        />
                        {tpl.previewSecondarySrc && (
                          <img
                            src={tpl.previewSecondarySrc}
                            alt={`${tpl.name} secondary preview`}
                            className="border-border-strong/50 w-24 translate-y-4 rounded-t-2xl border-x-2 border-t-2 object-cover opacity-90 shadow-overlay transition-transform duration-300 group-hover:translate-y-2"
                          />
                        )}
                      </div>
                    ) : (
                      <img
                        src={tpl.coverSrc}
                        alt={`${tpl.name} template preview`}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    )}
                    <span className="bg-background/90 text-foreground border-border type-caption absolute top-3 left-3 rounded-full border px-2.5 py-0.5 backdrop-blur-md">
                      {tpl.categoryName} · v{tpl.version}
                    </span>
                  </Link>

                  <div className="flex flex-col gap-2 px-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-foreground type-heading-s">
                        {tpl.name}
                      </h3>
                      <StatusPill
                        tone={tpl.tier === "free" ? "success" : "accent"}
                      >
                        {tpl.tier === "free" ? "Free" : "Pro"}
                      </StatusPill>
                    </div>
                    <p className="text-muted-foreground type-body-s line-clamp-2">
                      {tpl.summary}
                    </p>
                    <div className="border-border mt-1 flex items-center justify-between border-t pt-3">
                      <span className="text-tertiary font-mono type-caption">
                        {tpl.sectionCount} sections · {tpl.slotCount} slots
                      </span>
                      <Link
                        href={`/new?template=${tpl.slug}`}
                        className="text-primary hover:text-primary/80 type-caption inline-flex items-center gap-1 font-semibold"
                      >
                        <span>Use {tpl.name}</span>
                        <ArrowUpRight className="size-3.5" />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <Button variant="secondary" size="lg" asChild>
            <Link href="/templates">
              <span>Browse all templates</span>
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* 7. Constrained Editor Capabilities Bento (#product) */}
      <section
        id="product"
        className="bg-surface scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8 lg:py-28"
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-12 lg:gap-14">
          <SectionHeader
            overline="The constrained editor"
            title="A full editor, without the busywork"
            description="Structured flexibility: customize tokens, mockups, and narrative blocks while your layout rhythm stays unbreakable."
          />

          <div
            data-animate-grid
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {editorFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <article
                  key={feature.title}
                  className="border-border bg-card hover:border-border-strong flex flex-col justify-between gap-5 rounded-2xl border p-6 transition-colors sm:p-7"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      aria-hidden="true"
                      className="bg-accent text-accent-foreground inline-flex size-11 items-center justify-center rounded-xl"
                    >
                      <Icon className="size-5" />
                    </span>
                    <span className="bg-sunken text-muted-foreground font-mono type-caption rounded-full px-2.5 py-0.5">
                      {feature.badge}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <h3 className="text-foreground type-heading-s">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground type-body-s">
                      {feature.description}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* 8. Publish, Share & Export — Interactive Launch Simulator (#publish-export) */}
      <section
        id="publish-export"
        className="bg-background scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8 lg:py-28"
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-12 lg:gap-14">
          <SectionHeader
            overline="Publish, share & export · +20 XP Quest"
            title="One case study, everywhere you need it"
            description="Publish an indexed public URL on casefolio.app, or export crisp files for Behance, Dribbble, and recruiter PDF decks."
          />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Interactive Publish Simulator Card */}
            <article className="border-border bg-card shadow-card flex flex-col justify-between gap-6 rounded-2xl border p-7 sm:p-8">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <StatusPill tone={simulatedPublished ? "success" : "warning"}>
                    {simulatedPublished ? "Published · Live" : "Draft Preview"}
                  </StatusPill>
                  {completedIds.has("publish-launch") && (
                    <span className="text-success type-caption inline-flex items-center gap-1">
                      <CheckCircle2 className="size-3.5" /> +20 XP unlocked
                    </span>
                  )}
                </div>

                <h3 className="text-foreground type-heading-m">
                  A public page on casefolio.app
                </h3>
                <p className="text-muted-foreground type-body-m">
                  Choose Public, Unlisted, or Private visibility, customize your
                  slug, and ship with automatic OpenGraph social cards.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <div className="border-border bg-surface flex items-center justify-between gap-3 rounded-xl border px-4 py-3">
                  <span className="text-foreground font-mono type-body-s flex items-center gap-2 truncate">
                    <Globe className="text-primary size-4 shrink-0" />
                    <span className="truncate">
                      casefolio.app/p/cinema-booking
                    </span>
                  </span>
                  <StatusPill tone={simulatedPublished ? "success" : "neutral"}>
                    {simulatedPublished ? "Live 200 OK" : "Staged"}
                  </StatusPill>
                </div>

                <div className="border-border bg-surface flex items-center justify-between gap-3 rounded-xl border px-4 py-3">
                  <span className="text-foreground type-body-s">
                    SEO metadata &amp; OpenGraph unfurl card
                  </span>
                  <StatusPill tone="success">Ready</StatusPill>
                </div>

                <button
                  type="button"
                  onClick={handleSimulatePublish}
                  className={cn(
                    "type-body-s-strong focus-visible:ring-ring/40 mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 transition-all outline-none focus-visible:ring-2",
                    simulatedPublished
                      ? "border-success/40 bg-success-soft text-foreground"
                      : "bg-primary text-primary-foreground hover:bg-primary/90 border-transparent",
                  )}
                >
                  <Rocket className="size-4" />
                  <span>
                    {simulatedPublished
                      ? "Live URL Active! Click to toggle back to Draft"
                      : "Test-launch public URL (+20 XP)"}
                  </span>
                </button>
              </div>
            </article>

            {/* Export Bundle Visual Card */}
            <article className="border-border bg-card shadow-card flex flex-col justify-between gap-6 rounded-2xl border p-7 sm:p-8">
              <div className="flex flex-col gap-3">
                <div>
                  <StatusPill tone="accent">
                    {snapshot.exportFormatsCount} Export Formats
                  </StatusPill>
                </div>
                <h3 className="text-foreground type-heading-m">
                  PNG &amp; PDF that match the preview
                </h3>
                <p className="text-muted-foreground type-body-m">
                  Exports render from the exact same headless Chromium canvas as
                  the editor — zero broken fonts or shifted frames.
                </p>
              </div>

              <div className="border-border overflow-hidden rounded-xl border">
                <img
                  src="/landing/export-bundle-preview.svg"
                  alt="Behance 1400px PNG, A4 PDF deck, and public OpenGraph preview cards"
                  className="aspect-16/9 w-full object-cover"
                />
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="border-border bg-surface flex items-center justify-between rounded-lg border px-3 py-2">
                  <span className="text-foreground type-caption">PNG Long</span>
                  <StatusPill tone="success">Free</StatusPill>
                </div>
                <div className="border-border bg-surface flex items-center justify-between rounded-lg border px-3 py-2">
                  <span className="text-foreground type-caption">
                    Behance 1400
                  </span>
                  <StatusPill tone="warning">Pro</StatusPill>
                </div>
                <div className="border-border bg-surface flex items-center justify-between rounded-lg border px-3 py-2">
                  <span className="text-foreground type-caption">A4 PDF</span>
                  <StatusPill tone="warning">Pro</StatusPill>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* 9. Privacy-First Case Study Telemetry Inspector */}
      <section className="bg-surface px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto flex max-w-7xl flex-col gap-12 lg:gap-14">
          <SectionHeader
            overline="Built-in analytics"
            title="Know who is reading your work"
            description="Every published page records privacy-safe views, unique visitor hashes, referrers, and countries — zero third-party ad cookies."
          />

          <div className="border-border bg-card shadow-card flex flex-col gap-6 rounded-2xl border p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <StatusPill tone="success">
                  Live PostgreSQL Telemetry
                </StatusPill>
                <span className="text-muted-foreground font-mono type-caption">
                  Real counts · Zero inflated vanity metrics
                </span>
              </div>

              <div
                role="group"
                aria-label="Analytics inspector view"
                className="bg-sunken border-border inline-flex items-center gap-1 rounded-full border p-1"
              >
                <button
                  type="button"
                  aria-pressed={telemetryMode === "live"}
                  onClick={() => setTelemetryMode("live")}
                  className={cn(
                    "type-caption focus-visible:ring-ring/40 rounded-full px-3 py-1 transition-all outline-none focus-visible:ring-2",
                    telemetryMode === "live"
                      ? "bg-elevated text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Live platform counts
                </button>
                <button
                  type="button"
                  aria-pressed={telemetryMode === "schema"}
                  onClick={() => setTelemetryMode("schema")}
                  className={cn(
                    "type-caption focus-visible:ring-ring/40 rounded-full px-3 py-1 transition-all outline-none focus-visible:ring-2",
                    telemetryMode === "schema"
                      ? "bg-elevated text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Tracked signals
                </button>
              </div>
            </div>

            {telemetryMode === "live" ? (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <div className="border-border bg-surface flex flex-col gap-1 rounded-xl border p-5">
                  <p className="text-foreground type-display-m">
                    {snapshot.liveProjectsCount.toLocaleString()}
                  </p>
                  <p className="text-muted-foreground type-body-s">
                    Projects created on Casefolio
                  </p>
                </div>
                <div className="border-border bg-surface flex flex-col gap-1 rounded-xl border p-5">
                  <p className="text-foreground type-display-m">
                    {snapshot.livePageViewsCount.toLocaleString()}
                  </p>
                  <p className="text-muted-foreground type-body-s">
                    Recorded public page views
                  </p>
                </div>
                <div className="border-border bg-surface flex flex-col gap-1 rounded-xl border p-5">
                  <p className="text-primary type-display-m">
                    {snapshot.liveExportsCount.toLocaleString()}
                  </p>
                  <p className="text-muted-foreground type-body-s">
                    Completed PNG &amp; PDF exports
                  </p>
                </div>
                <div className="border-border bg-surface flex flex-col gap-1 rounded-xl border p-5">
                  <p className="text-success type-display-m">0</p>
                  <p className="text-muted-foreground type-body-s">
                    Third-party tracking cookies
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <div className="border-border bg-surface flex flex-col gap-1 rounded-xl border p-5">
                  <p className="text-foreground type-heading-l">SHA-256</p>
                  <p className="text-muted-foreground type-body-s">
                    Daily rotating visitor hash
                  </p>
                </div>
                <div className="border-border bg-surface flex flex-col gap-1 rounded-xl border p-5">
                  <p className="text-foreground type-heading-l">7d &amp; 30d</p>
                  <p className="text-muted-foreground type-body-s">
                    Time-series traffic windows
                  </p>
                </div>
                <div className="border-border bg-surface flex flex-col gap-1 rounded-xl border p-5">
                  <p className="text-primary type-heading-l">Referrers</p>
                  <p className="text-muted-foreground type-body-s">
                    LinkedIn, Read.cv, Dribbble, Direct
                  </p>
                </div>
                <div className="border-border bg-surface flex flex-col gap-1 rounded-xl border p-5">
                  <p className="text-foreground type-heading-l">ISO Country</p>
                  <p className="text-muted-foreground type-body-s">
                    Edge geo header without IP storage
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {SAMPLE_PRO_REFERREERS.map((ref) => (
                <div
                  key={ref.source}
                  className="border-border bg-surface flex items-center justify-between gap-3 rounded-xl border p-4"
                >
                  <span className="text-foreground font-mono type-caption">
                    {ref.source}
                  </span>
                  <span className="bg-sunken text-muted-foreground type-caption shrink-0 rounded-full px-2.5 py-0.5">
                    {ref.detail}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 10. Pricing Section (#pricing) */}
      <section
        id="pricing"
        className="bg-background scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8 lg:py-28"
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-12 lg:gap-14">
          <SectionHeader
            overline="Pricing"
            title="Simple plans for every designer"
            description="Start free with two projects — upgrade anytime for unlimited case studies, unwatermarked PNG & PDF exports, and full analytics."
          />

          <LandingPricingSection />
        </div>
      </section>

      {/* 11. Real Case Study Blueprints (Replaces fictional testimonials with real shipped blueprints) */}
      <section className="bg-surface px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto flex max-w-7xl flex-col gap-12 lg:gap-14">
          <SectionHeader
            overline="Real case study blueprints"
            title="Designers ship case studies faster"
            description="Inspect the real multi-section architectures included inside Casefolio — zero placeholder lorem ipsum."
          />

          <div
            data-animate-grid
            className="grid grid-cols-1 gap-6 md:grid-cols-3"
          >
            {snapshot.templates.map((item) => (
              <article
                key={`blueprint-${item.slug}`}
                className="border-border bg-card flex flex-col justify-between gap-5 rounded-2xl border p-6 sm:p-7"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="bg-accent text-accent-foreground type-caption rounded-full px-2.5 py-0.5">
                      {item.categoryName}
                    </span>
                    <span className="text-muted-foreground font-mono type-caption">
                      {item.sectionCount} sections · {item.slotCount} slots
                    </span>
                  </div>
                  <h3 className="text-foreground type-heading-m">
                    {item.headline}
                  </h3>
                  <p className="text-muted-foreground type-body-s">
                    {item.summary}
                  </p>
                </div>

                <div className="border-border flex items-center justify-between border-t pt-4">
                  <span className="text-muted-foreground type-caption inline-flex items-center gap-1.5">
                    <ShieldCheck className="text-success size-4" />
                    <span>Schema-validated v{item.version}</span>
                  </span>
                  <Link
                    href={`/templates`}
                    className="text-primary hover:underline type-caption font-semibold"
                  >
                    Inspect →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 12. FAQ Section (#faq) */}
      <section
        id="faq"
        className="bg-background scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8 lg:py-28"
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-12 lg:gap-14">
          <SectionHeader
            overline="FAQ"
            title="Questions, answered"
            description="Everything you need to know about templates, device mockups, exports, and plans."
          />

          <LandingFaqAccordion />
        </div>
      </section>

      {/* 13. Final CTA Box — Reacts to Studio Quest XP */}
      <section className="bg-background px-4 pt-4 pb-24 sm:px-6 lg:px-8 lg:pb-32">
        <div className="bg-inverse text-inverse-foreground relative mx-auto flex max-w-7xl flex-col items-center gap-6 overflow-hidden rounded-3xl px-6 py-16 text-center sm:px-12 lg:py-24">
          <span className="bg-inverse-foreground/12 text-inverse-foreground type-caption inline-flex items-center gap-2 rounded-full px-3.5 py-1">
            {xp >= maxXp ? (
              <>
                <Trophy className="size-3.5" />
                <span>
                  100/100 Studio XP Complete · Ship-Ready Designer Unlocked!
                </span>
              </>
            ) : (
              <>
                <Zap className="size-3.5" />
                <span>
                  {xp}/{maxXp} Studio XP earned ·{" "}
                  {snapshot.freeProjectsIncluded} free projects ready
                </span>
              </>
            )}
          </span>

          <h2 className="type-display-m sm:type-display-l max-w-2xl text-balance">
            Your next case study is one template away
          </h2>

          <p className="text-inverse-foreground/80 type-body-l max-w-xl">
            Start free with {snapshot.freeProjectsIncluded} full case studies —
            pick Cinema, Orbit, or Meridian and publish today.
          </p>

          <div className="flex w-full flex-col items-stretch justify-center gap-3 pt-2 sm:w-auto sm:flex-row sm:items-center">
            <Button size="lg" asChild>
              <Link href="/sign-up">
                <Sparkles className="size-4" />
                <span>Start free</span>
              </Link>
            </Button>
            <Button
              variant="secondary"
              size="lg"
              className="bg-inverse-foreground/12 text-inverse-foreground hover:bg-inverse-foreground/20 border-0"
              asChild
            >
              <Link href="/templates">Browse templates</Link>
            </Button>
          </div>
        </div>
      </section>

      <FloatingQuestHud />
    </div>
  );
}

export function LandingExperience({
  snapshot,
}: {
  snapshot: LandingPlatformSnapshot;
}) {
  return (
    <StudioQuestProvider>
      <LandingExperienceInner snapshot={snapshot} />
    </StudioQuestProvider>
  );
}
