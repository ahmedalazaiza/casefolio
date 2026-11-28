import { ArrowRight, ArrowUpRight, Layers } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { TestCanvasCtaSection } from "@/components/marketing/test-canvas-cta";
import { TemplateThumbnail } from "@/components/templates/template-thumbnail";
import { CasefolioMark } from "@/components/ui/brand-logo";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getLandingPlatformSnapshot } from "@/lib/marketing/landing-stats";

export const metadata: Metadata = {
  title: "Showcase — Made with Casefolio",
  description:
    "Explore featured mobile, web, and cross-platform product case studies and curated templates built with Casefolio.",
  alternates: {
    canonical: "/showcase",
  },
};

export default async function ShowcasePage() {
  const snapshot = await getLandingPlatformSnapshot();

  const mobileTemplateHref = (() => {
    const match = snapshot.publishedTemplates.find((t) => t.type === "mobile");
    return match ? `/new?template=${encodeURIComponent(match.slug)}` : "/templates?type=mobile";
  })();
  const webTemplateHref = (() => {
    const match = snapshot.publishedTemplates.find((t) => t.type === "web");
    return match ? `/new?template=${encodeURIComponent(match.slug)}` : "/templates?type=web";
  })();
  const crossPlatformTemplateHref = (() => {
    const match = snapshot.publishedTemplates.find((t) => t.type === "both");
    return match ? `/new?template=${encodeURIComponent(match.slug)}` : "/templates?type=both";
  })();

  return (
    <div className="relative flex flex-col overflow-x-clip bg-[var(--cf-bg-canvas)] text-[var(--cf-text-primary)]">
      {/* 1. Editorial Hero */}
      <section className="border-b border-[var(--cf-lp-cream-divider)] pt-12 pb-12 sm:pt-16 sm:pb-16 lg:pt-20">
        <div className="v3-container mx-auto flex max-w-4xl flex-col items-center text-center">
          <Eyebrow icon={<CasefolioMark className="size-3.5" />}>Made with Casefolio</Eyebrow>
          <h1 className="v3-display-xl mt-5 text-balance text-[var(--cf-text-primary)]">
            Stories worth{" "}
            <br />
            <span className="italic">stopping for.</span>
          </h1>
          <p className="v3-body-l mt-4 max-w-2xl text-pretty text-[var(--cf-text-secondary)]">
            See how product designers package mobile journeys, web launches, and design systems into
            focused, publishable narratives.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/sign-up">
                <span>Start creating free</span>
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/templates">
                <span>Browse templates</span>
                <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* 2. Featured Case Studies Grid */}
      <section
        aria-labelledby="featured-showcase-heading"
        className="border-b border-[var(--cf-lp-cream-divider)] bg-[var(--cf-lp-cream)] py-14 text-[var(--cf-lp-ink)] sm:py-20"
      >
        <div className="v3-container flex flex-col gap-10">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="cf-lp-kicker text-[var(--cf-lp-cream-muted)] uppercase">
                FEATURED STORIES
              </p>
              <h2
                id="featured-showcase-heading"
                className="cf-lp-section-title mt-3 font-normal text-[var(--cf-lp-ink)]"
              >
                Built to read like a product launch.
              </h2>
            </div>
            <Link
              href="/templates"
              className="v3-btn-secondary py-2.5 px-4 text-xs"
            >
              <Layers className="size-3.5" />
              <span>View starter templates</span>
            </Link>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Showcase 1: WAYGO / MOBILITY */}
            <Link
              href={mobileTemplateHref}
              className="group flex flex-col justify-between rounded-[0.625rem] border border-[var(--cf-lp-border)] bg-[var(--cf-lp-cream-elevated)] p-5 transition-colors hover:border-[var(--cf-lp-ink)]"
            >
              <div className="flex min-h-[14rem] flex-col justify-between rounded-[0.5rem] bg-[var(--cf-lp-dark)] p-6 text-[var(--cf-lp-lime)]">
                <span className="font-mono text-[0.625rem] tracking-[0.11em] text-[var(--cf-lp-dark-muted)] uppercase">
                  MOBILE APP CASE STUDY
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
        </div>
      </section>

      {/* 3. Studio Template Layouts In Action */}
      <section
        aria-labelledby="showcase-templates-heading"
        className="border-b border-[var(--cf-lp-cream-divider)] py-14 sm:py-20"
      >
        <div className="v3-container flex flex-col gap-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div className="flex flex-col gap-2">
              <Eyebrow>Curated Layouts</Eyebrow>
              <h2
                id="showcase-templates-heading"
                className="v3-display-l text-[var(--cf-text-primary)]"
              >
                Explore published studio foundations
              </h2>
              <p className="v3-body-m max-w-2xl text-[var(--cf-text-secondary)]">
                Every template pairs ratio-locked device screens with structured narrative
                sections ready for live links, PNG packs, and PDF exports.
              </p>
            </div>
            <Link href="/templates" className="v3-btn-secondary py-2.5 px-4 text-xs">
              <span>All templates</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {snapshot.templates.slice(0, 6).map((item) => {
              const typeLabel =
                item.type === "mobile"
                  ? "Mobile app"
                  : item.type === "web"
                    ? "Website"
                    : "Mobile + Web";
              return (
                <article
                  key={item.slug}
                  className="group flex flex-col justify-between gap-4 rounded-[0.625rem] border border-[var(--cf-lp-card-border)] bg-[var(--cf-lp-card)] p-5 transition-colors hover:border-[var(--cf-lp-ink)]"
                >
                  <div className="flex flex-col gap-4">
                    <div className="relative aspect-[16/10] overflow-hidden rounded-[0.5rem] border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)]">
                      <TemplateThumbnail
                        coverUrl={item.coverSrc}
                        alt={`${item.name} showcase preview`}
                        slug={item.slug}
                        name={item.name}
                        className="h-full w-full"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2 text-[0.6875rem] font-medium text-[var(--cf-text-secondary)]">
                        <span className="font-mono uppercase">{item.categoryName}</span>
                        <span>{typeLabel}</span>
                      </div>
                      <h3 className="font-editorial text-[1.375rem] font-normal text-[var(--cf-text-primary)]">
                        {item.name}
                      </h3>
                      <p className="v3-body-s line-clamp-2 text-[var(--cf-text-secondary)]">
                        {item.summary}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-[var(--cf-border-subtle)] pt-3.5 text-xs text-[var(--cf-text-secondary)]">
                    <span className="font-mono">
                      {item.sectionCount} sections · {item.slotCount} slots
                    </span>
                    <Link
                      href={`/new?template=${encodeURIComponent(item.slug)}`}
                      className="inline-flex items-center gap-1 font-semibold text-[var(--cf-text-primary)] hover:underline"
                    >
                      <span>Use layout</span>
                      <ArrowUpRight className="size-3.5" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <TestCanvasCtaSection />
    </div>
  );
}
