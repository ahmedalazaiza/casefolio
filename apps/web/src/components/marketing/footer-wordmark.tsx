"use client";

import { useRef } from "react";
import { CasefolioLockup } from "@/components/ui/brand-logo";
import {
  ensureGsapPluginsRegistered,
  gsap,
  prefersReducedMotion,
  useGSAP,
} from "@/lib/animation/gsap";

/** Oversized brand wordmark that rises into view as the footer scrolls in. */
export function FooterWordmark() {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || prefersReducedMotion()) return;
      ensureGsapPluginsRegistered();

      gsap.fromTo(
        el,
        { yPercent: 38, opacity: 0.2 },
        {
          yPercent: 0,
          opacity: 1,
          ease: "none",
          scrollTrigger: {
            trigger: el,
            start: "top 105%",
            end: "top 55%",
            scrub: 0.8,
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
      className="pointer-events-none mx-auto -mb-[0.1em] flex w-full max-w-[72rem] justify-center select-none"
      style={{
        WebkitMaskImage: "linear-gradient(180deg, black 35%, transparent 96%)",
        maskImage: "linear-gradient(180deg, black 35%, transparent 96%)",
      }}
    >
      <CasefolioLockup inverted className="h-auto w-full opacity-90" />
    </div>
  );
}
