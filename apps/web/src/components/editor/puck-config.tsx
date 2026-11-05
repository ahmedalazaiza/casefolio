import { Render, type Config, type CustomField, type Data } from "@puckeditor/core";
import { ImageSlotField } from "@/components/editor/image-slot-field";
import { RichTextField } from "@/components/editor/rich-text-field";
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
  type CtaSectionProps,
  type CustomSectionProps,
  type HeroSectionProps,
  type OverviewSectionProps,
  type ProblemSectionProps,
  type ProcessSectionProps,
  type QuoteSectionProps,
  type ResultsSectionProps,
  type ScreensGallerySectionProps,
} from "@/components/sections";
import type {
  ImageSlotValue,
  PuckDocument,
  RichTextValue,
  TemplateDocument,
  TemplateProjectType,
  TemplateSlotDefinition,
  TemplateTheme,
} from "@/lib/template/schema";
import { buildTemplateThemeStyle } from "@/lib/template/theme-vars";
import { cn } from "@/lib/utils";

export type CasefolioPuckComponentMap = {
  Hero: Omit<HeroSectionProps, "id" | "puck">;
  Overview: Omit<OverviewSectionProps, "id" | "puck">;
  Problem: Omit<ProblemSectionProps, "id">;
  Process: Omit<ProcessSectionProps, "id" | "puck">;
  ScreensGallery: Omit<ScreensGallerySectionProps, "id" | "puck">;
  Results: Omit<ResultsSectionProps, "id">;
  Quote: Omit<QuoteSectionProps, "id" | "puck">;
  CTA: Omit<CtaSectionProps, "id">;
  Custom: Omit<CustomSectionProps, "id" | "puck">;
};

const DEFAULT_COLOR_TOKENS = [
  "primary",
  "secondary",
  "background",
  "surface",
  "text",
  "textMuted",
  "accent",
] as const;

function buildColorTokenSelectField(label: string, colorKeys: readonly string[]) {
  return {
    type: "select" as const,
    label,
    options: colorKeys.map((token) => ({
      label: token,
      value: token,
    })),
  };
}

export interface CasefolioPuckEditorContext {
  projectId?: string;
  slots?: Record<string, TemplateSlotDefinition>;
}

function createImageSlotCustomField(
  slotKey: string,
  label: string,
  editorContext?: CasefolioPuckEditorContext,
): CustomField<ImageSlotValue | undefined> {
  return {
    type: "custom",
    label,
    render: ({ value, onChange, readOnly }) => {
      const resolvedKey = value?.slot || slotKey;
      const slotDefinition =
        editorContext?.slots?.[resolvedKey] ?? editorContext?.slots?.[slotKey];
      return (
        <ImageSlotField
          slotKey={slotKey}
          label={label}
          slotDefinition={slotDefinition}
          projectId={editorContext?.projectId}
          value={value}
          onChange={onChange}
          readOnly={readOnly}
        />
      );
    },
  };
}

function createRichTextCustomField(label: string): CustomField<RichTextValue> {
  return {
    type: "custom",
    label,
    render: ({ value, onChange, readOnly }) => (
      <RichTextField label={label} value={value} onChange={onChange} readOnly={readOnly} />
    ),
  };
}

export function createCasefolioPuckConfig(
  themeColorKeys: readonly string[] = DEFAULT_COLOR_TOKENS,
  editorContext?: CasefolioPuckEditorContext,
): Config<CasefolioPuckComponentMap> {
  const colorField = buildColorTokenSelectField("Background token", themeColorKeys);
  const accentField = buildColorTokenSelectField("Accent token", themeColorKeys);

  return {
    root: {
      fields: {
        title: { type: "text", label: "Case study title" },
      },
      render: ({ children }) => <div data-slot="puck-root-canvas">{children}</div>,
    },
    components: {
      Hero: {
        label: "Hero",
        fields: {
          eyebrow: { type: "text", label: "Eyebrow" },
          title: { type: "text", label: "Title" },
          subtitle: { type: "textarea", label: "Subtitle" },
          logo: createImageSlotCustomField("hero.logo", "Logo slot", editorContext),
          mockup: createImageSlotCustomField("hero.mockup", "Hero mockup slot", editorContext),
          background: colorField,
          accent: accentField,
        },
        render: ({ id, puck, ...props }) => <HeroSection id={id} puck={puck} {...props} />,
      },
      Overview: {
        label: "Overview",
        fields: {
          heading: { type: "text", label: "Heading" },
          summary: createRichTextCustomField("Summary"),
          meta: {
            type: "array",
            label: "Metadata items",
            max: 8,
            arrayFields: {
              label: { type: "text", label: "Label" },
              value: { type: "text", label: "Value" },
            },
          },
          banner: createImageSlotCustomField("overview.banner", "Banner slot", editorContext),
          background: colorField,
        },
        render: ({ id, puck, ...props }) => <OverviewSection id={id} puck={puck} {...props} />,
      },
      Problem: {
        label: "Problem",
        fields: {
          heading: { type: "text", label: "Heading" },
          statement: { type: "textarea", label: "Problem statement" },
          painPoints: {
            type: "array",
            label: "Pain points",
            min: 1,
            max: 6,
            arrayFields: {
              title: { type: "text", label: "Title" },
              body: { type: "textarea", label: "Description" },
            },
          },
          background: colorField,
        },
        render: ({ id, ...props }) => <ProblemSection id={id} {...props} />,
      },
      Process: {
        label: "Process",
        fields: {
          heading: { type: "text", label: "Heading" },
          steps: {
            type: "array",
            label: "Process steps",
            min: 1,
            max: 8,
            arrayFields: {
              number: { type: "text", label: "Step number" },
              title: { type: "text", label: "Step title" },
              body: { type: "textarea", label: "Step description" },
              image: createImageSlotCustomField(
                "process.step.image",
                "Step image",
                editorContext,
              ),
            },
          },
          background: colorField,
        },
        render: ({ id, puck, ...props }) => <ProcessSection id={id} puck={puck} {...props} />,
      },
      ScreensGallery: {
        label: "Screens Gallery",
        fields: {
          heading: { type: "text", label: "Heading" },
          columns: {
            type: "radio",
            label: "Columns",
            options: [
              { label: "2", value: 2 },
              { label: "3", value: 3 },
              { label: "4", value: 4 },
            ],
          },
          screens: {
            type: "array",
            label: "Screens",
            min: 1,
            max: 12,
            arrayFields: {
              caption: { type: "text", label: "Caption" },
              image: createImageSlotCustomField(
                "gallery.screen",
                "Screen image",
                editorContext,
              ) as CustomField<ImageSlotValue>,
            },
          },
          background: colorField,
        },
        render: ({ id, puck, ...props }) => (
          <ScreensGallerySection id={id} puck={puck} {...props} />
        ),
      },
      Results: {
        label: "Results",
        fields: {
          heading: { type: "text", label: "Heading" },
          metrics: {
            type: "array",
            label: "Metrics",
            min: 1,
            max: 6,
            arrayFields: {
              value: { type: "text", label: "Metric value" },
              label: { type: "text", label: "Metric label" },
            },
          },
          closing: { type: "textarea", label: "Closing note" },
          background: colorField,
        },
        render: ({ id, ...props }) => <ResultsSection id={id} {...props} />,
      },
      Quote: {
        label: "Quote",
        fields: {
          quote: { type: "textarea", label: "Quote" },
          author: { type: "text", label: "Author" },
          role: { type: "text", label: "Role" },
          avatar: createImageSlotCustomField("quote.avatar", "Avatar", editorContext),
          background: colorField,
        },
        render: ({ id, puck, ...props }) => <QuoteSection id={id} puck={puck} {...props} />,
      },
      CTA: {
        label: "Call to Action",
        fields: {
          heading: { type: "text", label: "Heading" },
          subheading: { type: "textarea", label: "Subheading" },
          primaryLabel: { type: "text", label: "Primary button label" },
          primaryHref: { type: "text", label: "Primary button URL" },
          secondaryLabel: { type: "text", label: "Secondary button label" },
          secondaryHref: { type: "text", label: "Secondary button URL" },
          background: colorField,
          accent: accentField,
        },
        render: ({ id, ...props }) => <CtaSection id={id} {...props} />,
      },
      Custom: {
        label: "Custom Section",
        fields: {
          heading: { type: "text", label: "Heading" },
          body: createRichTextCustomField("Body"),
          image: createImageSlotCustomField("custom.image", "Image", editorContext),
          background: colorField,
        },
        render: ({ id, puck, ...props }) => <CustomSection id={id} puck={puck} {...props} />,
      },
    },
  };
}

export const casefolioPuckConfig = createCasefolioPuckConfig();

export interface TemplatePuckRendererProps {
  document?: TemplateDocument;
  puckData?: PuckDocument;
  theme?: TemplateTheme;
  slots?: Record<string, TemplateSlotDefinition>;
  projectType?: TemplateProjectType;
  className?: string;
}

export function TemplatePuckRenderer({
  document,
  puckData,
  theme,
  slots,
  projectType,
  className,
}: TemplatePuckRendererProps) {
  const resolvedPuck = puckData ?? document?.puck;
  const resolvedTheme = theme ?? document?.template.theme;
  const resolvedSlots = slots ?? document?.template.slots;
  const resolvedType = projectType ?? document?.template.type ?? "mobile";

  if (!resolvedPuck) {
    return null;
  }

  const colorKeys = resolvedTheme ? Object.keys(resolvedTheme.colors) : DEFAULT_COLOR_TOKENS;
  const config = createCasefolioPuckConfig(colorKeys);

  return (
    <div
      data-slot="template-puck-renderer"
      data-project-type={resolvedType}
      style={buildTemplateThemeStyle(resolvedTheme)}
      className={cn("overflow-hidden rounded-xl", className)}
    >
      <Render
        config={config as unknown as Config}
        data={resolvedPuck as unknown as Data}
        metadata={{
          projectType: resolvedType,
          slots: resolvedSlots,
        }}
      />
    </div>
  );
}
