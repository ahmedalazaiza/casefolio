"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { isSafeTemplateCoverUrl } from "@/lib/template/cover-url";
import { semverSchema } from "@/lib/template/schema";
import {
  archiveTemplate,
  createNewTemplateVersion,
  deleteAdminTemplate,
  publishTemplateVersion,
  saveTemplateDraftFromWizard,
  unarchiveTemplateToDraft,
  updateTemplateCover,
  wizardMetadataInputSchema,
  type CreateTemplateVersionResult,
  type DeleteTemplateActionResult,
  type SaveTemplateDraftResult,
  type TemplateLifecycleActionResult,
  type UpdateTemplateCoverActionResult,
} from "@/lib/template/service";

const MAX_TEMPLATE_RAW_JSON_CHARS = 512_000;

const createDraftActionPayloadSchema = z.object({
  rawJson: z
    .string()
    .min(1, "Template JSON is required.")
    .max(MAX_TEMPLATE_RAW_JSON_CHARS, "Template JSON exceeds the 512 KB size limit."),
  metadata: wizardMetadataInputSchema,
});

const createVersionActionPayloadSchema = z.object({
  templateId: z.string().uuid("Invalid template ID."),
  version: semverSchema,
  changelog: z.string().trim().max(500).default(""),
  rawJson: z
    .string()
    .min(1, "Template JSON is required.")
    .max(MAX_TEMPLATE_RAW_JSON_CHARS, "Template JSON exceeds the 512 KB size limit."),
  coverUrl: z
    .string()
    .trim()
    .refine(
      (val) => val.length === 0 || isSafeTemplateCoverUrl(val),
      "Cover image URL must be an uploaded /cdn/covers path or https:// URL.",
    )
    .optional(),
  coverRatio: z.string().trim().optional(),
  publishImmediately: z.boolean().default(false),
});

const publishVersionActionPayloadSchema = z.object({
  templateId: z.string().uuid("Invalid template ID."),
  versionId: z.string().uuid("Invalid version ID."),
});

const templateIdPayloadSchema = z.object({
  templateId: z.string().uuid("Invalid template ID."),
});

const deleteTemplatePayloadSchema = z.object({
  templateId: z.string().uuid("Invalid template ID."),
  confirmName: z.string().trim().min(1, "Confirmation name is required.").max(120),
});

const updateTemplateCoverPayloadSchema = z.object({
  templateId: z.string().uuid("Invalid template ID."),
  coverUrl: z
    .string()
    .trim()
    .min(1, "A cover / thumbnail image is required.")
    .refine(
      isSafeTemplateCoverUrl,
      "Cover image URL must be an uploaded /cdn/covers path or https:// URL.",
    ),
  coverRatio: z.string().trim().default("4:3"),
});

function revalidateTemplatePaths(templateId: string) {
  revalidatePath("/");
  revalidatePath("/templates");
  revalidatePath("/new");
  revalidatePath("/dashboard");
  revalidatePath("/published");
  revalidatePath("/admin");
  revalidatePath("/admin/templates");
  revalidatePath(`/admin/templates/${templateId}`);
}

export async function createTemplateDraftAction(
  payload: z.input<typeof createDraftActionPayloadSchema>,
): Promise<SaveTemplateDraftResult> {
  const { user } = await requireAdmin("/admin/templates/new");

  const parsedPayload = createDraftActionPayloadSchema.safeParse(payload);
  if (!parsedPayload.success) {
    return {
      ok: false,
      error: "Invalid request payload.",
      issues: parsedPayload.error.issues.map((issue) => ({
        path: issue.path.join(".") || "root",
        message: issue.message,
      })),
    };
  }

  const result = await saveTemplateDraftFromWizard({
    actorId: user.id,
    rawJson: parsedPayload.data.rawJson,
    metadata: parsedPayload.data.metadata,
  });

  if (result.ok) {
    revalidateTemplatePaths(result.templateId);
  }

  return result;
}

export async function createTemplateVersionAction(
  payload: z.input<typeof createVersionActionPayloadSchema>,
): Promise<CreateTemplateVersionResult> {
  const { user } = await requireAdmin("/admin/templates");

  const parsed = createVersionActionPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid version payload.",
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join(".") || "root",
        message: issue.message,
      })),
    };
  }

  const result = await createNewTemplateVersion({
    actorId: user.id,
    ...parsed.data,
  });

  if (result.ok) {
    revalidateTemplatePaths(parsed.data.templateId);
  }

  return result;
}

export async function publishTemplateVersionAction(
  payload: z.input<typeof publishVersionActionPayloadSchema>,
): Promise<TemplateLifecycleActionResult> {
  const { user } = await requireAdmin("/admin/templates");

  const parsed = publishVersionActionPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid publish request.",
    };
  }

  const result = await publishTemplateVersion({
    actorId: user.id,
    templateId: parsed.data.templateId,
    versionId: parsed.data.versionId,
  });

  if (result.ok) {
    revalidateTemplatePaths(parsed.data.templateId);
  }

  return result;
}

export async function archiveTemplateAction(
  payload: z.input<typeof templateIdPayloadSchema>,
): Promise<TemplateLifecycleActionResult> {
  const { user } = await requireAdmin("/admin/templates");

  const parsed = templateIdPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: "Invalid template ID." };
  }

  const result = await archiveTemplate({
    actorId: user.id,
    templateId: parsed.data.templateId,
  });

  if (result.ok) {
    revalidateTemplatePaths(parsed.data.templateId);
  }

  return result;
}

export async function unarchiveTemplateAction(
  payload: z.input<typeof templateIdPayloadSchema>,
): Promise<TemplateLifecycleActionResult> {
  const { user } = await requireAdmin("/admin/templates");

  const parsed = templateIdPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: "Invalid template ID." };
  }

  const result = await unarchiveTemplateToDraft({
    actorId: user.id,
    templateId: parsed.data.templateId,
  });

  if (result.ok) {
    revalidateTemplatePaths(parsed.data.templateId);
  }

  return result;
}

export async function deleteTemplateAction(
  payload: z.input<typeof deleteTemplatePayloadSchema>,
): Promise<DeleteTemplateActionResult> {
  const { user } = await requireAdmin("/admin/templates");

  const parsed = deleteTemplatePayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid delete payload.",
    };
  }

  const result = await deleteAdminTemplate({
    actorId: user.id,
    templateId: parsed.data.templateId,
    confirmName: parsed.data.confirmName,
  });

  if (result.ok) {
    revalidatePath("/");
    revalidatePath("/templates");
    revalidatePath("/new");
    revalidatePath("/dashboard");
    revalidatePath("/published");
    revalidatePath("/admin");
    revalidatePath("/admin/templates");
  }

  return result;
}

export async function updateTemplateCoverAction(
  payload: z.input<typeof updateTemplateCoverPayloadSchema>,
): Promise<UpdateTemplateCoverActionResult> {
  const { user } = await requireAdmin("/admin/templates");

  const parsed = updateTemplateCoverPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid cover update payload.",
    };
  }

  const result = await updateTemplateCover({
    actorId: user.id,
    templateId: parsed.data.templateId,
    coverUrl: parsed.data.coverUrl,
    coverRatio: parsed.data.coverRatio,
  });

  if (result.ok) {
    revalidateTemplatePaths(parsed.data.templateId);
  }

  return result;
}
