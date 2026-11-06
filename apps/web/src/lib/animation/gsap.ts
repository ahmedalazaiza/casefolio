import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let pluginsRegistered = false;

/**
 * Registers GSAP client plugins (`useGSAP`, `ScrollTrigger`) at most once.
 * Safe to call in SSR/test environments (no-ops when `window` is undefined).
 */
export function ensureGsapPluginsRegistered(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  if (!pluginsRegistered) {
    gsap.registerPlugin(useGSAP, ScrollTrigger);
    pluginsRegistered = true;
  }
  return true;
}

if (typeof window !== "undefined") {
  ensureGsapPluginsRegistered();
}

export const REDUCED_MOTION_MEDIA_QUERY = "(prefers-reduced-motion: reduce)" as const;

export const ANIMATION_DURATIONS = {
  fast: 0.35,
  base: 0.55,
  slow: 0.75,
} as const;

export const ANIMATION_EASINGS = {
  entrance: "power3.out",
  subtle: "power2.out",
  scale: "back.out(1.2)",
} as const;

export const ANIMATION_DISTANCES = {
  subtleY: 12,
  baseY: 20,
  prominentY: 32,
} as const;

export const ANIMATION_SCALES = {
  subtle: 0.96,
  base: 0.92,
} as const;

export const ANIMATION_STAGGERS = {
  tight: 0.06,
  base: 0.1,
  relaxed: 0.14,
} as const;

export const ANIMATION_DELAYS = {
  none: 0,
  short: 0.08,
  medium: 0.16,
} as const;

export type AnimationDuration = (typeof ANIMATION_DURATIONS)[keyof typeof ANIMATION_DURATIONS];
export type AnimationEasing = (typeof ANIMATION_EASINGS)[keyof typeof ANIMATION_EASINGS];

export const GSAP_PRESETS = {
  fadeUp: {
    opacity: 0,
    y: ANIMATION_DISTANCES.baseY,
    duration: ANIMATION_DURATIONS.base,
    ease: ANIMATION_EASINGS.entrance,
  },
  stagger: {
    opacity: 0,
    y: ANIMATION_DISTANCES.subtleY,
    duration: ANIMATION_DURATIONS.base,
    stagger: ANIMATION_STAGGERS.base,
    ease: ANIMATION_EASINGS.entrance,
  },
  scaleIn: {
    opacity: 0,
    scale: ANIMATION_SCALES.subtle,
    duration: ANIMATION_DURATIONS.fast,
    ease: ANIMATION_EASINGS.subtle,
  },
} as const;

/**
 * Checks whether the user or environment requests reduced motion.
 * Defaults to `true` on the server or when `matchMedia` is unavailable.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return true;
  }
  return window.matchMedia(REDUCED_MOTION_MEDIA_QUERY).matches;
}

export interface BasePresetOptions {
  duration?: number;
  delay?: number;
  ease?: string;
  scrollTrigger?: ScrollTrigger.Vars;
}

export interface FadeUpOptions extends BasePresetOptions {
  y?: number;
}

export interface StaggerOptions extends BasePresetOptions {
  y?: number;
  each?: number;
}

export interface ScaleInOptions extends BasePresetOptions {
  scale?: number;
}

function resetStaticState(targets: gsap.TweenTarget): void {
  gsap.set(targets, {
    opacity: 1,
    y: 0,
    scale: 1,
    clearProps: "transform,opacity",
  });
}

/**
 * Shared `fadeUp` preset: animates `transform` (`translateY`) and `opacity` only.
 * Respects `prefers-reduced-motion: reduce` by leaving targets in their static end state.
 */
export function fadeUp(
  targets: gsap.TweenTarget,
  options?: FadeUpOptions,
): gsap.core.Tween | null {
  if (!ensureGsapPluginsRegistered()) {
    return null;
  }
  if (prefersReducedMotion()) {
    resetStaticState(targets);
    return null;
  }

  return gsap.from(targets, {
    opacity: GSAP_PRESETS.fadeUp.opacity,
    y: options?.y ?? GSAP_PRESETS.fadeUp.y,
    duration: options?.duration ?? GSAP_PRESETS.fadeUp.duration,
    delay: options?.delay ?? ANIMATION_DELAYS.none,
    ease: options?.ease ?? GSAP_PRESETS.fadeUp.ease,
    clearProps: "transform,opacity",
    ...(options?.scrollTrigger ? { scrollTrigger: options.scrollTrigger } : {}),
  });
}

/**
 * Shared `stagger` preset: animates a list of targets with `translateY` and `opacity` only.
 * Respects `prefers-reduced-motion: reduce`.
 */
export function stagger(
  targets: gsap.TweenTarget,
  options?: StaggerOptions,
): gsap.core.Tween | null {
  if (!ensureGsapPluginsRegistered()) {
    return null;
  }
  if (prefersReducedMotion()) {
    resetStaticState(targets);
    return null;
  }

  return gsap.from(targets, {
    opacity: GSAP_PRESETS.stagger.opacity,
    y: options?.y ?? GSAP_PRESETS.stagger.y,
    duration: options?.duration ?? GSAP_PRESETS.stagger.duration,
    delay: options?.delay ?? ANIMATION_DELAYS.none,
    stagger: options?.each ?? GSAP_PRESETS.stagger.stagger,
    ease: options?.ease ?? GSAP_PRESETS.stagger.ease,
    clearProps: "transform,opacity",
    ...(options?.scrollTrigger ? { scrollTrigger: options.scrollTrigger } : {}),
  });
}

/**
 * Shared `scaleIn` preset: animates `scale` and `opacity` only.
 * Respects `prefers-reduced-motion: reduce`.
 */
export function scaleIn(
  targets: gsap.TweenTarget,
  options?: ScaleInOptions,
): gsap.core.Tween | null {
  if (!ensureGsapPluginsRegistered()) {
    return null;
  }
  if (prefersReducedMotion()) {
    resetStaticState(targets);
    return null;
  }

  return gsap.from(targets, {
    opacity: GSAP_PRESETS.scaleIn.opacity,
    scale: options?.scale ?? GSAP_PRESETS.scaleIn.scale,
    duration: options?.duration ?? GSAP_PRESETS.scaleIn.duration,
    delay: options?.delay ?? ANIMATION_DELAYS.none,
    ease: options?.ease ?? GSAP_PRESETS.scaleIn.ease,
    clearProps: "transform,opacity",
    ...(options?.scrollTrigger ? { scrollTrigger: options.scrollTrigger } : {}),
  });
}

export { gsap, ScrollTrigger, useGSAP };

