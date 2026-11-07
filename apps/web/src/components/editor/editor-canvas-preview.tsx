"use client";

import type { PuckContext } from "@puckeditor/core";
import { useEffect, useMemo } from "react";
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
  selectedSectionIndex,
  onSelectSection,
}: EditorCanvasPreviewProps) {
  const effectiveProjectType: TemplateProjectType = viewport === "mobile" ? "mobile" : projectType;

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

  return (
    <div
      data-slot="editor-canvas-frame"
      data-testid="editor-canvas-preview"
      data-viewport={viewport}
      style={buildTemplateThemeStyle(theme)}
      className={cn(
        "shadow-card mx-auto w-full shrink-0 overflow-hidden transition-all duration-200",
        viewport === "mobile"
          ? "border-inverse max-w-sm rounded-3xl border-8"
          : "border-border/50 max-w-4xl rounded-2xl border",
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
                "type-caption focus-visible:ring-ring/40 absolute top-3 left-3 z-20 max-w-56 truncate rounded-full px-2.5 py-0.5 transition-colors outline-none focus-visible:ring-2",
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : "bg-inverse text-inverse-foreground",
              )}
            >
              {pillText}
            </button>
            {renderSectionBlock(section, puckCtx)}
          </div>
        );
      })}
    </div>
  );
}
