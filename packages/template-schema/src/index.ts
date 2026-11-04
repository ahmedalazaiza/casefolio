import { z } from "zod";

export const SUPPORTED_SECTION_TYPES = [
  "Hero",
  "Overview",
  "Problem",
  "Process",
  "ScreensGallery",
  "Results",
  "Quote",
  "CTA",
  "Custom",
] as const;

export type SupportedSectionType = (typeof SUPPORTED_SECTION_TYPES)[number];

export const TEMPLATE_PROJECT_TYPES = ["mobile", "web", "both"] as const;
export type TemplateProjectType = (typeof TEMPLATE_PROJECT_TYPES)[number];

export const TEMPLATE_TIERS = ["free", "pro"] as const;
export type TemplateTier = (typeof TEMPLATE_TIERS)[number];

export const TEMPLATE_STATUSES = ["draft", "published", "archived"] as const;
export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number];

export const EXPORT_PRESETS = ["png-long", "pdf", "behance-1400"] as const;
export type ExportPreset = (typeof EXPORT_PRESETS)[number];

export const SLOT_DEVICES = ["iphone", "android", "browser", "tablet", "none"] as const;
export type SlotDevice = (typeof SLOT_DEVICES)[number];

const HEX_COLOR_REGEX = /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
const RAW_COLOR_FUNCTION_REGEX = /\b(?:rgb|rgba|hsl|hsla|oklch)\s*\(/i;
const ASPECT_RATIO_REGEX = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/;
const SEMVER_REGEX = /^\d+\.\d+\.\d+$/;
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseAspectRatio(ratio: string): { width: number; height: number; numeric: number } | null {
  const match = ASPECT_RATIO_REGEX.exec(ratio.trim());
  if (!match) {
    return null;
  }
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  return { width, height, numeric: width / height };
}

export const aspectRatioSchema = z
  .string()
  .trim()
  .refine((val) => parseAspectRatio(val) !== null, {
    message:
      "Invalid aspect ratio: expected positive W:H format such as '16:9', '4:3', '1:1', or '9:19.5'.",
  });

export const hexColorSchema = z.string().trim().regex(HEX_COLOR_REGEX, {
  message: "Invalid theme color: expected a valid HEX color (e.g. '#5B4BFF').",
});

export const semverSchema = z.string().trim().regex(SEMVER_REGEX, {
  message: "Invalid version: expected semantic version format MAJOR.MINOR.PATCH (e.g. '1.0.0').",
});

export const cropRectSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().positive(),
  height: z.number().positive(),
});

export type CropRect = z.infer<typeof cropRectSchema>;

export const imageSlotValueSchema = z.object({
  slot: z.string().trim().min(1, "Slot key is required."),
  src: z.string(),
  alt: z.string(),
  assetId: z.string().uuid().nullish(),
  crop: cropRectSchema.nullable(),
});

export type ImageSlotValue = z.infer<typeof imageSlotValueSchema>;

export const richTextValueSchema = z.union([
  z.string(),
  z.object({
    type: z.literal("doc"),
    content: z.array(z.record(z.string(), z.unknown())).optional(),
  }),
]);

export type RichTextValue = z.infer<typeof richTextValueSchema>;

export const templateFontDefinitionSchema = z.object({
  family: z.string().trim().min(1, "Font family name is required."),
  weights: z.array(z.number().int().min(100).max(900)).min(1),
});

export const templateTypographyRoleSchema = z.object({
  font: z.string().trim().min(1),
  size: z.number().positive(),
  weight: z.number().int().min(100).max(900),
  lineHeight: z.number().positive(),
});

const REQUIRED_CORE_COLOR_TOKENS = ["primary", "background", "surface", "text"] as const;

export const templateThemeSchema = z
  .object({
    colors: z.record(z.string().min(1), hexColorSchema),
    fonts: z
      .object({
        heading: templateFontDefinitionSchema,
        body: templateFontDefinitionSchema,
        mono: templateFontDefinitionSchema.optional(),
      })
      .catchall(templateFontDefinitionSchema),
    typography: z.record(z.string().min(1), templateTypographyRoleSchema),
  })
  .superRefine((theme, ctx) => {
    for (const token of REQUIRED_CORE_COLOR_TOKENS) {
      if (!(token in theme.colors)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["colors", token],
          message: `Missing required theme color token '${token}'.`,
        });
      }
    }

    for (const [role, spec] of Object.entries(theme.typography)) {
      if (!(spec.font in theme.fonts)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["typography", role, "font"],
          message: `Typography role '${role}' references unknown font token '${spec.font}' (not in theme.fonts).`,
        });
      }
    }
  });

export type TemplateTheme = z.infer<typeof templateThemeSchema>;

export const templateSlotDefinitionSchema = z.object({
  ratio: aspectRatioSchema,
  minWidth: z.number().int().positive("Slot minWidth must be a positive integer."),
  device: z.enum(SLOT_DEVICES).optional(),
});

export type TemplateSlotDefinition = z.infer<typeof templateSlotDefinitionSchema>;

export const templateMetadataSchema = z.object({
  id: z.string().trim().min(3, "Template id is required."),
  slug: z
    .string()
    .trim()
    .regex(SLUG_REGEX, "Slug must contain lowercase letters, numbers, and hyphens only."),
  name: z.string().trim().min(1, "Template name is required.").max(100),
  type: z.enum(TEMPLATE_PROJECT_TYPES),
  version: semverSchema,
  status: z.enum(TEMPLATE_STATUSES).default("draft"),
  category: z.string().trim().min(1, "Category is required."),
  tier: z.enum(TEMPLATE_TIERS).default("free"),
  cover: z.object({
    src: z.string().trim().min(1, "Cover image URL is required."),
    ratio: aspectRatioSchema,
  }),
  canvas: z.object({
    width: z.number().int().min(320).max(3840).default(1440),
    exportPresets: z.array(z.enum(EXPORT_PRESETS)).min(1),
  }),
  figmaSource: z
    .object({
      fileKey: z.string().trim().min(1),
      nodeId: z.string().trim().min(1),
    })
    .optional(),
  theme: templateThemeSchema,
  slots: z.record(z.string().min(1), templateSlotDefinitionSchema),
});

export type TemplateMetadata = z.infer<typeof templateMetadataSchema>;

const baseSectionProps = {
  id: z.string().trim().min(1, "Section props.id is required."),
  hidden: z.boolean().optional(),
  background: z.string().trim().min(1, "Section background color token is required."),
};

export const heroSectionSchema = z.object({
  type: z.literal("Hero"),
  props: z.object({
    ...baseSectionProps,
    eyebrow: z.string().optional(),
    title: z.string().min(1, "Hero title is required."),
    subtitle: z.string().optional(),
    logo: imageSlotValueSchema.optional(),
    mockup: imageSlotValueSchema.optional(),
    accent: z.string().trim().min(1).optional(),
  }),
});

export const overviewSectionSchema = z.object({
  type: z.literal("Overview"),
  props: z.object({
    ...baseSectionProps,
    heading: z.string().min(1),
    summary: richTextValueSchema,
    meta: z
      .array(
        z.object({
          label: z.string().min(1),
          value: z.string().min(1),
        }),
      )
      .max(8)
      .default([]),
    banner: imageSlotValueSchema.optional(),
  }),
});

export const problemSectionSchema = z.object({
  type: z.literal("Problem"),
  props: z.object({
    ...baseSectionProps,
    heading: z.string().min(1),
    statement: z.string().min(1),
    painPoints: z
      .array(
        z.object({
          title: z.string().min(1),
          body: z.string().min(1),
        }),
      )
      .min(1)
      .max(6),
  }),
});

export const processSectionSchema = z.object({
  type: z.literal("Process"),
  props: z.object({
    ...baseSectionProps,
    heading: z.string().min(1),
    steps: z
      .array(
        z.object({
          number: z.string().min(1),
          title: z.string().min(1),
          body: z.string().min(1),
          image: imageSlotValueSchema.optional(),
        }),
      )
      .min(1)
      .max(8),
  }),
});

export const screensGallerySectionSchema = z.object({
  type: z.literal("ScreensGallery"),
  props: z.object({
    ...baseSectionProps,
    heading: z.string().min(1),
    columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
    screens: z
      .array(
        z.object({
          caption: z.string(),
          image: imageSlotValueSchema,
        }),
      )
      .min(1)
      .max(12),
  }),
});

export const resultsSectionSchema = z.object({
  type: z.literal("Results"),
  props: z.object({
    ...baseSectionProps,
    heading: z.string().min(1),
    metrics: z
      .array(
        z.object({
          value: z.string().min(1),
          label: z.string().min(1),
        }),
      )
      .min(1)
      .max(6),
    closing: z.string().optional(),
  }),
});

export const quoteSectionSchema = z.object({
  type: z.literal("Quote"),
  props: z.object({
    ...baseSectionProps,
    quote: z.string().min(1),
    author: z.string().min(1),
    role: z.string().optional(),
    avatar: imageSlotValueSchema.optional(),
  }),
});

export const ctaSectionSchema = z.object({
  type: z.literal("CTA"),
  props: z.object({
    ...baseSectionProps,
    heading: z.string().min(1),
    subheading: z.string().optional(),
    primaryLabel: z.string().min(1),
    primaryHref: z.string().min(1),
    secondaryLabel: z.string().optional(),
    secondaryHref: z.string().optional(),
    accent: z.string().trim().min(1).optional(),
  }),
});

export const customSectionSchema = z.object({
  type: z.literal("Custom"),
  props: z.object({
    ...baseSectionProps,
    heading: z.string().min(1),
    body: richTextValueSchema,
    image: imageSlotValueSchema.optional(),
  }),
});

export const puckSectionSchema = z.discriminatedUnion("type", [
  heroSectionSchema,
  overviewSectionSchema,
  problemSectionSchema,
  processSectionSchema,
  screensGallerySectionSchema,
  resultsSectionSchema,
  quoteSectionSchema,
  ctaSectionSchema,
  customSectionSchema,
]);

export type PuckSectionItem = z.infer<typeof puckSectionSchema>;

export const puckDocumentSchema = z.object({
  root: z.object({
    props: z
      .object({
        title: z.string().min(1, "Root title is required."),
        themeRef: z.string().optional(),
      })
      .catchall(z.unknown()),
  }),
  content: z.array(puckSectionSchema).min(1, "At least one section is required in puck.content."),
  zones: z.record(z.string(), z.array(puckSectionSchema)).default({}),
});

export type PuckDocument = z.infer<typeof puckDocumentSchema>;

export const templateWarningSchema = z.union([
  z.string().min(1),
  z.object({
    code: z.string().optional(),
    message: z.string().min(1),
    nodeId: z.string().optional(),
    path: z.string().optional(),
  }),
]);

export type TemplateWarning = z.infer<typeof templateWarningSchema>;

function isImageSlotObject(val: unknown): val is ImageSlotValue {
  return (
    typeof val === "object" &&
    val !== null &&
    "slot" in val &&
    typeof (val as Record<string, unknown>).slot === "string" &&
    "src" in val &&
    "alt" in val
  );
}

function collectRawColorAndSlotIssues(
  value: unknown,
  currentPath: Array<string | number>,
  definedSlots: Record<string, TemplateSlotDefinition>,
  ctx: z.RefinementCtx,
): void {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (HEX_COLOR_REGEX.test(trimmed) || RAW_COLOR_FUNCTION_REGEX.test(trimmed)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: currentPath,
        message: `Raw color '${trimmed}' is forbidden inside section props; reference a token from template.theme.colors instead.`,
      });
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      collectRawColorAndSlotIssues(entry, [...currentPath, index], definedSlots, ctx);
    });
    return;
  }

  if (typeof value === "object" && value !== null) {
    if (isImageSlotObject(value)) {
      if (!(value.slot in definedSlots)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...currentPath, "slot"],
          message: `Image slot '${value.slot}' is not defined in template.slots.`,
        });
      }
    }

    for (const [key, nested] of Object.entries(value)) {
      if (key === "src" || key === "primaryHref" || key === "secondaryHref") {
        continue;
      }
      collectRawColorAndSlotIssues(nested, [...currentPath, key], definedSlots, ctx);
    }
  }
}

export const templateDocumentSchema = z
  .object({
    template: templateMetadataSchema,
    puck: puckDocumentSchema,
    warnings: z.array(templateWarningSchema).default([]),
  })
  .superRefine((doc, ctx) => {
    const seenIds = new Set<string>();
    const colorTokens = doc.template.theme.colors;
    const slotDefs = doc.template.slots;

    doc.puck.content.forEach((section, index) => {
      const sectionPath = ["puck", "content", index, "props"];

      // 1. Unique section props.id
      if (seenIds.has(section.props.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...sectionPath, "id"],
          message: `Duplicate section id '${section.props.id}'. Every section in puck.content must have a unique props.id.`,
        });
      } else {
        seenIds.add(section.props.id);
      }

      // 2. Check raw colors and slot definitions recursively first
      collectRawColorAndSlotIssues(section.props, sectionPath, slotDefs, ctx);

      // 3. Check `background` & `accent` tokens exist in `template.theme.colors`
      const bgToken = section.props.background;
      if (
        !HEX_COLOR_REGEX.test(bgToken) &&
        !RAW_COLOR_FUNCTION_REGEX.test(bgToken) &&
        !(bgToken in colorTokens)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...sectionPath, "background"],
          message: `Color token '${bgToken}' is not defined in template.theme.colors.`,
        });
      }

      if ("accent" in section.props && typeof section.props.accent === "string") {
        const accentToken = section.props.accent;
        if (
          !HEX_COLOR_REGEX.test(accentToken) &&
          !RAW_COLOR_FUNCTION_REGEX.test(accentToken) &&
          !(accentToken in colorTokens)
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [...sectionPath, "accent"],
            message: `Accent color token '${accentToken}' is not defined in template.theme.colors.`,
          });
        }
      }
    });
  });

export type TemplateDocument = z.infer<typeof templateDocumentSchema>;

export interface TemplateValidationIssue {
  path: string;
  message: string;
}

export type ValidateTemplateResult =
  | { ok: true; data: TemplateDocument }
  | { ok: false; issues: TemplateValidationIssue[] };

export function validateTemplateDocument(rawInput: unknown): ValidateTemplateResult {
  const parsed = templateDocumentSchema.safeParse(rawInput);
  if (parsed.success) {
    return { ok: true, data: parsed.data };
  }

  return {
    ok: false,
    issues: parsed.error.issues.map((issue) => ({
      path: issue.path.length > 0 ? issue.path.join(".") : "root",
      message: issue.message,
    })),
  };
}
