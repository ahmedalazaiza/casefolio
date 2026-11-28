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
  Problem: Omit<ProblemSectionProps, "id" | "puck">;
  Process: Omit<ProcessSectionProps, "id" | "puck">;
  ScreensGallery: Omit<ScreensGallerySectionProps, "id" | "puck">;
  Results: Omit<ResultsSectionProps, "id" | "puck">;
  Quote: Omit<QuoteSectionProps, "id" | "puck">;
  CTA: Omit<CtaSectionProps, "id" | "puck">;
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
          studioName: { type: "text", label: "Studio wordmark (Editorial)" },
          eyebrow: { type: "text", label: "Eyebrow" },
          title: { type: "text", label: "Title" },
          titleMuted: { type: "text", label: "Muted accent phrase in title" },
          subtitle: { type: "textarea", label: "Subtitle" },
          ctaLabel: { type: "text", label: "Stage pill CTA label" },
          ctaHref: { type: "text", label: "Stage pill CTA link" },
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
              { label: "Editorial stage panel", value: "editorial-stage" },
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
        render: ({ id, puck, ...props }) => <ProblemSection id={id} puck={puck} {...props} />,
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
              { label: "Offset band", value: "band-offset" },
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
          layout: {
            type: "select",
            label: "Results layout",
            options: [
              { label: "Standard metrics", value: "default" },
              { label: "Editorial closing panel", value: "editorial-panel" },
            ],
          },
          eyebrow: { type: "text", label: "Eyebrow" },
          introLabel: { type: "text", label: "Intro strip label" },
          introBody: { type: "textarea", label: "Intro strip summary" },
          heading: { type: "text", label: "Heading" },
          subtitle: { type: "textarea", label: "Subtitle" },
          disclaimer: { type: "text", label: "Header note" },
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
              tag: { type: "text", label: "Metric badge / tag" },
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
        render: ({ id, puck, ...props }) => <ResultsSection id={id} puck={puck} {...props} />,
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
          layout: {
            type: "select",
            label: "CTA layout",
            options: [
              { label: "Standard CTA card", value: "default" },
              { label: "Editorial Thank You panel", value: "thank-you" },
            ],
          },
          heading: { type: "text", label: "Heading" },
          subheading: { type: "textarea", label: "Subheading / signoff" },
          logo: createImageSlotCustomField("cta.logo", "Studio logo slot", editorContext),
          primaryLabel: { type: "text", label: "Primary button label" },
          primaryHref: { type: "text", label: "Primary button URL" },
          secondaryLabel: { type: "text", label: "Secondary button label" },
          secondaryHref: { type: "text", label: "Secondary button URL" },
          socialLinks: {
            type: "array",
            label: "Portfolio & social links",
            max: 6,
            arrayFields: {
              platform: {
                type: "select",
                label: "Platform",
                options: [
                  { label: "Website", value: "website" },
                  { label: "Layerat", value: "layerat" },
                  { label: "Dribbble", value: "dribbble" },
                  { label: "LinkedIn", value: "linkedin" },
                ],
              },
              label: { type: "text", label: "Label" },
              href: { type: "text", label: "URL" },
            },
          },
          background: colorField,
          accent: accentField,
        },
        render: ({ id, puck, ...props }) => <CtaSection id={id} puck={puck} {...props} />,
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
              { label: "Editorial 2-column strip", value: "editorial-strip" },
              { label: "Feature spotlight — mockup right", value: "split-right" },
              { label: "Feature spotlight — mockup left", value: "split-left" },
              { label: "3-column phone feature tiles", value: "feature-tiles" },
              { label: "2×2 icon feature grid", value: "icon-features" },
              { label: "Lifestyle phone + card + photo composite", value: "lifestyle-composite" },
              { label: "Branding bento (Icons + Grid + Watch)", value: "branding-bento" },
              { label: "Brand guideline slides (6-card deck)", value: "brand-guidelines" },
              { label: "Arched hero phone pair", value: "arch-phone-pair" },
              { label: "3-column bento UI collage", value: "bento-collage" },
              { label: "Competitive comparison matrix", value: "comparison" },
              { label: "User persona profile", value: "persona" },
              { label: "Design system (Typography & Colors)", value: "design-system" },
            ],
          },
          brandName: { type: "text", label: "Brand wordmark (Guidelines)" },
          badgeText: { type: "text", label: "App icon badge count" },
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
            label: "Feature / Comparison / Persona cards",
            max: 8,
            arrayFields: {
              title: { type: "text", label: "Card title" },
              subtitle: { type: "text", label: "Subtitle / score" },
              icon: { type: "text", label: "Icon key (coins, refresh-cw, credit-card, circle-dot)" },
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
            label: "Color swatches (Design system / Guidelines)",
            max: 12,
            arrayFields: {
              label: { type: "text", label: "Swatch name" },
              token: swatchTokenField,
              role: { type: "text", label: "Usage role" },
            },
          },
          mediaItems: {
            type: "array",
            label: "Bento & showcase visual slots",
            max: 12,
            arrayFields: {
              title: { type: "text", label: "Tile / slot title" },
              subtitle: { type: "text", label: "Caption" },
              icon: { type: "text", label: "Tile icon (wallet, send, arrow-down-to-line)" },
              tone: {
                type: "select",
                label: "Panel tint",
                options: [
                  { label: "Periwinkle / Primary tint", value: "peri" },
                  { label: "Warm Butter / Accent tint", value: "butter" },
                  { label: "Neutral Stone / Surface", value: "stone" },
                  { label: "Dark Ink", value: "ink" },
                  { label: "Clean Surface", value: "surface" },
                  { label: "Clear", value: "clear" },
                ],
              },
              image: createImageSlotCustomField(
                "custom.image",
                "Primary visual slot",
                editorContext,
              ) as CustomField<ImageSlotValue>,
              secondaryImage: createImageSlotCustomField(
                "custom.image",
                "Secondary visual slot (optional)",
                editorContext,
              ),
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
  viewport?: "desktop" | "mobile";
  className?: string;
}

export function TemplatePuckRenderer({
  document,
  puckData,
  theme,
  slots,
  projectType,
  viewport,
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
      data-viewport={viewport}
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
          viewport,
        }}
      />
    </div>
  );
}
