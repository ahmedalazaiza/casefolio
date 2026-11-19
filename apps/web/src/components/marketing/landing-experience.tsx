"use client";

import { ArrowRight, FileDown, Globe, Layers } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { LandingFaqAccordion } from "@/components/marketing/landing-faq-accordion";
import { LandingHeroMotion } from "@/components/marketing/landing-hero-motion";
import {
  LandingHeroVisual,
  V3EditorSlotsPanelMedia,
  V3ShowcaseEditorPreview,
  V3TemplateArtwork,
  V3TemplatesPanelMedia,
} from "@/components/marketing/landing-hero-visual";
import {
  DepthStackPanel,
  HighlightUnfurl,
  Parallax,
  ScrollRise,
  ScrubbedMarqueeBoost,
  SectionStackSheet,
} from "@/components/marketing/motion";
import { TemplateThumbnail } from "@/components/templates/template-thumbnail";
import { Badge, ProBadge } from "@/components/ui/badge";
import type {
  LandingPlatformSnapshot,
  LandingPublishedTemplateItem,
} from "@/lib/marketing/landing-stats";
import {
  V3_FEATURE_CARDS,
  V3_MARQUEE_CARDS,
  V3_SHOWCASE_TABS,
  type V3ShowcaseTabId,
} from "@/lib/marketing/v3-landing-data";
import { cn } from "@/lib/utils";

const FEATURE_CARD_ICONS = [Globe, FileDown, Layers] as const;

function formatLandingTemplateType(type: LandingPublishedTemplateItem["type"]): string {
  if (type === "mobile") return "Mobile app";
  if (type === "web") return "Website";
  return "Mobile + Web";
}

function buildMarqueePublishedCards(
  items: readonly LandingPublishedTemplateItem[],
): LandingPublishedTemplateItem[] {
  if (items.length === 0) return [];
  const repeated: LandingPublishedTemplateItem[] = [];
  while (repeated.length < 4) {
    repeated.push(...items);
  }
  return repeated;
}

export function LandingExperience({
  snapshot,
}: {
  snapshot: LandingPlatformSnapshot;
}) {
  const [activeShowcaseTab, setActiveShowcaseTab] =
    useState<V3ShowcaseTabId>("slots");
  const marqueePublishedCards = buildMarqueePublishedCards(
    snapshot.publishedTemplates ?? [],
  );

  return (
    <div className="relative flex flex-col overflow-x-clip">
      {/* 1. HERO — Architectural Flat Grid + 3-Card Scroll Fan-Out Stage */}
      <section className="v3-pattern-grid relative z-10 overflow-hidden border-b border-[var(--cf-border-subtle)] pt-12 pb-0 sm:pt-16 lg:pt-24">
        <LandingHeroMotion
          visual={
            <LandingHeroVisual publishedTemplates={snapshot.publishedTemplates} />
          }
        >
          <div className="mx-auto flex flex-col items-center text-center">
            <span className="v3-label mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-3.5 py-1.5 text-[var(--cf-text-primary)]">
              <span
                aria-hidden="true"
                className="rounded-full bg-[var(--cf-bg-accent)] px-1.5 py-0.5 text-[0.625rem] leading-none font-bold text-[var(--cf-text-on-accent)]"
              >
                01
              </span>
              <span className="uppercase">Curated Case Study Studio</span>
            </span>

            <h1 className="v3-display-xl max-w-[20ch] text-[var(--cf-text-primary)] lg:max-w-none">
              Turn finished projects into{" "}
              <br className="hidden lg:block" />
              <span className="v3-sticker-lime">publishable</span> case studies
            </h1>

            <p className="v3-body-l mt-5 max-w-[40rem] text-[var(--cf-text-secondary)] lg:mt-6">
              Pick a template made by the Casefolio team, drop in your screens,
              tweak colors and text — then publish a page or export PNG &amp;
              PDF.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:mt-10">
              <Link
                href="/sign-up"
                className="v3-btn-primary focus-visible:ring-ring/40 group outline-none focus-visible:ring-2"
              >
                <span>Start free</span>
                <span
                  aria-hidden="true"
                  className="inline-flex size-5 items-center justify-center rounded-md bg-[var(--cf-bg-accent)] text-[var(--cf-text-on-accent)] transition-transform duration-200 group-hover:translate-x-0.5"
                >
                  <ArrowRight className="size-3.5 stroke-[2.5]" />
                </span>
              </Link>
              <Link
                href="/templates"
                className="v3-btn-secondary focus-visible:ring-ring/40 outline-none focus-visible:ring-2"
              >
                Browse templates
              </Link>
            </div>
          </div>
        </LandingHeroMotion>
      </section>

      {/* 2. OVERLAPPING SHEET 01 — FEATURES & DEPTH-STACKED SPLIT PANELS */}
      <SectionStackSheet
        overlapY={36}
        startScale={0.982}
        recedeOnExit
        className="z-20 -mt-6 lg:-mt-9"
      >
        <section
          id="how-it-works"
          className="v3-sheet-elevated scroll-mt-20 rounded-t-[2rem] border-t border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] pt-16 pb-24 sm:rounded-t-[2.75rem] lg:rounded-t-[3.5rem] lg:pt-28 lg:pb-36"
        >
          <div className="v3-container flex flex-col gap-10 lg:gap-14">
            <HighlightUnfurl className="mx-auto flex flex-col items-center text-center">
              <span className="v3-label mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-3.5 py-1 text-[var(--cf-text-primary)] uppercase">
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-[var(--cf-royal)]"
                />
                <span>Structured Workflow</span>
              </span>
              <h2 className="v3-display-l text-[var(--cf-text-primary)]">
                Built for{" "}
                <br className="sm:hidden" />
                <span className="v3-highlight">case studies</span>{" "}
                <br />
                ready the moment you are
              </h2>
            </HighlightUnfurl>

            {/* Split Panel 01: Templates (Flat Architectural Sheet) */}
            <DepthStackPanel recede>
              <div className="group overflow-hidden rounded-[1.5rem] border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] transition-all duration-300 hover:border-[var(--cf-royal)] hover:shadow-[var(--cf-shadow-hover)] lg:grid lg:min-h-[29rem] lg:grid-cols-2 lg:rounded-[2rem]">
                <div className="flex flex-col items-start justify-between gap-8 border-b border-[var(--cf-border-subtle)] p-6 sm:p-10 lg:border-r lg:border-b-0 lg:p-12">
                  <div className="flex w-full items-center justify-between gap-3">
                    <span className="v3-label inline-flex items-center gap-2 rounded-lg bg-[var(--cf-royal)] px-3 py-1.5 text-[var(--cf-text-on-royal)] uppercase">
                      <span
                        aria-hidden="true"
                        className="font-display font-bold text-[var(--cf-bg-accent)]"
                      >
                        01
                      </span>
                      <span>Templates</span>
                    </span>
                    <span className="font-mono text-xs font-medium tracking-wider text-[var(--cf-text-tertiary)] uppercase">
                      Curated System
                    </span>
                  </div>

                  <div className="flex w-full max-w-[32rem] flex-col items-start gap-5">
                    <div className="flex flex-col gap-3">
                      <h3 className="v3-heading-m text-[var(--cf-text-primary)]">
                        Templates made for case studies
                      </h3>
                      <p className="v3-body-m text-[var(--cf-text-secondary)]">
                        Pick a Mobile, Website or combined layout, designed and
                        versioned by the Casefolio team. Layout and spacing stay
                        intact.
                      </p>
                    </div>

                    <dl className="grid w-full grid-cols-3 divide-x divide-[var(--cf-border-subtle)] border-y border-[var(--cf-border-subtle)] py-3.5">
                      <div className="pr-3">
                        <dt className="font-mono text-[0.6875rem] text-[var(--cf-text-tertiary)] uppercase">
                          Formats
                        </dt>
                        <dd className="v3-body-s-strong mt-0.5 text-[var(--cf-text-primary)]">
                          App · Web
                        </dd>
                      </div>
                      <div className="px-3">
                        <dt className="font-mono text-[0.6875rem] text-[var(--cf-text-tertiary)] uppercase">
                          Spacing
                        </dt>
                        <dd className="v3-body-s-strong mt-0.5 text-[var(--cf-text-primary)]">
                          Grid-locked
                        </dd>
                      </div>
                      <div className="pl-3">
                        <dt className="font-mono text-[0.6875rem] text-[var(--cf-text-tertiary)] uppercase">
                          Updates
                        </dt>
                        <dd className="v3-body-s-strong mt-0.5 text-[var(--cf-text-primary)]">
                          Versioned
                        </dd>
                      </div>
                    </dl>

                    <Link
                      href="/templates"
                      className="v3-btn-primary focus-visible:ring-ring/40 outline-none focus-visible:ring-2"
                    >
                      <span>Browse templates</span>
                      <ArrowRight className="size-4" />
                    </Link>
                  </div>
                </div>

                <V3TemplatesPanelMedia />
              </div>
            </DepthStackPanel>

            {/* Split Panel 02: Editor (Flat Architectural Sheet + Acid-Lime Index) */}
            <DepthStackPanel>
              <div className="group overflow-hidden rounded-[1.5rem] border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] transition-all duration-300 hover:border-[var(--cf-royal)] hover:shadow-[var(--cf-shadow-hover)] lg:grid lg:min-h-[29rem] lg:grid-cols-2 lg:rounded-[2rem]">
                <div className="flex flex-col items-start justify-between gap-8 border-b border-[var(--cf-border-subtle)] p-6 sm:p-10 lg:border-r lg:border-b-0 lg:p-12">
                  <div className="flex w-full items-center justify-between gap-3">
                    <span className="v3-label inline-flex items-center gap-2 rounded-lg bg-[var(--cf-bg-accent)] px-3 py-1.5 text-[var(--cf-text-on-accent)] uppercase">
                      <span
                        aria-hidden="true"
                        className="font-display font-bold"
                      >
                        02
                      </span>
                      <span>Editor</span>
                    </span>
                    <span className="font-mono text-xs font-medium tracking-wider text-[var(--cf-text-tertiary)] uppercase">
                      Constrained Canvas
                    </span>
                  </div>

                  <div className="flex w-full max-w-[32rem] flex-col items-start gap-5">
                    <div className="flex flex-col gap-3">
                      <h3 className="v3-heading-m text-[var(--cf-text-primary)]">
                        Edit only what matters
                      </h3>
                      <p className="v3-body-m text-[var(--cf-text-secondary)]">
                        Drop screens into ratio-locked slots, change text, colors
                        and fonts, then reorder or hide sections.
                      </p>
                    </div>

                    <dl className="grid w-full grid-cols-3 divide-x divide-[var(--cf-border-subtle)] border-y border-[var(--cf-border-subtle)] py-3.5">
                      <div className="pr-3">
                        <dt className="font-mono text-[0.6875rem] text-[var(--cf-text-tertiary)] uppercase">
                          Frames
                        </dt>
                        <dd className="v3-body-s-strong mt-0.5 text-[var(--cf-text-primary)]">
                          Ratio-locked
                        </dd>
                      </div>
                      <div className="px-3">
                        <dt className="font-mono text-[0.6875rem] text-[var(--cf-text-tertiary)] uppercase">
                          Tokens
                        </dt>
                        <dd className="v3-body-s-strong mt-0.5 text-[var(--cf-text-primary)]">
                          AA checked
                        </dd>
                      </div>
                      <div className="pl-3">
                        <dt className="font-mono text-[0.6875rem] text-[var(--cf-text-tertiary)] uppercase">
                          Sections
                        </dt>
                        <dd className="v3-body-s-strong mt-0.5 text-[var(--cf-text-primary)]">
                          Live reorder
                        </dd>
                      </div>
                    </dl>

                    <a
                      href="#details-showcase"
                      className="v3-btn-primary focus-visible:ring-ring/40 outline-none focus-visible:ring-2"
                    >
                      <span>See how it works</span>
                      <ArrowRight className="size-4" />
                    </a>
                  </div>
                </div>

                <V3EditorSlotsPanelMedia />
              </div>
            </DepthStackPanel>

            {/* 3-Column Flat Graphic Bento Feature Grid (White · Electric Royal · Carbon Ink) */}
            <ScrollRise
              stagger
              y={26}
              data-testid="landing-feature-grid"
              className="grid grid-cols-1 gap-5 md:grid-cols-3 lg:gap-6"
            >
              {V3_FEATURE_CARDS.map((card, index) => {
                const Icon =
                  FEATURE_CARD_ICONS[index % FEATURE_CARD_ICONS.length]!;
                const isRoyal = index === 1;
                const isInk = index === 2;
                return (
                  <article
                    key={card.title}
                    className={cn(
                      "group relative flex flex-col justify-between gap-8 overflow-hidden rounded-[1.5rem] border p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-[var(--cf-shadow-hover)] sm:p-8 lg:rounded-[1.75rem]",
                      isRoyal
                        ? "border-[var(--cf-royal)] bg-[var(--cf-royal)] text-[var(--cf-text-on-royal)]"
                        : isInk
                          ? "border-[var(--cf-ink)] bg-[var(--cf-ink)] text-[var(--cf-text-on-ink)]"
                          : "border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] hover:border-[var(--cf-royal)]",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "inline-flex size-11 items-center justify-center rounded-xl",
                          isRoyal || isInk
                            ? "bg-[var(--cf-bg-accent)] text-[var(--cf-text-on-accent)]"
                            : "bg-[var(--cf-royal)] text-[var(--cf-text-on-royal)]",
                        )}
                      >
                        <Icon className="size-5" />
                      </span>
                      <span
                        aria-hidden="true"
                        className={cn(
                          "font-display text-2xl leading-none font-bold",
                          isRoyal || isInk
                            ? "text-[var(--cf-bg-accent)]"
                            : "text-[var(--cf-text-primary)]",
                        )}
                      >
                        0{index + 1}
                      </span>
                    </div>

                    <div className="flex flex-col gap-2.5">
                      <h3
                        className={cn(
                          "v3-heading-s",
                          isRoyal
                            ? "text-[var(--cf-text-on-royal)]"
                            : isInk
                              ? "text-[var(--cf-text-on-ink)]"
                              : "text-[var(--cf-text-primary)]",
                        )}
                      >
                        {card.title}
                      </h3>
                      <p
                        className={cn(
                          "v3-body-m",
                          isRoyal
                            ? "text-[var(--cf-text-on-royal-muted)]"
                            : isInk
                              ? "text-[var(--cf-text-on-ink-muted)]"
                              : "text-[var(--cf-text-secondary)]",
                        )}
                      >
                        {card.body}
                      </p>
                    </div>
                  </article>
                );
              })}
            </ScrollRise>
          </div>
        </section>
      </SectionStackSheet>

      {/* 3. OVERLAPPING SHEET 02 — ELECTRIC ROYAL BLUE & ACID LIME SHOWCASE */}
      <SectionStackSheet
        overlapY={64}
        startScale={0.962}
        recedeOnExit
        className="z-30 -mt-10 lg:-mt-16"
      >
        <section
          id="details-showcase"
          className="v3-pattern-dots-dark v3-sheet-royal scroll-mt-20 rounded-t-[2rem] pt-16 pb-24 sm:rounded-t-[2.75rem] lg:rounded-t-[3.5rem] lg:pt-28 lg:pb-36"
        >
          <div className="v3-container grid grid-cols-1 items-center gap-10 lg:grid-cols-[28.5rem_1fr] lg:gap-16">
            <div className="flex flex-col items-start gap-8 lg:gap-10">
              <div className="flex flex-col items-start gap-4">
                <span className="v3-label inline-flex items-center gap-2 rounded-full border border-[var(--cf-border-on-royal)] bg-[var(--cf-bg-inverse-elevated)] px-3 py-1 text-[var(--cf-bg-accent)] uppercase">
                  <span
                    aria-hidden="true"
                    className="size-1.5 rounded-full bg-[var(--cf-bg-accent)]"
                  />
                  <span>Design System Guardrails</span>
                </span>
                <h2 className="v3-heading-m text-[var(--cf-text-inverse)]">
                  <span className="v3-sticker-lime">Details</span>{" "}
                  <br className="sm:hidden" />
                  that keep every{" "}
                  <br />
                  case study consistent
                </h2>
              </div>

              <div
                role="tablist"
                aria-label="Casefolio consistency details"
                className="flex w-full flex-col gap-2"
              >
                {V3_SHOWCASE_TABS.map((tab, index) => {
                  const isActive = activeShowcaseTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveShowcaseTab(tab.id)}
                      className={cn(
                        "v3-body-l focus-visible:ring-ring/40 flex w-full items-center justify-between gap-4 rounded-xl border px-4 py-4 text-left transition-all duration-200 outline-none focus-visible:ring-2 lg:px-5 lg:py-4.5",
                        isActive
                          ? "border-[var(--cf-bg-accent)] bg-[var(--cf-bg-inverse-elevated)] font-medium text-[var(--cf-text-inverse)]"
                          : "border-[var(--cf-border-inverse)] bg-transparent text-[var(--cf-text-inverse-muted)] hover:border-[var(--cf-text-inverse)]/50 hover:text-[var(--cf-text-inverse)]",
                      )}
                    >
                      <span className="flex items-center gap-3.5">
                        <span
                          aria-hidden="true"
                          className={cn(
                            "font-display text-sm font-bold",
                            isActive
                              ? "text-[var(--cf-bg-accent)]"
                              : "text-[var(--cf-text-inverse-muted)]",
                          )}
                        >
                          0{index + 1}
                        </span>
                        <span>{tab.label}</span>
                      </span>
                      {isActive ? (
                        <span
                          aria-hidden="true"
                          className="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-[var(--cf-bg-accent)] text-[var(--cf-text-on-accent)]"
                        >
                          <ArrowRight className="size-3.5 stroke-[2.5]" />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <Parallax distance={-28} className="w-full">
              <div role="tabpanel">
                <V3ShowcaseEditorPreview activeTab={activeShowcaseTab} />
              </div>
            </Parallax>
          </div>
        </section>
      </SectionStackSheet>

      {/* 4. OVERLAPPING SHEET 03 — NEUTRAL GALLERY FAQ */}
      <SectionStackSheet
        overlapY={54}
        startScale={0.976}
        recedeOnExit
        className="z-40 -mt-10 lg:-mt-16"
      >
        <section
          id="faq"
          className="v3-sheet-elevated scroll-mt-20 rounded-t-[2rem] border-t border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] pt-16 pb-24 sm:rounded-t-[2.75rem] lg:rounded-t-[3.5rem] lg:pt-28 lg:pb-36"
        >
          <div className="v3-container flex flex-col items-start justify-between gap-10 lg:flex-row lg:gap-16">
            <HighlightUnfurl className="flex flex-col items-start gap-6 lg:w-[26.25rem] lg:shrink-0 lg:gap-7">
              <span className="v3-label inline-flex items-center gap-2 rounded-full border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-3.5 py-1 text-[var(--cf-text-primary)] uppercase">
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-[var(--cf-royal)]"
                />
                <span>FAQ · Straight Answers</span>
              </span>
              <h2 className="v3-heading-m text-[var(--cf-text-primary)]">
                Got questions? We have{" "}
                <br />
                <span className="v3-highlight">the answers.</span>
              </h2>

              <Link
                href="/sign-up"
                className="v3-btn-primary focus-visible:ring-ring/40 group outline-none focus-visible:ring-2"
              >
                <span>Start free</span>
                <span
                  aria-hidden="true"
                  className="inline-flex size-5 items-center justify-center rounded-md bg-[var(--cf-bg-accent)] text-[var(--cf-text-on-accent)] transition-transform duration-200 group-hover:translate-x-0.5"
                >
                  <ArrowRight className="size-3.5 stroke-[2.5]" />
                </span>
              </Link>
            </HighlightUnfurl>

            <ScrollRise y={24} className="w-full flex-1">
              <LandingFaqAccordion />
            </ScrollRise>
          </div>
        </section>
      </SectionStackSheet>

      {/* 5. OVERLAPPING SHEET 04 — FINAL CTA + VELOCITY-SCRUBBED MARQUEE + BRAND RIBBON */}
      <SectionStackSheet
        overlapY={50}
        startScale={0.98}
        className="z-50 -mt-10 lg:-mt-16"
      >
        <section
          data-testid="landing-start-cta"
          className="v3-pattern-grid v3-sheet-elevated relative overflow-hidden rounded-t-[2rem] border-t border-[var(--cf-border-subtle)] pt-16 sm:rounded-t-[2.75rem] lg:rounded-t-[3.5rem] lg:pt-28"
        >
          <div className="v3-container flex flex-col items-center text-center">
            <span className="v3-label mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--cf-royal)] px-3.5 py-1 text-[var(--cf-text-on-royal)] uppercase">
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-[var(--cf-bg-accent)]"
              />
              <span>Ready to Ship</span>
            </span>

            <h2 className="v3-display-l text-[var(--cf-text-primary)]">
              Your next case study is{" "}
              <br />
              <span className="v3-sticker-lime mt-1">one template away</span>
            </h2>

            <div className="mt-8">
              <Link
                href="/sign-up"
                className="v3-btn-primary focus-visible:ring-ring/40 group px-6 py-3.5 text-base outline-none focus-visible:ring-2"
              >
                <span>Make it happen</span>
                <span
                  aria-hidden="true"
                  className="inline-flex size-6 items-center justify-center rounded-md bg-[var(--cf-bg-accent)] text-[var(--cf-text-on-accent)] transition-transform duration-200 group-hover:translate-x-0.5"
                >
                  <ArrowRight className="size-4 stroke-[2.5]" />
                </span>
              </Link>
            </div>
          </div>

          {/* Horizontal Velocity-Scrubbed Template Marquee (pt-5 prevents top border/shadow clipping on hover) */}
          <div
            data-testid="landing-template-marquee"
            className="casefolio-marquee mt-8 overflow-hidden pt-5 pb-12 lg:mt-10 lg:pt-6 lg:pb-14"
          >
            <ScrubbedMarqueeBoost>
              <div className="casefolio-marquee-track gap-5 px-3 lg:gap-6">
                {[0, 1].map((loopIndex) =>
                  marqueePublishedCards.length > 0
                    ? marqueePublishedCards.map((tpl, tplIndex) => (
                        <Link
                          key={`${loopIndex}-${tpl.id}-${tplIndex}`}
                          href={`/new?template=${encodeURIComponent(tpl.slug)}`}
                          tabIndex={loopIndex === 1 ? -1 : undefined}
                          aria-hidden={loopIndex === 1 ? true : undefined}
                          className="focus-visible:ring-ring/40 group flex w-[18.5rem] shrink-0 flex-col rounded-[1.25rem] border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-4 transition-all duration-200 outline-none hover:-translate-y-1.5 hover:border-[var(--cf-royal)] hover:shadow-[var(--cf-shadow-hover)] focus-visible:ring-2 sm:w-[23rem] lg:w-[25.25rem] lg:rounded-[1.5rem]"
                        >
                          <div className="h-52 sm:h-64 lg:h-72">
                            <TemplateThumbnail
                              coverUrl={tpl.coverUrl}
                              slug={tpl.slug}
                              name={tpl.name}
                              theme={tpl.theme ?? null}
                              className="size-full rounded-xl border border-[var(--cf-border-subtle)]"
                              imageClassName="group-hover:scale-[1.03]"
                            />
                          </div>

                          <div className="mt-3.5 flex items-center justify-between gap-2">
                            <span className="v3-heading-s truncate text-[var(--cf-text-primary)] transition-colors group-hover:text-[var(--cf-royal-text)]">
                              {tpl.name}
                            </span>
                            <div className="flex shrink-0 items-center gap-1.5">
                              {tpl.tier === "pro" ? (
                                <ProBadge />
                              ) : (
                                <Badge tone="published">Free</Badge>
                              )}
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] px-2.5 py-0.5 font-mono text-xs font-medium text-[var(--cf-text-primary)]">
                                <span
                                  aria-hidden="true"
                                  className="size-1.5 rounded-full bg-[var(--cf-royal)]"
                                />
                                <span>v{tpl.version}</span>
                              </span>
                            </div>
                          </div>

                          <p className="v3-body-s mt-1.5 truncate text-left text-[var(--cf-text-secondary)]">
                            {formatLandingTemplateType(tpl.type)}
                            {tpl.categoryName ? ` · ${tpl.categoryName}` : ""} ·{" "}
                            {tpl.sectionCount} sections · {tpl.slotCount} slots
                          </p>
                        </Link>
                      ))
                    : V3_MARQUEE_CARDS.map((card) => (
                        <Link
                          key={`${loopIndex}-${card.id}`}
                          href={card.href}
                          tabIndex={loopIndex === 1 ? -1 : undefined}
                          aria-hidden={loopIndex === 1 ? true : undefined}
                          className="focus-visible:ring-ring/40 group flex w-[18.5rem] shrink-0 flex-col rounded-[1.25rem] border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-4 transition-all duration-200 outline-none hover:-translate-y-1.5 hover:border-[var(--cf-royal)] hover:shadow-[var(--cf-shadow-hover)] focus-visible:ring-2 sm:w-[23rem] lg:w-[25.25rem] lg:rounded-[1.5rem]"
                        >
                          <div className="h-52 sm:h-64 lg:h-72">
                            <V3TemplateArtwork variant={card.variant} />
                          </div>

                          <div className="mt-3.5 flex items-center justify-between gap-2">
                            <span className="v3-heading-s text-[var(--cf-text-primary)] transition-colors group-hover:text-[var(--cf-royal-text)]">
                              {card.name}
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] px-2.5 py-0.5 font-mono text-xs font-medium text-[var(--cf-text-primary)]">
                              <span
                                aria-hidden="true"
                                className="size-1.5 rounded-full bg-[var(--cf-royal)]"
                              />
                              <span>{card.version}</span>
                            </span>
                          </div>

                          <p className="v3-body-s mt-1.5 text-left text-[var(--cf-text-secondary)]">
                            {card.subtitle}
                          </p>
                        </Link>
                      )),
                )}
              </div>
            </ScrubbedMarqueeBoost>
          </div>

          {/* Dual Electric Royal Blue + Acid Lime Signature Ribbon */}
          <div aria-hidden="true" className="flex flex-col">
            <div className="h-1.5 w-full bg-[var(--cf-royal)]" />
            <div className="h-2 w-full bg-[var(--cf-bg-accent)]" />
          </div>
        </section>
      </SectionStackSheet>
    </div>
  );
}
