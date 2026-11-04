"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "@/lib/auth/session";
import { createProjectFromTemplate, saveProjectEditorState } from "@/lib/projects/service";
import type {
  CreateProjectInput,
  CreateProjectResult,
  SaveProjectEditorInput,
  SaveProjectEditorResult,
} from "@/lib/projects/types";

export async function createProjectAction(
  input: CreateProjectInput,
): Promise<CreateProjectResult> {
  const ctx = await getServerSession();
  if (!ctx) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      error: "Please sign in to create a project.",
    };
  }

  const result = await createProjectFromTemplate({
    userId: ctx.user.id,
    userPlan: ctx.user.plan,
    orgId: ctx.session.activeOrganizationId ?? null,
    input,
  });

  if (result.ok) {
    revalidatePath("/dashboard");
  }

  return result;
}

export async function saveProjectEditorAction(
  input: SaveProjectEditorInput,
): Promise<SaveProjectEditorResult> {
  const ctx = await getServerSession();
  if (!ctx) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      error: "Your session expired. Sign in again to save changes.",
    };
  }

  const result = await saveProjectEditorState(input, {
    id: ctx.user.id,
    role: ctx.user.role,
  });

  if (result.ok) {
    revalidatePath("/dashboard");
  }

  return result;
}
