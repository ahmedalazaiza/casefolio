import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { COLOR_TOKENS, RADIUS_TOKENS, TYPE_SCALE_TOKENS } from "./design-tokens";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));

const EXPECTED_LIGHT_FIGMA_VARS: Record<string, string> = {
  "--bg-canvas": "#f4f1ea",
  "--bg-surface": "#ece8de",
  "--bg-elevated": "#faf8f4",
  "--bg-sunken": "#e4e0d5",
  "--bg-inverse": "#20211d",
  "--text-primary": "#20211d",
  "--text-secondary": "#505246",
  "--text-tertiary": "#77756f",
  "--text-inverse": "#f4f1ea",
  "--border-default": "#d5d2c9",
  "--border-strong": "#b9b5aa",
  "--accent-primary": "#20211d",
  "--accent-on-primary": "#ffffff",
  "--accent-soft": "#e7e4de",
  "--accent-secondary": "#20211d",
  "--accent-secondary-soft": "#e4e0d5",
  "--status-success": "#15803d",
  "--status-success-soft": "#e4f3e8",
  "--status-warning": "#9a4708",
  "--status-warning-soft": "#f6ecd7",
  "--status-danger": "#c81e1e",
  "--status-danger-soft": "#fae5e5",
};

const EXPECTED_DARK_FIGMA_VARS: Record<string, string> = {
  "--bg-canvas": "#161713",
  "--bg-surface": "#20211d",
  "--bg-elevated": "#282923",
  "--bg-sunken": "#11120e",
  "--bg-inverse": "#f4f1ea",
  "--text-primary": "#f4f1ea",
  "--text-secondary": "#b0b1aa",
  "--text-tertiary": "#8b8d84",
  "--text-inverse": "#20211d",
  "--border-default": "#363730",
  "--border-strong": "#484943",
  "--accent-primary": "#e7ff68",
  "--accent-on-primary": "#20211d",
  "--accent-soft": "#2c2d26",
  "--accent-secondary": "#f4f1ea",
  "--accent-secondary-soft": "#2c2d26",
  "--status-success": "#4ade80",
  "--status-success-soft": "#0e2c1a",
  "--status-warning": "#fbbf24",
  "--status-warning-soft": "#2d220a",
  "--status-danger": "#f87171",
  "--status-danger-soft": "#2e1212",
};

describe("Figma design tokens 1:1 sync (C-101)", () => {
  const tokensCss = readFileSync(resolve(CURRENT_DIR, "../styles/tokens.css"), "utf8");
  const layoutTsx = readFileSync(resolve(CURRENT_DIR, "../app/layout.tsx"), "utf8");
  const [rootBlock = "", darkBlock = ""] = tokensCss.split(".dark {");

  it("matches all 22 Light mode color variables 1:1", () => {
    expect(COLOR_TOKENS).toHaveLength(22);
    for (const [cssVar, hex] of Object.entries(EXPECTED_LIGHT_FIGMA_VARS)) {
      expect(rootBlock).toContain(`${cssVar}: ${hex};`);
    }
  });

  it("matches all 22 Dark mode color variables 1:1", () => {
    for (const [cssVar, hex] of Object.entries(EXPECTED_DARK_FIGMA_VARS)) {
      expect(darkBlock).toContain(`${cssVar}: ${hex};`);
    }
  });

  it("defines typography and radius scale tokens and loads Manrope + DM Mono + Instrument Serif", () => {
    expect(TYPE_SCALE_TOKENS).toHaveLength(11);
    expect(RADIUS_TOKENS).toHaveLength(6);

    for (const spec of TYPE_SCALE_TOKENS) {
      expect(rootBlock).toContain(`${spec.cssSizeVar}:`);
    }
    for (const r of RADIUS_TOKENS) {
      expect(rootBlock).toContain(`${r.cssVar}:`);
    }

    expect(rootBlock).toContain("--font-editorial: Georgia");
    expect(rootBlock).toContain("--font-ui: var(--font-manrope)");
    expect(rootBlock).toContain("--font-code: var(--font-dm-mono)");
    expect(layoutTsx).toContain("Manrope");
    expect(layoutTsx).toContain("DM_Mono");
    expect(layoutTsx).toContain("Instrument_Serif");
    expect(layoutTsx).toContain("next/font/google");
  });
});
