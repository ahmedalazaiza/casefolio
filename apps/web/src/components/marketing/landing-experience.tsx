"use client";

import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  FolderPlus,
  Globe,
  Layers,
  LayoutTemplate,
  MessageCircleQuestion,
  Rocket,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { LandingFaqAccordion } from "@/components/marketing/landing-faq-accordion";
import { LandingHeroMotion } from "@/components/marketing/landing-hero-motion";
import { LandingHeroVisual } from "@/components/marketing/landing-hero-visual";
import {
  CtaStage,
  FeatureColumns,
  FeatureList,
  HeroDevice,
  HowItWorksStage,
  TemplateStack,
} from "@/components/marketing/landing-showcase";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import type { LandingPlatformSnapshot } from "@/lib/marketing/landing-stats";
import { cn } from "@/lib/utils";

function SectionIntro({
  icon,
  eyebrow,
  title,
  description,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mx-auto mb-10 flex max-w-2xl flex-col items-center gap-3.5 text-center sm:mb-14">
      <Eyebrow icon={icon}>{eyebrow}</Eyebrow>
      <h2 className="font-display text-foreground text-2xl leading-[1.15] font-medium tracking-tight text-balance sm:text-3xl lg:text-[2.25rem]">
        {title}
      </h2>
      {description && (
        <p className="text-muted-foreground type-body-l max-w-xl text-pretty">
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
  tone: "success" | "warning" | "neutral" | "accent";
  children: ReactNode;
}) {
  const styles = {
    success: "bg-success-soft text-foreground",
    warning: "bg-warning-soft text-foreground",
    neutral: "bg-sunken text-muted-foreground",
    accent: "bg-accent text-accent-foreground",
  }[tone];

  return (
    <span
      className={cn(
        "type-caption inline-flex w-fit shrink-0 items-center self-start rounded-full px-3 py-1",
        styles,
      )}
    >
      {children}
    </span>
  );
}

export function LandingExperience({
  snapshot,
}: {
  snapshot: LandingPlatformSnapshot;
}) {
  const [simulatedPublished, setSimulatedPublished] = useState(false);

  const featuredTemplate = snapshot.templates[0] ?? {
    slug: "cinema",
    name: "Cinema",
    sectionCount: 14,
    coverSrc: "/templates/cinema/cover.svg",
  };

  const metrics = [
    {
      value: snapshot.publishedTemplatesCount,
      label: "Curated templates",
      detail: "Mobile, Web, and cross-platform",
    },
    {
      value: snapshot.deviceFramesCount,
      label: "Device frames",
      detail: "iPhone · Android · iPad · MacBook",
    },
    {
      value: snapshot.sectionPresetsCount,
      label: "Story sections",
      detail: `${snapshot.sectionTypesCount} modular block types`,
    },
    {
      value: snapshot.exportFormatsCount,
      label: "Export formats",
      detail: "PNG · Behance 1400px · A4 PDF",
    },
  ] as const;

  const startActions = [
    {
      href: "/sign-up",
      icon: <FolderPlus className="size-4" />,
      title: "Create your free workspace",
      detail: `${snapshot.freeProjectsIncluded} active case ${snapshot.freeProjectsIncluded === 1 ? "study" : "studies"} free forever · Live link, PNG & PDF export`,
    },
    {
      href: `/new?template=${featuredTemplate.slug}`,
      icon: <Sparkles className="size-4" />,
      title: `Start with the ${featuredTemplate.name} template`,
      detail: `${featuredTemplate.sectionCount} guided UX story sections ready for your screens`,
    },
    {
      href: "/templates",
      icon: <LayoutTemplate className="size-4" />,
      title: `Browse all ${snapshot.publishedTemplatesCount} curated templates`,
      detail: "Preview full responsive layouts live before creating an account",
    },
  ] as const;

  return (
    <div className="relative flex flex-col overflow-x-clip">
      {/* 1. Split Hero — Copy & CTAs left, un-tilted Editor window right */}
      <section className="bg-background py-10 sm:py-16 lg:py-20">
        <LandingHeroMotion
          visual={
            <HeroDevice snapshot={snapshot}>
              <LandingHeroVisual />
            </HeroDevice>
          }
        >
          <Eyebrow icon={<Sparkles className="text-primary" />}>
            UI/UX Portfolio Case Study Builder
          </Eyebrow>

          <h1 className="font-display text-foreground text-3xl leading-[1.12] font-medium tracking-tight text-balance sm:text-4xl lg:text-[2.875rem]">
            Turn finished UI screens into published case studies
          </h1>

          <p className="text-muted-foreground type-body-l max-w-lg text-pretty">
            Pick a structured template crafted by designers, drop your screens
            into realistic device mockups, and publish a live portfolio link or
            export PNG, Behance, and PDF files in minutes.
          </p>

          <div className="flex w-full flex-col items-stretch gap-3 pt-1 sm:w-auto sm:flex-row sm:items-center">
            <Button size="lg" asChild>
              <Link href="/sign-up">
                <span>Start free</span>
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button variant="secondary" size="lg" asChild>
              <Link href="/templates">Browse templates</Link>
            </Button>
          </div>

          <p className="text-muted-foreground type-caption">
            {snapshot.freeProjectsIncluded} free case{" "}
            {snapshot.freeProjectsIncluded === 1 ? "study" : "studies"} forever ·
            No credit card required
          </p>
        </LandingHeroMotion>
      </section>

      {/* 2. Compact Capability Strip */}
      <section
        aria-label="Platform capabilities"
        className="border-border bg-surface border-y py-7 sm:py-9"
      >
        <div className="container-page grid grid-cols-2 gap-6 lg:grid-cols-4">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="flex flex-col items-start gap-1 sm:flex-row sm:items-baseline sm:gap-3"
            >
              <span className="font-display text-foreground text-2xl leading-none font-medium sm:text-3xl">
                {metric.value}
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="text-foreground type-body-s-strong">
                  {metric.label}
                </span>
                <span className="text-muted-foreground type-caption">
                  {metric.detail}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. How it works — 4 horizontal flat cards */}
      <section
        id="how-it-works"
        className="bg-background scroll-mt-20 py-16 sm:py-20 lg:py-24"
      >
        <div className="container-page">
          <SectionIntro
            icon={<BookOpen />}
            eyebrow="How it works"
            title="From finished UI to published case study in four steps"
            description="Choose your screen format, open a proven story layout, drop in your UI exports, and publish or download."
          />
          <HowItWorksStage snapshot={snapshot} />
        </div>
      </section>

      {/* 4. Templates — 6 clean flat cards (3 per row) */}
      <section
        id="templates"
        className="border-border bg-surface scroll-mt-20 border-y py-16 sm:py-20 lg:py-24"
      >
        <div className="container-page flex flex-col items-center gap-10 sm:gap-12">
          <SectionIntro
            icon={<LayoutTemplate />}
            eyebrow="Templates"
            title="Start from a case study structure that already works"
            description={`${snapshot.publishedTemplatesCount} designer-crafted templates with ${snapshot.totalTemplateSections} guided storytelling sections and ${snapshot.totalTemplateSlots} ratio-locked screen frames.`}
          />

          <TemplateStack templates={snapshot.templates} />

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button variant="default" size="lg" asChild>
              <Link href="/templates">
                <span>Browse all templates</span>
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button variant="secondary" size="lg" asChild>
              <Link href="/sign-up">Start free</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* 5. The Editor — calm structured editing blocks */}
      <section
        id="product"
        className="bg-background scroll-mt-20 py-16 sm:py-20 lg:py-24"
      >
        <div className="container-page">
          <SectionIntro
            icon={<Layers />}
            eyebrow="The editor"
            title="Structured editing, without formatting busywork"
            description="Customize colors, typography, device mockups, and narrative blocks while Casefolio keeps spacing, contrast, and responsive alignment locked."
          />
          <FeatureColumns snapshot={snapshot} />
          <FeatureList />
        </div>
      </section>

      {/* 6. Publish & export — 2 clean flat cards */}
      <section
        id="publish-export"
        className="border-border bg-surface scroll-mt-20 border-y py-16 sm:py-20 lg:py-24"
      >
        <div className="container-page">
          <SectionIntro
            icon={<Rocket />}
            eyebrow="Publish & export"
            title="One case study, ready for live links, Behance, and PDFs"
            description="Publish an indexed portfolio link on casefolio.app or export pixel-sharp files sized for Behance, Dribbble, and recruiter A4 PDF decks."
          />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <article className="border-border bg-elevated flex min-w-0 flex-col justify-between gap-6 rounded-2xl border p-6 sm:p-8">
              <div className="flex flex-col gap-3">
                <StatusPill tone={simulatedPublished ? "success" : "warning"}>
                  {simulatedPublished ? "Published · Live" : "Draft preview"}
                </StatusPill>
                <h3 className="type-heading-m text-foreground">
                  Host on casefolio.app or your own domain
                </h3>
                <p className="text-muted-foreground type-body-m max-w-md">
                  Switch between Public, Unlisted, and Private visibility, claim
                  a clean custom slug, and share links with automatic OpenGraph
                  social preview cards.
                </p>
              </div>

              <div className="flex min-w-0 flex-col gap-3.5">
                <div className="border-border bg-surface overflow-hidden rounded-xl border">
                  <div className="border-border flex items-center gap-2 border-b px-3 py-2 sm:gap-3 sm:px-4">
                    <span className="hidden gap-1.5 sm:flex" aria-hidden="true">
                      <span className="bg-border-strong size-2 rounded-full" />
                      <span className="bg-border-strong size-2 rounded-full" />
                      <span className="bg-border-strong size-2 rounded-full" />
                    </span>
                    <span className="text-foreground type-caption flex min-w-0 flex-1 items-center gap-1.5 font-mono">
                      <Globe className="text-primary size-3.5 shrink-0" />
                      <span className="truncate">
                        casefolio.app/p/{featuredTemplate.slug}
                      </span>
                    </span>
                    <StatusPill tone={simulatedPublished ? "success" : "neutral"}>
                      {simulatedPublished ? "Live 200 OK" : "Staged"}
                    </StatusPill>
                  </div>
                  <div className="bg-inverse relative overflow-hidden">
                    <img
                      src={featuredTemplate.coverSrc}
                      alt="Published Cinema case study page"
                      className={cn(
                        "aspect-16/9 w-full object-cover transition-opacity duration-300",
                        simulatedPublished ? "opacity-100" : "opacity-90",
                      )}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSimulatedPublished((prev) => !prev)}
                  className={cn(
                    "type-body-s-strong focus-visible:ring-ring/40 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-center transition-colors outline-none focus-visible:ring-2",
                    simulatedPublished
                      ? "bg-success-soft text-foreground border-border border"
                      : "bg-inverse text-inverse-foreground hover:bg-inverse/90",
                  )}
                >
                  {simulatedPublished ? (
                    <CheckCircle2 className="size-4 shrink-0" />
                  ) : (
                    <Rocket className="size-4 shrink-0" />
                  )}
                  <span>
                    {simulatedPublished
                      ? "Live URL active · Click to preview Draft state"
                      : "Preview live public URL state"}
                  </span>
                </button>
              </div>
            </article>

            <article className="border-border bg-elevated flex min-w-0 flex-col justify-between gap-6 rounded-2xl border p-6 sm:p-8">
              <div className="flex flex-col gap-3">
                <StatusPill tone="accent">
                  {snapshot.exportFormatsCount} export formats
                </StatusPill>
                <h3 className="type-heading-m text-foreground">
                  Pixel-accurate PNG, Behance, and PDF exports
                </h3>
                <p className="text-muted-foreground type-body-m max-w-md">
                  Every download renders directly from the live Casefolio canvas,
                  so typography, contrast, and device frames never shift or clip.
                </p>
              </div>

              <div className="border-border bg-surface overflow-hidden rounded-xl border">
                <img
                  src="/landing/export-bundle-preview.svg"
                  alt="Behance 1400px PNG, A4 PDF deck, and public OpenGraph preview cards"
                  className="aspect-16/9 w-full object-cover"
                />
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* 7. Application Launch CTA (replaces home-page pricing cards; keeps /pricing separate) */}
      <section
        data-testid="landing-start-cta"
        className="bg-background py-16 sm:py-20 lg:py-24"
      >
        <div className="container-page">
          <CtaStage snapshot={snapshot}>
            <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-12">
              <div className="flex flex-col items-start gap-4 text-left lg:col-span-6">
                <Eyebrow icon={<Rocket className="text-primary" />}>
                  Start for free
                </Eyebrow>
                <h2 className="font-display text-foreground text-2xl leading-[1.15] font-medium tracking-tight text-balance sm:text-3xl lg:text-[2.25rem]">
                  Ready to publish your next case study?
                </h2>
                <p className="text-muted-foreground type-body-l max-w-lg text-pretty">
                  Open the editor right away with {snapshot.freeProjectsIncluded}{" "}
                  full case{" "}
                  {snapshot.freeProjectsIncluded === 1 ? "study" : "studies"}{" "}
                  included free forever. Pick a template, drop in your finished
                  UI screens, and share a live link today.
                </p>

                <div className="flex w-full flex-col items-stretch gap-3 pt-2 sm:w-auto sm:flex-row sm:items-center">
                  <Button size="lg" asChild>
                    <Link href="/sign-up">
                      <span>Start free</span>
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                  <Button variant="secondary" size="lg" asChild>
                    <Link href="/templates">Choose a template</Link>
                  </Button>
                </div>

                <p className="text-muted-foreground type-caption pt-1">
                  Comparing Pro, Team, or Plus for unlimited projects and custom
                  domains?{" "}
                  <Link
                    href="/pricing"
                    className="text-accent-foreground hover:text-foreground underline underline-offset-4 transition-colors"
                  >
                    View pricing plans
                  </Link>
                </p>
              </div>

              <div
                data-testid="landing-start-actions"
                className="flex flex-col gap-3 lg:col-span-6"
              >
                {startActions.map((action) => (
                  <Link
                    key={action.title}
                    href={action.href}
                    className="border-border bg-surface hover:border-border-strong hover:bg-elevated focus-visible:ring-ring/40 group flex items-center justify-between gap-4 rounded-xl border p-4 transition-colors outline-none focus-visible:ring-2 sm:p-5"
                  >
                    <div className="flex min-w-0 items-start gap-3.5">
                      <span className="border-border bg-elevated text-primary inline-flex size-10 shrink-0 items-center justify-center rounded-lg border">
                        {action.icon}
                      </span>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-foreground type-body-m-strong">
                          {action.title}
                        </span>
                        <span className="text-muted-foreground type-body-s">
                          {action.detail}
                        </span>
                      </div>
                    </div>
                    <ArrowUpRight className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </Link>
                ))}
              </div>
            </div>
          </CtaStage>
        </div>
      </section>

      {/* 8. FAQ — 2-column editorial layout */}
      <section
        id="faq"
        className="border-border bg-surface scroll-mt-20 border-t py-16 sm:py-20 lg:py-24"
      >
        <div className="container-page grid grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="flex flex-col items-start gap-3.5 lg:col-span-4">
            <Eyebrow icon={<MessageCircleQuestion />}>FAQ</Eyebrow>
            <h2 className="font-display text-foreground text-2xl leading-[1.15] font-medium tracking-tight text-balance sm:text-3xl">
              Common questions, answered
            </h2>
            <p className="text-muted-foreground type-body-m max-w-sm">
              Straight answers on templates, device mockups, export formats,
              team seats, and plan changes.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/help"
                className="text-accent-foreground hover:text-foreground type-body-s-strong underline underline-offset-4 transition-colors"
              >
                Visit Help Center
              </Link>
              <Link
                href="/pricing"
                className="text-muted-foreground hover:text-foreground type-body-s underline underline-offset-4 transition-colors"
              >
                Compare plans
              </Link>
            </div>
          </div>

          <div className="lg:col-span-8">
            <LandingFaqAccordion />
          </div>
        </div>
      </section>
    </div>
  );
}
