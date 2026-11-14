"use client";

import { useRef, type ReactNode } from "react";
import {
  ANIMATION_DELAYS,
  ANIMATION_EASINGS,
  ensureGsapPluginsRegistered,
  gsap,
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
      const scope = scopeRef.current;
      if (!scope || prefersReducedMotion()) return;
      ensureGsapPluginsRegistered();

      // Crisp LCP-safe kinetic entrance (no post-SSR opacity flash)
      gsap.from("[data-hero-copy]", {
        y: 18,
        duration: 0.55,
        ease: ANIMATION_EASINGS.entrance,
        clearProps: "transform",
      });
      gsap.from("[data-hero-visual]", {
        y: 26,
        scale: 0.985,
        duration: 0.65,
        delay: ANIMATION_DELAYS.short,
        ease: ANIMATION_EASINGS.entrance,
        clearProps: "transform",
      });

      // Tactile scroll fan-out & perspective lift across the 3-card Hero stage
      const leftCard = scope.querySelector<HTMLElement>("[data-hero-card-left]");
      const rightCard = scope.querySelector<HTMLElement>("[data-hero-card-right]");
      const centerCard = scope.querySelector<HTMLElement>("[data-hero-card-center]");
      const copyDrift = scope.querySelector<HTMLElement>("[data-hero-copy-drift]");

      const scrollConfig = {
        trigger: scope,
        start: "top top",
        end: "bottom top",
        scrub: 0.65,
      };

      if (copyDrift) {
        gsap.fromTo(
          copyDrift,
          { y: 0, scale: 1 },
          {
            y: -26,
            scale: 0.985,
            ease: "none",
            immediateRender: false,
            scrollTrigger: scrollConfig,
          },
        );
      }

      if (leftCard) {
        gsap.fromTo(
          leftCard,
          { x: 0, y: 0, rotate: 0 },
          {
            x: -38,
            y: -10,
            rotate: -4,
            ease: "none",
            immediateRender: false,
            scrollTrigger: scrollConfig,
          },
        );
      }

      if (rightCard) {
        gsap.fromTo(
          rightCard,
          { x: 0, y: 0, rotate: 0 },
          {
            x: 38,
            y: -10,
            rotate: 4,
            ease: "none",
            immediateRender: false,
            scrollTrigger: scrollConfig,
          },
        );
      }

      if (centerCard) {
        gsap.set(centerCard, { transformOrigin: "bottom center" });
        gsap.fromTo(
          centerCard,
          { scale: 1 },
          {
            scale: 1.022,
            ease: "none",
            immediateRender: false,
            scrollTrigger: scrollConfig,
          },
        );
      }
    },
    { scope: scopeRef },
  );

  return (
    <div ref={scopeRef} className="relative z-10 flex flex-col gap-10 lg:gap-12">
      <div data-hero-copy="" className="v3-container">
        <div data-hero-copy-drift="" className="will-change-transform">
          {children}
        </div>
      </div>

      <div data-hero-visual="" className="v3-container">
        {visual}
      </div>
    </div>
  );
}
