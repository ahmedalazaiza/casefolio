"use client";

import type { PuckContext } from "@puckeditor/core";
import { useEffect } from "react";
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
import { formatSectionTypeLabel } from "@/lib/projects/types";
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
  const effectiveProjectType: TemplateProjectType =
    viewport === "mobile" ? "mobile" : projectType;

  const puckCtx: PuckContext = {
    isEditing: true,
    dragRef: null,
    renderDropZone: () => null,
    metadata: {
      projectType: effectiveProjectType,
      slots,
    },
  };

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
        "shadow-card mx-auto w-full overflow-hidden transition-all duration-200",
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
        const label = formatSectionTypeLabel(section.type);

        return (
          <div
            key={section.props.id}
            role="button"
            tabIndex={0}
            aria-label={`Edit ${label} section`}
            aria-pressed={isSelected}
            data-editor-section-index={index}
            data-editor-section-type={section.type}
            data-selected={isSelected ? "true" : "false"}
            onClick={(event) => {
              event.stopPropagation();
              onSelectSection(index);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectSection(index);
              }
            }}
            className={cn(
              "group/sec relative cursor-pointer transition-shadow outline-none",
              isSelected
                ? "ring-primary z-10 ring-2 ring-inset"
                : "hover:ring-primary/50 hover:ring-1 hover:ring-inset",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "type-caption pointer-events-none absolute top-3 left-3 z-20 rounded-full px-2.5 py-0.5 transition-opacity",
                isSelected
                  ? "bg-primary text-primary-foreground opacity-100"
                  : "bg-inverse/80 text-inverse-foreground opacity-0 group-hover/sec:opacity-100",
              )}
            >
              {label}
            </span>
            {renderSectionBlock(section, puckCtx)}
          </div>
        );
      })}
    </div>
  );
}
