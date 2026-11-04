"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { semverSchema } from "@/lib/template/schema";
import {
  archiveTemplate,
  createNewTemplateVersion,
  publishTemplateVersion,
  saveTemplateDraftFromWizard,
  unarchiveTemplateToDraft,
  wizardMetadataInputSchema,
  type CreateTemplateVersionResult,
  type SaveTemplateDraftResult,
  type TemplateLifecycleActionResult,
} from "@/lib/template/service";

const createDraftActionPayloadSchema = z.object({
  rawJson: z.string().min(1, "Template JSON is required."),
  metadata: wizardMetadataInputSchema,
});

const createVersionActionPayloadSchema = z.object({
  templateId: z.string().uuid("Invalid template ID."),
  version: semverSchema,
  changelog: z.string().trim().max(500).default(""),
  rawJson: z.string().min(1, "Template JSON is required."),
  publishImmediately: z.boolean().default(false),
});

const publishVersionActionPayloadSchema = z.object({
  templateId: z.string().uuid("Invalid template ID."),
  versionId: z.string().uuid("Invalid version ID."),
});

const templateIdPayloadSchema = z.object({
  templateId: z.string().uuid("Invalid template ID."),
});

function revalidateTemplatePaths(templateId: string) {
  revalidatePath("/admin/templates");
  revalidatePath(`/admin/templates/${templateId}`);
  revalidatePath("/templates");
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
