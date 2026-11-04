import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConstrainedEditor } from "./constrained-editor";
import {
  CONSTRAINED_PUCK_PERMISSIONS,
  toggleSectionVisibility,
  type ProjectEditorPayload,
} from "@/lib/projects/types";
import { validateTemplateDocument, type TemplateDocument } from "@/lib/template/schema";

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

describe("ConstrainedEditor (C-402)", () => {
  it("locks Puck permissions to fields-only (no insert, delete, duplicate, or drag) and renders zero component drawers", () => {
    expect(CONSTRAINED_PUCK_PERMISSIONS).toEqual({
      insert: false,
      delete: false,
      duplicate: false,
      drag: false,
      edit: true,
    });

    const payload = buildEditorPayload();
    // Hero is required and cannot be hidden even programmatically
    const attemptedHideHero = toggleSectionVisibility(payload.project.puckData, 0);
    expect(attemptedHideHero.content[0]?.props.hidden).toBeUndefined();

    const { container } = render(<ConstrainedEditor initialPayload={payload} />);

    // Verify no Puck free-canvas component drawer or draggable block list exists
    expect(container.querySelector('[data-puck-drawer]')).toBeNull();
    expect(container.querySelector('[data-puck-dropzone]')).toBeNull();
    expect(screen.queryByText(/Add a section/i)).toBeNull();
  });

  it("toggles optional section visibility on the live canvas and updates constrained section fields", async () => {
    const payload = buildEditorPayload();
    render(<ConstrainedEditor initialPayload={payload} />);

    // Problem section is visible initially on the live canvas
    expect(
      screen.getByText("68% of new users dropped off before making their first deposit."),
    ).toBeInTheDocument();

    // Toggle Problem section visibility OFF via the Sections panel switch
    const problemToggle = screen.getByTestId("toggle-section-Problem");
    expect(problemToggle).toHaveAttribute("aria-checked", "true");
    fireEvent.click(problemToggle);

    expect(problemToggle).toHaveAttribute("aria-checked", "false");
    expect(screen.getByTestId("section-row-Problem")).toHaveAttribute("data-hidden", "true");
    expect(
      screen.queryByText("68% of new users dropped off before making their first deposit."),
    ).toBeNull();

    // Toggle Problem section back ON
    fireEvent.click(problemToggle);
    expect(problemToggle).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByText("68% of new users dropped off before making their first deposit."),
    ).toBeInTheDocument();

    // Edit Hero Title field inside Puck.Fields inspector and verify live canvas updates
    await waitFor(() => {
      expect(screen.getByDisplayValue("Orbit — Banking that moves with you")).toBeInTheDocument();
    });

    const titleInput = screen.getByDisplayValue("Orbit — Banking that moves with you");
    fireEvent.change(titleInput, {
      target: { value: "Mosaed — Smart debt management" },
    });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Mosaed — Smart debt management" }),
      ).toBeInTheDocument();
    });
  });
});
