"use client";

import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Globe,
  Layers,
  LayoutTemplate,
  MessageCircleQuestion,
  Rocket,
  Sparkles,
  Tag,
} from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { LandingFaqAccordion } from "@/components/marketing/landing-faq-accordion";
import { LandingHeroMotion } from "@/components/marketing/landing-hero-motion";
import { LandingHeroVisual } from "@/components/marketing/landing-hero-visual";
import { LandingPricingSection } from "@/components/marketing/landing-pricing-section";
import {
  CtaStage,
  FeatureColumns,
  FeatureList,
  HeroDevice,
  HowItWorksStage,
  TemplateStack,
} from "@/components/marketing/landing-showcase";
import {
  CountUp,
  Reveal,
  ScrollWords,
  WordReveal,
} from "@/components/marketing/motion";
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
    <div className="mx-auto mb-12 flex max-w-3xl flex-col items-center gap-4 text-center sm:mb-16 sm:gap-6 lg:mb-28">
      <Reveal>
        <Eyebrow icon={icon}>{eyebrow}</Eyebrow>
      </Reveal>
      <WordReveal
        as="h2"
        text={title}
        onScroll
        className="type-section text-foreground text-balance"
      />
      {description && (
        <Reveal delay={0.15}>
          <p className="text-muted-foreground type-lead max-w-xl text-pretty">
            {description}
          </p>
        </Reveal>
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

  const metrics = [
    {
      value: snapshot.publishedTemplatesCount,
      label: "Curated templates",
      detail: snapshot.templates.map((t) => t.name).join(" · "),
    },
    {
      value: snapshot.deviceFramesCount,
      label: "Device frames",
      detail: "iPhone · Android · iPad · MacBook",
    },
    {
      value: snapshot.sectionPresetsCount,
      label: "Story sections",
      detail: `${snapshot.sectionTypesCount} modular section types`,
    },
    {
      value: snapshot.exportFormatsCount,
      label: "Export formats",
      detail: "PNG · Behance 1400px · A4 PDF",
    },
  ] as const;

  const liveCounts = [
    { value: snapshot.liveProjectsCount, label: "Case studies created" },
    { value: snapshot.livePageViewsCount, label: "Published page views" },
    { value: snapshot.liveExportsCount, label: "Exports generated" },
  ] as const;

  return (
    <div className="relative flex flex-col overflow-x-clip">
      {/* 1. Hero */}
      <section className="relative px-4 pt-4 pb-16 sm:px-6 sm:pt-6 sm:pb-24 lg:px-8 lg:pt-12 lg:pb-40">
        <LandingHeroMotion
          visual={
            <HeroDevice snapshot={snapshot}>
              <LandingHeroVisual />
            </HeroDevice>
          }
        >
          <Eyebrow icon={<Sparkles className="text-primary" />}>
            {snapshot.publishedTemplatesCount} curated templates ·{" "}
            {snapshot.deviceFramesCount} device mockups · Free to start
          </Eyebrow>

          <WordReveal
            as="h1"
            text="Turn finished UI screens into published case studies"
            delay={0.1}
            className="type-hero text-foreground max-w-6xl text-balance"
          />

          <p className="text-muted-foreground type-lead max-w-2xl text-pretty">
            Start with a structured case study template crafted by designers,
            snap your screens into realistic device mockups, and customize your
            brand colors and fonts — then publish a live link or export PNG,
            Behance, and PDF files in minutes.
          </p>

          <div className="flex w-full flex-col items-stretch justify-center gap-3 pt-1 sm:w-auto sm:flex-row sm:items-center sm:pt-2">
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

      {/* 2. Platform numbers */}
      <section
        aria-label="Platform metrics"
        className="container-page pb-[var(--section-space)]"
      >
        <Reveal
          stagger
          className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 sm:gap-y-14 lg:grid-cols-4"
        >
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="flex flex-col items-center gap-1.5 text-center sm:gap-2"
            >
              <span className="type-section text-foreground">
                <CountUp value={metric.value} />
              </span>
              <span className="text-foreground type-body-m-strong">
                {metric.label}
              </span>
              <span className="text-muted-foreground type-caption max-w-[14rem]">
                {metric.detail}
              </span>
            </div>
          ))}
        </Reveal>
      </section>

      {/* 3. Statement */}
      <section className="container-page pb-[var(--section-space)]">
        <ScrollWords
          text="You finish designing the product — then spend weeks rebuilding grids, faking device mockups, and slicing exports. Casefolio locks in the editorial layout so your finished UI becomes a published case study in minutes."
          className="type-heading-l text-foreground mx-auto max-w-4xl text-center text-balance lg:text-[2.75rem] lg:leading-[1.2]"
        />
      </section>

      {/* 4. How it works */}
      <section
        id="how-it-works"
        className="container-page scroll-mt-28 pb-[var(--section-space)]"
      >
        <SectionIntro
          icon={<BookOpen />}
          eyebrow="How it works"
          title="From finished UI to published case study in four steps"
          description="Choose a project format, pick a proven story template, drop in your screens and brand styling, then publish or export. Everything stays editable anytime."
        />
        <HowItWorksStage snapshot={snapshot} />
      </section>

      {/* 5. Editor */}
      <section
        id="product"
        className="container-page scroll-mt-28 pb-[var(--section-space)]"
      >
        <SectionIntro
          icon={<Layers />}
          eyebrow="The editor"
          title="Structured editing, without formatting busywork"
          description="Customize your colors, typography, device mockups, and narrative blocks while Casefolio keeps spacing, visual balance, and responsive rhythm locked."
        />
        <FeatureColumns snapshot={snapshot} />
        <FeatureList />
      </section>

      {/* 6. Templates */}
      <section id="templates" className="scroll-mt-28 pb-[var(--section-space)]">
        <div className="container-page">
          <SectionIntro
            icon={<LayoutTemplate />}
            eyebrow="Templates"
            title="Start from a case study structure that already works"
            description={`${snapshot.publishedTemplatesCount} designer-crafted templates with ${snapshot.totalTemplateSections} guided storytelling sections and ${snapshot.totalTemplateSlots} ratio-locked screen frames, ready to customize today.`}
          />
        </div>
        <div className="container-page flex w-full flex-col items-center gap-12 sm:gap-14">
          <TemplateStack templates={snapshot.templates} />
          <div className="flex flex-col items-center gap-3">
            <Button variant="default" size="lg" asChild>
              <Link href="/templates">
                <span>Browse all templates</span>
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <p className="text-muted-foreground type-caption">
              Explore the full UI/UX template library, filter by mobile or web, and preview layouts live
            </p>
          </div>
        </div>
      </section>

      {/* 7. Publish & export */}
      <section
        id="publish-export"
        className="container-page scroll-mt-28 pb-[var(--section-space)]"
      >
        <SectionIntro
          icon={<Rocket />}
          eyebrow="Publish & export"
          title="One case study, ready for live links, Behance, and PDFs"
          description="Publish an indexed portfolio link on casefolio.app or export pixel-sharp files sized for Behance, Dribbble, and recruiter A4 PDF decks."
        />

        <Reveal stagger className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <article className="bg-surface border-border/60 flex min-w-0 flex-col justify-between gap-7 rounded-3xl border p-6 sm:gap-10 sm:p-10">
            <div className="flex flex-col gap-3.5 sm:gap-4">
              <StatusPill tone={simulatedPublished ? "success" : "warning"}>
                {simulatedPublished ? "Published · Live" : "Draft preview"}
              </StatusPill>
              <h3 className="type-heading-l text-foreground">
                Host on casefolio.app or your own domain
              </h3>
              <p className="text-muted-foreground type-body-m max-w-md">
                Switch between Public, Unlisted, and Private visibility, claim
                a clean custom slug, and share links with automatic OpenGraph
                social preview cards.
              </p>
            </div>

            <div className="flex min-w-0 flex-col gap-4">
              <div className="bg-elevated border-border/60 overflow-hidden rounded-2xl border shadow-xs">
                <div className="border-border/60 flex items-center gap-2 border-b px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
                  <span className="hidden gap-1.5 sm:flex" aria-hidden="true">
                    <span className="bg-border-strong size-2 rounded-full" />
                    <span className="bg-border-strong size-2 rounded-full" />
                    <span className="bg-border-strong size-2 rounded-full" />
                  </span>
                  <span className="text-foreground type-caption flex min-w-0 flex-1 items-center gap-1.5 font-mono sm:gap-2">
                    <Globe className="text-primary size-3.5 shrink-0" />
                    <span className="truncate">casefolio.app/p/cinema</span>
                  </span>
                  <StatusPill tone={simulatedPublished ? "success" : "neutral"}>
                    {simulatedPublished ? "Live 200 OK" : "Staged"}
                  </StatusPill>
                </div>
                <div className="bg-inverse relative overflow-hidden">
                  <img
                    src={snapshot.templates[0]?.coverSrc ?? "/templates/cinema/cover.svg"}
                    alt="Published Cinema case study page"
                    className={cn(
                      "aspect-16/9 w-full object-cover transition-all duration-500",
                      simulatedPublished ? "scale-[1.01] opacity-100" : "opacity-92",
                    )}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSimulatedPublished((prev) => !prev)}
                className={cn(
                  "type-body-s-strong focus-visible:ring-ring/40 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-center transition-all duration-300 outline-none focus-visible:ring-2 active:scale-[0.99]",
                  simulatedPublished
                    ? "bg-success-soft text-foreground"
                    : "bg-inverse text-inverse-foreground hover:bg-inverse/85",
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

          <article className="bg-surface border-border/60 flex min-w-0 flex-col justify-between gap-7 rounded-3xl border p-6 sm:gap-10 sm:p-10">
            <div className="flex flex-col gap-3.5 sm:gap-4">
              <StatusPill tone="accent">
                {snapshot.exportFormatsCount} export formats
              </StatusPill>
              <h3 className="type-heading-l text-foreground">
                Pixel-accurate PNG, Behance, and PDF exports
              </h3>
              <p className="text-muted-foreground type-body-m max-w-md">
                Every download renders directly from the live Casefolio canvas,
                so typography, contrast, and device frames never shift or clip.
              </p>
            </div>

            <div className="bg-elevated border-border/60 overflow-hidden rounded-2xl border">
              <img
                src="/landing/export-bundle-preview.svg"
                alt="Behance 1400px PNG, A4 PDF deck, and public OpenGraph preview cards"
                className="aspect-16/9 w-full object-cover"
              />
            </div>
          </article>
        </Reveal>

        <Reveal
          stagger
          className="border-border/60 mx-auto mt-16 grid max-w-3xl grid-cols-3 gap-3 border-t pt-10 text-center sm:mt-24 sm:gap-6 sm:pt-14"
        >
          {liveCounts.map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-1 sm:gap-1.5">
              <span className="type-heading-m sm:type-heading-l text-foreground">
                <CountUp value={item.value} />
              </span>
              <span className="text-muted-foreground type-caption text-balance">
                {item.label}
              </span>
            </div>
          ))}
        </Reveal>
        <p className="text-tertiary type-caption mt-4 text-center">
          Live platform totals · privacy-first analytics with zero third-party ad cookies
        </p>
      </section>

      {/* 8. Pricing */}
      <section
        id="pricing"
        className="container-page scroll-mt-28 pb-[var(--section-space)]"
      >
        <SectionIntro
          icon={<Tag />}
          eyebrow="Pricing"
          title="Clear plans for solo designers, teams, and agencies"
          description="Start free forever with 1 active Case Study — or choose Pro, Team (2–10 seats), or Plus (up to 20 seats, custom domain, and white-labeling) with 20% off annual billing."
        />
        <LandingPricingSection showComparisonLink />
      </section>

      {/* 9. FAQ */}
      <section
        id="faq"
        className="container-page scroll-mt-28 pb-[var(--section-space)]"
      >
        <SectionIntro
          icon={<MessageCircleQuestion />}
          eyebrow="FAQ"
          title="Common questions, answered"
          description="Straight answers on templates, device mockups, export formats, team seats, and plan changes."
        />
        <Reveal>
          <LandingFaqAccordion />
        </Reveal>
      </section>

      {/* 10. Final CTA */}
      <section className="px-4 pb-8 sm:px-6 sm:pb-10 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <CtaStage snapshot={snapshot}>
            <span className="bg-primary text-primary-foreground shadow-float type-heading-m inline-flex size-14 items-center justify-center rounded-2xl sm:size-16">
              C
            </span>
            <h2 className="type-section text-foreground text-balance">
              Ready to publish your next case study?
            </h2>
            <p className="text-muted-foreground type-lead max-w-md">
              Start free with {snapshot.freeProjectsIncluded} full case{" "}
              {snapshot.freeProjectsIncluded === 1 ? "study" : "studies"} — pick
              Cinema, Orbit, or Northwind and share your work today.
            </p>
            <Button size="lg" asChild>
              <Link href="/sign-up">
                <span>Start free</span>
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CtaStage>
        </div>
      </section>
    </div>
  );
}
