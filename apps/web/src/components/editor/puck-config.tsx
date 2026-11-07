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
import { buildGoogleFontsStylesheetHref } from "@/lib/template/curated-themes";
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

const MOCKUP_STYLE_FIELD = {
  type: "select" as const,
  label: "Mockup presentation",
  options: [
    { label: "Straight", value: "straight" },
    { label: "Angled right", value: "tilt-right" },
    { label: "Angled left", value: "tilt-left" },
  ],
};

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
  const swatchTokenField = buildColorTokenSelectField("Theme color token", themeColorKeys);

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
          tags: {
            type: "array",
            label: "Highlight tags",
            max: 6,
            arrayFields: {
              label: { type: "text", label: "Tag" },
            },
          },
          layout: {
            type: "select",
            label: "Hero layout",
            options: [
              { label: "Split — mockup right", value: "split-right" },
              { label: "Split — mockup left", value: "split-left" },
              { label: "Centered showcase", value: "centered" },
            ],
          },
          mockupStyle: MOCKUP_STYLE_FIELD,
          glow: {
            type: "radio",
            label: "Ambient accent glow",
            options: [
              { label: "Off", value: false },
              { label: "On", value: true },
            ],
          },
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
          eyebrow: { type: "text", label: "Eyebrow" },
          heading: { type: "text", label: "Heading" },
          highlight: { type: "text", label: "Accent headline line" },
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
          accent: accentField,
        },
        render: ({ id, puck, ...props }) => <OverviewSection id={id} puck={puck} {...props} />,
      },
      Problem: {
        label: "Problem",
        fields: {
          eyebrow: { type: "text", label: "Eyebrow" },
          heading: { type: "text", label: "Heading" },
          statement: { type: "textarea", label: "Problem statement" },
          columns: {
            type: "radio",
            label: "Columns",
            options: [
              { label: "2", value: 2 },
              { label: "3", value: 3 },
              { label: "4", value: 4 },
            ],
          },
          painPoints: {
            type: "array",
            label: "Pain points",
            min: 1,
            max: 8,
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
          eyebrow: { type: "text", label: "Eyebrow" },
          heading: { type: "text", label: "Heading" },
          subtitle: { type: "textarea", label: "Subtitle" },
          layout: {
            type: "select",
            label: "Layout style",
            options: [
              { label: "2-column cards", value: "cards" },
              { label: "Connected user flow timeline", value: "timeline" },
              { label: "3-column UX pillars", value: "grid-3" },
            ],
          },
          steps: {
            type: "array",
            label: "Process steps",
            min: 1,
            max: 10,
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
          accent: accentField,
        },
        render: ({ id, puck, ...props }) => <ProcessSection id={id} puck={puck} {...props} />,
      },
      ScreensGallery: {
        label: "Screens Gallery",
        fields: {
          eyebrow: { type: "text", label: "Eyebrow" },
          heading: { type: "text", label: "Heading" },
          subtitle: { type: "textarea", label: "Subtitle" },
          columns: {
            type: "radio",
            label: "Columns",
            options: [
              { label: "2", value: 2 },
              { label: "3", value: 3 },
              { label: "4", value: 4 },
              { label: "5", value: 5 },
            ],
          },
          showcaseLayout: {
            type: "radio",
            label: "Gallery arrangement",
            options: [
              { label: "Aligned grid", value: "grid" },
              { label: "Staggered", value: "staggered" },
            ],
          },
          deviceFrame: {
            type: "select",
            label: "Gallery device frame",
            options: [
              { label: "Auto (per slot / template)", value: "auto" },
              { label: "iPhone Pro (Dynamic Island)", value: "iphone" },
              { label: "iPhone (Classic Notch)", value: "iphone-notch" },
              { label: "Android Flagship", value: "android" },
              { label: "iPad Pro Tablet", value: "tablet" },
              { label: "MacBook Pro", value: "macbook" },
              { label: "Browser Window", value: "browser" },
              { label: "No Frame (Wireframes / Plain)", value: "none" },
            ],
          },
          screens: {
            type: "array",
            label: "Screens",
            min: 1,
            max: 16,
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
          eyebrow: { type: "text", label: "Eyebrow" },
          heading: { type: "text", label: "Heading" },
          subtitle: { type: "textarea", label: "Subtitle" },
          columns: {
            type: "radio",
            label: "Metric columns",
            options: [
              { label: "2", value: 2 },
              { label: "3", value: 3 },
              { label: "4", value: 4 },
            ],
          },
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
          takeaways: {
            type: "array",
            label: "Key takeaways",
            max: 4,
            arrayFields: {
              title: { type: "text", label: "Takeaway title" },
              body: { type: "textarea", label: "Takeaway details" },
            },
          },
          closing: { type: "textarea", label: "Closing note" },
          background: colorField,
          accent: accentField,
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
          eyebrow: { type: "text", label: "Eyebrow" },
          heading: { type: "text", label: "Heading" },
          layout: {
            type: "select",
            label: "Section layout",
            options: [
              { label: "Stacked narrative", value: "stacked" },
              { label: "Feature spotlight — mockup right", value: "split-right" },
              { label: "Feature spotlight — mockup left", value: "split-left" },
              { label: "Competitive comparison matrix", value: "comparison" },
              { label: "User persona profile", value: "persona" },
              { label: "Design system (Typography & Colors)", value: "design-system" },
            ],
          },
          body: createRichTextCustomField("Body"),
          bullets: {
            type: "array",
            label: "Feature highlights (Spotlight)",
            max: 8,
            arrayFields: {
              text: { type: "text", label: "Highlight bullet" },
            },
          },
          cards: {
            type: "array",
            label: "Comparison / Persona cards",
            max: 8,
            arrayFields: {
              title: { type: "text", label: "Card title" },
              subtitle: { type: "text", label: "Subtitle / score" },
              body: { type: "textarea", label: "Details" },
              highlighted: {
                type: "radio",
                label: "Highlight card",
                options: [
                  { label: "No", value: false },
                  { label: "Yes", value: true },
                ],
              },
            },
          },
          swatches: {
            type: "array",
            label: "Color swatches (Design system)",
            max: 12,
            arrayFields: {
              label: { type: "text", label: "Swatch name" },
              token: swatchTokenField,
              role: { type: "text", label: "Usage role" },
            },
          },
          mockupStyle: MOCKUP_STYLE_FIELD,
          image: createImageSlotCustomField("custom.image", "Image / Mockup slot", editorContext),
          background: colorField,
          accent: accentField,
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
  const googleFontsHref = buildGoogleFontsStylesheetHref(resolvedTheme);
  const visiblePuckData: PuckDocument = {
    ...resolvedPuck,
    content: resolvedPuck.content.filter((section) => !section.props.hidden),
  };

  return (
    <div
      data-slot="template-puck-renderer"
      data-project-type={resolvedType}
      style={buildTemplateThemeStyle(resolvedTheme)}
      className={cn("overflow-hidden rounded-xl", className)}
    >
      {googleFontsHref && (
        <link rel="stylesheet" href={googleFontsHref} data-casefolio-theme-fonts="true" />
      )}
      <Render
        config={config as unknown as Config}
        data={visiblePuckData as unknown as Data}
        metadata={{
          projectType: resolvedType,
          slots: resolvedSlots,
          theme: resolvedTheme,
        }}
      />
    </div>
  );
}
