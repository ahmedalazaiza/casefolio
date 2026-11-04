"use client";

import "@puckeditor/core/no-external.css";
import { createUsePuck, Puck, type Config, type Data } from "@puckeditor/core";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Cloud,
  Eye,
  EyeOff,
  Globe,
  Monitor,
  Redo2,
  RotateCcw,
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
import {
  EditorCanvasPreview,
  type EditorViewportMode,
} from "@/components/editor/editor-canvas-preview";
import { createCasefolioPuckConfig, TemplatePuckRenderer } from "@/components/editor/puck-config";
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
  collectProjectSlotStatus,
  CONSTRAINED_PUCK_PERMISSIONS,
  formatSectionTypeLabel,
  isSectionRequired,
  toggleSectionVisibility,
  type ProjectEditorPayload,
} from "@/lib/projects/types";
import { puckDocumentSchema, type PuckDocument, type TemplateTheme } from "@/lib/template/schema";
import { cn } from "@/lib/utils";

type LeftPanelTab = "style" | "content" | "sections";
type RightPanelTab = "fields" | "slots";

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
  const serializedExternal = useMemo(() => JSON.stringify(externalPuckData), [externalPuckData]);

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
}

const PUCK_FONT_VARS = {
  "--puck-font-family": "var(--font-sans)",
  "--puck-font-family-monospaced": "var(--font-mono)",
} as CSSProperties;

export function ConstrainedEditor({ initialPayload }: ConstrainedEditorProps) {
  const [puckData, setPuckData] = useState<PuckDocument>(initialPayload.project.puckData);
  const [theme, setTheme] = useState<TemplateTheme>(initialPayload.project.theme);
  const [viewport, setViewport] = useState<EditorViewportMode>("desktop");
  const [leftTab, setLeftTab] = useState<LeftPanelTab>("sections");
  const [rightTab, setRightTab] = useState<RightPanelTab>("fields");
  const [selectedSectionIndex, setSelectedSectionIndex] = useState<number | null>(0);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  const lastPuckEmittedJsonRef = useRef<string>(
    JSON.stringify(initialPayload.project.puckData),
  );

  const colorKeys = useMemo(() => Object.keys(theme.colors), [theme.colors]);
  const puckConfig = useMemo(() => createCasefolioPuckConfig(colorKeys), [colorKeys]);

  const handlePuckDataChange = useCallback((nextRawData: Data) => {
    const parsed = puckDocumentSchema.safeParse(nextRawData);
    const nextDoc = parsed.success ? parsed.data : (nextRawData as unknown as PuckDocument);
    const nextJson = JSON.stringify(nextDoc);
    if (nextJson === lastPuckEmittedJsonRef.current) {
      return;
    }
    lastPuckEmittedJsonRef.current = nextJson;
    setPuckData(nextDoc);
  }, []);

  const handleSelectSection = useCallback((index: number) => {
    setSelectedSectionIndex(index);
    setRightTab("fields");
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
    [selectedSectionIndex],
  );

  const handleResetThemeToDefaults = useCallback(() => {
    setTheme(structuredClone(initialPayload.template.defaultTheme));
  }, [initialPayload.template.defaultTheme]);

  const handleCaseStudyTitleChange = useCallback((nextTitle: string) => {
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
  }, []);

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
      className="bg-surface text-foreground flex h-screen min-h-screen flex-col overflow-hidden"
    >
      <Puck
        config={puckConfig as unknown as Config}
        data={puckData as unknown as Data}
        onChange={handlePuckDataChange}
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
          {/* Top Editor Bar (matches Figma 2:4347) */}
        <header
          data-slot="editor-topbar"
          className="border-border bg-background z-30 flex h-17 shrink-0 items-center justify-between gap-3 border-b px-4 sm:px-6"
        >
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/dashboard"
              aria-label="Back to projects"
              className="border-border bg-elevated text-foreground hover:bg-surface focus-visible:ring-ring/40 inline-flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors outline-none focus-visible:ring-2"
            >
              <ArrowLeft className="size-4" />
            </Link>

            <div className="flex min-w-0 flex-col">
              <span className="text-foreground type-body-m-strong truncate">
                {puckData.root.props.title || initialPayload.project.name}
              </span>
              <span
                data-testid="editor-save-indicator"
                className="text-tertiary type-caption inline-flex items-center gap-1.5"
              >
                <Cloud className="text-success size-3.5 shrink-0" />
                <span>Saved · just now</span>
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
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label="Undo"
              disabled
              className="border-border bg-elevated text-foreground hover:bg-surface inline-flex size-9 items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Undo2 className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Redo"
              disabled
              className="border-border bg-elevated text-foreground hover:bg-surface inline-flex size-9 items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Redo2 className="size-4" />
            </button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setPreviewModalOpen(true)}
            >
              <Eye className="size-4" />
              <span className="hidden sm:inline">Preview</span>
            </Button>

            <Button asChild size="sm">
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

              {/* TAB: STYLE (Theme tokens overview; upgraded to full ThemePanel in C-404) */}
              {leftTab === "style" && (
                <div data-testid="editor-style-panel" className="flex flex-col gap-6">
                  <div className="flex flex-col gap-3">
                    <span className="text-tertiary type-overline">Colors · Template tokens</span>
                    <div className="flex flex-col gap-2">
                      {Object.entries(theme.colors).map(([tokenName, colorValue]) => (
                        <div
                          key={tokenName}
                          className="border-border bg-card flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              style={{ backgroundColor: colorValue }}
                              className="border-border inline-block size-6 rounded-md border"
                            />
                            <span className="text-foreground type-body-s-strong capitalize">
                              {tokenName}
                            </span>
                          </div>
                          <span className="text-tertiary font-mono text-xs uppercase">
                            {colorValue}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-border flex flex-col gap-2 border-t pt-4">
                    <span className="text-tertiary type-overline">Fonts</span>
                    <div className="border-border bg-card flex flex-col gap-1 rounded-lg border p-3">
                      <span className="text-tertiary type-caption">Heading</span>
                      <span className="text-foreground type-body-s-strong">
                        {theme.fonts.heading.family}
                      </span>
                    </div>
                    <div className="border-border bg-card flex flex-col gap-1 rounded-lg border p-3">
                      <span className="text-tertiary type-caption">Body</span>
                      <span className="text-foreground type-body-s-strong">
                        {theme.fonts.body.family}
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-fit"
                    onClick={handleResetThemeToDefaults}
                  >
                    <RotateCcw className="size-3.5" />
                    Reset to template defaults
                  </Button>
                </div>
              )}
            </div>
          </aside>

          {/* CENTER PANEL: Live Preview Canvas (matches Figma 2:4438) */}
          <main
            id="main-content"
            data-slot="editor-canvas"
            className="bg-surface flex min-w-0 flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-8"
          >
            <div className="mx-auto mb-5 flex flex-wrap items-center justify-center gap-2.5 text-center">
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
              onSelectSection={handleSelectSection}
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

                      <Puck.Fields wrapFields />
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
        </div>
      </Puck>

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
