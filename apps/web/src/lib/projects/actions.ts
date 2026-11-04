"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "@/lib/auth/session";
import { createProjectFromTemplate } from "@/lib/projects/service";
import type { CreateProjectInput, CreateProjectResult } from "@/lib/projects/types";

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
