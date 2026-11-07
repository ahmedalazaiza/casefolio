"use client";

import Lenis from "lenis";
import { useEffect, type ReactNode } from "react";
import {
  ensureGsapPluginsRegistered,
  gsap,
  prefersReducedMotion,
  ScrollTrigger,
} from "@/lib/animation/gsap";

const NAVBAR_ANCHOR_OFFSET = -92;

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (prefersReducedMotion()) {
      return;
    }

    ensureGsapPluginsRegistered();

    const lenis = new Lenis({
      autoRaf: false,
      lerp: 0.095,
      smoothWheel: true,
      wheelMultiplier: 0.95,
      touchMultiplier: 1.4,
    });

    const handleScrollUpdate = () => {
      ScrollTrigger.update();
    };
    lenis.on("scroll", handleScrollUpdate);
    window.addEventListener("scroll", handleScrollUpdate, { passive: true });

    const tickerCallback = (timeSeconds: number) => {
      lenis.raf(timeSeconds * 1000);
    };
    gsap.ticker.add(tickerCallback);
    gsap.ticker.lagSmoothing(0);

    const handleAnchorClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      const rawHref = anchor.getAttribute("href");
      if (!rawHref) {
        return;
      }

      let hash = "";
      if (rawHref.startsWith("#")) {
        hash = rawHref;
      } else if (rawHref.startsWith("/#") && window.location.pathname === "/") {
        hash = rawHref.slice(1);
      }

      if (!hash || hash === "#") {
        return;
      }

      const destination = document.querySelector<HTMLElement>(hash);
      if (!destination) {
        return;
      }

      event.preventDefault();
      window.history.pushState(null, "", hash);
      lenis.scrollTo(destination, {
        offset: NAVBAR_ANCHOR_OFFSET,
        duration: 1.1,
      });
    };

    document.addEventListener("click", handleAnchorClick);

    return () => {
      document.removeEventListener("click", handleAnchorClick);
      window.removeEventListener("scroll", handleScrollUpdate);
      lenis.off("scroll", handleScrollUpdate);
      gsap.ticker.remove(tickerCallback);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}

