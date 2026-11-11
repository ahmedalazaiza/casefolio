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
import {
  useRef,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Float, Parallax, Reveal } from "@/components/marketing/motion";
import { TemplateThumbnail } from "@/components/templates/template-thumbnail";
import { Badge, ProBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ensureGsapPluginsRegistered,
  gsap,
  prefersReducedMotion,
  useGSAP,
} from "@/lib/animation/gsap";
import type {
  LandingPlatformSnapshot,
  LandingTemplateShowcaseItem,
} from "@/lib/marketing/landing-stats";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Shared floating UI card chrome                                              */
/* -------------------------------------------------------------------------- */

export function FloatCard({
  className,
  children,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "border-border/60 bg-elevated shadow-float rounded-2xl border p-4 text-left",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function CardLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-muted-foreground type-caption flex items-center gap-1.5">
      {children}
    </p>
  );
}

function formatPlatformLabel(type: "mobile" | "web" | "both"): string {
  if (type === "mobile") return "Mobile app";
  if (type === "web") return "Website";
  return "Mobile + Web";
}

/* -------------------------------------------------------------------------- */
/* Hero floaters                                                               */
/* -------------------------------------------------------------------------- */

export function HeroFloaters({
  snapshot,
}: {
  snapshot: LandingPlatformSnapshot;
}) {
  return (
    <>
      <Parallax
        distance={-36}
        rotate={-3}
        className="pointer-events-none absolute -bottom-5 -left-4 z-20 hidden w-60 lg:block xl:-left-10"
      >
        <Float amplitude={6}>
          <FloatCard>
            <CardLabel>
              <ShieldCheck className="text-success size-3.5" />
              Pre-publish check
            </CardLabel>
            <p className="type-heading-m text-foreground mt-2">6 / 6 ready</p>
            <div className="bg-sunken mt-3 h-1.5 overflow-hidden rounded-full">
              <div className="bg-success h-full w-full rounded-full" />
            </div>
          </FloatCard>
        </Float>
      </Parallax>

      <Parallax
        distance={-32}
        rotate={3}
        className="pointer-events-none absolute top-14 -right-4 z-20 hidden w-60 lg:block xl:-right-10"
      >
        <Float amplitude={7} duration={4.2}>
          <FloatCard>
            <CardLabel>
              <Globe className="text-primary size-3.5" />
              Public page
            </CardLabel>
            <p className="text-foreground type-body-s-strong mt-2 truncate font-mono">
              casefolio.app/p/cinema
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["PNG", "Behance", "A4 PDF"].slice(0, snapshot.exportFormatsCount).map(
                (format) => (
                  <span
                    key={format}
                    className="bg-sunken text-muted-foreground type-caption rounded-full px-2.5 py-0.5"
                  >
                    {format}
                  </span>
                ),
              )}
            </div>
          </FloatCard>
        </Float>
      </Parallax>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Studio Panel & Header primitives (shared by How it works, Editor, Templates) */
/* -------------------------------------------------------------------------- */

function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-surface border-border/60 relative h-72 overflow-hidden rounded-2xl border",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="border-border absolute inset-y-0 left-[22%] border-l border-dashed"
      />
      <span
        aria-hidden="true"
        className="border-border absolute inset-x-0 top-[30%] border-t border-dashed"
      />
      {children}
    </div>
  );
}

function FeatureHead({
  icon,
  stepLabel,
  title,
  description,
}: {
  icon: ReactNode;
  stepLabel?: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="bg-surface border-border/60 text-foreground inline-flex size-11 shrink-0 items-center justify-center rounded-xl border [&_svg]:size-5">
          {icon}
        </span>
        {stepLabel && (
          <span className="bg-sunken text-muted-foreground type-caption rounded-full px-2.5 py-0.5 font-mono">
            {stepLabel}
          </span>
        )}
      </div>
      <h3 className="type-heading-m text-foreground mt-1">{title}</h3>
      <p className="text-muted-foreground type-body-s sm:type-body-m max-w-xs">
        {description}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* How it works — 4 horizontal cards in one single row (Editor card language)  */
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
    headline: ".Cinema — Movie Ticket Booking Experience",
    summary: "End-to-end dark-room booking narrative.",
  };

  return (
    <Reveal
      stagger
      data-testid="how-it-works-stage"
      className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4"
    >
      {/* STEP 01 — Pick a type */}
      <article
        data-testid="how-it-works-step-1"
        className="flex min-w-0 flex-col justify-between gap-7"
      >
        <FeatureHead
          icon={<Smartphone />}
          stepLabel="Step 01"
          title="Pick a type"
          description="Choose Mobile app, Website, or Mobile + Web to lock the right frames and ratios."
        />
        <Panel className="h-64">
          <FloatCard className="absolute top-6 left-1/2 w-[calc(100%-1.5rem)] -translate-x-1/2 -rotate-2 p-3">
            <CardLabel>Project format</CardLabel>
            <ul className="mt-2.5 flex flex-col gap-1.5">
              {[
                {
                  label: "Mobile app",
                  meta: "9:19.5",
                  active: true,
                },
                {
                  label: "Website",
                  meta: "16:10",
                  active: false,
                },
                {
                  label: "Mobile + Web",
                  meta: "Synced",
                  active: false,
                },
              ].map((format) => (
                <li
                  key={format.label}
                  className={cn(
                    "type-caption flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5",
                    format.active
                      ? "bg-inverse text-inverse-foreground font-medium"
                      : "bg-surface text-foreground",
                  )}
                >
                  <span className="truncate">{format.label}</span>
                  <span
                    className={cn(
                      "shrink-0 font-mono",
                      format.active
                        ? "text-inverse-foreground/75"
                        : "text-muted-foreground",
                    )}
                  >
                    {format.meta}
                  </span>
                </li>
              ))}
            </ul>
          </FloatCard>
          <span className="bg-elevated border-border/60 shadow-float type-caption text-foreground absolute bottom-3.5 left-3.5 rounded-full border px-2.5 py-1">
            {snapshot.deviceFramesCount} hardware frames
          </span>
        </Panel>
      </article>

      {/* STEP 02 — Pick a template */}
      <article
        data-testid="how-it-works-step-2"
        className="flex min-w-0 flex-col justify-between gap-7"
      >
        <FeatureHead
          icon={<LayoutTemplate />}
          stepLabel="Step 02"
          title="Pick a template"
          description="Start from a version-pinned template with cover art and pre-built narrative sections."
        />
        <Panel className="h-64">
          <div className="border-border/60 bg-elevated shadow-float absolute top-6 left-1/2 w-[calc(100%-1.5rem)] -translate-x-1/2 rotate-2 overflow-hidden rounded-2xl border p-1.5">
            <TemplateThumbnail
              coverUrl={featuredTemplate.coverSrc}
              slug={featuredTemplate.slug}
              name={featuredTemplate.name}
              alt={`${featuredTemplate.name} step preview`}
              loading="eager"
              className="aspect-16/10 w-full rounded-xl"
            />
            <div className="flex items-center justify-between gap-2 px-2 pt-2 pb-1">
              <span className="text-foreground type-caption truncate font-medium">
                {featuredTemplate.name}
              </span>
              <span className="text-muted-foreground type-caption shrink-0 font-mono">
                {featuredTemplate.sectionCount} sections
              </span>
            </div>
          </div>
          <span className="bg-elevated border-border/60 shadow-float type-caption text-foreground absolute bottom-3.5 left-3.5 rounded-full border px-2.5 py-1">
            {snapshot.publishedTemplatesCount} live templates
          </span>
        </Panel>
      </article>

      {/* STEP 03 — Customize */}
      <article
        data-testid="how-it-works-step-3"
        className="flex min-w-0 flex-col justify-between gap-7"
      >
        <FeatureHead
          icon={<Palette />}
          stepLabel="Step 03"
          title="Customize"
          description="Drop UI screens into ratio-locked slots and switch curated colors and fonts."
        />
        <Panel className="h-64">
          <FloatCard className="absolute top-6 left-1/2 w-[calc(100%-1.5rem)] -translate-x-1/2 -rotate-1 p-3">
            <div className="flex items-center justify-between gap-2">
              <CardLabel>Slots &amp; tokens</CardLabel>
              <span className="bg-success-soft text-foreground type-caption inline-flex items-center gap-1 rounded-full px-2 py-0.5">
                <Check className="text-success size-3 shrink-0" />
                <span>Locked</span>
              </span>
            </div>
            <ul className="mt-2.5 flex flex-col gap-1.5">
              {[
                { name: "Primary", swatch: "bg-primary" },
                { name: "Highlight", swatch: "bg-[var(--tmpl-primary)]" },
                { name: "Surface", swatch: "bg-inverse" },
              ].map((token) => (
                <li
                  key={token.name}
                  className="bg-surface type-caption flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5"
                >
                  <span className="text-foreground flex min-w-0 items-center gap-2 truncate">
                    <span
                      className={cn("size-3.5 shrink-0 rounded-full", token.swatch)}
                    />
                    <span className="truncate">{token.name}</span>
                  </span>
                  <span className="text-muted-foreground shrink-0 font-mono">
                    AA
                  </span>
                </li>
              ))}
            </ul>
          </FloatCard>
          <span className="bg-elevated border-border/60 shadow-float type-caption text-foreground absolute bottom-3.5 left-3.5 rounded-full border px-2.5 py-1">
            {snapshot.totalTemplateSlots} ratio-locked slots
          </span>
        </Panel>
      </article>

      {/* STEP 04 — Publish or export */}
      <article
        data-testid="how-it-works-step-4"
        className="flex min-w-0 flex-col justify-between gap-7"
      >
        <FeatureHead
          icon={<Rocket />}
          stepLabel="Step 04"
          title="Publish or export"
          description="Go live on casefolio.app or export crisp PNG, Behance 1400px, and A4 PDF files."
        />
        <Panel className="h-64">
          <FloatCard className="absolute top-6 left-1/2 w-[calc(100%-1.5rem)] -translate-x-1/2 rotate-2 p-3">
            <CardLabel>
              <Globe className="text-primary size-3.5 shrink-0" />
              <span className="truncate">Live &amp; export ready</span>
            </CardLabel>
            <div className="bg-surface border-border/60 mt-2.5 flex items-center justify-between gap-1.5 rounded-xl border px-2.5 py-1.5">
              <span className="text-foreground type-caption truncate font-mono">
                /p/{featuredTemplate.slug}
              </span>
              <span className="bg-success size-2 shrink-0 rounded-full" />
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1">
              {["PNG", "Behance", "A4 PDF"].map((preset) => (
                <span
                  key={preset}
                  className="bg-sunken text-muted-foreground type-caption rounded-full px-2 py-0.5"
                >
                  {preset}
                </span>
              ))}
            </div>
          </FloatCard>
          <span className="bg-elevated border-border/60 shadow-float type-caption text-foreground absolute bottom-3.5 left-3.5 rounded-full border px-2.5 py-1">
            {snapshot.exportFormatsCount} export formats
          </span>
        </Panel>
      </article>
    </Reveal>
  );
}

/* -------------------------------------------------------------------------- */
/* Why Casefolio — three columns with soft visual panels                       */
/* -------------------------------------------------------------------------- */

const SECTION_ROWS = [
  { label: "Hero", locked: true },
  { label: "Overview", locked: false },
  { label: "Problem", locked: false },
  { label: "Process", locked: false },
  { label: "Key screens", locked: false },
] as const;

export function FeatureColumns({
  snapshot,
}: {
  snapshot: LandingPlatformSnapshot;
}) {
  return (
    <Reveal
      stagger
      className="grid grid-cols-1 gap-x-8 gap-y-16 lg:grid-cols-3"
    >
      <div className="flex flex-col gap-8">
        <FeatureHead
          icon={<ImageIcon />}
          title="Drop screens into slots"
          description={`Ratio-locked slots and ${snapshot.deviceFramesCount} hardware frames keep every screenshot perfectly framed.`}
        />
        <Panel>
          <div className="absolute top-8 left-1/2 w-40 -translate-x-1/2 -rotate-6">
            <div className="bg-inverse border-border-strong shadow-float overflow-hidden rounded-3xl border-4 p-1">
              <img
                src="/landing/orbit-home.svg"
                alt="Orbit wallet screen inside an iPhone 16 Pro frame"
                className="aspect-9/19 w-full rounded-2xl object-cover"
              />
            </div>
          </div>
          <span className="bg-elevated shadow-float type-caption absolute bottom-4 left-4 rounded-full px-3 py-1">
            9:19.5 · iPhone 16 Pro
          </span>
        </Panel>
      </div>

      <div className="flex flex-col gap-8">
        <FeatureHead
          icon={<Palette />}
          title="Your colors and fonts"
          description={`${snapshot.curatedPalettesCount} curated palettes and ${snapshot.curatedFontPairsCount} font pairs, always contrast-checked.`}
        />
        <Panel>
          <FloatCard className="absolute top-10 left-1/2 w-[min(16rem,calc(100%-2rem))] -translate-x-1/2 rotate-3">
            <CardLabel>Theme tokens</CardLabel>
            <ul className="mt-3 flex flex-col gap-2">
              {[
                { name: "Primary", className: "bg-primary" },
                { name: "Accent", className: "bg-[var(--tmpl-secondary)]" },
                { name: "Highlight", className: "bg-[var(--tmpl-primary)]" },
                { name: "Surface", className: "bg-inverse" },
              ].map((token) => (
                <li
                  key={token.name}
                  className="type-caption flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <span className={cn("size-4 rounded-full", token.className)} />
                    {token.name}
                  </span>
                  <span className="text-tertiary font-mono">token</span>
                </li>
              ))}
            </ul>
          </FloatCard>
        </Panel>
      </div>

      <div className="flex flex-col gap-8">
        <FeatureHead
          icon={<Layers />}
          title="Sections your way"
          description={`${snapshot.sectionPresetsCount} narrative presets. Reorder, duplicate, or hide what you do not need.`}
        />
        <Panel>
          <FloatCard className="absolute top-8 left-1/2 w-[min(16rem,calc(100%-2rem))] -translate-x-1/2 -rotate-2 p-3">
            <ul className="flex flex-col gap-1.5">
              {SECTION_ROWS.map((row) => (
                <li
                  key={row.label}
                  className="bg-surface type-caption flex items-center justify-between rounded-xl px-3 py-2"
                >
                  <span>{row.label}</span>
                  {row.locked ? (
                    <Lock className="text-tertiary size-3.5" />
                  ) : (
                    <span className="bg-primary relative h-4 w-7 rounded-full">
                      <span className="bg-primary-foreground absolute top-0.5 right-0.5 size-3 rounded-full" />
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </FloatCard>
        </Panel>
      </div>
    </Reveal>
  );
}

export function FeatureList() {
  const items = [
    {
      icon: <Eye />,
      title: "Live preview",
      description:
        "Switch between 375px and 1440px with the exact renderer used for publish and export.",
    },
    {
      icon: <History />,
      title: "Autosave and versions",
      description:
        "Undo, redo, and autosave while every project stays pinned to its template version.",
    },
    {
      icon: <ShieldCheck />,
      title: "Pre-publish check",
      description:
        "Empty required slots and low-contrast tokens are caught before your page goes public.",
    },
  ] as const;

  return (
    <Reveal
      stagger
      className="border-border/60 mt-24 grid grid-cols-1 gap-x-8 gap-y-10 border-t pt-14 md:grid-cols-3"
    >
      {items.map((item) => (
        <div key={item.title} className="flex gap-4">
          <span className="bg-surface border-border/60 text-foreground inline-flex size-10 shrink-0 items-center justify-center rounded-xl border [&_svg]:size-4.5">
            {item.icon}
          </span>
          <div className="flex flex-col gap-1.5">
            <h3 className="type-heading-s text-foreground">{item.title}</h3>
            <p className="text-muted-foreground type-body-s">
              {item.description}
            </p>
          </div>
        </div>
      ))}
    </Reveal>
  );
}

/* -------------------------------------------------------------------------- */
/* Template showcase — 6 templates (3 per row) using Editor Panel card design  */
/* -------------------------------------------------------------------------- */

export const LANDING_MAX_TEMPLATES = 6;

function formatPlatformIcon(type: "mobile" | "web" | "both"): ReactNode {
  if (type === "mobile") return <Smartphone className="size-3.5 shrink-0" />;
  if (type === "web") return <Globe className="size-3.5 shrink-0" />;
  return <Layers className="size-3.5 shrink-0" />;
}

export function TemplateStack({
  templates,
}: {
  templates: readonly LandingTemplateShowcaseItem[];
}) {
  const visibleTemplates = templates.slice(0, LANDING_MAX_TEMPLATES);

  if (visibleTemplates.length === 0) return null;

  return (
    <Reveal
      stagger
      data-testid="landing-template-showcase"
      className="grid w-full grid-cols-1 gap-x-8 gap-y-14 md:grid-cols-2 lg:grid-cols-3"
    >
      {visibleTemplates.map((template) => (
        <article
          key={template.slug}
          data-stack-card=""
          data-template-slug={template.slug}
          className="group flex min-w-0 flex-col justify-between gap-6"
        >
          <div className="flex min-w-0 flex-col gap-6">
            {/* Editor-style dashed studio Panel with floating thumbnail card */}
            <Panel className="group-hover:border-border-strong h-auto p-5 pb-14 transition-colors duration-300">
              <Link
                href={`/templates?preview=${template.slug}`}
                aria-label={`Preview ${template.name} template`}
                className="border-border/60 bg-elevated shadow-float focus-visible:ring-ring/40 relative z-10 block overflow-hidden rounded-2xl border p-1.5 transition-transform duration-300 outline-none group-hover:-translate-y-1 focus-visible:ring-2"
              >
                <TemplateThumbnail
                  coverUrl={template.coverSrc}
                  slug={template.slug}
                  name={template.name}
                  alt={`${template.name} template preview`}
                  loading="eager"
                  className="aspect-4/3 w-full rounded-xl"
                  imageClassName="group-hover:scale-[1.02]"
                />
              </Link>

              <span className="bg-elevated border-border/60 shadow-float type-caption text-foreground absolute bottom-3.5 left-4 z-20 inline-flex items-center gap-1.5 rounded-full border px-3 py-1">
                {formatPlatformIcon(template.type)}
                <span>{formatPlatformLabel(template.type)}</span>
              </span>

              <div className="absolute right-4 bottom-3.5 z-20">
                {template.tier === "free" ? (
                  <Badge tone="published" withDot={false}>
                    Free
                  </Badge>
                ) : (
                  <ProBadge />
                )}
              </div>
            </Panel>

            {/* Clean editorial header & metadata matching FeatureHead */}
            <div className="flex min-w-0 flex-col gap-2 px-0.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <h3 className="type-heading-m text-foreground truncate">
                    {template.name}
                  </h3>
                  <span className="bg-sunken text-muted-foreground type-caption shrink-0 rounded-full px-2.5 py-0.5">
                    {template.categoryName}
                  </span>
                </div>
                <span className="text-muted-foreground type-caption shrink-0 font-mono">
                  {template.sectionCount}s · {template.slotCount} slots
                </span>
              </div>

              <p className="text-muted-foreground type-body-s line-clamp-2">
                {template.summary}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 px-0.5">
            <Button variant="secondary" size="sm" asChild>
              <Link href={`/templates?preview=${template.slug}`}>
                <Eye className="size-3.5" />
                <span>Preview</span>
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href={`/new?template=${template.slug}`}>
                <span>Use template</span>
                <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        </article>
      ))}
    </Reveal>
  );
}

/* -------------------------------------------------------------------------- */
/* Final CTA stage                                                             */
/* -------------------------------------------------------------------------- */

export function CtaStage({
  snapshot,
  children,
}: {
  snapshot: LandingPlatformSnapshot;
  children: ReactNode;
}) {
  const stageRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const stage = stageRef.current;
      if (!stage || prefersReducedMotion()) return;
      ensureGsapPluginsRegistered();

      gsap.fromTo(
        stage,
        { scale: 0.92, borderRadius: "4rem" },
        {
          scale: 1,
          borderRadius: "2.5rem",
          ease: "none",
          scrollTrigger: {
            trigger: stage,
            start: "top 100%",
            end: "top 45%",
            scrub: 0.8,
          },
        },
      );
    },
    { scope: stageRef },
  );

  const cinema = snapshot.templates[0];

  return (
    <div
      ref={stageRef}
      className="bg-wash-panel relative overflow-hidden rounded-3xl px-5 py-16 text-center sm:rounded-[2.5rem] sm:px-12 sm:py-28 lg:py-40"
    >
      <Parallax
        distance={-70}
        rotate={-6}
        className="absolute -top-2 -left-8 hidden w-60 md:block lg:left-10"
      >
        <Float amplitude={8}>
          <FloatCard className="-rotate-6">
            <CardLabel>Template</CardLabel>
            <p className="text-foreground type-body-s-strong mt-1.5">
              {cinema?.name ?? "Cinema"} · {cinema?.sectionCount ?? 14} sections
            </p>
            <div className="bg-inverse mt-3 overflow-hidden rounded-xl">
              <img
                src={cinema?.coverSrc ?? "/templates/cinema/cover.svg"}
                alt=""
                aria-hidden="true"
                className="aspect-16/10 w-full object-cover"
              />
            </div>
          </FloatCard>
        </Float>
      </Parallax>

      <Parallax
        distance={-100}
        rotate={7}
        className="absolute -top-4 -right-8 hidden w-56 md:block lg:right-10"
      >
        <Float amplitude={10} duration={4.4}>
          <FloatCard className="rotate-6">
            <CardLabel>
              <ShieldCheck className="text-success size-3.5" />
              Pre-publish check
            </CardLabel>
            <p className="type-heading-m text-foreground mt-2">6 / 6 ready</p>
          </FloatCard>
        </Float>
      </Parallax>

      <Parallax
        distance={-60}
        rotate={5}
        className="absolute -bottom-4 -left-6 hidden w-64 md:block lg:left-14"
      >
        <Float amplitude={9} duration={3.9}>
          <FloatCard className="rotate-3">
            <CardLabel>Export</CardLabel>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {["PNG long", "Behance 1400", "A4 PDF"].map((format) => (
                <span
                  key={format}
                  className="bg-sunken text-muted-foreground type-caption rounded-full px-2.5 py-0.5"
                >
                  {format}
                </span>
              ))}
            </div>
          </FloatCard>
        </Float>
      </Parallax>

      <Parallax
        distance={-110}
        rotate={-5}
        className="absolute -right-6 -bottom-6 hidden w-64 md:block lg:right-14"
      >
        <Float amplitude={10} duration={4.8}>
          <FloatCard className="-rotate-3">
            <CardLabel>
              <Globe className="text-primary size-3.5" />
              Public page
            </CardLabel>
            <p className="text-foreground type-body-s-strong mt-2 truncate font-mono">
              casefolio.app/p/you
            </p>
          </FloatCard>
        </Float>
      </Parallax>

      <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center gap-8">
        {children}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Hero device — tilts flat while the page scrolls                             */
/* -------------------------------------------------------------------------- */

export function HeroDevice({
  snapshot,
  children,
}: {
  snapshot: LandingPlatformSnapshot;
  children: ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const wrap = wrapRef.current;
      if (!wrap || prefersReducedMotion()) return;
      ensureGsapPluginsRegistered();

      const device = wrap.querySelector<HTMLElement>("[data-device]");
      if (!device) return;

      const isMobile = window.innerWidth < 768;
      gsap.fromTo(
        device,
        {
          rotateX: isMobile ? 6 : 14,
          scale: isMobile ? 0.97 : 0.92,
          y: isMobile ? 16 : 36,
          transformOrigin: "50% 0%",
        },
        {
          rotateX: 0,
          scale: 1,
          y: 0,
          ease: "none",
          scrollTrigger: {
            trigger: wrap,
            start: "top 92%",
            end: "top 30%",
            scrub: 0.8,
          },
        },
      );
    },
    { scope: wrapRef },
  );

  return (
    <div
      ref={wrapRef}
      className="relative mx-auto w-full max-w-6xl [perspective:1600px]"
    >
      <div
        data-device=""
        className="bg-inverse shadow-overlay rounded-2xl p-1.5 will-change-transform sm:rounded-[1.75rem] sm:p-2.5 lg:rounded-[2rem] lg:p-3"
      >
        <div className="bg-card relative overflow-hidden rounded-xl sm:rounded-2xl lg:rounded-3xl">
          <span
            aria-hidden="true"
            className="bg-border-strong absolute top-2 left-1/2 z-10 hidden size-1.5 -translate-x-1/2 rounded-full sm:block"
          />
          {children}
        </div>
      </div>
      <HeroFloaters snapshot={snapshot} />
    </div>
  );
}
