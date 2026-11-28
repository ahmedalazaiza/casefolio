import { ArrowRight, Check, Lock, Sparkles, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CmsIcon } from "@/components/cms/cms-icon";
import {
  DepthStackPanel,
  HighlightUnfurl,
  Reveal,
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
      {/* 1. Editorial Serif Hero */}
      <section className="relative z-10 overflow-hidden pt-12 pb-16 sm:pt-16 sm:pb-20 lg:pt-20">
        <div className="v3-container flex flex-col gap-12">
          <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <Eyebrow>{about.eyebrowText}</Eyebrow>

            <h1 className="v3-display-xl mt-5 text-balance text-[var(--cf-text-primary)]">
              {about.heroTitleLead}{" "}
              <span className="v3-sticker-lime">{about.heroTitleHighlight}</span>{" "}
              {about.heroTitleTrail}
            </h1>

            <p className="v3-body-l mt-4 max-w-xl text-pretty text-[var(--cf-text-secondary)]">
              {about.heroSubtitle}
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/templates"
                className="v3-btn-primary focus-visible:ring-ring/40 outline-none focus-visible:ring-2"
              >
                <span>Explore templates</span>
                <ArrowRight className="size-4" />
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

          {/* 4-Card Calm Metric Strip */}
          <Reveal
            stagger
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {about.metrics.map((item, idx) => (
              <div
                key={`${item.label}-${idx}`}
                className="flex flex-col justify-between gap-4 rounded-[0.5625rem] border border-[var(--cf-lp-card-border)] bg-[var(--cf-lp-card)] p-6"
              >
                <span className="inline-flex w-fit rounded-full border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-2.5 py-0.5 font-mono text-xs font-medium text-[var(--cf-text-secondary)]">
                  0{idx + 1}
                </span>
                <div className="flex flex-col gap-1">
                  <p className="font-editorial text-4xl font-normal tracking-tight text-[var(--cf-text-primary)]">
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

      {/* 2. Craft Philosophy & Architectural Pillars */}
      <section className="py-16 sm:py-24">
        <div className="v3-container flex flex-col gap-14">
          <HighlightUnfurl className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <Eyebrow>{about.philosophyEyebrow}</Eyebrow>
            <h2 className="v3-display-l mt-4 text-balance text-[var(--cf-text-primary)]">
              {about.philosophyTitleLead}{" "}
              <span className="v3-highlight">{about.philosophyTitleHighlight}</span>{" "}
              {about.philosophyTitleTrail}
            </h2>
            <p className="v3-body-m mt-4 max-w-xl text-[var(--cf-text-secondary)]">
              {about.philosophySubtitle}
            </p>
          </HighlightUnfurl>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {about.pillars.map((pillar) => (
              <DepthStackPanel key={`${pillar.step}-${pillar.title}`}>
                <article className="flex h-full flex-col justify-between gap-6 rounded-[0.5625rem] border border-[var(--cf-lp-card-border)] bg-[var(--cf-lp-card)] p-7">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex size-10 items-center justify-center rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] text-[var(--cf-text-primary)]">
                        <CmsIcon
                          iconName={pillar.iconName}
                          customIconUrl={pillar.customIconUrl}
                          className="size-5"
                        />
                      </span>
                      <span className="rounded-full border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-2.5 py-0.5 font-mono text-xs font-medium text-[var(--cf-text-secondary)]">
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

                  <div className="flex items-center gap-2 border-t border-[var(--cf-border-subtle)] pt-4 text-xs font-medium text-[var(--cf-text-primary)]">
                    <Sparkles className="size-3.5 text-[var(--cf-text-secondary)]" />
                    <span>{pillar.footerNote}</span>
                  </div>
                </article>
              </DepthStackPanel>
            ))}
          </div>

          {/* Comparison Table */}
          <div className="overflow-hidden rounded-[0.5625rem] border border-[var(--cf-lp-card-border)] bg-[var(--cf-lp-card)]">
            <div className="flex flex-col justify-between gap-2 border-b border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] px-6 py-5 sm:flex-row sm:items-center">
              <div>
                <p className="v3-label text-[var(--cf-text-tertiary)] uppercase">
                  {about.comparisonEyebrow}
                </p>
                <h3 className="v3-heading-s mt-1 text-[var(--cf-text-primary)]">
                  {about.comparisonTitle}
                </h3>
              </div>
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-3 py-1 text-xs font-medium text-[var(--cf-text-primary)]">
                <Lock className="size-3.5 text-[var(--cf-text-secondary)]" />
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
                  <p className="inline-flex items-center gap-2 text-xs font-medium text-[var(--cf-text-primary)] sm:text-sm">
                    <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--cf-lp-action)] text-[var(--cf-lp-on-action)]">
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

      {/* 3. Calm Editorial Final CTA */}
      <section className="py-20 sm:py-28">
        <div className="v3-container flex flex-col items-center text-center">
          <h2 className="v3-display-l max-w-2xl text-[var(--cf-text-primary)]">
            {about.ctaTitleLead}{" "}
            <span className="italic text-[var(--cf-lp-subtle)]">{about.ctaTitleHighlight}</span>?
          </h2>
          <p className="v3-body-m mt-4 max-w-md text-[var(--cf-text-secondary)]">
            {about.ctaBody}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/sign-up"
              className="v3-btn-primary focus-visible:ring-ring/40 py-3.5 px-7 outline-none focus-visible:ring-2"
            >
              <span>Start free</span>
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/team"
              className="v3-btn-secondary focus-visible:ring-ring/40 py-3.5 px-7 outline-none focus-visible:ring-2"
            >
              <span>Meet the studio team</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
