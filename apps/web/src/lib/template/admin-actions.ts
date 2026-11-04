"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import {
  saveTemplateDraftFromWizard,
  wizardMetadataInputSchema,
  type SaveTemplateDraftResult,
} from "@/lib/template/service";

const createDraftActionPayloadSchema = z.object({
  rawJson: z.string().min(1, "Template JSON is required."),
  metadata: wizardMetadataInputSchema,
});

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
    revalidatePath("/admin/templates");
    revalidatePath(`/admin/templates/${result.templateId}`);
    revalidatePath("/templates");
  }

  return result;
}
