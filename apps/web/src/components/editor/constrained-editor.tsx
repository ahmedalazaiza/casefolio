"use client";

import "@puckeditor/core/no-external.css";
import {
  createUsePuck,
  Puck,
  type AppState,
  type Config,
  type Data,
  type PuckAction,
} from "@puckeditor/core";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Check,
  Cloud,
  Eye,
  EyeOff,
  Globe,
  Layers,
  Loader2,
  Monitor,
  Palette,
  Redo2,
  SlidersHorizontal,
  Smartphone,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { useStore } from "zustand";
import {
  EditorCanvasPreview,
  type EditorViewportMode,
} from "@/components/editor/editor-canvas-preview";
import { createCasefolioPuckConfig, TemplatePuckRenderer } from "@/components/editor/puck-config";
import { ThemePanel } from "@/components/editor/theme-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  collectProjectSlotStatus,
  CONSTRAINED_PUCK_PERMISSIONS,
  formatSectionTypeLabel,
  isSectionRequired,
  toggleSectionVisibility,
  type ProjectEditorPayload,
  type SaveProjectEditorInput,
  type SaveProjectEditorResult,
} from "@/lib/projects/types";
import {
  puckDocumentSchema,
  templateThemeSchema,
  type PuckDocument,
} from "@/lib/template/schema";
import { cn } from "@/lib/utils";
import {
  createEditorStore,
  serializeEditorSnapshot,
  serializePuckDocument,
} from "@/stores/editor-store";

type LeftPanelTab = "style" | "content" | "sections";
type RightPanelTab = "fields" | "slots";
type MobileSheetTab = "fields" | "sections" | "style" | "slots";

const useEditorPuck = createUsePuck();

interface PuckStateBridgeProps {
  externalPuckData: PuckDocument;
  selectedSectionIndex: number | null;
  lastPuckEmittedJsonRef: RefObject<string>;
}

function PuckStateBridge({
  externalPuckData,
  selectedSectionIndex,
  lastPuckEmittedJsonRef,
}: PuckStateBridgeProps) {
  const dispatch = useEditorPuck((s) => s.dispatch);
  const currentSelector = useEditorPuck((s) => s.appState.ui.itemSelector);
  const serializedExternal = useMemo(
    () => serializePuckDocument(externalPuckData),
    [externalPuckData],
  );

  useEffect(() => {
    if (serializedExternal !== lastPuckEmittedJsonRef.current) {
      lastPuckEmittedJsonRef.current = serializedExternal;
      dispatch({
        type: "setData",
        data: externalPuckData as unknown as Data,
      });
    }
  }, [dispatch, externalPuckData, lastPuckEmittedJsonRef, serializedExternal]);

  useEffect(() => {
    if (selectedSectionIndex === null) {
      if (currentSelector !== null) {
        dispatch({
          type: "setUi",
          ui: { itemSelector: null },
        });
      }
      return;
    }

    if (
      !currentSelector ||
      currentSelector.index !== selectedSectionIndex ||
      currentSelector.zone !== "root:default-zone"
    ) {
      dispatch({
        type: "setUi",
        ui: {
          itemSelector: {
            index: selectedSectionIndex,
            zone: "root:default-zone",
          },
        },
      });
    }
  }, [currentSelector, dispatch, selectedSectionIndex]);

  return null;
}

export interface ConstrainedEditorProps {
  initialPayload: ProjectEditorPayload;
  onSaveProject?: (input: SaveProjectEditorInput) => Promise<SaveProjectEditorResult>;
  autosaveDebounceMs?: number;
}

const PUCK_FONT_VARS = {
  "--puck-font-family": "var(--font-sans)",
  "--puck-font-family-monospaced": "var(--font-mono)",
} as CSSProperties;

export function ConstrainedEditor({
  initialPayload,
  onSaveProject,
  autosaveDebounceMs = 600,
}: ConstrainedEditorProps) {
  const [editorStore] = useState(() =>
    createEditorStore({
      puckData: initialPayload.project.puckData,
      theme: initialPayload.project.theme,
      updatedAtIso: initialPayload.project.updatedAtIso,
    }),
  );

  const puckData = useStore(editorStore, (s) => s.puckData);
  const theme = useStore(editorStore, (s) => s.theme);
  const saveStatus = useStore(editorStore, (s) => s.saveStatus);
  const saveError = useStore(editorStore, (s) => s.saveError);
  const setPuckData = useStore(editorStore, (s) => s.setPuckData);
  const setTheme = useStore(editorStore, (s) => s.setTheme);

  const canUndo = useStore(editorStore.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(editorStore.temporal, (s) => s.futureStates.length > 0);

  const [viewport, setViewport] = useState<EditorViewportMode>("desktop");
  const [leftTab, setLeftTab] = useState<LeftPanelTab>("sections");
  const [rightTab, setRightTab] = useState<RightPanelTab>("fields");
  const [mobileSheetTab, setMobileSheetTab] = useState<MobileSheetTab | null>(null);
  const [selectedSectionIndex, setSelectedSectionIndex] = useState<number | null>(0);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  const lastPuckEmittedJsonRef = useRef<string>(
    serializePuckDocument(initialPayload.project.puckData),
  );
  const lastSavedSnapshotRef = useRef<string>(
    serializeEditorSnapshot({
      puckData: initialPayload.project.puckData,
      theme: initialPayload.project.theme,
    }),
  );
  const inFlightSaveRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const colorKeys = useMemo(() => Object.keys(theme.colors), [theme.colors]);
  const puckConfig = useMemo(() => createCasefolioPuckConfig(colorKeys), [colorKeys]);

  const performAutosave = useCallback(async () => {
    if (!onSaveProject || inFlightSaveRef.current) {
      return;
    }

    const currentState = editorStore.getState();
    const snapshotToSave = serializeEditorSnapshot({
      puckData: currentState.puckData,
      theme: currentState.theme,
    });

    if (snapshotToSave === lastSavedSnapshotRef.current) {
      if (currentState.saveStatus === "unsaved") {
        currentState.markSaved(currentState.expectedUpdatedAtIso);
      }
      return;
    }

    const puckValidation = puckDocumentSchema.safeParse(currentState.puckData);
    const themeValidation = templateThemeSchema.safeParse(currentState.theme);
    if (!puckValidation.success || !themeValidation.success) {
      return;
    }

    inFlightSaveRef.current = true;
    currentState.markSaving();

    try {
      const result = await onSaveProject({
        projectId: initialPayload.project.id,
        expectedUpdatedAtIso: currentState.expectedUpdatedAtIso,
        puckData: puckValidation.data,
        theme: themeValidation.data,
      });

      if (result.ok) {
        lastSavedSnapshotRef.current = snapshotToSave;
        editorStore.getState().markSaved(result.updatedAtIso);

        // If user edited again while save was in-flight, mark unsaved so next debounce fires
        const latestSnapshot = serializeEditorSnapshot({
          puckData: editorStore.getState().puckData,
          theme: editorStore.getState().theme,
        });
        if (latestSnapshot !== snapshotToSave) {
          editorStore.getState().markUnsaved();
        }
      } else if (result.code === "CONFLICT") {
        editorStore.getState().markConflict(result.error, result.serverUpdatedAtIso);
      } else {
        editorStore.getState().markError(result.error || "Couldn't save your last change.");
      }
    } catch {
      editorStore.getState().markError("Couldn't save your last change.");
    } finally {
      inFlightSaveRef.current = false;
    }
  }, [editorStore, initialPayload.project.id, onSaveProject]);

  const currentSnapshotJson = useMemo(
    () => serializeEditorSnapshot({ puckData, theme }),
    [puckData, theme],
  );

  // Sync undo/redo snapshot changes with debounced autosave
  useEffect(() => {
    if (!onSaveProject) {
      return;
    }

    if (saveStatus === "conflict") {
      return;
    }

    if (currentSnapshotJson === lastSavedSnapshotRef.current) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (saveStatus === "unsaved") {
        editorStore.getState().markSaved(editorStore.getState().expectedUpdatedAtIso);
      }
      return;
    }

    if (saveStatus === "saved") {
      editorStore.getState().markUnsaved();
    }

    if (saveStatus === "error") {
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      void performAutosave();
    }, autosaveDebounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [autosaveDebounceMs, currentSnapshotJson, editorStore, onSaveProject, performAutosave, saveStatus]);

  // Warn before closing tab with unsaved changes
  useEffect(() => {
    if (!onSaveProject) return;
    if (saveStatus !== "unsaved" && saveStatus !== "saving") return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [onSaveProject, saveStatus]);

  const handleUndo = useCallback(() => {
    if (editorStore.temporal.getState().pastStates.length === 0) return;
    editorStore.temporal.getState().undo();
  }, [editorStore]);

  const handleRedo = useCallback(() => {
    if (editorStore.temporal.getState().futureStates.length === 0) return;
    editorStore.temporal.getState().redo();
  }, [editorStore]);

  // Global keyboard shortcuts: Ctrl+Z / Cmd+Z (Undo) & Ctrl+Shift+Z / Cmd+Shift+Z / Ctrl+Y (Redo)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMod = event.metaKey || event.ctrlKey;
      if (!isMod || event.altKey) return;

      const key = event.key.toLowerCase();
      if (key === "z") {
        event.preventDefault();
        event.stopPropagation();
        if (event.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if (event.ctrlKey && !event.metaKey && key === "y") {
        event.preventDefault();
        event.stopPropagation();
        handleRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [handleRedo, handleUndo]);

  const handlePuckAction = useCallback(
    (action: PuckAction, newAppState: AppState) => {
      if (action.type !== "replace" && action.type !== "replaceRoot") {
        return;
      }
      const parsed = puckDocumentSchema.safeParse(newAppState.data);
      const nextDoc = parsed.success
        ? parsed.data
        : (newAppState.data as unknown as PuckDocument);
      const nextJson = serializePuckDocument(nextDoc);
      if (nextJson === lastPuckEmittedJsonRef.current) {
        return;
      }
      lastPuckEmittedJsonRef.current = nextJson;
      setPuckData(nextDoc);
    },
    [setPuckData],
  );

  const handleSelectSection = useCallback((index: number) => {
    setSelectedSectionIndex(index);
    setRightTab("fields");
  }, []);

  const handleCanvasSelectSection = useCallback((index: number) => {
    setSelectedSectionIndex(index);
    setRightTab("fields");
    if (typeof window !== "undefined" && window.innerWidth > 0 && window.innerWidth < 1024) {
      setMobileSheetTab("fields");
    }
  }, []);

  const handleToggleSection = useCallback(
    (index: number) => {
      setPuckData((prev) => {
        const next = toggleSectionVisibility(prev, index);
        const toggledItem = next.content[index];
        if (toggledItem?.props.hidden && selectedSectionIndex === index) {
          const firstVisible = next.content.findIndex((s) => !s.props.hidden);
          setSelectedSectionIndex(firstVisible >= 0 ? firstVisible : 0);
        }
        return next;
      });
    },
    [selectedSectionIndex, setPuckData],
  );

  const handleResetThemeToDefaults = useCallback(() => {
    setTheme(structuredClone(initialPayload.template.defaultTheme));
  }, [initialPayload.template.defaultTheme, setTheme]);

  const handleCaseStudyTitleChange = useCallback(
    (nextTitle: string) => {
      setPuckData((prev) => ({
        ...prev,
        root: {
          ...prev.root,
          props: {
            ...prev.root.props,
            title: nextTitle,
          },
        },
      }));
    },
    [setPuckData],
  );

  const slotItems = useMemo(
    () => collectProjectSlotStatus(puckData, initialPayload.template.slots),
    [puckData, initialPayload.template.slots],
  );

  const filledSlotCount = useMemo(
    () => slotItems.filter((item) => item.filled).length,
    [slotItems],
  );

  const emptyRequiredSlots = useMemo(
    () => slotItems.filter((item) => item.required && !item.filled),
    [slotItems],
  );

  const selectedSection =
    selectedSectionIndex !== null ? (puckData.content[selectedSectionIndex] ?? null) : null;

  return (
    <div
      data-testid="constrained-editor-root"
      style={PUCK_FONT_VARS}
      className="bg-surface text-foreground flex h-dvh min-h-dvh flex-col overflow-hidden"
    >
      <Puck
        config={puckConfig as unknown as Config}
        data={puckData as unknown as Data}
        onAction={handlePuckAction}
        permissions={CONSTRAINED_PUCK_PERMISSIONS}
        height="100%"
        dnd={{
          disableAutoScroll: true,
          disableOutlineDrag: true,
        }}
        iframe={{ enabled: false }}
        metadata={{
          projectType: initialPayload.project.type,
          slots: initialPayload.template.slots,
        }}
      >
        <PuckStateBridge
          externalPuckData={puckData}
          selectedSectionIndex={selectedSectionIndex}
          lastPuckEmittedJsonRef={lastPuckEmittedJsonRef}
        />

        <div
          style={{ visibility: "visible" }}
          className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
        >
          {/* Top Editor Bar (matches Figma 2:4347, compact at 375px) */}
          <header
            data-slot="editor-topbar"
            className="border-border bg-background z-30 flex h-15 shrink-0 items-center justify-between gap-2 border-b px-3 sm:h-17 sm:gap-3 sm:px-6"
          >
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <Link
                href="/dashboard"
                aria-label="Back to projects"
                className="border-border bg-elevated text-foreground hover:bg-surface focus-visible:ring-ring/40 inline-flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors outline-none focus-visible:ring-2 sm:size-9"
              >
                <ArrowLeft className="size-4" />
              </Link>

              <div className="flex min-w-0 flex-col">
                <span className="text-foreground type-body-s-strong sm:type-body-m-strong truncate">
                  {puckData.root.props.title || initialPayload.project.name}
                </span>
                <span
                  data-testid="editor-save-indicator"
                  data-save-status={saveStatus}
                  className="text-tertiary type-caption inline-flex min-w-0 items-center gap-1.5 truncate"
                >
                  {saveStatus === "saving" && (
                    <>
                      <Loader2 className="text-primary size-3.5 shrink-0 animate-spin" />
                      <span className="truncate">Saving...</span>
                    </>
                  )}
                  {saveStatus === "unsaved" && (
                    <>
                      <Cloud className="text-muted-foreground size-3.5 shrink-0" />
                      <span className="truncate">Unsaved changes</span>
                    </>
                  )}
                  {saveStatus === "saved" && (
                    <>
                      <Cloud className="text-success size-3.5 shrink-0" />
                      <span className="truncate">Saved · just now</span>
                    </>
                  )}
                  {saveStatus === "conflict" && (
                    <>
                      <AlertTriangle className="text-warning size-3.5 shrink-0" />
                      <span className="text-warning truncate">Save conflict</span>
                    </>
                  )}
                  {saveStatus === "error" && (
                    <>
                      <AlertCircle className="text-destructive size-3.5 shrink-0" />
                      <span className="text-destructive truncate">Save failed</span>
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Center Device Toggle (matches Figma 2:4359 & 2:6367) */}
            <div
              role="group"
              aria-label="Preview viewport"
              className="bg-sunken hidden items-center rounded-full p-1 md:inline-flex"
            >
              <button
                type="button"
                aria-pressed={viewport === "desktop"}
                onClick={() => setViewport("desktop")}
                className={cn(
                  "type-body-s-strong inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition-colors",
                  viewport === "desktop"
                    ? "bg-elevated text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Monitor className="size-3.5" />
                <span>Desktop</span>
              </button>
              <button
                type="button"
                aria-pressed={viewport === "mobile"}
                onClick={() => setViewport("mobile")}
                className={cn(
                  "type-body-s-strong inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition-colors",
                  viewport === "mobile"
                    ? "bg-elevated text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Smartphone className="size-3.5" />
                <span>Mobile</span>
              </button>
            </div>

            {/* Right Actions */}
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                aria-label="Undo"
                disabled={!canUndo}
                onClick={handleUndo}
                className="border-border bg-elevated text-foreground hover:bg-surface inline-flex size-8 items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-45 sm:size-9"
              >
                <Undo2 className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Redo"
                disabled={!canRedo}
                onClick={handleRedo}
                className="border-border bg-elevated text-foreground hover:bg-surface inline-flex size-8 items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-45 sm:size-9"
              >
                <Redo2 className="size-4" />
              </button>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                aria-label="Preview case study"
                onClick={() => setPreviewModalOpen(true)}
                className="size-8 p-0 sm:h-9 sm:w-auto sm:px-3"
              >
                <Eye className="size-4" />
                <span className="hidden sm:inline">Preview</span>
              </Button>

              <Button asChild size="sm" className="px-2.5 sm:px-3.5">
                <Link href={`/projects/${initialPayload.project.id}/share`}>
                  <Globe className="size-3.5" />
                  <span>Publish</span>
                </Link>
              </Button>
            </div>
          </header>

        {/* 3-Panel Workspace (matches Figma 2:4385) */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* LEFT PANEL: Style / Content / Sections (340px on desktop) */}
          <aside
            aria-label="Template customization and sections"
            data-slot="editor-left-panel"
            className="border-border bg-background hidden w-85 shrink-0 flex-col border-r lg:flex"
          >
            <div className="border-border border-b p-4">
              <div
                role="tablist"
                aria-label="Editor sidebar tabs"
                className="bg-sunken grid grid-cols-3 rounded-full p-1"
              >
                {(
                  [
                    { key: "style", label: "Style" },
                    { key: "content", label: "Content" },
                    { key: "sections", label: "Sections" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={leftTab === tab.key}
                    onClick={() => setLeftTab(tab.key)}
                    className={cn(
                      "type-body-s-strong rounded-full py-1.5 text-center transition-colors",
                      leftTab === tab.key
                        ? "bg-elevated text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {/* TAB: SECTIONS (matches Figma 2:4784 — visibility toggles only, no free-canvas add/drag) */}
              {leftTab === "sections" && (
                <div data-testid="editor-sections-panel" className="flex flex-col gap-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="text-foreground type-heading-s">Sections</h2>
                    <span className="text-tertiary type-caption">
                      Template: {initialPayload.template.name}
                    </span>
                  </div>

                  <p className="text-muted-foreground type-caption">
                    Select any section to edit its fields. Optional sections can be hidden.
                  </p>

                  <div className="flex flex-col gap-2.5">
                    {puckData.content.map((section, idx) => {
                      const required = isSectionRequired(section.type);
                      const hidden = Boolean(section.props.hidden);
                      const isSelected = selectedSectionIndex === idx;
                      const label = formatSectionTypeLabel(section.type);

                      return (
                        <div
                          key={section.props.id}
                          data-testid={`section-row-${section.type}`}
                          data-hidden={hidden ? "true" : "false"}
                          className={cn(
                            "flex items-center justify-between gap-3 rounded-xl border p-3.5 transition-colors",
                            isSelected
                              ? "border-primary bg-accent/40"
                              : "border-border bg-card hover:border-border-strong",
                            hidden && "opacity-65",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => handleSelectSection(idx)}
                            className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left outline-none"
                          >
                            <span className="text-foreground type-body-s-strong truncate">
                              {label}
                            </span>
                            <span className="text-tertiary type-caption">
                              {required
                                ? "Required"
                                : hidden
                                  ? "Optional · hidden"
                                  : "Optional"}
                            </span>
                          </button>

                          {required ? (
                            <Badge tone="neutral" withDot={false}>
                              Locked
                            </Badge>
                          ) : (
                            <button
                              type="button"
                              role="switch"
                              aria-checked={!hidden}
                              aria-label={`Toggle ${label} visibility`}
                              data-testid={`toggle-section-${section.type}`}
                              onClick={() => handleToggleSection(idx)}
                              className={cn(
                                "focus-visible:ring-ring/40 relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors outline-none focus-visible:ring-2",
                                !hidden ? "bg-primary" : "bg-border-strong",
                              )}
                            >
                              <span
                                aria-hidden="true"
                                className={cn(
                                  "bg-background inline-block size-4.5 rounded-full shadow-xs transition-transform",
                                  !hidden ? "translate-x-5.5" : "translate-x-1",
                                )}
                              />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB: CONTENT */}
              {leftTab === "content" && (
                <div data-testid="editor-content-panel" className="flex flex-col gap-5">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="editor-case-study-title">Case study title</Label>
                    <Input
                      id="editor-case-study-title"
                      value={puckData.root.props.title}
                      onChange={(e) => handleCaseStudyTitleChange(e.target.value)}
                    />
                  </div>

                  <div className="border-border flex flex-col gap-2 border-t pt-4">
                    <span className="text-tertiary type-overline">Jump to section fields</span>
                    <div className="flex flex-col gap-1.5">
                      {puckData.content.map((section, idx) => {
                        const hidden = Boolean(section.props.hidden);
                        const label = formatSectionTypeLabel(section.type);
                        return (
                          <button
                            key={section.props.id}
                            type="button"
                            onClick={() => handleSelectSection(idx)}
                            className={cn(
                              "flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors",
                              selectedSectionIndex === idx
                                ? "border-primary bg-accent/40 text-foreground type-body-s-strong"
                                : "border-border bg-card text-muted-foreground hover:text-foreground type-body-s",
                            )}
                          >
                            <span>{label}</span>
                            {hidden && <EyeOff className="text-tertiary size-3.5" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: STYLE (Theme palette tokens, presets, WCAG contrast, & curated font pairs) */}
              {leftTab === "style" && (
                <ThemePanel
                  theme={theme}
                  onChangeTheme={setTheme}
                  onResetToDefaults={handleResetThemeToDefaults}
                />
              )}
            </div>
          </aside>

          {/* CENTER PANEL: Live Preview Canvas (matches Figma 2:4438) */}
          <main
            id="main-content"
            data-slot="editor-canvas"
            className="bg-surface flex min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-3 py-4 sm:px-8 sm:py-6"
          >
            <div className="mx-auto mb-4 flex flex-wrap items-center justify-center gap-2 text-center sm:mb-5 sm:gap-2.5">
              <Badge tone="neutral" withDot={false}>
                {initialPayload.template.name} · v{initialPayload.template.version}
              </Badge>
              <span className="text-tertiary type-caption">
                Live preview · same renderer as publish &amp; export
              </span>
            </div>

            <EditorCanvasPreview
              puckData={puckData}
              theme={theme}
              slots={initialPayload.template.slots}
              projectType={initialPayload.project.type}
              viewport={viewport}
              selectedSectionIndex={selectedSectionIndex}
              onSelectSection={handleCanvasSelectSection}
            />
          </main>

          {/* RIGHT PANEL: Constrained Puck Fields Inspector & Slots Checklist (matches Figma 2:4480) */}
          <aside
            aria-label="Section fields and screen slots"
            data-slot="editor-right-panel"
            className="border-border bg-background hidden w-85 shrink-0 flex-col border-l lg:flex"
          >
            <div className="border-border border-b p-4">
              <div
                role="tablist"
                aria-label="Inspector tabs"
                className="bg-sunken grid grid-cols-2 rounded-full p-1"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={rightTab === "fields"}
                  onClick={() => setRightTab("fields")}
                  className={cn(
                    "type-body-s-strong inline-flex items-center justify-center gap-1.5 rounded-full py-1.5 transition-colors",
                    rightTab === "fields"
                      ? "bg-elevated text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <SlidersHorizontal className="size-3.5" />
                  <span>Fields</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={rightTab === "slots"}
                  onClick={() => setRightTab("slots")}
                  className={cn(
                    "type-body-s-strong inline-flex items-center justify-center gap-1.5 rounded-full py-1.5 transition-colors",
                    rightTab === "slots"
                      ? "bg-elevated text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span>Screenshots</span>
                  <span className="text-tertiary type-caption">
                    {filledSlotCount}/{slotItems.length}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {rightTab === "fields" && (
                <div data-testid="editor-fields-inspector" className="flex flex-col gap-4">
                  {selectedSection ? (
                    <>
                      <div className="border-border flex items-center justify-between gap-2 border-b pb-3">
                        <div className="flex flex-col">
                          <span className="text-tertiary type-overline">Editing section</span>
                          <h2 className="text-foreground type-heading-s">
                            {formatSectionTypeLabel(selectedSection.type)}
                          </h2>
                        </div>
                        {Boolean(selectedSection.props.hidden) && (
                          <Badge tone="draft">Hidden</Badge>
                        )}
                      </div>

                      {mobileSheetTab !== "fields" && <Puck.Fields wrapFields />}
                    </>
                  ) : (
                    <div className="text-muted-foreground type-body-s py-8 text-center">
                      Click any section on the canvas or in the Sections list to edit its content.
                    </div>
                  )}
                </div>
              )}

              {rightTab === "slots" && (
                <div data-testid="editor-slots-panel" className="flex flex-col gap-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="text-foreground type-heading-s">Screenshots</h2>
                    <span className="text-tertiary type-caption">
                      {filledSlotCount} / {slotItems.length} slots
                    </span>
                  </div>

                  {emptyRequiredSlots.length > 0 && (
                    <div className="border-warning/40 bg-warning-soft text-foreground flex items-start gap-2.5 rounded-lg border p-3">
                      <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" />
                      <span className="type-caption">
                        {emptyRequiredSlots.length} required{" "}
                        {emptyRequiredSlots.length === 1 ? "slot is" : "slots are"} empty:{" "}
                        &ldquo;{emptyRequiredSlots[0]?.label}&rdquo;
                      </span>
                    </div>
                  )}

                  <span className="text-tertiary type-overline">Slots</span>

                  <div className="flex flex-col gap-2">
                    {slotItems.map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => handleSelectSection(slot.sectionIndex)}
                        className="border-border bg-card hover:border-border-strong flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="bg-sunken border-border inline-flex h-11 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border">
                            {slot.filled ? (
                              <Check className="text-success size-3.5" />
                            ) : (
                              <span className="bg-border size-2 rounded-full" />
                            )}
                          </span>
                          <div className="flex min-w-0 flex-col">
                            <span className="text-foreground type-body-s-strong truncate">
                              {slot.label}
                            </span>
                            <span className="text-tertiary type-caption capitalize">
                              {slot.device} · {slot.ratio}
                            </span>
                          </div>
                        </div>

                        <Badge tone={slot.filled ? "published" : "draft"}>
                          {slot.filled ? "Filled" : "Empty"}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>

          {/* Mobile Bottom Action Bar (< 1024px, usable at 375px) */}
          <nav
            aria-label="Mobile editor controls"
            data-testid="editor-mobile-bar"
            className="border-border bg-elevated z-30 grid shrink-0 grid-cols-4 gap-1 border-t px-2 py-1.5 lg:hidden"
          >
            <button
              type="button"
              data-testid="mobile-open-fields"
              aria-expanded={mobileSheetTab === "fields"}
              onClick={() => setMobileSheetTab("fields")}
              className={cn(
                "focus-visible:ring-ring/40 flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 py-1 transition-colors outline-none focus-visible:ring-2",
                mobileSheetTab === "fields"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground",
              )}
            >
              <SlidersHorizontal className="size-4 shrink-0" />
              <span className="type-caption font-medium">Fields</span>
            </button>

            <button
              type="button"
              data-testid="mobile-open-sections"
              aria-expanded={mobileSheetTab === "sections"}
              onClick={() => setMobileSheetTab("sections")}
              className={cn(
                "focus-visible:ring-ring/40 flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 py-1 transition-colors outline-none focus-visible:ring-2",
                mobileSheetTab === "sections"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground",
              )}
            >
              <Layers className="size-4 shrink-0" />
              <span className="type-caption font-medium">Sections</span>
            </button>

            <button
              type="button"
              data-testid="mobile-open-style"
              aria-expanded={mobileSheetTab === "style"}
              onClick={() => setMobileSheetTab("style")}
              className={cn(
                "focus-visible:ring-ring/40 flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 py-1 transition-colors outline-none focus-visible:ring-2",
                mobileSheetTab === "style"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground",
              )}
            >
              <Palette className="size-4 shrink-0" />
              <span className="type-caption font-medium">Style</span>
            </button>

            <button
              type="button"
              data-testid="mobile-open-slots"
              aria-expanded={mobileSheetTab === "slots"}
              onClick={() => setMobileSheetTab("slots")}
              className={cn(
                "focus-visible:ring-ring/40 flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 py-1 transition-colors outline-none focus-visible:ring-2",
                mobileSheetTab === "slots"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground",
              )}
            >
              <Smartphone className="size-4 shrink-0" />
              <span className="type-caption font-medium">
                Screens {filledSlotCount}/{slotItems.length}
              </span>
            </button>
          </nav>

          {/* Mobile Bottom-Sheet Drawer (Fields / Sections / Style / Screens) */}
          <Sheet
            open={mobileSheetTab !== null}
            onOpenChange={(open) => {
              if (!open) setMobileSheetTab(null);
            }}
          >
            <SheetContent
              side="bottom"
              data-testid="editor-mobile-sheet"
              className="border-border bg-background flex max-h-[82dvh] flex-col gap-0 rounded-t-2xl p-0"
            >
              <SheetHeader className="border-border shrink-0 gap-3 border-b px-4 pt-4 pr-12 pb-3 text-left">
                <div className="flex flex-col gap-0.5">
                  <SheetTitle>
                    {mobileSheetTab === "fields" &&
                      (selectedSection
                        ? `Edit ${formatSectionTypeLabel(selectedSection.type)}`
                        : "Section fields")}
                    {mobileSheetTab === "sections" && "Sections"}
                    {mobileSheetTab === "style" && "Theme & project style"}
                    {mobileSheetTab === "slots" && "Screenshots & preview"}
                  </SheetTitle>
                  <SheetDescription className="sr-only">
                    Constrained mobile editor drawer for fields, sections, theme, and screenshot
                    slots.
                  </SheetDescription>
                </div>

                <div
                  role="tablist"
                  aria-label="Mobile editor panels"
                  className="bg-sunken grid grid-cols-4 rounded-full p-1"
                >
                  {(
                    [
                      { key: "fields", label: "Fields" },
                      { key: "sections", label: "Sections" },
                      { key: "style", label: "Style" },
                      { key: "slots", label: "Screens" },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={mobileSheetTab === tab.key}
                      onClick={() => setMobileSheetTab(tab.key)}
                      className={cn(
                        "type-caption rounded-full py-1.5 text-center font-medium transition-colors",
                        mobileSheetTab === tab.key
                          ? "bg-elevated text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </SheetHeader>

              <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-8">
                {mobileSheetTab === "fields" && (
                  <div data-testid="mobile-fields-drawer" className="flex flex-col gap-4">
                    <div
                      role="group"
                      aria-label="Select section to edit"
                      className="flex items-center gap-1.5 overflow-x-auto pb-1"
                    >
                      {puckData.content.map((section, idx) => {
                        const label = formatSectionTypeLabel(section.type);
                        const active = selectedSectionIndex === idx;
                        return (
                          <button
                            key={section.props.id}
                            type="button"
                            aria-pressed={active}
                            onClick={() => handleSelectSection(idx)}
                            className={cn(
                              "type-caption inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 font-medium transition-colors",
                              active
                                ? "border-primary bg-accent text-foreground"
                                : "border-border bg-card text-muted-foreground hover:text-foreground",
                            )}
                          >
                            <span>{label}</span>
                            {Boolean(section.props.hidden) && (
                              <EyeOff className="text-tertiary size-3" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {selectedSection ? (
                      <Puck.Fields wrapFields />
                    ) : (
                      <div className="text-muted-foreground type-body-s py-6 text-center">
                        Select a section above to edit its fields.
                      </div>
                    )}
                  </div>
                )}

                {mobileSheetTab === "sections" && (
                  <div data-testid="mobile-sections-drawer" className="flex flex-col gap-3">
                    <p className="text-muted-foreground type-caption">
                      Tap a section to edit its fields, or toggle optional sections on and off.
                    </p>
                    <div className="flex flex-col gap-2">
                      {puckData.content.map((section, idx) => {
                        const required = isSectionRequired(section.type);
                        const hidden = Boolean(section.props.hidden);
                        const isSelected = selectedSectionIndex === idx;
                        const label = formatSectionTypeLabel(section.type);

                        return (
                          <div
                            key={section.props.id}
                            className={cn(
                              "flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors",
                              isSelected
                                ? "border-primary bg-accent/40"
                                : "border-border bg-card",
                              hidden && "opacity-65",
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                handleSelectSection(idx);
                                setMobileSheetTab("fields");
                              }}
                              className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left outline-none"
                            >
                              <span className="text-foreground type-body-s-strong truncate">
                                {label}
                              </span>
                              <span className="text-tertiary type-caption">
                                {required
                                  ? "Required"
                                  : hidden
                                    ? "Optional · hidden"
                                    : "Optional"}
                              </span>
                            </button>

                            {required ? (
                              <Badge tone="neutral" withDot={false}>
                                Locked
                              </Badge>
                            ) : (
                              <button
                                type="button"
                                role="switch"
                                aria-checked={!hidden}
                                aria-label={`Toggle ${label} visibility`}
                                data-testid={`mobile-toggle-section-${section.type}`}
                                onClick={() => handleToggleSection(idx)}
                                className={cn(
                                  "focus-visible:ring-ring/40 relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors outline-none focus-visible:ring-2",
                                  !hidden ? "bg-primary" : "bg-border-strong",
                                )}
                              >
                                <span
                                  aria-hidden="true"
                                  className={cn(
                                    "bg-background inline-block size-4.5 rounded-full shadow-xs transition-transform",
                                    !hidden ? "translate-x-5.5" : "translate-x-1",
                                  )}
                                />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {mobileSheetTab === "style" && (
                  <div data-testid="mobile-style-drawer" className="flex flex-col gap-5">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="mobile-editor-case-study-title">Case study title</Label>
                      <Input
                        id="mobile-editor-case-study-title"
                        value={puckData.root.props.title}
                        onChange={(e) => handleCaseStudyTitleChange(e.target.value)}
                      />
                    </div>

                    <div className="border-border border-t pt-4">
                      <ThemePanel
                        theme={theme}
                        onChangeTheme={setTheme}
                        onResetToDefaults={handleResetThemeToDefaults}
                      />
                    </div>
                  </div>
                )}

                {mobileSheetTab === "slots" && (
                  <div data-testid="mobile-slots-drawer" className="flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-tertiary type-overline">Preview frame</span>
                      <div
                        role="group"
                        aria-label="Mobile preview viewport"
                        className="bg-sunken inline-flex items-center rounded-full p-1"
                      >
                        <button
                          type="button"
                          aria-pressed={viewport === "desktop"}
                          onClick={() => setViewport("desktop")}
                          className={cn(
                            "type-caption inline-flex items-center gap-1 rounded-full px-3 py-1 font-medium transition-colors",
                            viewport === "desktop"
                              ? "bg-elevated text-foreground shadow-xs"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <Monitor className="size-3.5" />
                          <span>Desktop</span>
                        </button>
                        <button
                          type="button"
                          aria-pressed={viewport === "mobile"}
                          onClick={() => setViewport("mobile")}
                          className={cn(
                            "type-caption inline-flex items-center gap-1 rounded-full px-3 py-1 font-medium transition-colors",
                            viewport === "mobile"
                              ? "bg-elevated text-foreground shadow-xs"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <Smartphone className="size-3.5" />
                          <span>Mobile</span>
                        </button>
                      </div>
                    </div>

                    <div className="border-border flex flex-col gap-3 border-t pt-4">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="text-foreground type-heading-s">Screenshots</h3>
                        <span className="text-tertiary type-caption">
                          {filledSlotCount} / {slotItems.length} slots
                        </span>
                      </div>

                      <div className="flex flex-col gap-2">
                        {slotItems.map((slot) => (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => {
                              handleSelectSection(slot.sectionIndex);
                              setMobileSheetTab("fields");
                            }}
                            className="border-border bg-card hover:border-border-strong flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="bg-sunken border-border inline-flex h-11 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border">
                                {slot.filled ? (
                                  <Check className="text-success size-3.5" />
                                ) : (
                                  <span className="bg-border size-2 rounded-full" />
                                )}
                              </span>
                              <div className="flex min-w-0 flex-col">
                                <span className="text-foreground type-body-s-strong truncate">
                                  {slot.label}
                                </span>
                                <span className="text-tertiary type-caption capitalize">
                                  {slot.device} · {slot.ratio}
                                </span>
                              </div>
                            </div>

                            <Badge tone={slot.filled ? "published" : "draft"}>
                              {slot.filled ? "Filled" : "Empty"}
                            </Badge>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </Puck>

      {/* Save Error / Conflict Banner (matches Figma 2:6162) */}
      {(saveStatus === "error" || saveStatus === "conflict") && (
        <div
          role="alert"
          data-testid="editor-save-toast"
          className="bg-inverse text-inverse-foreground shadow-card fixed bottom-20 left-1/2 z-50 flex w-[min(92vw,26rem)] -translate-x-1/2 items-center justify-between gap-3 rounded-2xl px-4 py-3 lg:bottom-6"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="bg-destructive text-primary-foreground inline-flex size-6 shrink-0 items-center justify-center rounded-full">
              <AlertCircle className="size-3.5" />
            </span>
            <span className="type-body-s truncate">
              {saveError ||
                (saveStatus === "conflict"
                  ? "This project was updated in another session."
                  : "Couldn't save your last change.")}
            </span>
          </div>

          {saveStatus === "conflict" ? (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-primary type-body-s-strong shrink-0 cursor-pointer underline-offset-4 hover:underline"
            >
              Reload
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void performAutosave()}
              className="text-primary type-body-s-strong shrink-0 cursor-pointer underline-offset-4 hover:underline"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Full Clean Preview Modal */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {puckData.root.props.title || initialPayload.project.name}
            </DialogTitle>
            <DialogDescription>
              Clean publish &amp; export preview ({initialPayload.template.name} · v
              {initialPayload.template.version})
            </DialogDescription>
          </DialogHeader>

          <div className="border-border max-h-[70vh] overflow-y-auto rounded-xl border">
            <TemplatePuckRenderer
              puckData={puckData}
              theme={theme}
              slots={initialPayload.template.slots}
              projectType={initialPayload.project.type}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPreviewModalOpen(false)}
            >
              Back to editor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
