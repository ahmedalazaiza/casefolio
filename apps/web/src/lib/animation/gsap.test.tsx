import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LandingHeroMotion } from "@/components/marketing/landing-hero-motion";
import {
  ANIMATION_DELAYS,
  ANIMATION_DISTANCES,
  ANIMATION_DURATIONS,
  ANIMATION_EASINGS,
  ANIMATION_SCALES,
  ANIMATION_STAGGERS,
  ensureGsapPluginsRegistered,
  fadeUp,
  gsap,
  GSAP_PRESETS,
  prefersReducedMotion,
  REDUCED_MOTION_MEDIA_QUERY,
  scaleIn,
  stagger,
} from "@/lib/animation/gsap";

function setReducedMotionPreference(reduced: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === REDUCED_MOTION_MEDIA_QUERY ? reduced : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function collectSourceFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
    } else if (
      (entry.endsWith(".ts") || entry.endsWith(".tsx")) &&
      !entry.endsWith(".test.ts") &&
      !entry.endsWith(".test.tsx")
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("GSAP animation setup, presets, reduced-motion & architecture rules", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers GSAP plugins idempotently on the client and exports shared constants", () => {
    const registerSpy = vi.spyOn(gsap, "registerPlugin");
    expect(ensureGsapPluginsRegistered()).toBe(true);
    expect(ensureGsapPluginsRegistered()).toBe(true);
    // Already registered on initial module evaluation in jsdom
    expect(registerSpy).not.toHaveBeenCalled();

    expect(ANIMATION_DURATIONS.base).toBeGreaterThan(0);
    expect(ANIMATION_EASINGS.entrance).toBe("power3.out");
    expect(ANIMATION_DISTANCES.baseY).toBeGreaterThan(0);
    expect(ANIMATION_SCALES.subtle).toBeLessThan(1);
    expect(ANIMATION_STAGGERS.base).toBeGreaterThan(0);
    expect(ANIMATION_DELAYS.short).toBeGreaterThan(0);

    // Presets must only specify transform (y/scale), opacity, timing, and stagger keys
    expect(Object.keys(GSAP_PRESETS.fadeUp).sort()).toEqual(["duration", "ease", "opacity", "y"]);
    expect(Object.keys(GSAP_PRESETS.stagger).sort()).toEqual([
      "duration",
      "ease",
      "opacity",
      "stagger",
      "y",
    ]);
    expect(Object.keys(GSAP_PRESETS.scaleIn).sort()).toEqual([
      "duration",
      "ease",
      "opacity",
      "scale",
    ]);
  });

  it("disables fadeUp, stagger, and scaleIn when prefers-reduced-motion is active", () => {
    setReducedMotionPreference(true);
    expect(prefersReducedMotion()).toBe(true);

    const fromSpy = vi.spyOn(gsap, "from");
    const setSpy = vi.spyOn(gsap, "set");

    const target = document.createElement("div");
    expect(fadeUp(target)).toBeNull();
    expect(stagger([target])).toBeNull();
    expect(scaleIn(target)).toBeNull();

    expect(fromSpy).not.toHaveBeenCalled();
    expect(setSpy).toHaveBeenCalledTimes(3);
  });

  it("creates transform/opacity-only tweens for fadeUp, stagger, and scaleIn when motion is allowed", () => {
    setReducedMotionPreference(false);
    expect(prefersReducedMotion()).toBe(false);

    const fromSpy = vi.spyOn(gsap, "from");
    const elA = document.createElement("div");
    const elB = document.createElement("div");

    const tweenFade = fadeUp(elA);
    expect(tweenFade).not.toBeNull();
    expect(fromSpy).toHaveBeenCalledWith(
      elA,
      expect.objectContaining({
        opacity: 0,
        y: ANIMATION_DISTANCES.baseY,
        duration: ANIMATION_DURATIONS.base,
        ease: ANIMATION_EASINGS.entrance,
        clearProps: "transform,opacity",
      }),
    );
    tweenFade?.kill();

    const tweenStagger = stagger([elA, elB], { each: ANIMATION_STAGGERS.tight });
    expect(tweenStagger).not.toBeNull();
    expect(fromSpy).toHaveBeenCalledWith(
      [elA, elB],
      expect.objectContaining({
        opacity: 0,
        y: ANIMATION_DISTANCES.subtleY,
        stagger: ANIMATION_STAGGERS.tight,
        clearProps: "transform,opacity",
      }),
    );
    tweenStagger?.kill();

    const tweenScale = scaleIn(elA);
    expect(tweenScale).not.toBeNull();
    expect(fromSpy).toHaveBeenCalledWith(
      elA,
      expect.objectContaining({
        opacity: 0,
        scale: ANIMATION_SCALES.subtle,
        duration: ANIMATION_DURATIONS.fast,
        ease: ANIMATION_EASINGS.subtle,
        clearProps: "transform,opacity",
      }),
    );
    tweenScale?.kill();
  });

  it("LandingHeroMotion respects prefers-reduced-motion and cleans up scoped tweens on unmount", () => {
    setReducedMotionPreference(true);
    const fromSpy = vi.spyOn(gsap, "from");

    const { unmount: unmountReduced } = render(
      <LandingHeroMotion visual={<div>Hero Visual Preview</div>}>
        <h1>Hero Headline</h1>
      </LandingHeroMotion>,
    );

    expect(screen.getByRole("heading", { name: "Hero Headline" })).toBeInTheDocument();
    expect(screen.getByText("Hero Visual Preview")).toBeInTheDocument();
    expect(fromSpy).not.toHaveBeenCalled();
    unmountReduced();

    setReducedMotionPreference(false);
    const { unmount: unmountAnimated } = render(
      <LandingHeroMotion visual={<div>Animated Visual</div>}>
        <h1>Animated Headline</h1>
      </LandingHeroMotion>,
    );

    expect(fromSpy).toHaveBeenCalledTimes(2);
    expect(fromSpy).toHaveBeenNthCalledWith(
      1,
      "[data-hero-copy]",
      expect.objectContaining({
        opacity: 0,
        y: ANIMATION_DISTANCES.baseY,
        delay: ANIMATION_DELAYS.none,
      }),
    );
    expect(fromSpy).toHaveBeenNthCalledWith(
      2,
      "[data-hero-visual]",
      expect.objectContaining({
        opacity: 0,
        y: ANIMATION_DISTANCES.baseY,
        delay: ANIMATION_DELAYS.short,
      }),
    );

    unmountAnimated();
  });

  it("enforces package boundaries, client-only animation components, and zero editor/export animations", () => {
    const repoRoot = resolve(process.cwd());
    const webPkg = JSON.parse(readFileSync(join(repoRoot, "apps/web/package.json"), "utf-8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(webPkg.dependencies?.gsap).toBeDefined();
    expect(webPkg.dependencies?.["@gsap/react"]).toBeDefined();

    const otherManifestPaths = [
      "package.json",
      "apps/worker/package.json",
      "packages/db/package.json",
      "packages/template-schema/package.json",
    ];
    for (const relPath of otherManifestPaths) {
      const pkg = JSON.parse(readFileSync(join(repoRoot, relPath), "utf-8")) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      expect(allDeps.gsap, `gsap must not be installed in ${relPath}`).toBeUndefined();
      expect(
        allDeps["@gsap/react"],
        `@gsap/react must not be installed in ${relPath}`,
      ).toBeUndefined();
      expect(
        allDeps["framer-motion"],
        `framer-motion is forbidden in ${relPath}`,
      ).toBeUndefined();
      expect(allDeps.motion, `motion is forbidden in ${relPath}`).toBeUndefined();
    }

    const webDeps = { ...webPkg.dependencies, ...webPkg.devDependencies };
    expect(webDeps["framer-motion"]).toBeUndefined();
    expect(webDeps.motion).toBeUndefined();

    // Forbidden zones: Puck editor canvas, section renderers, and export/render pages
    const staticOnlyDirs = [
      join(repoRoot, "apps/web/src/components/editor"),
      join(repoRoot, "apps/web/src/components/sections"),
      join(repoRoot, "apps/web/src/app/(app)/editor"),
      join(repoRoot, "apps/web/src/app/export"),
    ];
    const gsapImportPattern = /from\s+["'](?:gsap|gsap\/[^"']+|@gsap\/react|@\/lib\/animation\/gsap)["']/;

    for (const dir of staticOnlyDirs) {
      for (const file of collectSourceFiles(dir)) {
        const content = readFileSync(file, "utf-8");
        expect(
          content,
          `Animations are forbidden in editor/sections/export file: ${file}`,
        ).not.toMatch(gsapImportPattern);
      }
    }

    // Every component/page outside src/lib/animation importing GSAP must be a "use client" module
    const animationLibDir = join(repoRoot, "apps/web/src/lib/animation");
    const allWebSourceFiles = collectSourceFiles(join(repoRoot, "apps/web/src")).filter(
      (file) => !file.startsWith(animationLibDir),
    );
    for (const file of allWebSourceFiles) {
      const content = readFileSync(file, "utf-8");
      if (gsapImportPattern.test(content)) {
        const trimmed = content.trimStart();
        expect(
          trimmed.startsWith('"use client";') || trimmed.startsWith("'use client';"),
          `File ${file} imports GSAP but is missing "use client" directive`,
        ).toBe(true);
      }
    }
  });
});

