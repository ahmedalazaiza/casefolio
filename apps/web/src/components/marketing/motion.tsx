"use client";

import {
  useRef,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";
import {
  ensureGsapPluginsRegistered,
  gsap,
  prefersReducedMotion,
  ScrollTrigger,
  useGSAP,
} from "@/lib/animation/gsap";
import { cn } from "@/lib/utils";

const EASE_OUT = "power3.out";

export interface RevealProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  as?: ElementType;
  /** Animate each direct child instead of the wrapper (staggered). */
  stagger?: boolean;
  delay?: number;
  y?: number;
  /** ScrollTrigger start position. */
  start?: string;
  "data-testid"?: string;
}

/**
 * Scroll-triggered entrance: translate + fade + soft blur.
 * Animates `transform`, `opacity` and `filter` only and respects reduced motion.
 */
export function Reveal({
  children,
  className,
  style,
  as: Tag = "div",
  stagger = false,
  delay = 0,
  y = 22,
  start = "top 92%",
  "data-testid": dataTestId,
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || prefersReducedMotion()) return;
      ensureGsapPluginsRegistered();

      const targets = stagger ? Array.from(el.children) : [el];
      if (targets.length === 0) return;

      gsap.set(targets, { opacity: 0, y });
      gsap.to(targets, {
        opacity: 1,
        y: 0,
        duration: 0.65,
        delay,
        ease: EASE_OUT,
        stagger: stagger ? 0.08 : 0,
        clearProps: "transform,opacity",
        scrollTrigger: { trigger: el, start, once: true },
      });
    },
    { scope: ref },
  );

  return (
    <Tag ref={ref} className={className} style={style} data-testid={dataTestId}>
      {children}
    </Tag>
  );
}

export interface WordRevealProps {
  text: string;
  as?: ElementType;
  className?: string;
  delay?: number;
  /** Play on scroll instead of immediately on mount. */
  onScroll?: boolean;
}

/** Headline that rises word-by-word out of a mask. */
export function WordReveal({
  text,
  as: Tag = "h2",
  className,
  delay = 0,
  onScroll = false,
}: WordRevealProps) {
  const ref = useRef<HTMLElement>(null);
  const words = text.split(" ");

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || prefersReducedMotion()) return;
      ensureGsapPluginsRegistered();

      const targets = el.querySelectorAll<HTMLElement>("[data-word]");
      const travel = onScroll ? 14 : (targets[0]?.offsetHeight ?? 80) * 1.15;
      gsap.set(targets, { y: travel });
      gsap.to(targets, {
        y: 0,
        duration: onScroll ? 0.55 : 1.05,
        delay,
        ease: "expo.out",
        stagger: onScroll ? 0.03 : 0.06,
        clearProps: "transform",
        ...(onScroll
          ? { scrollTrigger: { trigger: el, start: "top 95%", once: true } }
          : {}),
      });
    },
    { scope: ref },
  );

  return (
    <Tag ref={ref} aria-label={text} className={className}>
      {words.map((word, index) => (
        <span key={`${word}-${index}`}>
          <span
            aria-hidden="true"
            className="inline-block overflow-hidden pb-[0.08em] align-bottom"
          >
            <span data-word="" className="inline-block will-change-transform">
              {word}
            </span>
          </span>
          {index < words.length - 1 ? " " : null}
        </span>
      ))}
    </Tag>
  );
}

export interface ScrollWordsProps {
  text: string;
  className?: string;
}

/** Large statement whose words light up while the user scrolls through it. */
export function ScrollWords({ text, className }: ScrollWordsProps) {
  const ref = useRef<HTMLParagraphElement>(null);
  const words = text.split(" ");

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || prefersReducedMotion()) return;
      ensureGsapPluginsRegistered();

      const targets = el.querySelectorAll("[data-scroll-word]");
      gsap.fromTo(
        targets,
        { color: "var(--muted-foreground)" },
        {
          color: "var(--foreground)",
          ease: "none",
          stagger: 0.12,
          scrollTrigger: {
            trigger: el,
            start: "top 78%",
            end: "bottom 46%",
            scrub: 0.6,
          },
        },
      );
    },
    { scope: ref },
  );

  return (
    <p ref={ref} className={className}>
      {words.map((word, index) => (
        <span key={`${word}-${index}`} data-scroll-word="">
          {word}
          {index < words.length - 1 ? " " : null}
        </span>
      ))}
    </p>
  );
}

export interface CountUpProps {
  value: number;
  className?: string;
}

/** Number that counts up once it scrolls into view. Renders the final value without JS. */
export function CountUp({ value, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || prefersReducedMotion()) return;
      ensureGsapPluginsRegistered();

      const counter = { current: Math.max(0, Math.floor(value * 0.35)) };
      ScrollTrigger.create({
        trigger: el,
        start: "top 95%",
        once: true,
        onEnter: () => {
          gsap.to(counter, {
            current: value,
            duration: 0.9,
            ease: "power2.out",
            onUpdate: () => {
              el.textContent = String(Math.round(counter.current));
            },
          });
        },
      });
    },
    { scope: ref, dependencies: [value] },
  );

  return (
    <span ref={ref} className={className}>
      {value}
    </span>
  );
}

export interface ParallaxProps {
  children: ReactNode;
  className?: string;
  /** Vertical travel in px across the viewport pass (negative drifts upward). */
  distance?: number;
  rotate?: number;
}

/** Scroll-scrubbed drift for floating UI cards. */
export function Parallax({
  children,
  className,
  distance = -60,
  rotate = 0,
}: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || prefersReducedMotion()) return;
      ensureGsapPluginsRegistered();

      gsap.fromTo(
        el,
        { y: -distance / 2, rotate: -rotate / 2 },
        {
          y: distance / 2,
          rotate: rotate / 2,
          ease: "none",
          scrollTrigger: {
            trigger: el,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.8,
          },
        },
      );
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={cn("will-change-transform", className)}>
      {children}
    </div>
  );
}

export interface FloatProps {
  children: ReactNode;
  className?: string;
  amplitude?: number;
  duration?: number;
}

/** Gentle endless bob so floating UI cards feel alive. */
export function Float({
  children,
  className,
  amplitude = 10,
  duration = 3.6,
}: FloatProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || prefersReducedMotion()) return;
      ensureGsapPluginsRegistered();

      gsap.to(el, {
        y: amplitude,
        rotate: amplitude / 8,
        duration,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });
    },
    { scope: ref, dependencies: [amplitude, duration] },
  );

  return (
    <div ref={ref} className={cn("will-change-transform", className)}>
      {children}
    </div>
  );
}

export interface SectionIntersectProps {
  children: ReactNode;
  className?: string;
  /** Vertical overlap travel in px scrubbed by ScrollTrigger (positive starts shifted down and settles to 0). */
  overlapY?: number;
  /** Slight starting scale before settling to 1 (safe at opacity 1). */
  startScale?: number;
}

/**
 * Scrubbed section intersection transition: glides a section upward to overlap
 * the previous band as the user scrolls, while preserving full opacity at all times.
 */
export function SectionIntersect({
  children,
  className,
  overlapY = 36,
  startScale = 0.985,
}: SectionIntersectProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || prefersReducedMotion()) return;
      ensureGsapPluginsRegistered();

      gsap.fromTo(
        el,
        { y: overlapY, scale: startScale },
        {
          y: 0,
          scale: 1,
          ease: "none",
          clearProps: "transform",
          scrollTrigger: {
            trigger: el,
            start: "top bottom",
            end: "top 42%",
            scrub: 0.75,
          },
        },
      );
    },
    { scope: ref, dependencies: [overlapY, startScale] },
  );

  return (
    <div ref={ref} className={cn("relative will-change-transform", className)}>
      {children}
    </div>
  );
}

export interface ScrollRiseProps {
  children: ReactNode;
  className?: string;
  stagger?: boolean;
  y?: number;
  start?: string;
  "data-testid"?: string;
}

/**
 * Transform-only scroll entrance: translates elements into place without ever
 * holding content at opacity 0 before scroll.
 */
export function ScrollRise({
  children,
  className,
  stagger = false,
  y = 20,
  start = "top 92%",
  "data-testid": dataTestId,
}: ScrollRiseProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || prefersReducedMotion()) return;
      ensureGsapPluginsRegistered();

      const targets = stagger ? Array.from(el.children) : [el];
      if (targets.length === 0) return;

      gsap.fromTo(
        targets,
        { y },
        {
          y: 0,
          duration: 0.7,
          ease: EASE_OUT,
          stagger: stagger ? 0.08 : 0,
          clearProps: "transform",
          scrollTrigger: { trigger: el, start, once: true },
        },
      );
    },
    { scope: ref, dependencies: [stagger, y, start] },
  );

  return (
    <div ref={ref} className={className} data-testid={dataTestId}>
      {children}
    </div>
  );
}

export interface ScrollConnectorProps {
  className?: string;
}

/** Horizontal progress rail that draws across stepped workflow cards on scroll. */
export function ScrollConnector({ className }: ScrollConnectorProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || prefersReducedMotion()) return;
      ensureGsapPluginsRegistered();

      gsap.fromTo(
        el,
        { scaleX: 0.14 },
        {
          scaleX: 1,
          ease: "none",
          scrollTrigger: {
            trigger: el,
            start: "top 88%",
            end: "top 45%",
            scrub: 0.6,
          },
        },
      );
    },
    { scope: ref },
  );

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn(
        "from-primary/35 via-primary to-primary/45 origin-left rounded-full bg-gradient-to-r will-change-transform",
        className,
      )}
    />
  );
}

/** Sticky navbar scroll progress ribbon (Electric Royal Blue -> Acid Lime). */
export function ScrollProgressBar({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || prefersReducedMotion()) return;
      ensureGsapPluginsRegistered();

      gsap.fromTo(
        el,
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: "none",
          scrollTrigger: {
            trigger: document.documentElement,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.25,
          },
        },
      );
    },
    { scope: ref },
  );

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute right-0 bottom-0 left-0 h-[2.5px] overflow-hidden bg-transparent",
        className,
      )}
    >
      <div
        ref={ref}
        style={{ transform: "scaleX(0)" }}
        className="h-full w-full origin-left bg-gradient-to-r from-[var(--cf-royal)] via-[var(--cf-royal)] to-[var(--cf-bg-accent)] will-change-transform"
      />
    </div>
  );
}

export interface SectionStackSheetProps {
  children: ReactNode;
  className?: string;
  overlapY?: number;
  startScale?: number;
  recedeOnExit?: boolean;
}

/**
 * Architectural overlapping sheet section:
 * Glides upward to physically overlap the preceding band on scroll entrance,
 * and optionally tucks into subtle depth when the next sheet rises over it.
 */
export function SectionStackSheet({
  children,
  className,
  overlapY = 52,
  startScale = 0.972,
  recedeOnExit = false,
}: SectionStackSheetProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || prefersReducedMotion()) return;
      ensureGsapPluginsRegistered();

      gsap.fromTo(
        el,
        { y: overlapY, scale: startScale },
        {
          y: 0,
          scale: 1,
          ease: "none",
          scrollTrigger: {
            trigger: el,
            start: "top bottom",
            end: "top 36%",
            scrub: 0.65,
          },
        },
      );

      if (recedeOnExit) {
        gsap.fromTo(
          el,
          { scale: 1, y: 0 },
          {
            scale: 0.986,
            y: -16,
            ease: "none",
            immediateRender: false,
            scrollTrigger: {
              trigger: el,
              start: "bottom 72%",
              end: "bottom top",
              scrub: 0.65,
            },
          },
        );
      }
    },
    { scope: ref, dependencies: [overlapY, startScale, recedeOnExit] },
  );

  return (
    <div ref={ref} className={cn("relative origin-top will-change-transform", className)}>
      {children}
    </div>
  );
}

/**
 * Choreographs split feature panels so Panel 01 recedes into depth as Panel 02 glides up,
 * while floating inner `[data-panel-media]` artwork in gentle counter-parallax.
 */
export function DepthStackPanel({
  children,
  className,
  recede = false,
}: {
  children: ReactNode;
  className?: string;
  recede?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || prefersReducedMotion()) return;
      ensureGsapPluginsRegistered();

      gsap.fromTo(
        el,
        { y: 38, scale: 0.978 },
        {
          y: 0,
          scale: 1,
          ease: "none",
          scrollTrigger: {
            trigger: el,
            start: "top 95%",
            end: "top 44%",
            scrub: 0.6,
          },
        },
      );

      if (recede) {
        gsap.fromTo(
          el,
          { scale: 1, y: 0 },
          {
            scale: 0.972,
            y: 20,
            ease: "none",
            immediateRender: false,
            scrollTrigger: {
              trigger: el,
              start: "bottom 68%",
              end: "bottom 10%",
              scrub: 0.65,
            },
          },
        );
      }

      const media = el.querySelector<HTMLElement>("[data-panel-media]");
      if (media) {
        gsap.fromTo(
          media,
          { y: 20 },
          {
            y: -14,
            ease: "none",
            scrollTrigger: {
              trigger: el,
              start: "top bottom",
              end: "bottom top",
              scrub: 0.7,
            },
          },
        );
      }
    },
    { scope: ref, dependencies: [recede] },
  );

  return (
    <div ref={ref} className={cn("origin-top will-change-transform", className)}>
      {children}
    </div>
  );
}

/** Animates `.v3-highlight` Acid-Lime stroke width (`--cf-hl-scale`) as a heading scrolls into view. */
export function HighlightUnfurl({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || prefersReducedMotion()) return;
      ensureGsapPluginsRegistered();

      const highlights = el.querySelectorAll<HTMLElement>(".v3-highlight");
      if (highlights.length === 0) return;

      gsap.fromTo(
        highlights,
        { "--cf-hl-scale": 0.32 },
        {
          "--cf-hl-scale": 1,
          ease: "power2.out",
          scrollTrigger: {
            trigger: el,
            start: "top 92%",
            end: "top 56%",
            scrub: 0.5,
          },
        },
      );
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/** Adds scroll-velocity horizontal momentum to the infinite template marquee. */
export function ScrubbedMarqueeBoost({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || prefersReducedMotion()) return;
      ensureGsapPluginsRegistered();

      gsap.fromTo(
        el,
        { x: 28 },
        {
          x: -56,
          ease: "none",
          scrollTrigger: {
            trigger: el,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.7,
          },
        },
      );
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={cn("will-change-transform", className)}>
      {children}
    </div>
  );
}
