import { temporal } from "zundo";
import { createStore } from "zustand/vanilla";
import { immer } from "zustand/middleware/immer";
import type { PuckDocument, TemplateTheme } from "@/lib/template/schema";

export type EditorSaveStatus = "saved" | "unsaved" | "saving" | "conflict" | "error";

export interface EditorDocumentSnapshot {
  puckData: PuckDocument;
  theme: TemplateTheme;
}

export interface EditorStoreInit {
  puckData: PuckDocument;
  theme: TemplateTheme;
  updatedAtIso: string;
}

export interface EditorStoreState extends EditorDocumentSnapshot {
  expectedUpdatedAtIso: string;
  saveStatus: EditorSaveStatus;
  saveError: string | null;
  conflictServerUpdatedAtIso: string | null;
  setPuckData: (updater: PuckDocument | ((prev: PuckDocument) => PuckDocument)) => void;
  setTheme: (updater: TemplateTheme | ((prev: TemplateTheme) => TemplateTheme)) => void;
  markUnsaved: () => void;
  markSaving: () => void;
  markSaved: (updatedAtIso: string) => void;
  markConflict: (message: string, serverUpdatedAtIso?: string) => void;
  markError: (message: string) => void;
}

export function serializePuckDocument(doc: PuckDocument): string {
  return JSON.stringify({
    root: doc.root,
    content: doc.content,
    zones: doc.zones ?? {},
  });
}

export function serializeEditorSnapshot(snapshot: EditorDocumentSnapshot): string {
  return JSON.stringify({
    puck: JSON.parse(serializePuckDocument(snapshot.puckData)) as unknown,
    theme: snapshot.theme,
  });
}

export function createEditorStore(initial: EditorStoreInit) {
  return createStore<EditorStoreState>()(
    temporal(
      immer((set, get) => ({
        puckData: structuredClone(initial.puckData),
        theme: structuredClone(initial.theme),
        expectedUpdatedAtIso: initial.updatedAtIso,
        saveStatus: "saved",
        saveError: null,
        conflictServerUpdatedAtIso: null,

        setPuckData: (updater) => {
          const prevPuck = get().puckData;
          const next =
            typeof updater === "function" ? updater(structuredClone(prevPuck)) : updater;
          const clonedNext = structuredClone(next);
          set((draft) => {
            draft.puckData = clonedNext as typeof draft.puckData;
            draft.saveStatus = "unsaved";
            draft.saveError = null;
          });
        },

        setTheme: (updater) => {
          const prevTheme = get().theme;
          const next =
            typeof updater === "function" ? updater(structuredClone(prevTheme)) : updater;
          const clonedNext = structuredClone(next);
          set((draft) => {
            draft.theme = clonedNext as typeof draft.theme;
            draft.saveStatus = "unsaved";
            draft.saveError = null;
          });
        },

        markUnsaved: () => {
          set((draft) => {
            draft.saveStatus = "unsaved";
            draft.saveError = null;
          });
        },

        markSaving: () => {
          set((draft) => {
            draft.saveStatus = "saving";
            draft.saveError = null;
          });
        },

        markSaved: (updatedAtIso) => {
          set((draft) => {
            draft.expectedUpdatedAtIso = updatedAtIso;
            draft.saveStatus = "saved";
            draft.saveError = null;
            draft.conflictServerUpdatedAtIso = null;
          });
        },

        markConflict: (message, serverUpdatedAtIso) => {
          set((draft) => {
            draft.saveStatus = "conflict";
            draft.saveError = message;
            draft.conflictServerUpdatedAtIso = serverUpdatedAtIso ?? null;
          });
        },

        markError: (message) => {
          set((draft) => {
            draft.saveStatus = "error";
            draft.saveError = message;
          });
        },
      })),
      {
        limit: 100,
        partialize: (state): EditorDocumentSnapshot => ({
          puckData: state.puckData,
          theme: state.theme,
        }),
        equality: (pastState, currentState) =>
          serializeEditorSnapshot(pastState) === serializeEditorSnapshot(currentState),
      },
    ),
  );
}

export type EditorStoreInstance = ReturnType<typeof createEditorStore>;
