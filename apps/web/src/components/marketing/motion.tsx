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
  y = 32,
  start = "top 90%",
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || prefersReducedMotion()) return;
      ensureGsapPluginsRegistered();

      const targets = stagger ? Array.from(el.children) : [el];
      if (targets.length === 0) return;

      gsap.set(targets, { opacity: 0, y, filter: "blur(10px)" });
      gsap.to(targets, {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        duration: 1,
        delay,
        ease: EASE_OUT,
        stagger: stagger ? 0.12 : 0,
        clearProps: "filter,transform,opacity",
        scrollTrigger: { trigger: el, start, once: true },
      });
    },
    { scope: ref },
  );

  return (
    <Tag ref={ref} className={className} style={style}>
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
      const travel = (targets[0]?.offsetHeight ?? 80) * 1.2;
      gsap.set(targets, { y: travel });
      gsap.to(targets, {
        y: 0,
        duration: 1.1,
        delay,
        ease: "expo.out",
        stagger: 0.07,
        ...(onScroll
          ? { scrollTrigger: { trigger: el, start: "top 88%", once: true } }
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
            className="inline-block overflow-hidden pb-[0.14em] align-bottom"
            style={{ marginBottom: "-0.14em" }}
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
        { opacity: 0.16 },
        {
          opacity: 1,
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
    <p ref={ref} aria-label={text} className={className}>
      {words.map((word, index) => (
        <span key={`${word}-${index}`} aria-hidden="true" data-scroll-word="">
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

      const counter = { current: 0 };
      el.textContent = "0";
      gsap.to(counter, {
        current: value,
        duration: 1.6,
        ease: "power2.out",
        onUpdate: () => {
          el.textContent = String(Math.round(counter.current));
        },
        scrollTrigger: { trigger: el, start: "top 92%", once: true },
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
        duration: duration + Math.random(),
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={cn("will-change-transform", className)}>
      {children}
    </div>
  );
}
