"use client";

import {
  ArrowUpRight,
  Check,
  Eye,
  Globe,
  History,
  Image as ImageIcon,
  Layers,
  LayoutTemplate,
  Lock,
  Palette,
  Rocket,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { TemplateThumbnail } from "@/components/templates/template-thumbnail";
import { Badge, ProBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  LandingPlatformSnapshot,
  LandingTemplateShowcaseItem,
} from "@/lib/marketing/landing-stats";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Shared flat card surface                                                    */
/* -------------------------------------------------------------------------- */

export function FloatCard({
  className,
  children,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "border-border bg-elevated rounded-xl border p-4 text-left",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function formatPlatformLabel(type: "mobile" | "web" | "both"): string {
  if (type === "mobile") return "Mobile app";
  if (type === "web") return "Website";
  return "Mobile + Web";
}

function formatPlatformIcon(type: "mobile" | "web" | "both"): ReactNode {
  if (type === "mobile") return <Smartphone className="size-3.5 shrink-0" />;
  if (type === "web") return <Globe className="size-3.5 shrink-0" />;
  return <Layers className="size-3.5 shrink-0" />;
}

/* -------------------------------------------------------------------------- */
/* Hero browser/editor frame — flat, un-tilted, zero floating clutter          */
/* -------------------------------------------------------------------------- */

export function HeroDevice({
  snapshot,
  children,
}: {
  snapshot: LandingPlatformSnapshot;
  children: ReactNode;
}) {
  return (
    <div className="border-border bg-elevated shadow-card w-full overflow-hidden rounded-2xl border">
      <div className="border-border bg-surface flex items-center justify-between gap-3 border-b px-3.5 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex shrink-0 items-center gap-1.5" aria-hidden="true">
            <span className="bg-border-strong size-2.5 rounded-full" />
            <span className="bg-border-strong size-2.5 rounded-full" />
            <span className="bg-border-strong size-2.5 rounded-full" />
          </span>
          <span className="border-border bg-elevated text-muted-foreground type-caption flex min-w-0 items-center gap-1.5 rounded-md border px-2.5 py-0.5 font-mono">
            <Globe className="text-primary size-3 shrink-0" />
            <span className="truncate">casefolio.app/editor</span>
          </span>
        </div>

        <span className="bg-accent text-accent-foreground type-caption hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 sm:inline-flex">
          {snapshot.publishedTemplatesCount} templates · {snapshot.deviceFramesCount} mockups
        </span>
      </div>

      <div className="bg-elevated relative overflow-hidden">{children}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* How it works — 4 clean flat horizontal step cards                           */
/* -------------------------------------------------------------------------- */

export function HowItWorksStage({
  snapshot,
}: {
  snapshot: LandingPlatformSnapshot;
}) {
  const featuredTemplate = snapshot.templates[0] ?? {
    slug: "cinema",
    name: "Cinema",
    type: "both" as const,
    categoryName: "Entertainment",
    tier: "free" as const,
    version: "1.0.0",
    sectionCount: 14,
    slotCount: 8,
    coverSrc: "/templates/cinema/cover.svg",
    headline: "Cinema — Mobile Movie Ticket Booking Case Study",
    summary: "Dark-mode ticketing UX narrative.",
  };

  return (
    <div
      data-testid="how-it-works-stage"
      className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
    >
      {/* STEP 01 */}
      <article
        data-testid="how-it-works-step-1"
        className="border-border bg-elevated flex min-w-0 flex-col justify-between gap-6 rounded-2xl border p-5 sm:p-6"
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="bg-accent text-accent-foreground type-caption inline-flex items-center rounded-md px-2.5 py-1 font-mono">
              01
            </span>
            <span className="border-border bg-surface text-foreground inline-flex size-9 shrink-0 items-center justify-center rounded-lg border">
              <Smartphone className="size-4" />
            </span>
          </div>
          <h3 className="type-heading-s text-foreground mt-1">Pick a format</h3>
          <p className="text-muted-foreground type-body-s">
            Select Mobile app, Website, or Mobile + Web so every device frame matches your UI.
          </p>
        </div>

        <div className="border-border bg-surface flex flex-col gap-1.5 rounded-xl border p-3">
          {[
            { label: "Mobile app", meta: "9:19.5", active: true },
            { label: "Website", meta: "16:10", active: false },
            { label: "Mobile + Web", meta: `${snapshot.deviceFramesCount} frames`, active: false },
          ].map((format) => (
            <div
              key={format.label}
              className={cn(
                "type-caption flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5",
                format.active
                  ? "bg-elevated border-border text-foreground border font-medium"
                  : "text-muted-foreground",
              )}
            >
              <span className="truncate">{format.label}</span>
              <span className="shrink-0 font-mono">{format.meta}</span>
            </div>
          ))}
        </div>
      </article>

      {/* STEP 02 */}
      <article
        data-testid="how-it-works-step-2"
        className="border-border bg-elevated flex min-w-0 flex-col justify-between gap-6 rounded-2xl border p-5 sm:p-6"
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="bg-accent text-accent-foreground type-caption inline-flex items-center rounded-md px-2.5 py-1 font-mono">
              02
            </span>
            <span className="border-border bg-surface text-foreground inline-flex size-9 shrink-0 items-center justify-center rounded-lg border">
              <LayoutTemplate className="size-4" />
            </span>
          </div>
          <h3 className="type-heading-s text-foreground mt-1">Choose a template</h3>
          <p className="text-muted-foreground type-body-s">
            Start from a designer-built layout with cover art and guided storytelling blocks.
          </p>
        </div>

        <div className="border-border bg-surface flex flex-col gap-2 rounded-xl border p-2.5">
          <TemplateThumbnail
            coverUrl={featuredTemplate.coverSrc}
            slug={featuredTemplate.slug}
            name={featuredTemplate.name}
            alt={`${featuredTemplate.name} step preview`}
            loading="eager"
            className="aspect-16/10 w-full rounded-lg"
          />
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-foreground type-caption truncate font-medium">
              {featuredTemplate.name}
            </span>
            <span className="text-muted-foreground type-caption shrink-0 font-mono">
              {snapshot.publishedTemplatesCount} templates
            </span>
          </div>
        </div>
      </article>

      {/* STEP 03 */}
      <article
        data-testid="how-it-works-step-3"
        className="border-border bg-elevated flex min-w-0 flex-col justify-between gap-6 rounded-2xl border p-5 sm:p-6"
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="bg-accent text-accent-foreground type-caption inline-flex items-center rounded-md px-2.5 py-1 font-mono">
              03
            </span>
            <span className="border-border bg-surface text-foreground inline-flex size-9 shrink-0 items-center justify-center rounded-lg border">
              <Palette className="size-4" />
            </span>
          </div>
          <h3 className="type-heading-s text-foreground mt-1">Add screens &amp; style</h3>
          <p className="text-muted-foreground type-body-s">
            Drop UI screens into ratio-locked slots and set contrast-checked brand colors and fonts.
          </p>
        </div>

        <div className="border-border bg-surface flex flex-col gap-2 rounded-xl border p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-foreground type-caption">Brand tokens</span>
            <span className="bg-success-soft text-foreground type-caption inline-flex items-center gap-1 rounded-full px-2 py-0.5">
              <Check className="text-success size-3 shrink-0" />
              <span>WCAG AA</span>
            </span>
          </div>
          <div className="border-border bg-elevated flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2">
            <div className="flex items-center gap-1.5">
              <span className="bg-primary size-4 rounded-full" />
              <span className="bg-[var(--tmpl-primary)] size-4 rounded-full" />
              <span className="bg-inverse size-4 rounded-full" />
            </div>
            <span className="text-muted-foreground type-caption font-mono">
              {snapshot.totalTemplateSlots} slots
            </span>
          </div>
        </div>
      </article>

      {/* STEP 04 */}
      <article
        data-testid="how-it-works-step-4"
        className="border-border bg-elevated flex min-w-0 flex-col justify-between gap-6 rounded-2xl border p-5 sm:p-6"
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="bg-accent text-accent-foreground type-caption inline-flex items-center rounded-md px-2.5 py-1 font-mono">
              04
            </span>
            <span className="border-border bg-surface text-foreground inline-flex size-9 shrink-0 items-center justify-center rounded-lg border">
              <Rocket className="size-4" />
            </span>
          </div>
          <h3 className="type-heading-s text-foreground mt-1">Publish or export</h3>
          <p className="text-muted-foreground type-body-s">
            Share an indexed casefolio.app URL or export Behance 1400px, PNG, and A4 PDF files.
          </p>
        </div>

        <div className="border-border bg-surface flex flex-col gap-2 rounded-xl border p-3">
          <div className="border-border bg-elevated flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5">
            <span className="text-foreground type-caption truncate font-mono">
              casefolio.app/p/{featuredTemplate.slug}
            </span>
            <span className="bg-success size-2 shrink-0 rounded-full" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["PNG", "Behance", "A4 PDF"].map((preset) => (
              <span
                key={preset}
                className="border-border bg-elevated text-muted-foreground type-caption rounded-md border px-2 py-0.5"
              >
                {preset}
              </span>
            ))}
          </div>
        </div>
      </article>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Template showcase — 6 clean flat cards (3 per row)                          */
/* -------------------------------------------------------------------------- */

export const LANDING_MAX_TEMPLATES = 6;

export function TemplateStack({
  templates,
}: {
  templates: readonly LandingTemplateShowcaseItem[];
}) {
  const visibleTemplates = templates.slice(0, LANDING_MAX_TEMPLATES);

  if (visibleTemplates.length === 0) return null;

  return (
    <div
      data-testid="landing-template-showcase"
      className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
    >
      {visibleTemplates.map((template) => (
        <article
          key={template.slug}
          data-stack-card=""
          data-template-slug={template.slug}
          className="border-border bg-elevated hover:border-border-strong group flex min-w-0 flex-col justify-between overflow-hidden rounded-2xl border transition-colors duration-200"
        >
          <div className="flex min-w-0 flex-col">
            <Link
              href={`/templates?preview=${template.slug}`}
              aria-label={`Preview ${template.name} template`}
              className="border-border bg-sunken focus-visible:ring-ring/40 relative block overflow-hidden border-b outline-none focus-visible:ring-2"
            >
              <TemplateThumbnail
                coverUrl={template.coverSrc}
                slug={template.slug}
                name={template.name}
                alt={`${template.name} template preview`}
                loading="eager"
                className="aspect-16/10 w-full"
                imageClassName="transition-transform duration-300 group-hover:scale-[1.02]"
              />
            </Link>

            <div className="flex min-w-0 flex-col gap-3 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground type-caption inline-flex min-w-0 items-center gap-1.5">
                  {formatPlatformIcon(template.type)}
                  <span className="truncate">
                    {formatPlatformLabel(template.type)} · {template.categoryName}
                  </span>
                </span>
                {template.tier === "free" ? (
                  <Badge tone="published" withDot={false}>
                    Free
                  </Badge>
                ) : (
                  <ProBadge />
                )}
              </div>

              <div className="flex min-w-0 flex-col gap-1.5">
                <h3 className="type-heading-m text-foreground truncate">
                  {template.name}
                </h3>
                <p className="text-muted-foreground type-body-s line-clamp-2">
                  {template.summary}
                </p>
              </div>
            </div>
          </div>

          <div className="border-border mx-5 mb-5 flex flex-wrap items-center justify-between gap-2 border-t pt-4 sm:mx-6 sm:mb-6">
            <span className="text-muted-foreground type-caption font-mono">
              {template.sectionCount} sections · {template.slotCount} slots
            </span>

            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" asChild>
                <Link href={`/templates?preview=${template.slug}`}>
                  <Eye className="size-3.5" />
                  <span>Preview</span>
                </Link>
              </Button>
              <Button variant="default" size="sm" asChild>
                <Link href={`/new?template=${template.slug}`}>
                  <span>Use template</span>
                  <ArrowUpRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* The Editor — 3 clean flat feature cards + 3-column assurance list           */
/* -------------------------------------------------------------------------- */

const SECTION_ROWS = [
  { label: "Hero", locked: true },
  { label: "Overview", locked: false },
  { label: "Problem & goals", locked: false },
  { label: "Design process", locked: false },
  { label: "Key UI screens", locked: false },
] as const;

export function FeatureColumns({
  snapshot,
}: {
  snapshot: LandingPlatformSnapshot;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Feature 1 */}
      <article className="border-border bg-elevated flex min-w-0 flex-col justify-between gap-6 rounded-2xl border p-6">
        <div className="flex flex-col gap-3">
          <span className="border-border bg-surface text-foreground inline-flex size-10 items-center justify-center rounded-xl border">
            <ImageIcon className="size-5" />
          </span>
          <h3 className="type-heading-m text-foreground">
            Drop screens into exact frames
          </h3>
          <p className="text-muted-foreground type-body-s">
            Ratio-locked placeholders and {snapshot.deviceFramesCount} device mockups keep every screen sharp without manual cropping.
          </p>
        </div>

        <div className="border-border bg-surface flex items-center justify-between gap-4 rounded-xl border p-4">
          <div className="bg-inverse border-border-strong w-24 shrink-0 overflow-hidden rounded-2xl border-2 p-1">
            <img
              src="/landing/orbit-home.svg"
              alt="Orbit wallet screen inside an iPhone 16 Pro frame"
              className="aspect-9/19 w-full rounded-xl object-cover"
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="border-border bg-elevated text-foreground type-caption rounded-lg border px-2.5 py-1.5 font-mono">
              9:19.5 · iPhone 16 Pro
            </span>
            <span className="border-border bg-elevated text-muted-foreground type-caption rounded-lg border px-2.5 py-1.5 font-mono">
              16:10 · MacBook Pro
            </span>
            <span className="text-muted-foreground type-caption px-0.5">
              Zero stretched or clipped pixels
            </span>
          </div>
        </div>
      </article>

      {/* Feature 2 */}
      <article className="border-border bg-elevated flex min-w-0 flex-col justify-between gap-6 rounded-2xl border p-6">
        <div className="flex flex-col gap-3">
          <span className="border-border bg-surface text-foreground inline-flex size-10 items-center justify-center rounded-xl border">
            <Palette className="size-5" />
          </span>
          <h3 className="type-heading-m text-foreground">
            Brand colors and typography
          </h3>
          <p className="text-muted-foreground type-body-s">
            {snapshot.curatedPalettesCount} curated palettes and {snapshot.curatedFontPairsCount} font pairings, automatically checked for readable contrast.
          </p>
        </div>

        <div className="border-border bg-surface flex flex-col gap-2 rounded-xl border p-3.5">
          {[
            { name: "Primary", className: "bg-primary", tag: "AA Pass" },
            { name: "Accent", className: "bg-[var(--tmpl-secondary)]", tag: "AA Pass" },
            { name: "Highlight", className: "bg-[var(--tmpl-primary)]", tag: "AA Pass" },
            { name: "Surface", className: "bg-inverse", tag: "AA Pass" },
          ].map((token) => (
            <div
              key={token.name}
              className="border-border bg-elevated type-caption flex items-center justify-between rounded-lg border px-3 py-2"
            >
              <span className="text-foreground flex items-center gap-2.5">
                <span className={cn("size-3.5 rounded-full", token.className)} />
                <span>{token.name}</span>
              </span>
              <span className="text-muted-foreground font-mono">{token.tag}</span>
            </div>
          ))}
        </div>
      </article>

      {/* Feature 3 */}
      <article className="border-border bg-elevated flex min-w-0 flex-col justify-between gap-6 rounded-2xl border p-6">
        <div className="flex flex-col gap-3">
          <span className="border-border bg-surface text-foreground inline-flex size-10 items-center justify-center rounded-xl border">
            <Layers className="size-5" />
          </span>
          <h3 className="type-heading-m text-foreground">
            Modular narrative sections
          </h3>
          <p className="text-muted-foreground type-body-s">
            {snapshot.sectionPresetsCount} storytelling presets. Reorder, duplicate, or hide sections without breaking your grid.
          </p>
        </div>

        <ul className="border-border bg-surface flex flex-col gap-1.5 rounded-xl border p-3.5">
          {SECTION_ROWS.map((row) => (
            <li
              key={row.label}
              className="border-border bg-elevated type-caption flex items-center justify-between rounded-lg border px-3 py-2"
            >
              <span className="text-foreground">{row.label}</span>
              {row.locked ? (
                <span className="text-muted-foreground inline-flex items-center gap-1 font-mono">
                  <Lock className="size-3" />
                  <span>Pinned</span>
                </span>
              ) : (
                <span className="bg-primary relative h-4 w-7 rounded-full">
                  <span className="bg-primary-foreground absolute top-0.5 right-0.5 size-3 rounded-full" />
                </span>
              )}
            </li>
          ))}
        </ul>
      </article>
    </div>
  );
}

export function FeatureList() {
  const items = [
    {
      icon: <Eye />,
      title: "Responsive live preview",
      description:
        "Switch between 375px mobile and 1440px desktop using the exact engine that powers your published page and exports.",
    },
    {
      icon: <History />,
      title: "Autosave and version safety",
      description:
        "Edit with instant undo, redo, and autosave while your case study stays pinned to a stable template layout.",
    },
    {
      icon: <ShieldCheck />,
      title: "Automatic pre-publish checks",
      description:
        "Missing required screens and low-contrast color combinations are flagged before you publish or share.",
    },
  ] as const;

  return (
    <div className="border-border mt-12 grid grid-cols-1 gap-8 border-t pt-10 md:grid-cols-3">
      {items.map((item) => (
        <div key={item.title} className="flex gap-3.5">
          <span className="border-border bg-surface text-foreground inline-flex size-9 shrink-0 items-center justify-center rounded-lg border [&_svg]:size-4">
            {item.icon}
          </span>
          <div className="flex flex-col gap-1">
            <h3 className="type-heading-s text-foreground">{item.title}</h3>
            <p className="text-muted-foreground type-body-s">
              {item.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Clean CTA container (flat, zero floating parallax stickers)                 */
/* -------------------------------------------------------------------------- */

export function CtaStage({
  children,
}: {
  snapshot?: LandingPlatformSnapshot;
  children: ReactNode;
}) {
  return (
    <div className="border-border bg-elevated shadow-card overflow-hidden rounded-2xl border p-6 sm:rounded-3xl sm:p-10 lg:p-12">
      {children}
    </div>
  );
}
