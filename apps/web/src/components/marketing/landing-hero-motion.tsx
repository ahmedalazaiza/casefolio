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
      className="mx-auto flex max-w-7xl flex-col items-center gap-12 text-center lg:gap-16"
    >
      <div data-hero-copy="" className="flex max-w-3xl flex-col items-center gap-6">
        {children}
      </div>
      <div data-hero-visual="" className="w-full">
        {visual}
      </div>
    </div>
  );
}

