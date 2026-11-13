"use client";

import { useRef, type ReactNode } from "react";
import {
  ANIMATION_DELAYS,
  ensureGsapPluginsRegistered,
  fadeUp,
  prefersReducedMotion,
  useGSAP,
} from "@/lib/animation/gsap";

export interface LandingHeroMotionProps {
  children: ReactNode;
  visual: ReactNode;
}

export function LandingHeroMotion({ children, visual }: LandingHeroMotionProps) {
  const scopeRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      ensureGsapPluginsRegistered();
      if (prefersReducedMotion()) {
        return;
      }

      fadeUp("[data-hero-copy]");
      fadeUp("[data-hero-visual]", { delay: ANIMATION_DELAYS.short });
    },
    { scope: scopeRef },
  );

  return (
    <div
      ref={scopeRef}
      className="container-page grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12"
    >
      <div
        data-hero-copy=""
        className="flex min-w-0 flex-col items-start gap-5 text-left sm:gap-6 lg:col-span-5"
      >
        {children}
      </div>
      <div data-hero-visual="" className="min-w-0 w-full lg:col-span-7">
        {visual}
      </div>
    </div>
  );
}
