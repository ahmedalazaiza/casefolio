import { ArrowRight, Check, Lock, Sparkles, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CmsIcon } from "@/components/cms/cms-icon";
import {
  DepthStackPanel,
  HighlightUnfurl,
  Reveal,
  SectionStackSheet,
} from "@/components/marketing/motion";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getSiteCmsContent } from "@/lib/cms/service";

export const metadata: Metadata = {
  title: "About Us — Casefolio",
  description:
    "Why we built Casefolio: a constrained, designer-crafted case study studio that turns finished product work into publishable web pages and studio exports without blank-canvas drift.",
};

export default async function AboutPage() {
  const { about } = await getSiteCmsContent();

  return (
    <div className="relative flex flex-col overflow-x-clip bg-[var(--cf-bg-canvas)] text-[var(--cf-text-primary)]">
      {/* 1. Architectural Grid Hero */}
      <section className="v3-pattern-grid relative z-10 overflow-hidden pt-12 pb-20 sm:pt-16 sm:pb-24 lg:pt-20 lg:pb-28">
        <div className="v3-container flex flex-col gap-12">
          <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
            <Eyebrow step={about.eyebrowStep}>{about.eyebrowText}</Eyebrow>

            <h1 className="v3-display-xl mt-5 text-balance text-[var(--cf-text-primary)]">
              {about.heroTitleLead}{" "}
              <span className="v3-sticker-lime">{about.heroTitleHighlight}</span>{" "}
              {about.heroTitleTrail}
            </h1>

            <p className="v3-body-l mt-5 max-w-2xl text-pretty text-[var(--cf-text-secondary)]">
              {about.heroSubtitle}
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/templates"
                className="v3-btn-primary focus-visible:ring-ring/40 group outline-none focus-visible:ring-2"
              >
                <span>Explore templates</span>
                <span
                  aria-hidden="true"
                  className="inline-flex size-5 items-center justify-center rounded-md bg-[var(--cf-bg-accent)] text-[var(--cf-text-on-accent)] transition-transform duration-200 group-hover:translate-x-0.5"
                >
                  <ArrowRight className="size-3.5 stroke-[2.5]" />
                </span>
              </Link>
              <Link
                href="/team"
                className="v3-btn-secondary focus-visible:ring-ring/40 outline-none focus-visible:ring-2"
              >
                <Users className="size-4" />
                <span>Meet our team</span>
              </Link>
            </div>
          </div>

          {/* 4-Card Flat Studio Metric Strip */}
          <Reveal
            stagger
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {about.metrics.map((item, idx) => (
              <div
                key={`${item.label}-${idx}`}
                className="flex flex-col justify-between gap-4 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-5 transition-all duration-200 hover:border-[var(--cf-royal)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-xs border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] px-2 py-0.5 font-mono text-xs font-semibold text-[var(--cf-text-tertiary)]">
                    0{idx + 1}
                  </span>
                  <span className="size-2 rounded-full bg-[var(--cf-royal)]" aria-hidden="true" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <p className="font-display text-3xl font-bold tracking-tight text-[var(--cf-text-primary)]">
                    {item.value}
                  </p>
                  <p className="text-sm font-semibold text-[var(--cf-text-primary)]">
                    {item.label}
                  </p>
                  <p className="text-xs leading-relaxed text-[var(--cf-text-secondary)]">
                    {item.detail}
                  </p>
                </div>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* 2. Overlapping Elevated Sheet — Craft Philosophy & Architectural Pillars */}
      <SectionStackSheet
        overlapY={44}
        startScale={0.982}
        recedeOnExit
        className="z-20 -mt-8 lg:-mt-12"
      >
        <section className="v3-sheet-elevated rounded-t-[2rem] border-t border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] pt-14 pb-20 sm:rounded-t-[2.75rem] sm:pt-20 sm:pb-28 lg:rounded-t-[3.5rem]">
          <div className="v3-container flex flex-col gap-14">
            <HighlightUnfurl className="mx-auto flex max-w-3xl flex-col items-center text-center">
              <Eyebrow>{about.philosophyEyebrow}</Eyebrow>
              <h2 className="v3-display-l mt-4 text-balance text-[var(--cf-text-primary)]">
                {about.philosophyTitleLead}{" "}
                <span className="v3-highlight">{about.philosophyTitleHighlight}</span>{" "}
                {about.philosophyTitleTrail}
              </h2>
              <p className="v3-body-m mt-4 max-w-2xl text-[var(--cf-text-secondary)]">
                {about.philosophySubtitle}
              </p>
            </HighlightUnfurl>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              {about.pillars.map((pillar) => (
                <DepthStackPanel key={`${pillar.step}-${pillar.title}`}>
                  <article className="flex h-full flex-col justify-between gap-6 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-6 transition-all duration-200 hover:border-[var(--cf-royal)] sm:p-7">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="inline-flex size-10 items-center justify-center rounded-md bg-[var(--cf-royal)] text-[var(--cf-text-on-royal)]">
                          <CmsIcon
                            iconName={pillar.iconName}
                            customIconUrl={pillar.customIconUrl}
                            className="size-5"
                          />
                        </span>
                        <span className="rounded-xs border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] px-2.5 py-1 font-mono text-xs font-semibold text-[var(--cf-text-secondary)]">
                          Pillar {pillar.step}
                        </span>
                      </div>
                      <h3 className="v3-heading-m text-[var(--cf-text-primary)]">
                        {pillar.title}
                      </h3>
                      <p className="v3-body-s leading-relaxed text-[var(--cf-text-secondary)]">
                        {pillar.body}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 border-t border-[var(--cf-border-subtle)] pt-4 text-xs font-semibold text-[var(--cf-royal-text)]">
                      <Sparkles className="size-3.5" />
                      <span>{pillar.footerNote}</span>
                    </div>
                  </article>
                </DepthStackPanel>
              ))}
            </div>

            {/* Flat Architectural Comparison Table */}
            <div className="overflow-hidden rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)]">
              <div className="flex flex-col justify-between gap-2 border-b border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] px-6 py-5 sm:flex-row sm:items-center">
                <div>
                  <p className="v3-label text-[var(--cf-royal-text)] uppercase">
                    {about.comparisonEyebrow}
                  </p>
                  <h3 className="v3-heading-s mt-1 text-[var(--cf-text-primary)]">
                    {about.comparisonTitle}
                  </h3>
                </div>
                <span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-3 py-1 text-xs font-semibold text-[var(--cf-text-primary)]">
                  <Lock className="size-3.5 text-[var(--cf-royal-text)]" />
                  <span>{about.comparisonBadge}</span>
                </span>
              </div>

              <div className="divide-y divide-[var(--cf-border-subtle)]">
                {about.comparisonRows.map((row) => (
                  <div
                    key={row.topic}
                    className="grid grid-cols-1 gap-3 px-6 py-4 md:grid-cols-[12rem_1fr_1fr] md:items-center md:gap-6"
                  >
                    <p className="text-sm font-semibold text-[var(--cf-text-primary)]">
                      {row.topic}
                    </p>
                    <p className="text-xs text-[var(--cf-text-tertiary)] sm:text-sm">
                      {row.generic}
                    </p>
                    <p className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--cf-text-primary)] sm:text-sm">
                      <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-xs bg-[var(--cf-royal)] text-[var(--cf-text-on-royal)]">
                        <Check className="size-3 stroke-[2.5]" />
                      </span>
                      <span>{row.casefolio}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </SectionStackSheet>

      {/* 3. Overlapping Royal Blue CTA Sheet */}
      <SectionStackSheet
        overlapY={40}
        startScale={0.985}
        className="z-30 -mt-8 lg:-mt-12"
      >
        <section className="v3-pattern-dots-dark v3-sheet-royal overflow-hidden rounded-t-[2rem] pt-14 sm:rounded-t-[2.75rem] lg:rounded-t-[3.5rem] lg:pt-20">
          <div className="v3-container flex flex-col items-center pb-16 text-center lg:pb-20">
            <span className="v3-label mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--cf-border-on-royal)] bg-[var(--cf-bg-inverse-elevated)] px-3.5 py-1 text-[var(--cf-bg-accent)] uppercase">
              <span>{about.ctaEyebrow}</span>
            </span>
            <h2 className="v3-display-l max-w-2xl text-[var(--cf-text-inverse)]">
              {about.ctaTitleLead}{" "}
              <span className="v3-sticker-lime">{about.ctaTitleHighlight}</span>?
            </h2>
            <p className="v3-body-l mt-4 max-w-xl text-[var(--cf-text-inverse-muted)]">
              {about.ctaBody}
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
                href="/team"
                className="v3-btn-secondary focus-visible:ring-ring/40 outline-none focus-visible:ring-2"
              >
                <span>Meet the studio team</span>
              </Link>
            </div>
          </div>

          <div aria-hidden="true" className="flex flex-col">
            <div className="h-1.5 w-full bg-[var(--cf-royal)]" />
            <div className="h-2 w-full bg-[var(--cf-bg-accent)]" />
          </div>
        </section>
      </SectionStackSheet>
    </div>
  );
}
