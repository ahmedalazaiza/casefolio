import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createEditorStore } from "./editor-store";
import { ConstrainedEditor } from "@/components/editor/constrained-editor";
import type {
  ProjectEditorPayload,
  SaveProjectEditorInput,
  SaveProjectEditorResult,
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
      updatedAtIso: "2026-11-04T12:00:00.000Z",
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

describe("Zustand + zundo editor store & autosave (C-405)", () => {
  it("tracks puckData and theme snapshots in zundo temporal history without polluting history on saveStatus transitions", () => {
    const payload = buildEditorPayload();
    const store = createEditorStore({
      puckData: payload.project.puckData,
      theme: payload.project.theme,
      updatedAtIso: payload.project.updatedAtIso,
    });

    expect(store.temporal.getState().pastStates).toHaveLength(0);

    // Edit case study root title
    store.getState().setPuckData((prev) => ({
      ...prev,
      root: { ...prev.root, props: { ...prev.root.props, title: "Updated Title v1" } },
    }));
    expect(store.getState().puckData.root.props.title).toBe("Updated Title v1");
    expect(store.getState().saveStatus).toBe("unsaved");
    expect(store.temporal.getState().pastStates).toHaveLength(1);

    // Save status transitions should NOT add extra undo snapshots
    store.getState().markSaving();
    store.getState().markSaved("2026-11-04T12:00:05.000Z");
    expect(store.temporal.getState().pastStates).toHaveLength(1);

    // Edit theme primary color
    store.getState().setTheme((prev) => ({
      ...prev,
      colors: { ...prev.colors, primary: "#10B981" },
    }));
    expect(store.temporal.getState().pastStates).toHaveLength(2);

    // Undo once -> reverts color, keeps title
    store.temporal.getState().undo();
    expect(store.getState().theme.colors.primary).toBe(payload.project.theme.colors.primary);
    expect(store.getState().puckData.root.props.title).toBe("Updated Title v1");
    expect(store.temporal.getState().futureStates).toHaveLength(1);

    // Redo -> restores #10B981
    store.temporal.getState().redo();
    expect(store.getState().theme.colors.primary).toBe("#10B981");
  });

  it("handles Ctrl+Z / Ctrl+Shift+Z keyboard shortcuts, debounced autosave indicator, error retry, and conflict detection", async () => {
    const payload = buildEditorPayload();
    let callCount = 0;

    const onSaveProject = vi.fn(async (): Promise<SaveProjectEditorResult> => {
      callCount += 1;
      if (callCount === 1) {
        return {
          ok: true,
          updatedAtIso: "2026-11-04T12:01:00.000Z",
          revision: 2,
        };
      }
      if (callCount === 2) {
        return {
          ok: false,
          code: "SAVE_FAILED",
          error: "Couldn't save your last change.",
        };
      }
      return {
        ok: true,
        updatedAtIso: "2026-11-04T12:02:00.000Z",
        revision: 3,
      };
    });

    render(
      <ConstrainedEditor
        initialPayload={payload}
        onSaveProject={onSaveProject}
        autosaveDebounceMs={25}
      />,
    );

    const indicator = screen.getByTestId("editor-save-indicator");
    expect(indicator).toHaveAttribute("data-save-status", "saved");

    // Toggle Problem section -> triggers unsaved -> debounced save -> saved
    fireEvent.click(screen.getByTestId("toggle-section-Problem"));
    expect(screen.getByTestId("section-row-Problem")).toHaveAttribute("data-hidden", "true");
    expect(indicator).toHaveAttribute("data-save-status", "unsaved");

    await waitFor(() => {
      expect(onSaveProject).toHaveBeenCalledTimes(1);
      expect(indicator).toHaveAttribute("data-save-status", "saved");
    });

    // Press Ctrl+Z -> undoes Problem hide -> triggers save #2 (which fails) -> shows Retry toast
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(screen.getByTestId("section-row-Problem")).toHaveAttribute("data-hidden", "false");

    await waitFor(() => {
      expect(onSaveProject).toHaveBeenCalledTimes(2);
      expect(indicator).toHaveAttribute("data-save-status", "error");
    });

    const toast = screen.getByTestId("editor-save-toast");
    expect(toast).toHaveTextContent("Couldn't save your last change.");

    // Click Retry -> succeeds -> Saved
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => {
      expect(onSaveProject).toHaveBeenCalledTimes(3);
      expect(indicator).toHaveAttribute("data-save-status", "saved");
    });

    // Press Ctrl+Shift+Z -> redoes Problem hide
    fireEvent.keyDown(window, { key: "z", ctrlKey: true, shiftKey: true });
    expect(screen.getByTestId("section-row-Problem")).toHaveAttribute("data-hidden", "true");
  });

  it("offers non-destructive conflict resolution ('Keep my changes' & 'Download a copy') instead of Reload-only (B5)", async () => {
    const payload = buildEditorPayload();
    let callCount = 0;

    const onSaveProject = vi.fn(
      async (input: SaveProjectEditorInput): Promise<SaveProjectEditorResult> => {
        callCount += 1;
        if (callCount === 1) {
          return {
            ok: false,
            code: "CONFLICT",
            error: "This project was updated in another tab or session.",
            serverUpdatedAtIso: "2026-11-04T12:05:00.000Z",
            serverRevision: 7,
          };
        }
        expect(input.expectedUpdatedAtIso).toBe("2026-11-04T12:05:00.000Z");
        expect(input.expectedRevision).toBe(7);
        return {
          ok: true,
          updatedAtIso: "2026-11-04T12:06:00.000Z",
          revision: 8,
        };
      },
    );

    render(
      <ConstrainedEditor
        initialPayload={payload}
        onSaveProject={onSaveProject}
        autosaveDebounceMs={20}
      />,
    );

    const indicator = screen.getByTestId("editor-save-indicator");
    fireEvent.click(screen.getByTestId("toggle-section-Problem"));

    await waitFor(() => {
      expect(onSaveProject).toHaveBeenCalledTimes(1);
      expect(indicator).toHaveAttribute("data-save-status", "conflict");
    });

    expect(screen.getByTestId("editor-conflict-keep-mine")).toHaveTextContent(
      "Keep my changes",
    );
    expect(screen.getByTestId("editor-conflict-download-copy")).toHaveTextContent(
      "Download a copy",
    );
    expect(screen.getByTestId("editor-conflict-reload")).toHaveTextContent("Reload");

    // Clicking "Keep my changes" rebases onto server revision 7 and saves local edits as revision 8
    fireEvent.click(screen.getByTestId("editor-conflict-keep-mine"));
    await waitFor(() => {
      expect(onSaveProject).toHaveBeenCalledTimes(2);
      expect(indicator).toHaveAttribute("data-save-status", "saved");
    });
  });
});
