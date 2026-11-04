import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { calculateContrastRatio, evaluateThemeContrastIssues } from "./contrast";
import { validateTemplateDocument, type TemplateDocument } from "./schema";
import { ConstrainedEditor } from "@/components/editor/constrained-editor";
import type { ProjectEditorPayload } from "@/lib/projects/types";

function loadOrbitDoc(): TemplateDocument {
  for (const candidate of [
    resolve(process.cwd(), "reference/template.example.json"),
    resolve(process.cwd(), "../../reference/template.example.json"),
  ]) {
    if (existsSync(candidate)) {
      const parsed = validateTemplateDocument(JSON.parse(readFileSync(candidate, "utf-8")));
      if (parsed.ok) return parsed.data;
    }
  }
  throw new Error("Missing Orbit fixture");
}

function buildEditorPayload(): ProjectEditorPayload {
  const doc = loadOrbitDoc();
  return {
    project: {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      name: "Orbit Case Study",
      type: "mobile",
      puckData: structuredClone(doc.puck),
      theme: structuredClone(doc.template.theme),
      visibility: "private",
      slug: null,
      updatedAtIso: new Date().toISOString(),
    },
    template: {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      name: doc.template.name,
      slug: doc.template.slug,
      version: doc.template.version,
      slots: structuredClone(doc.template.slots),
      defaultTheme: structuredClone(doc.template.theme),
      defaultPuck: structuredClone(doc.puck),
    },
  };
}

describe("ThemePanel & WCAG contrast (C-404)", () => {
  it("computes WCAG 2.1 contrast ratios and flags pairs below 4.5:1", () => {
    expect(calculateContrastRatio("#FFFFFF", "#000000")).toBe(21);
    expect(calculateContrastRatio("#777777", "#FFFFFF")).toBe(4.48);

    const lowContrastIssues = evaluateThemeContrastIssues({
      primary: "#4F46E5",
      background: "#FFFFFF",
      surface: "#F5F5F7",
      text: "#9CA3AF",
    });
    expect(lowContrastIssues.length).toBeGreaterThanOrEqual(1);
    expect(lowContrastIssues[0]?.ratio).toBeLessThan(4.5);

    const accessibleIssues = evaluateThemeContrastIssues({
      primary: "#4F46E5",
      background: "#FFFFFF",
      surface: "#F5F5F7",
      text: "#0B0B0F",
    });
    expect(accessibleIssues).toHaveLength(0);
  });

  it("applies palette presets, token hex edits, and curated font pairs instantly to canvas CSS variables and shows contrast warnings < 4.5:1", () => {
    const payload = buildEditorPayload();
    render(<ConstrainedEditor initialPayload={payload} />);

    // Open Style tab
    fireEvent.click(screen.getByRole("tab", { name: "Style" }));
    expect(screen.getByTestId("editor-style-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("theme-contrast-warning")).toBeNull();

    const canvas = screen.getByTestId("editor-canvas-preview");

    // Apply Obsidian Gold preset -> CSS variables update synchronously
    fireEvent.click(screen.getByTestId("palette-preset-obsidian-gold"));
    expect(canvas.style.getPropertyValue("--tpl-color-primary")).toBe("#E6C36A");
    expect(canvas.style.getPropertyValue("--tpl-color-background")).toBe("#121110");

    // Set Text color too close to #121110 background -> triggers < 4.5:1 contrast warning
    const textHexInput = screen.getByLabelText("Text hex code");
    fireEvent.change(textHexInput, { target: { value: "#2A2A2A" } });

    const warning = screen.getByTestId("theme-contrast-warning");
    expect(warning).toBeInTheDocument();
    expect(warning).toHaveTextContent(/Low text contrast/i);

    // Pick curated font pair "Instrument Serif + Geist" -> updates --tpl-font-heading immediately
    fireEvent.change(screen.getByLabelText("Font pair"), {
      target: { value: "instrument-editorial" },
    });
    expect(canvas.style.getPropertyValue("--tpl-font-heading")).toContain("Instrument Serif");

    // Reset to template defaults -> restores Orbit colors/fonts & clears warning
    fireEvent.click(screen.getByRole("button", { name: /Reset to template defaults/i }));
    expect(canvas.style.getPropertyValue("--tpl-color-primary")).toBe(
      payload.template.defaultTheme.colors.primary,
    );
    expect(screen.queryByTestId("theme-contrast-warning")).toBeNull();
  });
});
