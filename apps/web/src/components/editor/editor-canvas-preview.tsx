"use client";

import type { PuckContext } from "@puckeditor/core";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  CtaSection,
  CustomSection,
  HeroSection,
  OverviewSection,
  ProblemSection,
  ProcessSection,
  QuoteSection,
  ResultsSection,
  ScreensGallerySection,
} from "@/components/sections";
import { formatSectionSummaryLabel, formatSectionTypeLabel } from "@/lib/projects/types";
import { ensureThemeFontsLoaded } from "@/lib/template/curated-themes";
import type {
  PuckDocument,
  PuckSectionItem,
  TemplateProjectType,
  TemplateSlotDefinition,
  TemplateTheme,
} from "@/lib/template/schema";
import { buildTemplateThemeStyle } from "@/lib/template/theme-vars";
import { cn } from "@/lib/utils";

export type EditorViewportMode = "desktop" | "mobile";

export interface EditorCanvasPreviewProps {
  puckData: PuckDocument;
  theme: TemplateTheme;
  slots: Record<string, TemplateSlotDefinition>;
  projectType: TemplateProjectType;
  viewport: EditorViewportMode;
  zoom?: number;
  selectedSectionIndex: number | null;
  onSelectSection: (sectionIndex: number) => void;
}

function renderSectionBlock(section: PuckSectionItem, puckCtx: PuckContext) {
  switch (section.type) {
    case "Hero":
      return <HeroSection {...section.props} puck={puckCtx} />;
    case "Overview":
      return <OverviewSection {...section.props} puck={puckCtx} />;
    case "Problem":
      return <ProblemSection {...section.props} />;
    case "Process":
      return <ProcessSection {...section.props} puck={puckCtx} />;
    case "ScreensGallery":
      return <ScreensGallerySection {...section.props} puck={puckCtx} />;
    case "Results":
      return <ResultsSection {...section.props} />;
    case "Quote":
      return <QuoteSection {...section.props} puck={puckCtx} />;
    case "CTA":
      return <CtaSection {...section.props} />;
    case "Custom":
      return <CustomSection {...section.props} puck={puckCtx} />;
    default:
      return null;
  }
}

export function EditorCanvasPreview({
  puckData,
  theme,
  slots,
  projectType,
  viewport,
  zoom = 1,
  selectedSectionIndex,
  onSelectSection,
}: EditorCanvasPreviewProps) {
  const effectiveProjectType: TemplateProjectType = viewport === "mobile" ? "mobile" : projectType;

  const rulerRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [baseWidth, setBaseWidth] = useState(0);
  const [naturalHeight, setNaturalHeight] = useState(0);

  const puckCtx: PuckContext = {
    isEditing: true,
    dragRef: null,
    renderDropZone: () => null,
    metadata: {
      projectType: effectiveProjectType,
      slots,
      theme,
    },
  };

  const typeCounts = useMemo(() => {
    const counts = new Map<PuckSectionItem["type"], number>();
    for (const item of puckData.content) {
      counts.set(item.type, (counts.get(item.type) ?? 0) + 1);
    }
    return counts;
  }, [puckData.content]);

  const firstVisibleIndexByType = useMemo(() => {
    const map = new Map<PuckSectionItem["type"], number>();
    puckData.content.forEach((item, idx) => {
      if (!item.props.hidden && !map.has(item.type)) {
        map.set(item.type, idx);
      }
    });
    return map;
  }, [puckData.content]);

  useEffect(() => {
    ensureThemeFontsLoaded(theme);
  }, [theme]);

  useEffect(() => {
    const rulerEl = rulerRef.current;
    const frameEl = frameRef.current;
    if (!rulerEl && !frameEl) return;

    const syncMetrics = () => {
      if (rulerRef.current) {
        setBaseWidth(rulerRef.current.offsetWidth);
      }
      if (frameRef.current) {
        setNaturalHeight(frameRef.current.offsetHeight);
      }
    };

    syncMetrics();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      syncMetrics();
    });

    if (rulerEl) observer.observe(rulerEl);
    if (frameEl) observer.observe(frameEl);

    return () => observer.disconnect();
  }, [viewport, puckData]);

  const zoomPercent = Math.round(zoom * 100);
  const isScaled = Math.abs(zoom - 1) > 0.001;
  const hasMeasuredBox = baseWidth > 0 && naturalHeight > 0;

  const stageStyle: CSSProperties | undefined = isScaled
    ? hasMeasuredBox
      ? {
          width: `${Math.round(baseWidth * zoom)}px`,
          height: `${Math.round(naturalHeight * zoom)}px`,
        }
      : undefined
    : undefined;

  const frameStyle: CSSProperties = {
    ...buildTemplateThemeStyle(theme),
    ...(isScaled
      ? hasMeasuredBox
        ? {
            width: `${baseWidth}px`,
            maxWidth: "none",
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
          }
        : {
            transform: `scale(${zoom})`,
            transformOrigin: "top center",
          }
      : {}),
  };

  return (
    <>
      <div
        ref={rulerRef}
        aria-hidden="true"
        className={cn(
          "pointer-events-none mx-auto h-0 w-full shrink-0",
          viewport === "mobile" ? "max-w-sm" : "max-w-4xl",
        )}
      />

      <div
        data-testid="editor-canvas-zoom-stage"
        data-zoom={zoomPercent}
        style={stageStyle}
        className={cn(
          "mx-auto shrink-0",
          !isScaled && "w-full",
          !isScaled && (viewport === "mobile" ? "max-w-sm" : "max-w-4xl"),
        )}
      >
        <div
          ref={frameRef}
          data-slot="editor-canvas-frame"
          data-testid="editor-canvas-preview"
          data-viewport={viewport}
          style={frameStyle}
          className={cn(
            "shadow-float mx-auto w-full shrink-0 overflow-hidden transition-[border-radius,box-shadow] duration-200",
            viewport === "mobile"
              ? "border-inverse max-w-sm rounded-3xl border-8"
              : "border-border/60 max-w-4xl rounded-3xl border",
          )}
        >
          {puckData.content.map((section, index) => {
            if (section.props.hidden) {
              return null;
            }

            const isSelected = selectedSectionIndex === index;
            const typeLabel = formatSectionTypeLabel(section.type);
            const summaryLabel = formatSectionSummaryLabel(section);
            const hasMultipleOfSameType = (typeCounts.get(section.type) ?? 0) > 1;
            const pillText = hasMultipleOfSameType ? summaryLabel : typeLabel;
            const ariaLabel =
              firstVisibleIndexByType.get(section.type) === index
                ? `Edit ${typeLabel} section`
                : `Edit ${summaryLabel} section`;

            return (
              <div
                key={section.props.id}
                data-editor-section-index={index}
                data-editor-section-type={section.type}
                data-selected={isSelected ? "true" : "false"}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectSection(index);
                }}
                className={cn(
                  "group/sec relative cursor-pointer transition-shadow",
                  isSelected
                    ? "ring-primary z-10 ring-2 ring-inset"
                    : "hover:ring-primary/50 hover:ring-1 hover:ring-inset",
                )}
              >
                <button
                  type="button"
                  aria-label={ariaLabel}
                  aria-pressed={isSelected}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectSection(index);
                  }}
                  className={cn(
                    "type-caption focus-visible:ring-ring/40 absolute top-3 left-3 z-20 max-w-56 truncate rounded-full px-3 py-1 shadow-xs backdrop-blur-md transition-all outline-none focus-visible:ring-2",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-inverse/85 text-inverse-foreground opacity-85 group-hover/sec:opacity-100",
                  )}
                >
                  {pillText}
                </button>
                {renderSectionBlock(section, puckCtx)}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
