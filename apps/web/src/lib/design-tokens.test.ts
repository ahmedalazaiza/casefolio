import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { COLOR_TOKENS, RADIUS_TOKENS, TYPE_SCALE_TOKENS } from "./design-tokens";

const EXPECTED_LIGHT_FIGMA_VARS: Record<string, string> = {
  "--bg-canvas": "#fafafa",
  "--bg-surface": "#f3f3f5",
  "--bg-elevated": "#ffffff",
  "--bg-sunken": "#ebebee",
  "--bg-inverse": "#0c0d12",
  "--text-primary": "#0c0d12",
  "--text-secondary": "#474a54",
  "--text-tertiary": "#5a5e6b",
  "--text-inverse": "#ffffff",
  "--border-default": "#e2e2e7",
  "--border-strong": "#c4c5ce",
  "--accent-primary": "#2650f2",
  "--accent-on-primary": "#ffffff",
  "--accent-soft": "#f3f3f5",
  "--accent-secondary": "#0c0d12",
  "--accent-secondary-soft": "#ebebee",
  "--status-success": "#15803d",
  "--status-success-soft": "#ecfdf3",
  "--status-warning": "#b45309",
  "--status-warning-soft": "#fffbeb",
  "--status-danger": "#c81e1e",
  "--status-danger-soft": "#fef2f2",
};

const EXPECTED_DARK_FIGMA_VARS: Record<string, string> = {
  "--bg-canvas": "#070b19",
  "--bg-surface": "#0e152c",
  "--bg-elevated": "#141e3b",
  "--bg-sunken": "#050813",
  "--bg-inverse": "#f5f7ff",
  "--text-primary": "#f5f7ff",
  "--text-secondary": "#b4c0df",
  "--text-tertiary": "#8e9ec7",
  "--text-inverse": "#070b19",
  "--border-default": "#1f2c52",
  "--border-strong": "#354982",
  "--accent-primary": "#85a3ff",
  "--accent-on-primary": "#070b19",
  "--accent-soft": "#16244f",
  "--accent-secondary": "#e6ecff",
  "--accent-secondary-soft": "#1c2951",
  "--status-success": "#4ade80",
  "--status-success-soft": "#052e16",
  "--status-warning": "#fbbf24",
  "--status-warning-soft": "#2d1f05",
  "--status-danger": "#f87171",
  "--status-danger-soft": "#2a0a0a",
};

describe("Figma design tokens 1:1 sync (C-101)", () => {
  const tokensCss = readFileSync(
    resolve(process.cwd(), "apps/web/src/styles/tokens.css"),
    "utf-8",
  );
  const [rootBlock = "", darkBlock = ""] = tokensCss.split(".dark {");

  it("matches all 22 Figma Light mode color variables 1:1", () => {
    expect(COLOR_TOKENS).toHaveLength(22);
    for (const [cssVar, hex] of Object.entries(EXPECTED_LIGHT_FIGMA_VARS)) {
      expect(rootBlock).toContain(`${cssVar}: ${hex};`);
    }
  });

  it("matches all 22 Figma Dark mode color variables 1:1", () => {
    for (const [cssVar, hex] of Object.entries(EXPECTED_DARK_FIGMA_VARS)) {
      expect(darkBlock).toContain(`${cssVar}: ${hex};`);
    }
  });

  it("defines all Figma typography and radius scale tokens and self-hosts Geist + JetBrains Mono", () => {
    expect(TYPE_SCALE_TOKENS).toHaveLength(11);
    expect(RADIUS_TOKENS).toHaveLength(6);

    for (const spec of TYPE_SCALE_TOKENS) {
      expect(rootBlock).toContain(`${spec.cssSizeVar}:`);
    }
    for (const r of RADIUS_TOKENS) {
      expect(rootBlock).toContain(`${r.cssVar}:`);
    }

    const layoutTsx = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/layout.tsx"),
      "utf-8",
    );
    expect(layoutTsx).toContain("Geist");
    expect(layoutTsx).toContain("JetBrains_Mono");
    expect(layoutTsx).toContain("next/font/google");
  });
});

