import { z } from "zod";
import { isSafeTemplateCoverUrl } from "@/lib/template/cover-url";
import {
  aspectRatioSchema,
  TEMPLATE_PROJECT_TYPES,
  TEMPLATE_TIERS,
  validateTemplateDocument,
  type TemplateDocument,
  type TemplateValidationIssue,
  type TemplateWarning,
} from "@/lib/template/schema";

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const wizardMetadataInputSchema = z.object({
  name: z.string().trim().min(1, "Template name is required.").max(100),
  slug: z
    .string()
    .trim()
    .regex(SLUG_REGEX, "Slug must contain lowercase letters, numbers, and hyphens only."),
  type: z.enum(TEMPLATE_PROJECT_TYPES),
  category: z.string().trim().min(1, "Category is required.").max(60),
  tier: z.enum(TEMPLATE_TIERS),
  coverUrl: z
    .string()
    .trim()
    .min(1, "Cover image URL is required.")
    .refine(isSafeTemplateCoverUrl, "Cover image URL must be an uploaded /cdn/covers path or https:// URL."),
  coverRatio: aspectRatioSchema,
  changelog: z.string().trim().max(500).optional(),
});

export type WizardMetadataInput = z.infer<typeof wizardMetadataInputSchema>;

export type SaveTemplateDraftResult =
  | {
      ok: true;
      templateId: string;
      versionId: string;
      slug: string;
      version: "1.0.0";
      status: "draft";
    }
  | {
      ok: false;
      error: string;
      issues: TemplateValidationIssue[];
    };

export interface TemplateValidationSummary {
  sectionCount: number;
  slotCount: number;
  warningCount: number;
  warnings: TemplateWarning[];
}

export type ParseTemplateJsonResult =
  | {
      ok: true;
      data: TemplateDocument;
      summary: TemplateValidationSummary;
    }
  | {
      ok: false;
      syntaxError?: string;
      issues: TemplateValidationIssue[];
    };

export function parseAndValidateTemplateJson(rawJsonText: string): ParseTemplateJsonResult {
  const trimmed = rawJsonText.trim();
  if (!trimmed) {
    return {
      ok: false,
      syntaxError: "JSON input is empty.",
      issues: [
        {
          path: "json",
          message: "Upload or paste a non-empty template JSON file.",
        },
      ],
    };
  }

  let parsedUnknown: unknown;
  try {
    parsedUnknown = JSON.parse(trimmed);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Invalid JSON syntax.";
    return {
      ok: false,
      syntaxError: detail,
      issues: [
        {
          path: "json",
          message: `Invalid JSON syntax: ${detail}`,
        },
      ],
    };
  }

  if (
    typeof parsedUnknown === "object" &&
    parsedUnknown !== null &&
    "error" in parsedUnknown &&
    typeof (parsedUnknown as Record<string, unknown>).error === "string"
  ) {
    const converterError = (parsedUnknown as { error: string }).error;
    return {
      ok: false,
      issues: [
        {
          path: "error",
          message: `Converter reported fatal error: ${converterError}`,
        },
      ],
    };
  }

  const validation = validateTemplateDocument(parsedUnknown);
  if (!validation.ok) {
    return {
      ok: false,
      issues: validation.issues,
    };
  }

  const doc = validation.data;
  return {
    ok: true,
    data: doc,
    summary: {
      sectionCount: doc.puck.content.length,
      slotCount: Object.keys(doc.template.slots).length,
      warningCount: doc.warnings.length,
      warnings: doc.warnings,
    },
  };
}

/**
 * Allows admins to upload converter JSON files that omit `template.cover` in Step 1,
 * so they can attach the mandatory cover thumbnail directly in the Upload Wizard.
 */
export function normalizeRawTemplateJsonCoverIfMissing(
  rawJsonText: string,
  fallbackCoverSrc = "/templates/pending-cover.png",
  fallbackCoverRatio = "4:3",
): { normalizedJson: string; coverWasMissing: boolean } {
  try {
    const parsed = JSON.parse(rawJsonText) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { normalizedJson: rawJsonText, coverWasMissing: false };
    }
    const tpl = parsed.template as Record<string, unknown> | undefined;
    if (!tpl || typeof tpl !== "object" || Array.isArray(tpl)) {
      return { normalizedJson: rawJsonText, coverWasMissing: false };
    }

    const existingCover = tpl.cover as { src?: unknown; ratio?: unknown } | undefined;
    const existingSrc =
      typeof existingCover?.src === "string" ? existingCover.src.trim() : "";
    if (existingSrc.length > 0) {
      return { normalizedJson: rawJsonText, coverWasMissing: false };
    }

    const ratio =
      typeof existingCover?.ratio === "string" && existingCover.ratio.trim().length > 0
        ? existingCover.ratio.trim()
        : fallbackCoverRatio;

    const cloned = {
      ...parsed,
      template: {
        ...tpl,
        cover: {
          src: fallbackCoverSrc,
          ratio,
        },
      },
    };
    return {
      normalizedJson: JSON.stringify(cloned, null, 2),
      coverWasMissing: true,
    };
  } catch {
    return { normalizedJson: rawJsonText, coverWasMissing: false };
  }
}
