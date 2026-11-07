"use client";

import {
  ArrowUpRight,
  Check,
  Eye,
  Globe,
  History,
  Image as ImageIcon,
  Layers,
  Lock,
  Palette,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Float, Parallax, Reveal } from "@/components/marketing/motion";
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
/* How it works — cards fan out while scrolling                                */
/* -------------------------------------------------------------------------- */

interface FanCardSpec {
  key: string;
  className: string;
  fromX: number;
  fromY: number;
  fromRotate: number;
  tilt: number;
}

const FAN_CARDS: readonly FanCardSpec[] = [
  {
    key: "template",
    className: "md:left-0 md:top-16 md:w-72",
    fromX: 320,
    fromY: 60,
    fromRotate: 10,
    tilt: -4,
  },
  {
    key: "type",
    className: "md:left-24 md:bottom-0 md:w-64",
    fromX: 300,
    fromY: -40,
    fromRotate: -8,
    tilt: 3,
  },
  {
    key: "slots",
    className: "md:left-1/2 md:top-0 md:-ml-40 md:w-80",
    fromX: 0,
    fromY: 80,
    fromRotate: 0,
    tilt: 0,
  },
  {
    key: "customize",
    className: "md:right-0 md:top-10 md:w-72",
    fromX: -320,
    fromY: 60,
    fromRotate: -10,
    tilt: 4,
  },
  {
    key: "publish",
    className: "md:right-20 md:bottom-2 md:w-72",
    fromX: -300,
    fromY: -40,
    fromRotate: 8,
    tilt: -3,
  },
];

export function HowItWorksStage({
  snapshot,
}: {
  snapshot: LandingPlatformSnapshot;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const cinema = snapshot.templates[0];

  useGSAP(
    () => {
      const stage = stageRef.current;
      if (!stage || prefersReducedMotion()) return;
      ensureGsapPluginsRegistered();

      const mm = gsap.matchMedia();
      mm.add("(min-width: 768px)", () => {
        const cards = gsap.utils.toArray<HTMLElement>("[data-fan-card]");
        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: stage,
            start: "top 88%",
            end: "top 28%",
            scrub: 0.9,
          },
        });

        cards.forEach((card, index) => {
          const spec = FAN_CARDS[index];
          if (!spec) return;
          timeline.from(
            card,
            {
              x: spec.fromX,
              y: spec.fromY,
              rotate: spec.fromRotate,
              scale: 0.78,
              opacity: 0,
              ease: "power3.out",
              duration: 1,
            },
            index * 0.08,
          );
        });
      });

      return () => mm.revert();
    },
    { scope: stageRef },
  );

  const typeRows: readonly { label: string; count: number; icon: ReactNode }[] =
    [
      {
        label: "Mobile app",
        count: snapshot.mobileTemplatesCount,
        icon: <Smartphone className="size-3.5" />,
      },
      {
        label: "Website",
        count: snapshot.webTemplatesCount,
        icon: <Globe className="size-3.5" />,
      },
      {
        label: "Mobile + Web",
        count: snapshot.crossPlatformTemplatesCount,
        icon: <Layers className="size-3.5" />,
      },
    ];

  return (
    <div
      ref={stageRef}
      className="relative mx-auto grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 md:block md:h-[34rem]"
    >
      {/* 02 — Template */}
      <div
        data-fan-card=""
        className={cn("order-2 md:order-none md:absolute", FAN_CARDS[0]?.className)}
      >
        <FloatCard className="p-3 md:-rotate-3">
          <div className="bg-inverse overflow-hidden rounded-xl">
            <img
              src={cinema?.coverSrc ?? "/templates/cinema/cover.svg"}
              alt="Cinema template cover"
              className="aspect-16/10 w-full object-cover"
            />
          </div>
          <div className="flex items-center justify-between gap-2 px-1 pt-3">
            <div className="min-w-0">
              <CardLabel>02 · Pick a template</CardLabel>
              <p className="text-foreground type-body-s-strong mt-0.5 truncate">
                {cinema?.name ?? "Cinema"} · v{cinema?.version ?? "1.0.0"}
              </p>
            </div>
            <span className="bg-sunken text-muted-foreground type-caption shrink-0 rounded-full px-2.5 py-0.5">
              {cinema?.sectionCount ?? 14} sections
            </span>
          </div>
        </FloatCard>
      </div>

      {/* 01 — Type */}
      <div
        data-fan-card=""
        className={cn("order-1 md:order-none md:absolute", FAN_CARDS[1]?.className)}
      >
        <FloatCard className="md:rotate-3">
          <CardLabel>01 · Pick a type</CardLabel>
          <ul className="mt-3 flex flex-col gap-1.5">
            {typeRows.map((row, index) => (
              <li
                key={row.label}
                className={cn(
                  "type-caption flex items-center justify-between rounded-xl px-3 py-2",
                  index === 0
                    ? "bg-inverse text-inverse-foreground"
                    : "bg-surface text-foreground",
                )}
              >
                <span className="flex items-center gap-2">
                  {row.icon}
                  {row.label}
                </span>
                <span className="font-mono">{row.count}</span>
              </li>
            ))}
          </ul>
        </FloatCard>
      </div>

      {/* Slot check — centre stat */}
      <div
        data-fan-card=""
        className={cn(
          "order-3 sm:col-span-2 md:order-none md:col-span-1 md:absolute",
          FAN_CARDS[2]?.className,
        )}
      >
        <FloatCard className="p-5">
          <CardLabel>
            <Check className="text-success size-3.5" />
            Ratio-locked slots
          </CardLabel>
          <p className="type-display-m text-foreground mt-4 sm:mt-6">
            {snapshot.totalTemplateSlots}
          </p>
          <p className="text-muted-foreground type-body-s mt-1">
            screenshot slots across {snapshot.publishedTemplatesCount} live
            templates
          </p>
          <div className="mt-5 flex items-end gap-3 sm:mt-6">
            <div className="bg-primary flex h-20 flex-1 items-end justify-center rounded-t-2xl pb-2 sm:h-24">
              <span className="bg-primary-foreground/80 h-1 w-10 rounded-full" />
            </div>
            <div className="bg-inverse flex h-28 flex-1 items-end justify-center rounded-t-2xl pb-2 sm:h-32">
              <span className="bg-inverse-foreground/80 h-1 w-10 rounded-full" />
            </div>
          </div>
        </FloatCard>
      </div>

      {/* 03 — Customize */}
      <div
        data-fan-card=""
        className={cn("order-4 md:order-none md:absolute", FAN_CARDS[3]?.className)}
      >
        <FloatCard className="md:rotate-3">
          <CardLabel>03 · Customize</CardLabel>
          <div className="mt-3 flex items-center gap-2">
            <span className="size-7 rounded-full bg-[var(--tmpl-secondary)]" />
            <span className="bg-primary size-7 rounded-full" />
            <span className="size-7 rounded-full bg-[var(--tmpl-primary)]" />
            <span className="bg-success size-7 rounded-full" />
            <span className="bg-inverse size-7 rounded-full" />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {["iPhone 16 Pro", "Android", "MacBook"].map((frame) => (
              <span
                key={frame}
                className="bg-sunken text-muted-foreground type-caption rounded-full px-2.5 py-0.5"
              >
                {frame}
              </span>
            ))}
          </div>
          <p className="text-muted-foreground type-caption mt-3">
            {snapshot.deviceFramesCount} frames · {snapshot.curatedPalettesCount}{" "}
            palettes · {snapshot.curatedFontPairsCount} font pairs
          </p>
        </FloatCard>
      </div>

      {/* 04 — Publish */}
      <div
        data-fan-card=""
        className={cn("order-5 md:order-none md:absolute", FAN_CARDS[4]?.className)}
      >
        <FloatCard className="md:-rotate-3">
          <CardLabel>04 · Publish or export</CardLabel>
          <div className="bg-surface text-foreground type-caption mt-3 flex items-center justify-between gap-2 rounded-xl px-3 py-2">
            <span className="flex min-w-0 items-center gap-2 truncate font-mono">
              <Globe className="text-primary size-3.5 shrink-0" />
              <span className="truncate">casefolio.app/p/you</span>
            </span>
            <span className="bg-success-soft text-foreground shrink-0 rounded-full px-2 py-0.5">
              Live
            </span>
          </div>
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
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Why Casefolio — three columns with soft visual panels                       */
/* -------------------------------------------------------------------------- */

function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="bg-surface border-border/60 relative h-72 overflow-hidden rounded-2xl border">
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
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="bg-surface border-border/60 text-foreground inline-flex size-11 items-center justify-center rounded-xl border [&_svg]:size-5">
        {icon}
      </span>
      <h3 className="type-heading-m text-foreground mt-2">{title}</h3>
      <p className="text-muted-foreground type-body-m max-w-xs">
        {description}
      </p>
    </div>
  );
}

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
/* Template stack carousel                                                     */
/* -------------------------------------------------------------------------- */

export function TemplateStack({
  templates,
}: {
  templates: readonly LandingTemplateShowcaseItem[];
}) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(1280);
  const stageRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const firstRun = useRef(true);
  const count = templates.length;

  useEffect(() => {
    const syncViewport = () => {
      setViewportWidth(window.innerWidth);
    };
    syncViewport();
    window.addEventListener("resize", syncViewport, { passive: true });
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  useEffect(() => {
    if (paused || count < 2 || prefersReducedMotion()) return;
    const id = window.setInterval(() => {
      setActive((current) => (current + 1) % count);
    }, 5500);
    return () => window.clearInterval(id);
  }, [paused, count]);

  useGSAP(
    () => {
      const stage = stageRef.current;
      if (!stage || count === 0) return;
      ensureGsapPluginsRegistered();

      const isCompact = viewportWidth < 640;
      const offset = isCompact ? 18 : viewportWidth < 1024 ? 170 : 310;
      const sideScale = isCompact ? 0.94 : 0.88;
      const sideOpacity = isCompact ? 0.32 : 0.85;
      const sideRotate = isCompact ? 2.5 : 6;
      const sideY = isCompact ? 14 : 28;
      const instant = firstRun.current || prefersReducedMotion();
      firstRun.current = false;

      const cards = gsap.utils.toArray<HTMLElement>("[data-stack-card]");
      cards.forEach((card, index) => {
        const rel = (index - active + count) % count;
        const state =
          rel === 0
            ? { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1, zIndex: 30 }
            : rel === 1
              ? {
                  x: offset,
                  y: sideY,
                  rotate: sideRotate,
                  scale: sideScale,
                  opacity: sideOpacity,
                  zIndex: 20,
                }
              : rel === count - 1
                ? {
                    x: -offset,
                    y: sideY,
                    rotate: -sideRotate,
                    scale: sideScale,
                    opacity: sideOpacity,
                    zIndex: 20,
                  }
                : { x: 0, y: 48, rotate: 0, scale: 0.7, opacity: 0, zIndex: 10 };

        gsap.to(card, {
          ...state,
          xPercent: -50,
          duration: instant ? 0 : 0.9,
          ease: "expo.out",
          overwrite: true,
        });
      });
    },
    { scope: stageRef, dependencies: [active, count, viewportWidth] },
  );

  if (count === 0) return null;

  return (
    <div
      className="flex w-full flex-col items-center gap-8 sm:gap-10"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(event) => {
        touchStartX.current = event.touches[0]?.clientX ?? null;
        setPaused(true);
      }}
      onTouchEnd={(event) => {
        const startX = touchStartX.current;
        const endX = event.changedTouches[0]?.clientX ?? null;
        touchStartX.current = null;
        setPaused(false);
        if (startX === null || endX === null || count < 2) return;
        const deltaX = endX - startX;
        if (Math.abs(deltaX) > 40) {
          setActive((current) =>
            deltaX < 0 ? (current + 1) % count : (current - 1 + count) % count,
          );
        }
      }}
    >
      <div
        ref={stageRef}
        className="relative h-[29.5rem] w-full max-w-5xl overflow-x-clip sm:h-[31rem] md:overflow-visible"
      >
        {templates.map((template, index) => {
          const isActive = index === active;
          return (
            <article
              key={template.slug}
              data-stack-card=""
              onClick={() => setActive(index)}
              aria-hidden={isActive ? undefined : true}
              className={cn(
                "border-border/60 bg-elevated shadow-float absolute top-2 left-1/2 w-[min(21.5rem,calc(100%-1rem))] rounded-3xl border p-3 will-change-transform sm:w-[22rem]",
                !isActive && "cursor-pointer",
              )}
            >
              <div className="bg-inverse overflow-hidden rounded-2xl">
                <img
                  src={template.coverSrc}
                  alt={`${template.name} template preview`}
                  className="aspect-4/3 w-full object-cover"
                />
              </div>
              <div className="flex flex-col gap-3 px-2 pt-4 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="type-heading-m text-foreground truncate">
                    {template.name}
                  </h3>
                  <span
                    className={cn(
                      "type-caption shrink-0 rounded-full px-2.5 py-0.5",
                      template.tier === "free"
                        ? "bg-success-soft text-foreground"
                        : "bg-accent text-accent-foreground",
                    )}
                  >
                    {template.tier === "free" ? "Free" : "Pro"}
                  </span>
                </div>
                <p className="text-muted-foreground type-body-s line-clamp-2">
                  {template.summary}
                </p>
                <div className="border-border/60 flex items-center justify-between gap-2 border-t pt-3">
                  <span className="text-tertiary type-caption min-w-0 truncate font-mono">
                    {template.categoryName} · {template.sectionCount} sections ·{" "}
                    {template.slotCount} slots
                  </span>
                  <Link
                    href={`/new?template=${template.slug}`}
                    tabIndex={isActive ? 0 : -1}
                    className="text-foreground type-caption inline-flex shrink-0 items-center gap-1 font-semibold"
                  >
                    <span>Use</span>
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div role="tablist" aria-label="Choose template" className="flex gap-2">
        {templates.map((template, index) => (
          <button
            key={template.slug}
            type="button"
            role="tab"
            aria-selected={index === active}
            aria-label={`Show ${template.name}`}
            onClick={() => setActive(index)}
            className={cn(
              "focus-visible:ring-ring/40 h-2.5 rounded-full outline-none transition-all duration-500 focus-visible:ring-2",
              index === active ? "bg-primary w-14" : "bg-border-strong w-6",
            )}
          />
        ))}
      </div>
    </div>
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
