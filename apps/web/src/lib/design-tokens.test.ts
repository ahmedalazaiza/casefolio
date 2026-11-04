import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { COLOR_TOKENS, RADIUS_TOKENS, TYPE_SCALE_TOKENS } from "./design-tokens";

const EXPECTED_LIGHT_FIGMA_VARS: Record<string, string> = {
  "--bg-canvas": "#ffffff",
  "--bg-surface": "#fafafa",
  "--bg-elevated": "#ffffff",
  "--bg-sunken": "#f4f4f5",
  "--bg-inverse": "#0a0a0a",
  "--text-primary": "#0a0a0a",
  "--text-secondary": "#52525b",
  "--text-tertiary": "#a1a1aa",
  "--text-inverse": "#ffffff",
  "--border-default": "#ededef",
  "--border-strong": "#d4d4d8",
  "--accent-primary": "#4f46e5",
  "--accent-on-primary": "#ffffff",
  "--accent-soft": "#eef2ff",
  "--accent-secondary": "#18181b",
  "--accent-secondary-soft": "#f4f4f5",
  "--status-success": "#16a34a",
  "--status-success-soft": "#f0fdf4",
  "--status-warning": "#d97706",
  "--status-warning-soft": "#fffbeb",
  "--status-danger": "#dc2626",
  "--status-danger-soft": "#fef2f2",
};

const EXPECTED_DARK_FIGMA_VARS: Record<string, string> = {
  "--bg-canvas": "#0a0a0a",
  "--bg-surface": "#111113",
  "--bg-elevated": "#18181b",
  "--bg-sunken": "#09090b",
  "--bg-inverse": "#fafafa",
  "--text-primary": "#fafafa",
  "--text-secondary": "#a1a1aa",
  "--text-tertiary": "#71717a",
  "--text-inverse": "#0a0a0a",
  "--border-default": "#27272a",
  "--border-strong": "#3f3f46",
  "--accent-primary": "#818cf8",
  "--accent-on-primary": "#0a0a0a",
  "--accent-soft": "#1e1b4b",
  "--accent-secondary": "#e4e4e7",
  "--accent-secondary-soft": "#27272a",
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

