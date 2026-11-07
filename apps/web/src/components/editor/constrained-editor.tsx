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
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileText,
  Globe,
  Image as ImageIcon,
  Layers,
  Loader2,
  Minus,
  Monitor,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Redo2,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Smartphone,
  Trash2,
  Undo2,
  X,
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
  type WheelEvent as ReactWheelEvent,
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
  duplicateSectionInDocument,
  formatSectionSummaryLabel,
  formatSectionTypeLabel,
  insertSectionPresetIntoDocument,
  isSectionRequired,
  moveSectionInDocument,
  removeSectionFromDocument,
  SECTION_PRESET_OPTIONS,
  toggleSectionVisibility,
  type ProjectEditorPayload,
  type SaveProjectEditorInput,
  type SaveProjectEditorResult,
  type SectionPresetKey,
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
type SlotFilterMode = "all" | "empty" | "filled";

export const MIN_CANVAS_ZOOM = 0.5;
export const MAX_CANVAS_ZOOM = 2;
export const CANVAS_ZOOM_STEP = 0.1;

function clampCanvasZoom(value: number): number {
  const clamped = Math.min(MAX_CANVAS_ZOOM, Math.max(MIN_CANVAS_ZOOM, value));
  return Math.round(clamped * 100) / 100;
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }
  if (target.isContentEditable) {
    return true;
  }
  return Boolean(target.closest('[contenteditable="true"], [role="textbox"]'));
}

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

interface SafariGestureEvent extends Event {
  scale: number;
}

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
  const [canvasZoom, setCanvasZoom] = useState<number>(1);
  const [leftPanelOpen, setLeftPanelOpen] = useState<boolean>(true);
  const [rightPanelOpen, setRightPanelOpen] = useState<boolean>(true);
  const [leftTab, setLeftTab] = useState<LeftPanelTab>("sections");
  const [rightTab, setRightTab] = useState<RightPanelTab>("fields");
  const [mobileSheetTab, setMobileSheetTab] = useState<MobileSheetTab | null>(null);
  const [selectedSectionIndex, setSelectedSectionIndex] = useState<number | null>(0);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [insertPickerOpen, setInsertPickerOpen] = useState(false);
  const [sectionSearchQuery, setSectionSearchQuery] = useState("");
  const [slotFilter, setSlotFilter] = useState<SlotFilterMode>("all");
  const allowSectionMutations = initialPayload.template.allowSectionMutations !== false;

  const canvasZoomRef = useRef(canvasZoom);
  canvasZoomRef.current = canvasZoom;

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
  const canvasScrollRef = useRef<HTMLElement | null>(null);

  const colorKeys = useMemo(() => Object.keys(theme.colors), [theme.colors]);
  const puckConfig = useMemo(
    () =>
      createCasefolioPuckConfig(colorKeys, {
        projectId: initialPayload.project.id,
        slots: initialPayload.template.slots,
      }),
    [colorKeys, initialPayload.project.id, initialPayload.template.slots],
  );

  const handleZoomIn = useCallback(() => {
    setCanvasZoom((prev) => clampCanvasZoom(Math.round((prev + CANVAS_ZOOM_STEP) * 10) / 10));
  }, []);

  const handleZoomOut = useCallback(() => {
    setCanvasZoom((prev) => clampCanvasZoom(Math.round((prev - CANVAS_ZOOM_STEP) * 10) / 10));
  }, []);

  const handleZoomReset = useCallback(() => {
    setCanvasZoom(1);
  }, []);

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

  // Global keyboard shortcuts:
  // - Ctrl/Cmd+Z (Undo), Ctrl/Cmd+Shift+Z or Ctrl+Y (Redo)
  // - Ctrl/Cmd + (+/=/-/0) OR plain +/=/-/0 (when not typing in inputs) for canvas zoom
  // - [ / ] (when not typing) or Ctrl/Cmd+\ to toggle left/right panels
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMod = event.metaKey || event.ctrlKey;

      if (isMod && !event.altKey) {
        const key = event.key.toLowerCase();
        if (key === "z") {
          event.preventDefault();
          event.stopPropagation();
          if (event.shiftKey) {
            handleRedo();
          } else {
            handleUndo();
          }
          return;
        }
        if (event.ctrlKey && !event.metaKey && key === "y") {
          event.preventDefault();
          event.stopPropagation();
          handleRedo();
          return;
        }
        if (
          event.key === "+" ||
          event.key === "=" ||
          event.code === "Equal" ||
          event.code === "NumpadAdd"
        ) {
          event.preventDefault();
          handleZoomIn();
          return;
        }
        if (
          event.key === "-" ||
          event.key === "_" ||
          event.code === "Minus" ||
          event.code === "NumpadSubtract"
        ) {
          event.preventDefault();
          handleZoomOut();
          return;
        }
        if (event.key === "0" || event.code === "Digit0" || event.code === "Numpad0") {
          event.preventDefault();
          handleZoomReset();
          return;
        }
        if (event.key === "\\") {
          event.preventDefault();
          setLeftPanelOpen((prevLeft) => {
            const shouldOpenBoth = !prevLeft && !rightPanelOpen;
            setRightPanelOpen(shouldOpenBoth);
            return shouldOpenBoth;
          });
          return;
        }
        return;
      }

      if (event.altKey || isEditableKeyboardTarget(event.target)) {
        return;
      }

      if (event.key === "+" || event.key === "=" || event.code === "NumpadAdd") {
        event.preventDefault();
        handleZoomIn();
      } else if (event.key === "-" || event.key === "_" || event.code === "NumpadSubtract") {
        event.preventDefault();
        handleZoomOut();
      } else if (event.key === "0" || event.code === "Numpad0") {
        event.preventDefault();
        handleZoomReset();
      } else if (event.key === "[") {
        event.preventDefault();
        setLeftPanelOpen((prev) => !prev);
      } else if (event.key === "]") {
        event.preventDefault();
        setRightPanelOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [handleRedo, handleUndo, handleZoomIn, handleZoomOut, handleZoomReset, rightPanelOpen]);

  // Canvas wheel (Ctrl/Cmd/Alt + wheel & trackpad two-finger pinch) + Safari gesture + touch pinch
  useEffect(() => {
    const canvasEl = canvasScrollRef.current;
    if (!canvasEl) return;

    let gestureBaseZoom = canvasZoomRef.current;
    let touchStartDist: number | null = null;
    let touchBaseZoom = canvasZoomRef.current;

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        return;
      }
      event.preventDefault();
      if (event.deltaY === 0) return;

      const delta =
        Math.abs(event.deltaY) >= 40
          ? -Math.sign(event.deltaY) * CANVAS_ZOOM_STEP
          : -event.deltaY * 0.01;

      setCanvasZoom((prev) => clampCanvasZoom(prev + delta));
    };

    const handleGestureStart = (event: Event) => {
      event.preventDefault();
      gestureBaseZoom = canvasZoomRef.current;
    };

    const handleGestureChange = (event: Event) => {
      event.preventDefault();
      const scale = (event as SafariGestureEvent).scale;
      if (typeof scale === "number" && Number.isFinite(scale) && scale > 0) {
        setCanvasZoom(clampCanvasZoom(gestureBaseZoom * scale));
      }
    };

    const measureTouchDistance = (touches: TouchList): number => {
      const t0 = touches[0];
      const t1 = touches[1];
      if (!t0 || !t1) return 0;
      return Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        touchStartDist = measureTouchDistance(event.touches);
        touchBaseZoom = canvasZoomRef.current;
      }
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 2 && touchStartDist && touchStartDist > 0) {
        event.preventDefault();
        const nextDist = measureTouchDistance(event.touches);
        if (nextDist > 0) {
          setCanvasZoom(clampCanvasZoom(touchBaseZoom * (nextDist / touchStartDist)));
        }
      }
    };

    const handleTouchEnd = () => {
      touchStartDist = null;
    };

    canvasEl.addEventListener("wheel", handleWheel, { passive: false });
    canvasEl.addEventListener("gesturestart", handleGestureStart, { passive: false });
    canvasEl.addEventListener("gesturechange", handleGestureChange, { passive: false });
    canvasEl.addEventListener("touchstart", handleTouchStart, { passive: true });
    canvasEl.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvasEl.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      canvasEl.removeEventListener("wheel", handleWheel);
      canvasEl.removeEventListener("gesturestart", handleGestureStart);
      canvasEl.removeEventListener("gesturechange", handleGestureChange);
      canvasEl.removeEventListener("touchstart", handleTouchStart);
      canvasEl.removeEventListener("touchmove", handleTouchMove);
      canvasEl.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  const handleZoomBarWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    if (event.deltaY === 0) return;
    event.preventDefault();
    event.stopPropagation();
    const delta = -Math.sign(event.deltaY) * CANVAS_ZOOM_STEP;
    setCanvasZoom((prev) => clampCanvasZoom(prev + delta));
  }, []);

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
    requestAnimationFrame(() => {
      const target = canvasScrollRef.current?.querySelector<HTMLElement>(
        `[data-editor-section-index="${index}"]`,
      );
      target?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    });
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

  const handleMoveSection = useCallback(
    (index: number, direction: "up" | "down") => {
      if (!allowSectionMutations) return;
      setPuckData((prev) => {
        const { puckData: next, nextIndex } = moveSectionInDocument(prev, index, direction);
        if (next === prev) return prev;
        if (selectedSectionIndex === index) {
          setSelectedSectionIndex(nextIndex);
        } else if (selectedSectionIndex === nextIndex) {
          setSelectedSectionIndex(index);
        }
        return next;
      });
    },
    [allowSectionMutations, selectedSectionIndex, setPuckData],
  );

  const handleDuplicateSection = useCallback(
    (index: number) => {
      if (!allowSectionMutations) return;
      let targetIdx = index;
      setPuckData((prev) => {
        const { puckData: next, insertedIndex } = duplicateSectionInDocument(prev, index);
        targetIdx = insertedIndex;
        return next;
      });
      setSelectedSectionIndex(targetIdx);
      setRightTab("fields");
      requestAnimationFrame(() => {
        const target = canvasScrollRef.current?.querySelector<HTMLElement>(
          `[data-editor-section-index="${targetIdx}"]`,
        );
        target?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      });
    },
    [allowSectionMutations, setPuckData],
  );

  const handleRemoveSection = useCallback(
    (index: number) => {
      if (!allowSectionMutations) return;
      setPuckData((prev) => {
        const { puckData: next, nextSelectedIndex } = removeSectionFromDocument(prev, index);
        if (next === prev) return prev;
        setSelectedSectionIndex(nextSelectedIndex);
        return next;
      });
    },
    [allowSectionMutations, setPuckData],
  );

  const handleInsertSectionPreset = useCallback(
    (presetKey: SectionPresetKey) => {
      if (!allowSectionMutations) return;
      let targetIdx = 1;
      setPuckData((prev) => {
        const { puckData: next, insertedIndex } = insertSectionPresetIntoDocument(
          prev,
          presetKey,
          initialPayload.template.slots,
          selectedSectionIndex,
        );
        targetIdx = insertedIndex;
        return next;
      });
      setInsertPickerOpen(false);
      setSelectedSectionIndex(targetIdx);
      setRightTab("fields");
      requestAnimationFrame(() => {
        const target = canvasScrollRef.current?.querySelector<HTMLElement>(
          `[data-editor-section-index="${targetIdx}"]`,
        );
        target?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      });
    },
    [allowSectionMutations, initialPayload.template.slots, selectedSectionIndex, setPuckData],
  );

  const firstIndexByType = useMemo(() => {
    const map = new Map<string, number>();
    puckData.content.forEach((item, idx) => {
      if (!map.has(item.type)) {
        map.set(item.type, idx);
      }
    });
    return map;
  }, [puckData.content]);

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

  const emptySlotCount = slotItems.length - filledSlotCount;

  const emptyRequiredSlots = useMemo(
    () => slotItems.filter((item) => item.required && !item.filled),
    [slotItems],
  );

  const filteredSlotItems = useMemo(() => {
    if (slotFilter === "empty") return slotItems.filter((item) => !item.filled);
    if (slotFilter === "filled") return slotItems.filter((item) => item.filled);
    return slotItems;
  }, [slotFilter, slotItems]);

  const visibleSectionCount = useMemo(
    () => puckData.content.filter((item) => !item.props.hidden).length,
    [puckData.content],
  );

  const normalizedSectionFilter = sectionSearchQuery.trim().toLowerCase();

  const selectedSection =
    selectedSectionIndex !== null ? (puckData.content[selectedSectionIndex] ?? null) : null;

  const zoomPercent = Math.round(canvasZoom * 100);
  const slotProgressPercent =
    slotItems.length > 0 ? Math.round((filledSlotCount / slotItems.length) * 100) : 100;

  // Ensure Puck's internal icon-only ArrayField buttons always carry accessible names (WCAG 4.1.2)
  useEffect(() => {
    const root = document.querySelector('[data-testid="constrained-editor-root"]');
    if (!root) return;

    const patchPuckButtons = () => {
      const addButtons = root.querySelectorAll<HTMLButtonElement>(
        'button[class*="_ArrayField-addButton_"]:not([aria-label])',
      );
      addButtons.forEach((btn) => {
        if (!btn.textContent?.trim()) {
          btn.setAttribute("aria-label", "Add item");
        }
      });
    };

    patchPuckButtons();
    const observer = new MutationObserver(patchPuckButtons);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [selectedSectionIndex, rightTab]);

  const editorDocumentTitle = `${puckData.root.props.title || initialPayload.project.name || "Untitled"} — Casefolio Editor`;

  useEffect(() => {
    const syncTitle = () => {
      if (!document.title.trim()) {
        document.title = editorDocumentTitle;
      }
    };
    document.title = editorDocumentTitle;
    const headObserver = new MutationObserver(syncTitle);
    headObserver.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => headObserver.disconnect();
  }, [editorDocumentTitle]);

  return (
    <div
      data-testid="constrained-editor-root"
      style={PUCK_FONT_VARS}
      className="bg-surface text-foreground flex h-dvh min-h-dvh flex-col overflow-hidden [&>.Puck]:flex [&>.Puck]:h-full [&>.Puck]:min-h-0 [&>.Puck]:flex-1 [&>.Puck]:flex-col [&>.Puck]:overflow-hidden"
    >
      <Puck
        config={puckConfig as unknown as Config}
        data={puckData as unknown as Data}
        headerTitle={editorDocumentTitle}
        onAction={handlePuckAction}
        permissions={CONSTRAINED_PUCK_PERMISSIONS}
        height="100%"
        dnd={{
          disableAutoScroll: true,
          disableOutlineDrag: true,
        }}
        iframe={{ enabled: false }}
        metadata={{
          projectId: initialPayload.project.id,
          projectType: initialPayload.project.type,
          slots: initialPayload.template.slots,
          theme,
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
          {/* Top Editor Bar */}
          <header
            data-slot="editor-topbar"
            className="border-border/75 bg-elevated/95 z-30 flex h-15 shrink-0 items-center justify-between gap-2 border-b px-3 backdrop-blur-xl sm:h-16 sm:gap-3 sm:px-5 xl:grid xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
          >
            <div className="flex max-w-full min-w-0 flex-1 items-center gap-2 sm:gap-2.5 xl:justify-self-start">
              <Link
                href="/dashboard"
                aria-label="Back to projects"
                className="border-border/80 bg-elevated text-foreground hover:bg-surface focus-visible:ring-ring/40 inline-flex size-8.5 shrink-0 items-center justify-center rounded-full border shadow-2xs transition-colors outline-none focus-visible:ring-2 sm:size-9"
              >
                <ArrowLeft className="size-4" />
              </Link>

              <button
                type="button"
                data-testid="toggle-left-panel"
                aria-label={leftPanelOpen ? "Close left panel" : "Open left panel"}
                aria-expanded={leftPanelOpen}
                title={leftPanelOpen ? "Close left panel ([)" : "Open left panel ([)"}
                onClick={() => setLeftPanelOpen((prev) => !prev)}
                className={cn(
                  "focus-visible:ring-ring/40 hidden size-9 shrink-0 items-center justify-center rounded-full border transition-colors outline-none focus-visible:ring-2 lg:inline-flex",
                  leftPanelOpen
                    ? "border-border/80 bg-surface text-foreground hover:bg-sunken"
                    : "border-primary/40 bg-accent text-accent-foreground",
                )}
              >
                {leftPanelOpen ? (
                  <PanelLeftClose className="size-4" />
                ) : (
                  <PanelLeftOpen className="size-4" />
                )}
              </button>

              <div className="bg-border/70 hidden h-5 w-px shrink-0 lg:block" />

              <div className="flex min-w-0 flex-col">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-foreground font-display truncate text-sm font-medium tracking-tight sm:text-base">
                    {puckData.root.props.title || initialPayload.project.name}
                  </span>
                  <Badge tone="neutral" withDot={false} className="hidden shrink-0 2xl:inline-flex">
                    {initialPayload.template.name}
                  </Badge>
                </div>
                <span
                  data-testid="editor-save-indicator"
                  data-save-status={saveStatus}
                  className="text-tertiary type-caption inline-flex min-w-0 items-center gap-1.5 truncate"
                >
                  {saveStatus === "saving" && (
                    <>
                      <Loader2 className="text-primary size-3 shrink-0 animate-spin" />
                      <span className="truncate">Saving...</span>
                    </>
                  )}
                  {saveStatus === "unsaved" && (
                    <>
                      <Cloud className="text-muted-foreground size-3 shrink-0" />
                      <span className="truncate">Unsaved changes</span>
                    </>
                  )}
                  {saveStatus === "saved" && (
                    <>
                      <Cloud className="text-success size-3 shrink-0" />
                      <span className="truncate">Saved · just now</span>
                    </>
                  )}
                  {saveStatus === "conflict" && (
                    <>
                      <AlertTriangle className="text-warning size-3 shrink-0" />
                      <span className="text-warning truncate">Save conflict</span>
                    </>
                  )}
                  {saveStatus === "error" && (
                    <>
                      <AlertCircle className="text-destructive size-3 shrink-0" />
                      <span className="text-destructive truncate">Save failed</span>
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Center Device Toggle */}
            <div
              role="group"
              aria-label="Preview viewport"
              className="border-border/70 bg-surface hidden shrink-0 items-center rounded-full border p-1 md:inline-flex xl:justify-self-center"
            >
              <button
                type="button"
                aria-pressed={viewport === "desktop"}
                onClick={() => setViewport("desktop")}
                className={cn(
                  "type-body-s-strong inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.25 transition-all",
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
                  "type-body-s-strong inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.25 transition-all",
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
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 xl:justify-self-end">
              <div className="border-border/75 bg-surface hidden items-center rounded-full border p-0.5 sm:inline-flex">
                <button
                  type="button"
                  aria-label="Undo"
                  title="Undo (⌘Z)"
                  disabled={!canUndo}
                  onClick={handleUndo}
                  className="text-foreground hover:bg-elevated inline-flex size-7.5 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 sm:size-8"
                >
                  <Undo2 className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Redo"
                  title="Redo (⇧⌘Z)"
                  disabled={!canRedo}
                  onClick={handleRedo}
                  className="text-foreground hover:bg-elevated inline-flex size-7.5 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 sm:size-8"
                >
                  <Redo2 className="size-3.5" />
                </button>
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                aria-label="Preview case study"
                onClick={() => setPreviewModalOpen(true)}
                className="size-8.5 p-0 sm:h-9 sm:w-auto sm:px-3.5"
              >
                <Eye className="size-3.5" />
                <span className="hidden sm:inline">Preview</span>
              </Button>

              <Button
                asChild
                variant="secondary"
                size="sm"
                className="size-8.5 p-0 sm:h-9 sm:w-auto sm:px-3.5"
              >
                <Link
                  href={`/projects/${initialPayload.project.id}/exports`}
                  aria-label="Export case study"
                >
                  <Download className="size-3.5" />
                  <span className="hidden sm:inline">Export</span>
                </Link>
              </Button>

              <Button asChild variant="accent" size="sm" className="px-3 sm:px-4">
                <Link href={`/projects/${initialPayload.project.id}/share`}>
                  <Globe className="size-3.5" />
                  <span>Publish</span>
                </Link>
              </Button>

              <button
                type="button"
                data-testid="toggle-right-panel"
                aria-label={rightPanelOpen ? "Close right panel" : "Open right panel"}
                aria-expanded={rightPanelOpen}
                title={rightPanelOpen ? "Close right panel (])" : "Open right panel (])"}
                onClick={() => setRightPanelOpen((prev) => !prev)}
                className={cn(
                  "focus-visible:ring-ring/40 hidden size-9 shrink-0 items-center justify-center rounded-full border transition-colors outline-none focus-visible:ring-2 lg:inline-flex",
                  rightPanelOpen
                    ? "border-border/80 bg-surface text-foreground hover:bg-sunken"
                    : "border-primary/40 bg-accent text-accent-foreground",
                )}
              >
                {rightPanelOpen ? (
                  <PanelRightClose className="size-4" />
                ) : (
                  <PanelRightOpen className="size-4" />
                )}
              </button>
            </div>
          </header>

          {/* 3-Panel Studio Workspace */}
          <div className="flex min-h-0 flex-1 overflow-hidden">
            {/* LEFT PANEL: Sections / Style / Content */}
            <aside
              aria-label="Template customization and sections"
              data-slot="editor-left-panel"
              data-open={leftPanelOpen ? "true" : "false"}
              className={cn(
                "border-border/75 bg-background min-h-0 w-86 shrink-0 flex-col border-r",
                leftPanelOpen ? "hidden lg:flex" : "hidden",
              )}
            >
              <div className="border-border/70 bg-elevated/60 flex shrink-0 items-center gap-2 border-b px-3.5 py-3">
                <div
                  role="tablist"
                  aria-label="Editor sidebar tabs"
                  className="bg-surface border-border/60 grid flex-1 grid-cols-3 rounded-full border p-1"
                >
                  {(
                    [
                      { key: "sections", label: "Sections", icon: Layers },
                      { key: "style", label: "Style", icon: Palette },
                      { key: "content", label: "Content", icon: FileText },
                    ] as const
                  ).map((tab) => {
                    const TabIcon = tab.icon;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        role="tab"
                        aria-selected={leftTab === tab.key}
                        onClick={() => setLeftTab(tab.key)}
                        className={cn(
                          "type-caption inline-flex items-center justify-center gap-1.5 rounded-full py-1.5 font-medium transition-all",
                          leftTab === tab.key
                            ? "bg-elevated text-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <TabIcon className="size-3.5 shrink-0" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  data-testid="collapse-left-panel"
                  aria-label="Collapse left panel"
                  title="Collapse left panel ([)"
                  onClick={() => setLeftPanelOpen(false)}
                  className="text-muted-foreground hover:bg-surface hover:text-foreground inline-flex size-8 shrink-0 items-center justify-center rounded-full transition-colors"
                >
                  <PanelLeftClose className="size-4" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4">
                {/* TAB: SECTIONS */}
                {leftTab === "sections" && (
                  <div data-testid="editor-sections-panel" className="flex flex-col gap-3.5">
                    <div className="border-border/70 bg-elevated flex flex-col gap-3 rounded-2xl border p-3.5 shadow-2xs">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <h2 className="text-foreground type-heading-s">Sections</h2>
                            <Badge tone="neutral" withDot={false}>
                              {visibleSectionCount}/{puckData.content.length}
                            </Badge>
                          </div>
                          <span className="text-tertiary type-caption">
                            {initialPayload.template.name} narrative flow
                          </span>
                        </div>

                        {allowSectionMutations && (
                          <Button
                            type="button"
                            variant={insertPickerOpen ? "accent" : "outline"}
                            size="sm"
                            data-testid="open-insert-section-menu"
                            onClick={() => setInsertPickerOpen((prev) => !prev)}
                            className="h-8 gap-1.5 px-3"
                          >
                            <Plus className="size-3.5" />
                            <span>Insert section</span>
                          </Button>
                        )}
                      </div>

                      {puckData.content.length >= 4 && (
                        <div className="relative">
                          <Search className="text-tertiary pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2" />
                          <input
                            type="search"
                            value={sectionSearchQuery}
                            onChange={(e) => setSectionSearchQuery(e.target.value)}
                            placeholder="Filter sections..."
                            aria-label="Filter sections"
                            className="border-border/70 bg-surface/70 text-foreground placeholder:text-tertiary focus:border-ring h-8.5 w-full rounded-full border pr-7 pl-8.5 text-xs outline-none"
                          />
                          {sectionSearchQuery && (
                            <button
                              type="button"
                              aria-label="Clear section filter"
                              onClick={() => setSectionSearchQuery("")}
                              className="text-tertiary hover:text-foreground absolute top-1/2 right-2.5 inline-flex size-4 -translate-y-1/2 items-center justify-center rounded-full"
                            >
                              <X className="size-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {allowSectionMutations && insertPickerOpen && (
                      <div
                        data-testid="insert-section-preset-picker"
                        className="border-primary/30 bg-wash-panel flex flex-col gap-2 rounded-2xl border p-3.5 shadow-2xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-accent-foreground type-overline">
                            Insert structured block
                          </span>
                          <button
                            type="button"
                            aria-label="Close preset picker"
                            onClick={() => setInsertPickerOpen(false)}
                            className="text-muted-foreground hover:text-foreground inline-flex size-5 items-center justify-center rounded-full"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                        <div className="grid gap-1.5">
                          {SECTION_PRESET_OPTIONS.map((preset) => (
                            <button
                              key={preset.key}
                              type="button"
                              data-testid={`insert-preset-${preset.key}`}
                              onClick={() => handleInsertSectionPreset(preset.key)}
                              className="border-border/70 bg-elevated hover:border-primary/60 flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left shadow-2xs transition-all"
                            >
                              <span className="text-foreground type-body-s-strong">
                                {preset.label}
                              </span>
                              <span className="text-muted-foreground type-caption">
                                {preset.description}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      {puckData.content.map((section, idx) => {
                        const required = isSectionRequired(section.type);
                        const hidden = Boolean(section.props.hidden);
                        const isSelected = selectedSectionIndex === idx;
                        const typeLabel = formatSectionTypeLabel(section.type);
                        const summaryLabel = formatSectionSummaryLabel(section);
                        const isFirstOfType = firstIndexByType.get(section.type) === idx;
                        const rowTestKey = isFirstOfType ? section.type : section.props.id;
                        const canMoveUp = !required && idx > 1;
                        const canMoveDown = !required && idx < puckData.content.length - 1;

                        const matchesFilter =
                          !normalizedSectionFilter ||
                          summaryLabel.toLowerCase().includes(normalizedSectionFilter) ||
                          typeLabel.toLowerCase().includes(normalizedSectionFilter);

                        if (!matchesFilter) {
                          return null;
                        }

                        return (
                          <div
                            key={section.props.id}
                            data-testid={`section-row-${rowTestKey}`}
                            data-hidden={hidden ? "true" : "false"}
                            className={cn(
                              "group/row flex flex-col gap-2 rounded-2xl border p-3 transition-all",
                              isSelected
                                ? "border-primary bg-accent/50 shadow-2xs"
                                : "border-border/70 bg-elevated hover:border-border-strong",
                              hidden && "opacity-65",
                            )}
                          >
                            <div className="flex items-center justify-between gap-2.5">
                              <button
                                type="button"
                                onClick={() => handleSelectSection(idx)}
                                className="flex min-w-0 flex-1 items-center gap-2.5 text-left outline-none"
                              >
                                <span
                                  aria-hidden="true"
                                  className={cn(
                                    "inline-flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-medium",
                                    isSelected
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-surface text-tertiary",
                                  )}
                                >
                                  {String(idx + 1).padStart(2, "0")}
                                </span>

                                <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                                  <span className="text-foreground type-body-s-strong w-full truncate">
                                    {summaryLabel}
                                  </span>
                                  <span className="text-tertiary type-caption truncate">
                                    {required
                                      ? `${typeLabel} · Required`
                                      : hidden
                                        ? `${typeLabel} · Hidden`
                                        : typeLabel}
                                  </span>
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
                                  aria-label={`Toggle ${summaryLabel} visibility`}
                                  data-testid={`toggle-section-${rowTestKey}`}
                                  onClick={() => handleToggleSection(idx)}
                                  className={cn(
                                    "focus-visible:ring-ring/40 relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors outline-none focus-visible:ring-2",
                                    !hidden ? "bg-primary" : "bg-border-strong",
                                  )}
                                >
                                  <span
                                    aria-hidden="true"
                                    className={cn(
                                      "bg-background inline-block size-4 rounded-full shadow-xs transition-transform",
                                      !hidden ? "translate-x-5" : "translate-x-0.75",
                                    )}
                                  />
                                </button>
                              )}
                            </div>

                            {!required && allowSectionMutations && (
                              <div className="border-border/50 flex items-center justify-between gap-1 border-t pt-2">
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    disabled={!canMoveUp}
                                    aria-label={`Move ${summaryLabel} up`}
                                    data-testid={`move-up-section-${rowTestKey}`}
                                    onClick={() => handleMoveSection(idx, "up")}
                                    className="text-muted-foreground hover:bg-surface hover:text-foreground inline-flex size-6.5 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-35"
                                  >
                                    <ArrowUp className="size-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!canMoveDown}
                                    aria-label={`Move ${summaryLabel} down`}
                                    data-testid={`move-down-section-${rowTestKey}`}
                                    onClick={() => handleMoveSection(idx, "down")}
                                    className="text-muted-foreground hover:bg-surface hover:text-foreground inline-flex size-6.5 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-35"
                                  >
                                    <ArrowDown className="size-3.5" />
                                  </button>
                                </div>

                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    aria-label={`Duplicate ${summaryLabel}`}
                                    data-testid={`duplicate-section-${rowTestKey}`}
                                    onClick={() => handleDuplicateSection(idx)}
                                    className="text-muted-foreground hover:bg-surface hover:text-foreground type-caption inline-flex h-6.5 items-center gap-1 rounded-full px-2 transition-colors"
                                  >
                                    <Copy className="size-3" />
                                    <span>Duplicate</span>
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={`Remove ${summaryLabel}`}
                                    data-testid={`remove-section-${rowTestKey}`}
                                    onClick={() => handleRemoveSection(idx)}
                                    className="text-muted-foreground hover:bg-destructive-soft hover:text-destructive inline-flex size-6.5 items-center justify-center rounded-full transition-colors"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TAB: CONTENT */}
                {leftTab === "content" && (
                  <div data-testid="editor-content-panel" className="flex flex-col gap-4">
                    <section className="border-border/70 bg-elevated flex flex-col gap-3 rounded-2xl border p-4 shadow-2xs">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-foreground type-body-s-strong">Document info</span>
                        <span className="text-tertiary type-caption">
                          Shown in browser tabs, exports, and share cards.
                        </span>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="editor-case-study-title">Case study title</Label>
                        <Input
                          id="editor-case-study-title"
                          value={puckData.root.props.title}
                          onChange={(e) => handleCaseStudyTitleChange(e.target.value)}
                        />
                      </div>

                      <div className="border-border/60 bg-surface/60 grid grid-cols-2 gap-2 rounded-xl border p-2.5">
                        <div className="flex flex-col">
                          <span className="text-tertiary type-caption">Template</span>
                          <span className="text-foreground type-body-s-strong truncate">
                            {initialPayload.template.name}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-tertiary type-caption">Format</span>
                          <span className="text-foreground type-body-s-strong capitalize">
                            {initialPayload.project.type}
                          </span>
                        </div>
                      </div>
                    </section>

                    <section className="border-border/70 bg-elevated flex flex-col gap-2.5 rounded-2xl border p-4 shadow-2xs">
                      <span className="text-tertiary type-overline">Jump to section fields</span>
                      <div className="flex flex-col gap-1.5">
                        {puckData.content.map((section, idx) => {
                          const hidden = Boolean(section.props.hidden);
                          const label = formatSectionSummaryLabel(section);
                          return (
                            <button
                              key={section.props.id}
                              type="button"
                              onClick={() => handleSelectSection(idx)}
                              className={cn(
                                "flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-all",
                                selectedSectionIndex === idx
                                  ? "border-primary bg-accent/50 text-foreground type-body-s-strong"
                                  : "border-border/60 bg-surface/60 text-muted-foreground hover:text-foreground hover:bg-surface type-body-s",
                              )}
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="text-tertiary font-mono text-xs">
                                  {String(idx + 1).padStart(2, "0")}
                                </span>
                                <span className="truncate">{label}</span>
                              </span>
                              {hidden && <EyeOff className="text-tertiary size-3.5 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  </div>
                )}

                {/* TAB: STYLE */}
                {leftTab === "style" && (
                  <ThemePanel
                    theme={theme}
                    onChangeTheme={setTheme}
                    onResetToDefaults={handleResetThemeToDefaults}
                  />
                )}
              </div>
            </aside>

            {/* CENTER PANEL: Live Preview Canvas + Floating Panel Handles + Zoom HUD */}
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              {/* Floating quick-open pills when panels are collapsed on desktop */}
              {!leftPanelOpen && (
                <button
                  type="button"
                  data-testid="reopen-left-panel"
                  aria-label="Open left panel"
                  onClick={() => setLeftPanelOpen(true)}
                  className="border-border/80 bg-elevated/95 text-foreground shadow-float hover:bg-elevated type-caption absolute top-3.5 left-3.5 z-20 hidden items-center gap-1.5 rounded-full border px-3 py-1.5 font-medium backdrop-blur-xl transition-all lg:inline-flex"
                >
                  <PanelLeftOpen className="size-3.5" />
                  <span>Sections</span>
                </button>
              )}

              {!rightPanelOpen && (
                <button
                  type="button"
                  data-testid="reopen-right-panel"
                  aria-label="Open right panel"
                  onClick={() => setRightPanelOpen(true)}
                  className="border-border/80 bg-elevated/95 text-foreground shadow-float hover:bg-elevated type-caption absolute top-3.5 right-3.5 z-20 hidden items-center gap-1.5 rounded-full border px-3 py-1.5 font-medium backdrop-blur-xl transition-all lg:inline-flex"
                >
                  <span>Inspector</span>
                  <PanelRightOpen className="size-3.5" />
                </button>
              )}

              <main
                ref={canvasScrollRef}
                id="main-content"
                data-slot="editor-canvas"
                className="bg-editor-canvas flex min-h-0 min-w-0 flex-1 flex-col overflow-x-auto overflow-y-auto overscroll-contain px-3 pt-4 pb-20 sm:px-8 sm:pt-6 sm:pb-24"
              >
                <div className="mx-auto mb-4 flex shrink-0 flex-wrap items-center justify-center gap-2 text-center sm:mb-5">
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
                  zoom={canvasZoom}
                  selectedSectionIndex={selectedSectionIndex}
                  onSelectSection={handleCanvasSelectSection}
                />
              </main>

              {/* Floating Glass Zoom Pill Bar */}
              <div
                data-testid="editor-zoom-controls"
                onWheel={handleZoomBarWheel}
                title="Zoom canvas (+/- keys, trackpad pinch, or ⌘/Ctrl + scroll)"
                className="border-border/80 bg-elevated/92 shadow-float pointer-events-auto absolute bottom-4 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-1 rounded-full border p-1 backdrop-blur-xl"
              >
                <button
                  type="button"
                  data-testid="zoom-out-button"
                  aria-label="Zoom out"
                  disabled={canvasZoom <= MIN_CANVAS_ZOOM}
                  onClick={handleZoomOut}
                  className="text-foreground hover:bg-surface inline-flex size-7.5 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Minus className="size-3.5" />
                </button>

                <button
                  type="button"
                  data-testid="zoom-reset-button"
                  title="Reset zoom (0)"
                  onClick={handleZoomReset}
                  className="text-foreground hover:bg-surface min-w-14 rounded-full px-2.5 py-1 text-center font-mono text-xs font-medium transition-colors"
                >
                  {zoomPercent}%<span className="sr-only"> reset zoom</span>
                </button>

                <button
                  type="button"
                  data-testid="zoom-in-button"
                  aria-label="Zoom in"
                  disabled={canvasZoom >= MAX_CANVAS_ZOOM}
                  onClick={handleZoomIn}
                  className="text-foreground hover:bg-surface inline-flex size-7.5 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus className="size-3.5" />
                </button>

                {zoomPercent !== 100 && (
                  <>
                    <span aria-hidden="true" className="bg-border/80 mx-0.5 h-4 w-px" />
                    <button
                      type="button"
                      onClick={handleZoomReset}
                      className="text-muted-foreground hover:text-foreground hover:bg-surface type-caption inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium transition-colors"
                    >
                      <RotateCcw className="size-3" />
                      <span>100%</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* RIGHT PANEL: Constrained Puck Fields Inspector & Screenshots Checklist */}
            <aside
              aria-label="Section fields and screen slots"
              data-slot="editor-right-panel"
              data-open={rightPanelOpen ? "true" : "false"}
              className={cn(
                "border-border/75 bg-background min-h-0 w-90 shrink-0 flex-col border-l",
                rightPanelOpen ? "hidden lg:flex" : "hidden",
              )}
            >
              <div className="border-border/70 bg-elevated/60 flex shrink-0 items-center gap-2 border-b px-3.5 py-3">
                <div
                  role="tablist"
                  aria-label="Inspector tabs"
                  className="bg-surface border-border/60 grid flex-1 grid-cols-2 rounded-full border p-1"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={rightTab === "fields"}
                    onClick={() => setRightTab("fields")}
                    className={cn(
                      "type-caption inline-flex items-center justify-center gap-1.5 rounded-full py-1.5 font-medium transition-all",
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
                      "type-caption inline-flex items-center justify-center gap-1.5 rounded-full py-1.5 font-medium transition-all",
                      rightTab === "slots"
                        ? "bg-elevated text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <ImageIcon className="size-3.5" />
                    <span>Screenshots</span>
                    <span className="text-tertiary font-mono text-xs">
                      {filledSlotCount}/{slotItems.length}
                    </span>
                  </button>
                </div>

                <button
                  type="button"
                  data-testid="collapse-right-panel"
                  aria-label="Collapse right panel"
                  title="Collapse right panel (])"
                  onClick={() => setRightPanelOpen(false)}
                  className="text-muted-foreground hover:bg-surface hover:text-foreground inline-flex size-8 shrink-0 items-center justify-center rounded-full transition-colors"
                >
                  <PanelRightClose className="size-4" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4">
                {rightTab === "fields" && (
                  <div data-testid="editor-fields-inspector" className="flex flex-col gap-4">
                    {selectedSection && selectedSectionIndex !== null ? (
                      <>
                        <div className="border-border/70 bg-elevated flex flex-col gap-2.5 rounded-2xl border p-3.5 shadow-2xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-tertiary type-overline">
                              Section {selectedSectionIndex + 1} of {puckData.content.length} ·{" "}
                              {formatSectionTypeLabel(selectedSection.type)}
                            </span>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                aria-label="Previous section"
                                disabled={selectedSectionIndex <= 0}
                                onClick={() => handleSelectSection(selectedSectionIndex - 1)}
                                className="border-border/70 bg-surface text-foreground hover:bg-sunken inline-flex size-6.5 items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-35"
                              >
                                <ChevronLeft className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                aria-label="Next section"
                                disabled={selectedSectionIndex >= puckData.content.length - 1}
                                onClick={() => handleSelectSection(selectedSectionIndex + 1)}
                                className="border-border/70 bg-surface text-foreground hover:bg-sunken inline-flex size-6.5 items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-35"
                              >
                                <ChevronRight className="size-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <h2 className="text-foreground type-heading-s truncate">
                              {formatSectionSummaryLabel(selectedSection)}
                            </h2>
                            {Boolean(selectedSection.props.hidden) && (
                              <Badge tone="draft">Hidden</Badge>
                            )}
                          </div>
                        </div>

                        {mobileSheetTab !== "fields" && <Puck.Fields wrapFields={false} />}
                      </>
                    ) : (
                      <div className="border-border/70 bg-elevated text-muted-foreground type-body-s rounded-2xl border p-6 text-center">
                        Click any section on the canvas or in the Sections list to edit its content.
                      </div>
                    )}
                  </div>
                )}

                {rightTab === "slots" && (
                  <div data-testid="editor-slots-panel" className="flex flex-col gap-3.5">
                    {/* Upload readiness summary card */}
                    <div className="border-border/70 bg-elevated flex flex-col gap-3 rounded-2xl border p-4 shadow-2xs">
                      <div className="flex items-baseline justify-between gap-2">
                        <h2 className="text-foreground type-heading-s">Screenshots</h2>
                        <span className="text-foreground font-mono text-xs font-medium">
                          {filledSlotCount} / {slotItems.length} ready
                        </span>
                      </div>

                      <div className="bg-sunken h-2 w-full overflow-hidden rounded-full">
                        <div
                          className="bg-primary h-full rounded-full transition-all duration-300"
                          style={{ width: `${slotProgressPercent}%` }}
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {(
                          [
                            { key: "all", label: `All (${slotItems.length})` },
                            { key: "empty", label: `Empty (${emptySlotCount})` },
                            { key: "filled", label: `Filled (${filledSlotCount})` },
                          ] as const
                        ).map((filterItem) => (
                          <button
                            key={filterItem.key}
                            type="button"
                            onClick={() => setSlotFilter(filterItem.key)}
                            className={cn(
                              "type-caption rounded-full border px-2.5 py-1 font-medium transition-colors",
                              slotFilter === filterItem.key
                                ? "border-primary bg-accent/60 text-foreground"
                                : "border-border/70 bg-surface text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {filterItem.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {emptyRequiredSlots.length > 0 && (
                      <div className="border-warning/40 bg-warning-soft text-foreground flex items-start gap-2.5 rounded-2xl border p-3.5">
                        <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" />
                        <span className="type-caption">
                          {emptyRequiredSlots.length} required{" "}
                          {emptyRequiredSlots.length === 1 ? "slot is" : "slots are"} empty:{" "}
                          &ldquo;{emptyRequiredSlots[0]?.label}&rdquo;
                        </span>
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      {filteredSlotItems.map((slot) => (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => handleSelectSection(slot.sectionIndex)}
                          className="border-border/70 bg-elevated hover:border-border-strong flex items-center justify-between gap-3 rounded-2xl border p-3 text-left shadow-2xs transition-all"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="bg-surface border-border/80 inline-flex h-11 w-8.5 shrink-0 items-center justify-center overflow-hidden rounded-lg border">
                              {slot.filled && slot.src ? (
                                <img
                                  src={slot.src}
                                  alt={slot.label}
                                  className="size-full object-cover"
                                />
                              ) : slot.filled ? (
                                <Check className="text-success size-3.5" />
                              ) : (
                                <span className="bg-border-strong size-2 rounded-full" />
                              )}
                            </span>
                            <div className="flex min-w-0 flex-col">
                              <span className="text-foreground type-body-s-strong truncate">
                                {slot.label}
                              </span>
                              <span className="text-tertiary type-caption capitalize">
                                {slot.device} · {slot.ratio}
                                {slot.required ? " · Required" : ""}
                              </span>
                            </div>
                          </div>

                          <Badge tone={slot.filled ? "published" : "draft"}>
                            {slot.filled ? "Filled" : "Empty"}
                          </Badge>
                        </button>
                      ))}

                      {filteredSlotItems.length === 0 && (
                        <div className="border-border/60 bg-elevated text-muted-foreground type-caption rounded-2xl border p-5 text-center">
                          No screenshot slots match this filter.
                        </div>
                      )}
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
            className="border-border/80 bg-elevated/95 z-30 grid shrink-0 grid-cols-4 gap-1 border-t px-2 py-1.5 backdrop-blur-xl lg:hidden"
          >
            <button
              type="button"
              data-testid="mobile-open-fields"
              aria-expanded={mobileSheetTab === "fields"}
              onClick={() => setMobileSheetTab("fields")}
              className={cn(
                "focus-visible:ring-ring/40 flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl px-1.5 py-1 transition-colors outline-none focus-visible:ring-2",
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
                "focus-visible:ring-ring/40 flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl px-1.5 py-1 transition-colors outline-none focus-visible:ring-2",
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
                "focus-visible:ring-ring/40 flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl px-1.5 py-1 transition-colors outline-none focus-visible:ring-2",
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
                "focus-visible:ring-ring/40 flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl px-1.5 py-1 transition-colors outline-none focus-visible:ring-2",
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
              className="border-border bg-background flex max-h-[82dvh] flex-col gap-0 rounded-t-3xl p-0"
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
                  className="bg-surface border-border/60 grid grid-cols-4 rounded-full border p-1"
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
                        const label = formatSectionSummaryLabel(section);
                        const active = selectedSectionIndex === idx;
                        return (
                          <button
                            key={section.props.id}
                            type="button"
                            aria-pressed={active}
                            onClick={() => handleSelectSection(idx)}
                            className={cn(
                              "type-caption inline-flex max-w-44 shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 font-medium transition-colors",
                              active
                                ? "border-primary bg-accent text-foreground"
                                : "border-border bg-elevated text-muted-foreground hover:text-foreground",
                            )}
                          >
                            <span className="truncate">{label}</span>
                            {Boolean(section.props.hidden) && (
                              <EyeOff className="text-tertiary size-3 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {selectedSection ? (
                      <Puck.Fields wrapFields={false} />
                    ) : (
                      <div className="text-muted-foreground type-body-s py-6 text-center">
                        Select a section above to edit its fields.
                      </div>
                    )}
                  </div>
                )}

                {mobileSheetTab === "sections" && (
                  <div data-testid="mobile-sections-drawer" className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-muted-foreground type-caption">
                        Tap a section to edit its fields, or organize optional sections.
                      </p>
                      {allowSectionMutations && (
                        <Button
                          type="button"
                          variant={insertPickerOpen ? "accent" : "outline"}
                          size="sm"
                          onClick={() => setInsertPickerOpen((prev) => !prev)}
                          className="h-8 shrink-0 gap-1 px-2.5"
                        >
                          <Plus className="size-3.5" />
                          <span>Insert section</span>
                        </Button>
                      )}
                    </div>

                    {allowSectionMutations && insertPickerOpen && (
                      <div className="border-primary/35 bg-wash-panel grid gap-1.5 rounded-2xl border p-2.5">
                        {SECTION_PRESET_OPTIONS.map((preset) => (
                          <button
                            key={preset.key}
                            type="button"
                            onClick={() => {
                              handleInsertSectionPreset(preset.key);
                              setMobileSheetTab("fields");
                            }}
                            className="border-border bg-elevated flex flex-col items-start rounded-xl border px-3 py-2 text-left"
                          >
                            <span className="text-foreground type-body-s-strong">
                              {preset.label}
                            </span>
                            <span className="text-tertiary type-caption">
                              {preset.description}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      {puckData.content.map((section, idx) => {
                        const required = isSectionRequired(section.type);
                        const hidden = Boolean(section.props.hidden);
                        const isSelected = selectedSectionIndex === idx;
                        const typeLabel = formatSectionTypeLabel(section.type);
                        const summaryLabel = formatSectionSummaryLabel(section);
                        const isFirstOfType = firstIndexByType.get(section.type) === idx;
                        const rowTestKey = isFirstOfType ? section.type : section.props.id;

                        return (
                          <div
                            key={section.props.id}
                            className={cn(
                              "flex flex-col gap-2 rounded-2xl border p-3 transition-colors",
                              isSelected
                                ? "border-primary bg-accent/50"
                                : "border-border bg-elevated",
                              hidden && "opacity-65",
                            )}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  handleSelectSection(idx);
                                  setMobileSheetTab("fields");
                                }}
                                className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left outline-none"
                              >
                                <span className="text-foreground type-body-s-strong w-full truncate">
                                  {summaryLabel}
                                </span>
                                <span className="text-tertiary type-caption truncate">
                                  {required
                                    ? `${typeLabel} · Required`
                                    : hidden
                                      ? `${typeLabel} · Hidden`
                                      : typeLabel}
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
                                  aria-label={`Toggle ${summaryLabel} visibility`}
                                  data-testid={`mobile-toggle-section-${rowTestKey}`}
                                  onClick={() => handleToggleSection(idx)}
                                  className={cn(
                                    "focus-visible:ring-ring/40 relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors outline-none focus-visible:ring-2",
                                    !hidden ? "bg-primary" : "bg-border-strong",
                                  )}
                                >
                                  <span
                                    aria-hidden="true"
                                    className={cn(
                                      "bg-background inline-block size-4 rounded-full shadow-xs transition-transform",
                                      !hidden ? "translate-x-5" : "translate-x-0.75",
                                    )}
                                  />
                                </button>
                              )}
                            </div>

                            {!required && allowSectionMutations && (
                              <div className="border-border/50 flex items-center justify-between gap-1 border-t pt-2">
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    disabled={idx <= 1}
                                    aria-label={`Move ${summaryLabel} up`}
                                    onClick={() => handleMoveSection(idx, "up")}
                                    className="text-muted-foreground inline-flex size-6 items-center justify-center rounded-full disabled:opacity-35"
                                  >
                                    <ArrowUp className="size-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={idx >= puckData.content.length - 1}
                                    aria-label={`Move ${summaryLabel} down`}
                                    onClick={() => handleMoveSection(idx, "down")}
                                    className="text-muted-foreground inline-flex size-6 items-center justify-center rounded-full disabled:opacity-35"
                                  >
                                    <ArrowDown className="size-3.5" />
                                  </button>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    aria-label={`Duplicate ${summaryLabel}`}
                                    onClick={() => handleDuplicateSection(idx)}
                                    className="text-muted-foreground type-caption inline-flex h-6 items-center gap-1 rounded-full px-1.5"
                                  >
                                    <Copy className="size-3" />
                                    <span>Duplicate</span>
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={`Remove ${summaryLabel}`}
                                    onClick={() => handleRemoveSection(idx)}
                                    className="text-muted-foreground hover:text-destructive inline-flex size-6 items-center justify-center rounded-full"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {mobileSheetTab === "style" && (
                  <div data-testid="mobile-style-drawer" className="flex flex-col gap-4">
                    <div className="border-border/70 bg-elevated flex flex-col gap-2 rounded-2xl border p-3.5">
                      <Label htmlFor="mobile-editor-case-study-title">Case study title</Label>
                      <Input
                        id="mobile-editor-case-study-title"
                        value={puckData.root.props.title}
                        onChange={(e) => handleCaseStudyTitleChange(e.target.value)}
                      />
                    </div>

                    <ThemePanel
                      theme={theme}
                      onChangeTheme={setTheme}
                      onResetToDefaults={handleResetThemeToDefaults}
                    />
                  </div>
                )}

                {mobileSheetTab === "slots" && (
                  <div data-testid="mobile-slots-drawer" className="flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-tertiary type-overline">Preview frame</span>
                      <div
                        role="group"
                        aria-label="Mobile preview viewport"
                        className="bg-surface border-border/60 inline-flex items-center rounded-full border p-1"
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
                            className="border-border bg-elevated hover:border-border-strong flex items-center justify-between gap-3 rounded-2xl border p-3 text-left transition-colors"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="bg-surface border-border inline-flex h-11 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border">
                                {slot.filled ? (
                                  <Check className="text-success size-3.5" />
                                ) : (
                                  <span className="bg-border-strong size-2 rounded-full" />
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

      {/* Save Error / Conflict Banner */}
      {(saveStatus === "error" || saveStatus === "conflict") && (
        <div
          role="alert"
          data-testid="editor-save-toast"
          className="bg-inverse text-inverse-foreground shadow-float fixed bottom-20 left-1/2 z-50 flex w-[min(92vw,26rem)] -translate-x-1/2 items-center justify-between gap-3 rounded-full px-4 py-2.5 lg:bottom-6"
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
        <DialogContent className="max-w-5xl rounded-3xl">
          <DialogHeader>
            <DialogTitle>
              {puckData.root.props.title || initialPayload.project.name}
            </DialogTitle>
            <DialogDescription>
              Clean publish &amp; export preview ({initialPayload.template.name} · v
              {initialPayload.template.version})
            </DialogDescription>
          </DialogHeader>

          <div className="border-border max-h-[70vh] overflow-y-auto rounded-2xl border">
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
