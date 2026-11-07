"use client";

import { useRef } from "react";
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
      className="font-display text-elevated pointer-events-none -mb-[0.1em] w-full text-center leading-[0.82] font-semibold tracking-[-0.06em] select-none"
      style={{
        fontSize: "clamp(4.5rem, 21vw, 20rem)",
        WebkitMaskImage:
          "linear-gradient(180deg, black 35%, transparent 96%)",
        maskImage: "linear-gradient(180deg, black 35%, transparent 96%)",
      }}
    >
      casefolio
    </div>
  );
}
