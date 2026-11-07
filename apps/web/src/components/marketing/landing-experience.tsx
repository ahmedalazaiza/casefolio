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
    <div className="mx-auto mb-20 flex max-w-3xl flex-col items-center gap-6 text-center lg:mb-28">
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
        "type-caption inline-flex shrink-0 items-center rounded-full px-3 py-1",
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
      label: "Live templates",
      detail: snapshot.templates.map((t) => t.name).join(" · "),
    },
    {
      value: snapshot.deviceFramesCount,
      label: "Hardware frames",
      detail: "iPhone · Android · iPad · MacBook",
    },
    {
      value: snapshot.sectionPresetsCount,
      label: "Section presets",
      detail: `${snapshot.sectionTypesCount} core section types`,
    },
    {
      value: snapshot.exportFormatsCount,
      label: "Export formats",
      detail: "PNG · Behance 1400 · A4 PDF",
    },
  ] as const;

  const liveCounts = [
    { value: snapshot.liveProjectsCount, label: "Projects created" },
    { value: snapshot.livePageViewsCount, label: "Public page views" },
    { value: snapshot.liveExportsCount, label: "Exports completed" },
  ] as const;

  return (
    <div className="relative flex flex-col">
      {/* 1. Hero */}
      <section className="relative px-4 pt-6 pb-24 sm:px-6 lg:px-8 lg:pt-12 lg:pb-40">
        <LandingHeroMotion
          visual={
            <HeroDevice snapshot={snapshot}>
              <LandingHeroVisual />
            </HeroDevice>
          }
        >
          <Eyebrow icon={<Sparkles className="text-primary" />}>
            {snapshot.publishedTemplatesCount} live templates ·{" "}
            {snapshot.deviceFramesCount} hardware frames · Free to start
          </Eyebrow>

          <WordReveal
            as="h1"
            text="Turn finished projects into publishable case studies"
            delay={0.1}
            className="type-hero text-foreground max-w-6xl text-balance"
          />

          <p className="text-muted-foreground type-lead max-w-2xl text-pretty">
            Pick a template crafted by the Casefolio team, snap your UI screens
            into ratio-locked device frames, tune your tokens — then publish a
            live URL or export PNG &amp; PDF in minutes.
          </p>

          <div className="flex w-full flex-col items-stretch justify-center gap-3 pt-2 sm:w-auto sm:flex-row sm:items-center">
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
            {snapshot.freeProjectsIncluded} free case studies included · No
            credit card required
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
          className="grid grid-cols-2 gap-x-6 gap-y-14 lg:grid-cols-4"
        >
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="flex flex-col items-center gap-2 text-center"
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
          text="Designers finish the product, then lose weeks rebuilding grids, framing mockups by hand and re-slicing exports. Casefolio keeps your layout rhythm unbreakable, so a finished project becomes a published case study in minutes."
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
          title="From finished UI to case study in four steps"
          description="Pick a type, choose a template, customize it, then publish or export. Every decision stays editable."
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
          title="A full editor, without the busywork"
          description="Structured flexibility: customize tokens, mockups, and narrative blocks while your layout rhythm stays unbreakable."
        />
        <FeatureColumns snapshot={snapshot} />
        <FeatureList />
      </section>

      {/* 6. Templates */}
      <section className="pb-[var(--section-space)]">
        <div className="container-page">
          <SectionIntro
            icon={<LayoutTemplate />}
            eyebrow="Templates"
            title="Start from a layout that already works"
            description={`${snapshot.publishedTemplatesCount} curated templates with ${snapshot.totalTemplateSections} pre-built sections and ${snapshot.totalTemplateSlots} ratio-locked slots, ready to open today.`}
          />
        </div>
        <Reveal className="container-page flex flex-col items-center gap-14">
          <TemplateStack templates={snapshot.templates} />
          <Button variant="secondary" size="lg" asChild>
            <Link href="/templates">
              <span>Browse all templates</span>
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </Reveal>
      </section>

      {/* 7. Publish & export */}
      <section
        id="publish-export"
        className="container-page scroll-mt-28 pb-[var(--section-space)]"
      >
        <SectionIntro
          icon={<Rocket />}
          eyebrow="Publish & export"
          title="One case study, everywhere you need it"
          description="Publish an indexed public URL on casefolio.app, or export crisp files for Behance, Dribbble, and recruiter PDF decks."
        />

        <Reveal stagger className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <article className="bg-surface border-border/60 flex flex-col justify-between gap-10 rounded-3xl border p-8 sm:p-10">
            <div className="flex flex-col gap-4">
              <StatusPill tone={simulatedPublished ? "success" : "warning"}>
                {simulatedPublished ? "Published · Live" : "Draft preview"}
              </StatusPill>
              <h3 className="type-heading-l text-foreground">
                A public page on casefolio.app
              </h3>
              <p className="text-muted-foreground type-body-m max-w-md">
                Choose Public, Unlisted, or Private visibility, customize your
                slug, and ship with automatic OpenGraph social cards.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="bg-elevated border-border/60 overflow-hidden rounded-2xl border shadow-xs">
                <div className="border-border/60 flex items-center gap-3 border-b px-4 py-3">
                  <span className="flex gap-1.5" aria-hidden="true">
                    <span className="bg-border-strong size-2 rounded-full" />
                    <span className="bg-border-strong size-2 rounded-full" />
                    <span className="bg-border-strong size-2 rounded-full" />
                  </span>
                  <span className="text-foreground type-caption flex min-w-0 flex-1 items-center gap-2 font-mono">
                    <Globe className="text-primary size-3.5 shrink-0" />
                    <span className="truncate">casefolio.app/p/cinema-booking</span>
                  </span>
                  <StatusPill tone={simulatedPublished ? "success" : "neutral"}>
                    {simulatedPublished ? "Live 200 OK" : "Staged"}
                  </StatusPill>
                </div>
                <div
                  className={cn(
                    "bg-inverse transition-opacity duration-700",
                    simulatedPublished ? "opacity-100" : "opacity-45",
                  )}
                >
                  <img
                    src={snapshot.templates[0]?.coverSrc ?? "/templates/cinema/cover.svg"}
                    alt="Published Cinema case study page"
                    className="aspect-16/8 w-full object-cover"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSimulatedPublished((prev) => !prev)}
                className={cn(
                  "type-body-s-strong focus-visible:ring-ring/40 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full transition-all duration-300 outline-none focus-visible:ring-2 active:scale-[0.99]",
                  simulatedPublished
                    ? "bg-success-soft text-foreground"
                    : "bg-inverse text-inverse-foreground hover:bg-inverse/85",
                )}
              >
                {simulatedPublished ? (
                  <CheckCircle2 className="size-4" />
                ) : (
                  <Rocket className="size-4" />
                )}
                <span>
                  {simulatedPublished
                    ? "Live URL active · Click to preview Draft state"
                    : "Preview live public URL state"}
                </span>
              </button>
            </div>
          </article>

          <article className="bg-surface border-border/60 flex flex-col justify-between gap-10 rounded-3xl border p-8 sm:p-10">
            <div className="flex flex-col gap-4">
              <StatusPill tone="accent">
                {snapshot.exportFormatsCount} export formats
              </StatusPill>
              <h3 className="type-heading-l text-foreground">
                PNG &amp; PDF that match the preview
              </h3>
              <p className="text-muted-foreground type-body-m max-w-md">
                Exports render from the exact same headless Chromium canvas as
                the editor — zero broken fonts or shifted frames.
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
          className="border-border/60 mx-auto mt-24 grid max-w-3xl grid-cols-3 gap-6 border-t pt-14 text-center"
        >
          {liveCounts.map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-1.5">
              <span className="type-heading-l text-foreground">
                <CountUp value={item.value} />
              </span>
              <span className="text-muted-foreground type-caption">
                {item.label}
              </span>
            </div>
          ))}
        </Reveal>
        <p className="text-tertiary type-caption mt-4 text-center">
          Live counts from the Casefolio platform · privacy-safe analytics, zero
          third-party ad cookies
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
          title="Simple plans for every designer"
          description="Start free with two projects — upgrade anytime for unlimited case studies, unwatermarked PNG & PDF exports, and full analytics."
        />
        <LandingPricingSection />
      </section>

      {/* 9. FAQ */}
      <section
        id="faq"
        className="container-page scroll-mt-28 pb-[var(--section-space)]"
      >
        <SectionIntro
          icon={<MessageCircleQuestion />}
          eyebrow="FAQ"
          title="Questions, answered"
          description="Everything you need to know about templates, device mockups, exports, and plans."
        />
        <Reveal>
          <LandingFaqAccordion />
        </Reveal>
      </section>

      {/* 10. Final CTA */}
      <section className="px-4 pb-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <CtaStage snapshot={snapshot}>
            <span className="bg-primary text-primary-foreground shadow-float type-heading-m inline-flex size-16 items-center justify-center rounded-2xl">
              C
            </span>
            <WordReveal
              as="h2"
              text="Your next case study is one template away"
              onScroll
              className="type-section text-foreground text-balance"
            />
            <p className="text-muted-foreground type-lead max-w-md">
              Start free with {snapshot.freeProjectsIncluded} full case studies
              — pick Cinema, Orbit, or Meridian and publish today.
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
