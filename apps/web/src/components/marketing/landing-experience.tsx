"use client";

import {
  ArrowRight,
  ArrowUpRight,
  Download,
  FileImage,
  FileText,
  Globe,
  Layers,
  LayoutGrid,
  Smartphone,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { LandingHeroMotion } from "@/components/marketing/landing-hero-motion";
import {
  LandingHeroVisual,
  V3ShowcaseEditorPreview,
} from "@/components/marketing/landing-hero-visual";
import { LandingPricingSection } from "@/components/marketing/landing-pricing-section";
import { TestCanvasCtaSection } from "@/components/marketing/test-canvas-cta";
import { Button } from "@/components/ui/button";
import { DEFAULT_SITE_CMS_CONTENT, type SiteCmsContent } from "@/lib/cms/schema";
import type {
  LandingPlatformSnapshot,
  LandingPublishedTemplateItem,
} from "@/lib/marketing/landing-stats";
import { cn } from "@/lib/utils";

type PublishChannelKey = "layerat" | "live" | "pdf" | "png";

const PUBLISH_CHANNELS: readonly {
  key: PublishChannelKey;
  label: string;
  spec: string;
  summary: string;
  badge?: string;
}[] = [
  {
    key: "layerat",
    label: "Layerat",
    badge: "Flagship",
    spec: "Full case study -> .zip",
    summary:
      "Export your entire case study cleanly in 1,400px seamless panels ready to upload straight to Layerat.",
  },
  {
    key: "live",
    label: "Live site",
    spec: "casefolio.app/p/...",
    summary:
      "Hosted responsive web URL with custom slugs, optional NDA password lock, and view analytics.",
  },
  {
    key: "pdf",
    label: "PDF",
    spec: "Selectable A4 · .pdf",
    summary:
      "Multi-page A4 case study deck (up to 60 pages) with crisp selectable typography for recruiters and clients.",
  },
  {
    key: "png",
    label: "PNG",
    spec: "1× & 2× Retina · .png",
    summary:
      "Continuous full-length presentation image at 1,440px (1×) or 2,880px (2× Retina) with zero seams.",
  },
];

function stripLeadingSectionNumber(label: string): string {
  return label.replace(/^\d{1,2}\s+/, "").trim();
}

function resolveTemplateHref(
  templates: readonly LandingPublishedTemplateItem[],
  preferredType: "mobile" | "web" | "both",
): string {
  const matched = templates.find((item) => item.type === preferredType);
  if (matched) {
    return `/new?template=${encodeURIComponent(matched.slug)}`;
  }
  return `/templates?type=${preferredType}`;
}

export function LandingExperience({
  snapshot,
  cms = DEFAULT_SITE_CMS_CONTENT.landing,
  cmsPricing = DEFAULT_SITE_CMS_CONTENT.pricing,
}: {
  snapshot: LandingPlatformSnapshot;
  cms?: SiteCmsContent["landing"];
  cmsPricing?: SiteCmsContent["pricing"];
}) {
  const [activeChannel, setActiveChannel] = useState<PublishChannelKey>("layerat");

  const mobileTemplateHref = useMemo(
    () => resolveTemplateHref(snapshot.publishedTemplates, "mobile"),
    [snapshot.publishedTemplates],
  );
  const webTemplateHref = useMemo(
    () => resolveTemplateHref(snapshot.publishedTemplates, "web"),
    [snapshot.publishedTemplates],
  );
  const crossPlatformTemplateHref = useMemo(
    () => resolveTemplateHref(snapshot.publishedTemplates, "both"),
    [snapshot.publishedTemplates],
  );

  const featureCards =
    cms.featureCards.length > 0
      ? cms.featureCards
      : DEFAULT_SITE_CMS_CONTENT.landing.featureCards;

  return (
    <div className="w-full overflow-x-clip">
      {/* Band 1: Acid Lime Hero */}
      <section
        aria-labelledby="hero-heading"
        className="cf-lp-hero-grid border-b border-[var(--cf-lp-dark)] bg-[var(--cf-lp-lime)] text-[var(--cf-lp-on-lime)]"
      >
        <div className="mx-auto max-w-[82rem] px-4 pt-12 pb-16 sm:px-6 sm:pt-16 sm:pb-20 lg:px-8 lg:pt-20 lg:pb-24">
          <LandingHeroMotion
            visual={
              <LandingHeroVisual
                heroImageUrl={cms.heroMockupImageUrl}
                publishedTemplates={snapshot.publishedTemplates}
              />
            }
          >
            <div className="mx-auto max-w-[49rem] text-center">
              <p className="cf-lp-kicker text-[var(--cf-lp-on-lime)] uppercase">
                {cms.heroEyebrowStep || "✦"}{" "}
                {cms.heroEyebrowText || "BUILT FOR PRODUCT STORYTELLERS"}
              </p>

              <h1
                id="hero-heading"
                className="cf-lp-hero-title mt-5 font-normal text-[var(--cf-lp-on-lime)]"
              >
                {cms.heroTitleLead}{" "}
                <span className="italic">{cms.heroTitleHighlight}</span>
                {cms.heroTitleTrail ? ` ${cms.heroTitleTrail}` : ""}
              </h1>

              <p className="mx-auto mt-5 max-w-[36rem] text-[1.0625rem] leading-[1.6] text-[var(--cf-lp-lime-copy)]">
                {cms.heroSubtitle}
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Button
                  asChild
                  size="lg"
                  className="border border-[var(--cf-lp-dark)] bg-[var(--cf-lp-dark)] text-[var(--cf-lp-dark-ink)] shadow-[0_1px_2px_rgba(32,33,29,0.14)] hover:-translate-y-0.5 hover:bg-[var(--cf-lp-dark-elevated)] hover:text-[var(--cf-lp-dark-ink)]"
                >
                  <Link href={cms.primaryCtaHref}>
                    {cms.primaryCtaLabel}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="secondary"
                  size="lg"
                  className="border border-[var(--cf-lp-hero-sec-border)] bg-[var(--cf-lp-hero-sec-bg)] text-[var(--cf-lp-on-lime)] shadow-[0_1px_2px_rgba(32,33,29,0.06)] hover:-translate-y-0.5 hover:border-[var(--cf-lp-dark)] hover:bg-[var(--cf-lp-hero-sec-hover)] hover:text-[var(--cf-lp-on-lime)]"
                >
                  <Link href={cms.secondaryCtaHref}>
                    {cms.secondaryCtaLabel}
                    <ArrowUpRight className="size-4" />
                  </Link>
                </Button>
              </div>

              <p className="mt-4 font-mono text-[0.6875rem] tracking-[0.06em] text-[var(--cf-lp-lime-caption)]">
                Free to start · No credit card required
              </p>
            </div>
          </LandingHeroMotion>
        </div>
      </section>

      {/* Band 2: Warm Cream Trust Bar */}
      <section
        aria-label="Trusted teams"
        className="border-b border-[var(--cf-lp-cream-divider)] bg-[var(--cf-lp-cream)] text-[var(--cf-lp-ink)]"
      >
        <div className="mx-auto flex max-w-[82rem] flex-col items-center justify-between gap-4 px-4 py-8 sm:px-6 lg:flex-row lg:px-8">
          <span className="cf-lp-kicker text-[var(--cf-lp-cream-muted)] uppercase">
            TRUSTED BY DESIGNERS FROM
          </span>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[1rem] font-semibold tracking-[-0.02em] text-[var(--cf-lp-cream-muted)] sm:gap-x-12">
            <span className="font-mono text-[0.875rem] lowercase">linear</span>
            <span className="text-[0.875rem] font-bold tracking-[0.08em] uppercase">
              VERCEL
            </span>
            <span className="font-editorial text-[1.125rem] italic">
              Webflow
            </span>
            <span className="text-[0.875rem] font-bold tracking-[0.14em] uppercase">
              SONOS
            </span>
            <span className="text-[0.9375rem] font-semibold">Intercom</span>
          </div>
        </div>
      </section>

      {/* Band 3: THE BETTER WAY (Deep Charcoal) */}
      <section
        id="features"
        aria-labelledby="better-way-heading"
        className="bg-[var(--cf-lp-dark)] text-[var(--cf-lp-dark-ink)]"
      >
        <div className="mx-auto max-w-[82rem] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <p className="cf-lp-kicker text-[var(--cf-lp-dark-index)] uppercase">
            {stripLeadingSectionNumber(cms.workflowEyebrow)}
          </p>

          <div className="mt-5 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <h2
              id="better-way-heading"
              className="cf-lp-section-title font-normal text-[var(--cf-lp-dark-ink)]"
            >
              {cms.workflowTitleLead}{" "}
              <span className="italic">{cms.workflowTitleHighlight}</span>
              {cms.workflowTitleTrail ? ` ${cms.workflowTitleTrail}` : ""}
            </h2>
            <p className="text-[1rem] leading-[1.65] text-[var(--cf-lp-dark-body)]">
              You’ve already done the hard work. Casefolio gives your thinking a
              clear, considered structure so you can move from finished product
              to finished story—fast.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {featureCards.slice(0, 3).map((card, index) => {
              const Icon =
                index === 0
                  ? LayoutGrid
                  : index === 1
                    ? Smartphone
                    : Download;
              return (
                <article
                  key={card.title}
                  className="flex flex-col justify-between rounded-[0.5rem] border border-[var(--cf-lp-dark-rule)] bg-[var(--cf-lp-dark-elevated)] p-6 sm:p-7"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="inline-flex size-9 items-center justify-center rounded-[0.3125rem] border border-[var(--cf-lp-dark-icon-border)] text-[var(--cf-lp-lime)]">
                        <Icon className="size-4" />
                      </span>
                      <span className="font-mono text-[0.75rem] text-[var(--cf-lp-dark-num)]">
                        0{index + 1}
                      </span>
                    </div>

                    <h3 className="mt-7 font-editorial text-[1.5rem] leading-[1.15] font-normal tracking-[-0.025em] text-[var(--cf-lp-dark-ink)]">
                      {card.title}
                    </h3>
                    <p className="mt-3 text-[0.9375rem] leading-[1.6] text-[var(--cf-lp-dark-body)]">
                      {card.body}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Band 4: TEMPLATES (Warm Cream) */}
      <section
        id="templates"
        aria-labelledby="templates-heading"
        className="border-b border-[var(--cf-lp-cream-divider)] bg-[var(--cf-lp-cream)] text-[var(--cf-lp-ink)]"
      >
        <div className="mx-auto max-w-[82rem] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <p className="cf-lp-kicker text-[var(--cf-lp-cream-muted)] uppercase">
                TEMPLATES
              </p>
              <h2
                id="templates-heading"
                className="cf-lp-section-title mt-4 max-w-[40rem] font-normal text-[var(--cf-lp-ink)]"
              >
                Designed to tell different stories.
              </h2>
              <p className="mt-4 max-w-[34rem] text-[1rem] leading-[1.6] text-[var(--cf-lp-muted)]">
                Start with a system tailored to your project—not a
                one-size-fits-all theme.
              </p>
            </div>

            <Button asChild variant="secondary">
              <Link href="/templates">
                Browse all templates
                <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {/* Template 1: MOBILE */}
            <article className="group flex flex-col justify-between rounded-[0.625rem] border border-[var(--cf-lp-border)] bg-[var(--cf-lp-cream-elevated)] p-5 transition-colors hover:border-[var(--cf-lp-ink)]">
              <div className="rounded-[0.5rem] bg-[var(--cf-lp-cobalt)] p-6 text-[var(--cf-lp-cream-elevated)]">
                <div className="mx-auto max-w-[14rem] rounded-[0.875rem] border border-[var(--cf-lp-cobalt-tile-border)] bg-[var(--cf-lp-cobalt-tile)] p-5">
                  <div className="flex items-center justify-between font-mono text-[0.625rem] tracking-[0.11em] text-[var(--cf-lp-cobalt-tile-ink)] uppercase">
                    <span>SALTO</span>
                    <span>06:42</span>
                  </div>
                  <p className="mt-5 font-editorial text-[1.625rem] leading-[1.06] tracking-[-0.03em] text-[var(--cf-lp-dark-ink)]">
                    Find your
                    <br />
                    next trail.
                  </p>
                  <div className="mt-6 flex items-end justify-between border-t border-[var(--cf-lp-cobalt-tile-border)] pt-3">
                    <div>
                      <p className="font-mono text-[0.5625rem] tracking-[0.11em] text-[var(--cf-lp-cobalt-tile-ink)] uppercase">
                        Elevation
                      </p>
                      <p className="mt-0.5 font-mono text-[0.875rem] font-medium text-[var(--cf-lp-lime)]">
                        1,284 m
                      </p>
                    </div>
                    <span className="rounded-[0.25rem] bg-[var(--cf-lp-lime)] px-2 py-0.5 font-mono text-[0.5625rem] font-medium text-[var(--cf-lp-on-lime)]">
                      iOS
                    </span>
                  </div>
                </div>
              </div>

              <footer className="mt-5 flex items-center justify-between gap-3 pt-1">
                <div>
                  <p className="font-mono text-[0.625rem] tracking-[0.11em] text-[var(--cf-lp-subtle)] uppercase">
                    MOBILE
                  </p>
                  <p className="mt-0.5 font-editorial text-[1.25rem] text-[var(--cf-lp-ink)]">
                    The App Story
                  </p>
                </div>
                <Link
                  href={mobileTemplateHref}
                  aria-label="Open Mobile App Story template"
                  className="inline-flex size-9 items-center justify-center rounded-full border border-[var(--cf-lp-border-strong)] bg-transparent text-[var(--cf-lp-ink)] transition-colors group-hover:border-[var(--cf-lp-ink)] group-hover:bg-[var(--cf-lp-dark)] group-hover:text-[var(--cf-lp-lime)]"
                >
                  <ArrowUpRight className="size-4" />
                </Link>
              </footer>
            </article>

            {/* Template 2: WEB */}
            <article className="group flex flex-col justify-between rounded-[0.625rem] border border-[var(--cf-lp-border)] bg-[var(--cf-lp-cream-elevated)] p-5 transition-colors hover:border-[var(--cf-lp-ink)]">
              <div className="flex min-h-[16.25rem] items-center rounded-[0.5rem] bg-[var(--cf-lp-peach)] p-6 text-[var(--cf-lp-ink)]">
                <div className="w-full rounded-[0.5rem] border border-[var(--cf-lp-ink)] bg-[var(--cf-lp-cream-elevated)] p-5">
                  <div className="flex items-center justify-between border-b border-[var(--cf-lp-cream-divider)] pb-2.5">
                    <span className="font-mono text-[0.625rem] font-medium tracking-[0.11em] text-[var(--cf-lp-terracotta)] uppercase">
                      ARCA / HOME
                    </span>
                    <span className="size-2 rounded-full bg-[var(--cf-lp-terracotta)]" />
                  </div>
                  <h3 className="mt-4 font-editorial text-[1.5rem] leading-[1.08] font-normal tracking-[-0.03em] text-[var(--cf-lp-ink)]">
                    Objects for quiet living.
                  </h3>
                  <div className="mt-5 grid grid-cols-3 gap-2">
                    <div className="h-11 rounded-[0.25rem] bg-[var(--cf-lp-terracotta)]" />
                    <div className="h-11 rounded-[0.25rem] bg-[var(--cf-lp-surface)]" />
                    <div className="h-11 rounded-[0.25rem] bg-[var(--cf-lp-dark)]" />
                  </div>
                </div>
              </div>

              <footer className="mt-5 flex items-center justify-between gap-3 pt-1">
                <div>
                  <p className="font-mono text-[0.625rem] tracking-[0.11em] text-[var(--cf-lp-subtle)] uppercase">
                    WEB
                  </p>
                  <p className="mt-0.5 font-editorial text-[1.25rem] text-[var(--cf-lp-ink)]">
                    The Digital Experience
                  </p>
                </div>
                <Link
                  href={webTemplateHref}
                  aria-label="Open Web Digital Experience template"
                  className="inline-flex size-9 items-center justify-center rounded-full border border-[var(--cf-lp-border-strong)] bg-transparent text-[var(--cf-lp-ink)] transition-colors group-hover:border-[var(--cf-lp-ink)] group-hover:bg-[var(--cf-lp-dark)] group-hover:text-[var(--cf-lp-lime)]"
                >
                  <ArrowUpRight className="size-4" />
                </Link>
              </footer>
            </article>

            {/* Template 3: CROSS-PLATFORM */}
            <article className="group flex flex-col justify-between rounded-[0.625rem] border border-[var(--cf-lp-border)] bg-[var(--cf-lp-cream-elevated)] p-5 transition-colors hover:border-[var(--cf-lp-ink)]">
              <div className="flex min-h-[16.25rem] flex-col justify-between rounded-[0.5rem] border border-[var(--cf-lp-border)] bg-[var(--cf-lp-cream)] p-5">
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex h-12 items-center justify-center rounded-[0.25rem] bg-[var(--cf-lp-lime)] font-editorial text-[1rem] text-[var(--cf-lp-on-lime)]">
                    Aa
                  </div>
                  <div className="flex h-12 items-center justify-center rounded-[0.25rem] bg-[var(--cf-lp-arch-gold)] font-mono text-[0.8125rem] text-[var(--cf-lp-ink)]">
                    ↗
                  </div>
                  <div className="flex h-12 items-center justify-center rounded-[0.25rem] bg-[var(--cf-lp-cream-elevated)] font-mono text-[0.8125rem] text-[var(--cf-lp-ink)]">
                    ◉
                  </div>
                  <div className="flex h-12 items-center justify-center rounded-[0.25rem] bg-[var(--cf-lp-arch-periwinkle)] font-mono text-[0.8125rem] text-[var(--cf-lp-dark)]">
                    #
                  </div>
                  <div className="flex h-12 items-center justify-center rounded-[0.25rem] bg-[var(--cf-lp-cream-elevated)] font-mono text-[0.8125rem] text-[var(--cf-lp-ink)]">
                    12
                  </div>
                  <div className="flex h-12 items-center justify-center rounded-[0.25rem] bg-[var(--cf-lp-terracotta)] font-mono text-[0.8125rem] text-[var(--cf-lp-cream-elevated)]">
                    ⌁
                  </div>
                </div>

                <div className="mt-4 rounded-[0.375rem] bg-[var(--cf-lp-dark)] p-3.5 text-[var(--cf-lp-dark-ink)]">
                  <h3 className="font-mono text-[0.6875rem] font-medium tracking-[0.11em] text-[var(--cf-lp-lime)] uppercase">
                    NORTH / DESIGN SYSTEM
                  </h3>
                  <p className="mt-1 text-[0.75rem] text-[var(--cf-lp-dark-muted)]">
                    Unified tokens &amp; multi-device specs.
                  </p>
                </div>
              </div>

              <footer className="mt-5 flex items-center justify-between gap-3 pt-1">
                <div>
                  <p className="font-mono text-[0.625rem] tracking-[0.11em] text-[var(--cf-lp-subtle)] uppercase">
                    CROSS-PLATFORM
                  </p>
                  <p className="mt-0.5 font-editorial text-[1.25rem] text-[var(--cf-lp-ink)]">
                    The System Story
                  </p>
                </div>
                <Link
                  href={crossPlatformTemplateHref}
                  aria-label="Open Cross-Platform System Story template"
                  className="inline-flex size-9 items-center justify-center rounded-full border border-[var(--cf-lp-border-strong)] bg-transparent text-[var(--cf-lp-ink)] transition-colors group-hover:border-[var(--cf-lp-ink)] group-hover:bg-[var(--cf-lp-dark)] group-hover:text-[var(--cf-lp-lime)]"
                >
                  <ArrowUpRight className="size-4" />
                </Link>
              </footer>
            </article>
          </div>
        </div>
      </section>

      {/* Band 5: 03 ONE STORY, EVERYWHERE (Deep Charcoal) */}
      <section
        aria-labelledby="publish-heading"
        className="bg-[var(--cf-lp-dark)] text-[var(--cf-lp-dark-ink)]"
      >
        <div className="mx-auto grid max-w-[82rem] gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:px-8">
          <div>
            <div
              role="tablist"
              aria-label="Publishing channels"
              className="mb-4 flex flex-wrap items-center gap-2"
            >
              {PUBLISH_CHANNELS.map((channel) => {
                const selected = channel.key === activeChannel;
                return (
                  <button
                    key={channel.key}
                    role="tab"
                    type="button"
                    aria-selected={selected}
                    onClick={() => setActiveChannel(channel.key)}
                    className={cn(
                      "cursor-pointer rounded-[0.3125rem] border px-3.5 py-2 text-[0.8125rem] font-medium transition-colors",
                      selected
                        ? "border-[var(--cf-lp-lime)] bg-[var(--cf-lp-lime)] font-semibold text-[var(--cf-lp-on-lime)]"
                        : "border-[var(--cf-lp-dark-rule)] bg-transparent text-[var(--cf-lp-dark-tab-inactive)] hover:border-[var(--cf-lp-dark-muted)] hover:text-[var(--cf-lp-dark-ink)]",
                    )}
                  >
                    {channel.label}
                  </button>
                );
              })}
            </div>

            <V3ShowcaseEditorPreview activeTab={activeChannel} />
          </div>

          <div>
            <p className="cf-lp-kicker text-[var(--cf-lp-dark-index)] uppercase">
              {stripLeadingSectionNumber(cms.showcaseEyebrow)}
            </p>
            <h2
              id="publish-heading"
              className="cf-lp-section-title mt-4 font-normal text-[var(--cf-lp-dark-ink)]"
            >
              {cms.showcaseTitleHighlight}
              <br />
              {cms.showcaseTitleMiddle} {cms.showcaseTitleTrail}
            </h2>
            <p className="mt-4 max-w-[34rem] text-[1rem] leading-[1.65] text-[var(--cf-lp-dark-body)]">
              Build your narrative once, then export the full case study directly to{" "}
              <strong className="font-semibold text-[var(--cf-lp-dark-ink)]">Layerat</strong> or
              ship to every format below — zero rebuilding, pixel-locked every time.
            </p>

            <div className="mt-7 grid gap-2.5 border-t border-[var(--cf-lp-dark-rule)] pt-6">
              {PUBLISH_CHANNELS.map((channel) => {
                const selected = channel.key === activeChannel;
                return (
                  <button
                    key={channel.key}
                    type="button"
                    onClick={() => setActiveChannel(channel.key)}
                    className={cn(
                      "flex w-full cursor-pointer items-start justify-between gap-3 rounded-[0.5rem] border px-4 py-3 text-left transition-colors",
                      selected
                        ? "border-[var(--cf-lp-lime)] bg-[var(--cf-lp-dark-elevated)]"
                        : "border-[var(--cf-lp-dark-rule)] bg-transparent hover:border-[var(--cf-lp-dark-muted)]",
                    )}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-[0.375rem]",
                          selected
                            ? "bg-[var(--cf-lp-lime)] text-[var(--cf-lp-on-lime)]"
                            : "border border-[var(--cf-lp-dark-rule)] bg-[var(--cf-lp-dark-elevated)] text-[var(--cf-lp-lime)]",
                        )}
                      >
                        {channel.key === "layerat" ? (
                          <Layers className="size-3.5" />
                        ) : channel.key === "pdf" ? (
                          <FileText className="size-3.5" />
                        ) : channel.key === "png" ? (
                          <FileImage className="size-3.5" />
                        ) : (
                          <Globe className="size-3.5" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-[var(--cf-lp-dark-ink)]">
                            {channel.key === "layerat"
                              ? "Full Case Study to Layerat"
                              : channel.label}
                          </span>
                          {channel.badge && (
                            <span className="rounded-full bg-[var(--cf-lp-lime)] px-2 py-0.5 font-mono text-[0.5625rem] font-semibold text-[var(--cf-lp-on-lime)] uppercase">
                              {channel.badge}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-[var(--cf-lp-dark-body)]">
                          {channel.summary}
                        </p>
                      </div>
                    </div>
                    <span className="hidden shrink-0 font-mono text-[0.6875rem] text-[var(--cf-lp-dark-muted)] sm:inline">
                      {channel.spec}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Band 6: MADE WITH CASEFOLIO (Warm Cream) */}
      <section
        id="showcase"
        aria-labelledby="showcase-heading"
        className="border-b border-[var(--cf-lp-cream-divider)] bg-[var(--cf-lp-cream)] text-[var(--cf-lp-ink)]"
      >
        <div className="mx-auto max-w-[82rem] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-[44rem] text-center">
            <p className="cf-lp-kicker text-[var(--cf-lp-cream-muted)] uppercase">
              MADE WITH CASEFOLIO
            </p>
            <h2
              id="showcase-heading"
              className="cf-lp-section-title mt-4 font-normal text-[var(--cf-lp-ink)]"
            >
              Stories worth{" "}
              <br />
              stopping for.
            </h2>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {/* Showcase 1: WAYGO / MOBILITY */}
            <Link
              href={mobileTemplateHref}
              className="group flex flex-col justify-between rounded-[0.625rem] border border-[var(--cf-lp-border)] bg-[var(--cf-lp-cream-elevated)] p-5 transition-colors hover:border-[var(--cf-lp-ink)]"
            >
              <div className="flex min-h-[14rem] flex-col justify-between rounded-[0.5rem] bg-[var(--cf-lp-dark)] p-6 text-[var(--cf-lp-lime)]">
                <span className="font-mono text-[0.625rem] tracking-[0.11em] text-[var(--cf-lp-dark-muted)] uppercase">
                  CASE STUDY · 01
                </span>
                <div className="my-4 font-editorial text-[2rem] leading-[1.02] tracking-[-0.03em] text-[var(--cf-lp-lime)]">
                  Move freely.
                  <br />
                  City-wide pass.
                </div>
                <div className="flex items-center justify-between font-mono text-[0.625rem] text-[var(--cf-lp-dark-ink)]">
                  <span>9 screens</span>
                  <span>iOS + Web</span>
                </div>
              </div>
              <div className="mt-5">
                <p className="font-mono text-[0.625rem] tracking-[0.11em] text-[var(--cf-lp-subtle)] uppercase">
                  WAYGO / MOBILITY
                </p>
                <h3 className="mt-1.5 font-editorial text-[1.5rem] font-normal text-[var(--cf-lp-ink)] group-hover:underline">
                  Moving cities forward.
                </h3>
                <p className="mt-2 font-mono text-[0.625rem] tracking-[0.08em] text-[var(--cf-lp-cream-muted)] uppercase">
                  NADIA K. — PRODUCT DESIGNER
                </p>
              </div>
            </Link>

            {/* Showcase 2: COMMON / COMMUNITY */}
            <Link
              href={webTemplateHref}
              className="group flex flex-col justify-between rounded-[0.625rem] border border-[var(--cf-lp-border)] bg-[var(--cf-lp-cream-elevated)] p-5 transition-colors hover:border-[var(--cf-lp-ink)]"
            >
              <div className="flex min-h-[14rem] flex-col justify-between rounded-[0.5rem] bg-[var(--cf-lp-surface)] p-6 text-[var(--cf-lp-ink)]">
                <div className="grid grid-cols-3 gap-2">
                  <div className="h-14 rounded-[0.25rem] bg-[var(--cf-lp-terracotta)]" />
                  <div className="h-14 rounded-[0.25rem] bg-[var(--cf-lp-lime)]" />
                  <div className="h-14 rounded-[0.25rem] bg-[var(--cf-lp-arch-gold)]" />
                </div>
                <div className="mt-4 rounded-[0.375rem] border border-[var(--cf-lp-ink)] bg-[var(--cf-lp-cream-elevated)] p-3.5">
                  <p className="font-mono text-[0.5625rem] tracking-[0.11em] text-[var(--cf-lp-subtle)] uppercase">
                    MEMBERSHIP FLOW
                  </p>
                  <p className="mt-1 font-editorial text-[1.25rem] text-[var(--cf-lp-ink)]">
                    Shared studios across 14 cities.
                  </p>
                </div>
              </div>
              <div className="mt-5">
                <p className="font-mono text-[0.625rem] tracking-[0.11em] text-[var(--cf-lp-subtle)] uppercase">
                  COMMON / COMMUNITY
                </p>
                <h3 className="mt-1.5 font-editorial text-[1.5rem] font-normal text-[var(--cf-lp-ink)] group-hover:underline">
                  Built to belong.
                </h3>
                <p className="mt-2 font-mono text-[0.625rem] tracking-[0.08em] text-[var(--cf-lp-cream-muted)] uppercase">
                  SAM E. — UX DESIGNER
                </p>
              </div>
            </Link>

            {/* Showcase 3: HEARTH / WELLNESS */}
            <Link
              href={crossPlatformTemplateHref}
              className="group flex flex-col justify-between rounded-[0.625rem] border border-[var(--cf-lp-border)] bg-[var(--cf-lp-cream-elevated)] p-5 transition-colors hover:border-[var(--cf-lp-ink)]"
            >
              <div className="flex min-h-[14rem] flex-col justify-between rounded-[0.5rem] bg-[var(--cf-lp-mauve)] p-6 text-[var(--cf-lp-mauve-ink)]">
                <span className="font-mono text-[0.625rem] tracking-[0.11em] uppercase opacity-75">
                  HABIT STREAKS · 21 DAYS
                </span>
                <div className="rounded-[0.5rem] border border-[var(--cf-lp-ink)] bg-[var(--cf-lp-cream-elevated)] p-4 text-[var(--cf-lp-ink)]">
                  <p className="font-editorial text-[1.375rem] leading-tight">
                    Evening wind-down
                  </p>
                  <div className="mt-3 flex items-center gap-1.5">
                    <span className="h-2 flex-1 rounded-full bg-[var(--cf-lp-dark)]" />
                    <span className="h-2 flex-1 rounded-full bg-[var(--cf-lp-dark)]" />
                    <span className="h-2 flex-1 rounded-full bg-[var(--cf-lp-cobalt)]" />
                    <span className="h-2 flex-1 rounded-full bg-[var(--cf-lp-surface)]" />
                  </div>
                </div>
              </div>
              <div className="mt-5">
                <p className="font-mono text-[0.625rem] tracking-[0.11em] text-[var(--cf-lp-subtle)] uppercase">
                  HEARTH / WELLNESS
                </p>
                <h3 className="mt-1.5 font-editorial text-[1.5rem] font-normal text-[var(--cf-lp-ink)] group-hover:underline">
                  Small rituals. Real change.
                </h3>
                <p className="mt-2 font-mono text-[0.625rem] tracking-[0.08em] text-[var(--cf-lp-cream-muted)] uppercase">
                  OLIVIA M. — PRODUCT DESIGNER
                </p>
              </div>
            </Link>
          </div>

          <div className="mt-10 flex justify-center">
            <Button asChild variant="secondary">
              <Link href="/showcase">
                <span>View all case studies in Showcase</span>
                <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Band 7: Start with your best work — 3 Pricing Packages (Electric Acid Lime) */}
      <section
        aria-labelledby="starter-cta-heading"
        className="border-b border-[var(--cf-lp-ink)] bg-[var(--cf-lp-lime)] text-[var(--cf-lp-on-lime)]"
      >
        <div className="mx-auto max-w-[82rem] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-[44rem] text-center">
            <p className="cf-lp-kicker text-[var(--cf-lp-on-lime)] uppercase">
              ✦ {cms.finalCtaEyebrow}
            </p>
            <h2
              id="starter-cta-heading"
              className="cf-lp-section-title mt-4 font-normal text-[var(--cf-lp-on-lime)]"
            >
              {cms.finalCtaTitleLead}{" "}
              <span className="italic">{cms.finalCtaTitleHighlight}</span>
            </h2>
            <p className="mx-auto mt-4 max-w-[34rem] text-[1rem] leading-[1.6] text-[var(--cf-lp-lime-pricing-copy)]">
              Join thousands of designers telling better product stories without the portfolio
              busywork — start free or pick the plan that matches your studio.
            </p>
          </div>

          <div className="mt-10">
            <LandingPricingSection cmsPricing={cmsPricing} showComparisonLink />
          </div>
        </div>
      </section>

      {/* Band 8: Test the canvas CTA */}
      <TestCanvasCtaSection className="bg-[var(--cf-lp-cream)] py-20 text-[var(--cf-text-primary)] sm:py-28" />
    </div>
  );
}
