"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/session";
import { resolveEffectivePlanForUser } from "@/lib/entitlements/server";
import {
  deleteProjectForUser,
  duplicateProjectForUser,
  renameProjectForUser,
} from "@/lib/projects/dashboard";
import type {
  DeleteProjectInput,
  DeleteProjectResult,
  DuplicateProjectInput,
  DuplicateProjectResult,
  RenameProjectInput,
  RenameProjectResult,
} from "@/lib/projects/dashboard-types";
import {
  checkProjectSlugAvailability,
  publishProjectForUser,
  unpublishProjectForUser,
  type PublishProjectInput,
  type PublishProjectResult,
  type UnpublishProjectResult,
} from "@/lib/projects/publish";
import { createProjectFromTemplate, saveProjectEditorState } from "@/lib/projects/service";
import type {
  CreateProjectInput,
  CreateProjectResult,
  SaveProjectEditorInput,
  SaveProjectEditorResult,
} from "@/lib/projects/types";
import { consumeUploadRateLimit } from "@/lib/storage/rate-limit";
import { authorizeProjectAccess } from "@/lib/workspaces/acl";

export async function createProjectAction(input: CreateProjectInput): Promise<CreateProjectResult> {
  const ctx = await getServerSession();
  if (!ctx) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      error: "Please sign in to create a project.",
    };
  }

  const effectivePlan = await resolveEffectivePlanForUser(ctx.user.id);

  const result = await createProjectFromTemplate({
    userId: ctx.user.id,
    userPlan: effectivePlan,
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

const checkSlugActionSchema = z.object({
  slug: z.string().max(120),
  projectId: z.string().uuid("Invalid project ID."),
});

export async function checkProjectSlugAction(
  slug: string,
  projectId: string,
): Promise<{
  available: boolean;
  normalizedSlug: string;
  reason?: string;
}> {
  const ctx = await getServerSession();
  if (!ctx) {
    return {
      available: false,
      normalizedSlug: slug.trim().toLowerCase(),
      reason: "Please sign in to check slug availability.",
    };
  }

  const rate = consumeUploadRateLimit(`slug-check:${ctx.user.id}`, 60, 60_000);
  if (!rate.allowed) {
    return {
      available: false,
      normalizedSlug: slug.trim().toLowerCase(),
      reason: "Too many slug availability checks. Please wait a moment.",
    };
  }

  const parsed = checkSlugActionSchema.safeParse({ slug, projectId });
  if (!parsed.success) {
    return {
      available: false,
      normalizedSlug: slug.trim().toLowerCase(),
      reason: parsed.error.issues[0]?.message ?? "Invalid slug check input.",
    };
  }

  // Verify caller has read access to `projectId` before allowing it as `excludeProjectId`,
  // preventing cross-tenant slug-to-projectId enumeration.
  const access = await authorizeProjectAccess(parsed.data.projectId, ctx.user.id, "read");
  const safeExcludeProjectId = access.ok ? parsed.data.projectId : undefined;

  return checkProjectSlugAvailability(parsed.data.slug, safeExcludeProjectId);
}

export async function publishProjectAction(
  input: PublishProjectInput,
): Promise<PublishProjectResult> {
  const ctx = await getServerSession();
  if (!ctx) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      error: "Please sign in to publish your case study.",
    };
  }

  const result = await publishProjectForUser(input, {
    id: ctx.user.id,
    role: ctx.user.role,
  });

  if (result.ok) {
    revalidatePath(`/p/${result.slug}`);
    revalidatePath(`/projects/${result.projectId}/share`);
    revalidatePath("/dashboard");
  }

  return result;
}

export async function unpublishProjectAction(projectId: string): Promise<UnpublishProjectResult> {
  const ctx = await getServerSession();
  if (!ctx) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      error: "Please sign in to unpublish your case study.",
    };
  }

  const result = await unpublishProjectForUser(projectId, {
    id: ctx.user.id,
    role: ctx.user.role,
  });

  if (result.ok) {
    if (result.slug) {
      revalidatePath(`/p/${result.slug}`);
    }
    revalidatePath(`/projects/${result.projectId}/share`);
    revalidatePath("/dashboard");
  }

  return result;
}

export async function renameProjectAction(input: RenameProjectInput): Promise<RenameProjectResult> {
  const ctx = await getServerSession();
  if (!ctx) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      error: "Please sign in to rename this project.",
    };
  }

  const result = await renameProjectForUser(input, {
    id: ctx.user.id,
    role: ctx.user.role,
  });

  if (result.ok) {
    revalidatePath("/dashboard");
    revalidatePath("/published");
  }

  return result;
}

export async function duplicateProjectAction(
  input: DuplicateProjectInput,
): Promise<DuplicateProjectResult> {
  const ctx = await getServerSession();
  if (!ctx) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      error: "Please sign in to duplicate this project.",
    };
  }

  const effectivePlan = await resolveEffectivePlanForUser(ctx.user.id);
  const result = await duplicateProjectForUser(
    input,
    { id: ctx.user.id, role: ctx.user.role },
    effectivePlan,
  );

  if (result.ok) {
    revalidatePath("/dashboard");
  }

  return result;
}

export async function deleteProjectAction(input: DeleteProjectInput): Promise<DeleteProjectResult> {
  const ctx = await getServerSession();
  if (!ctx) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      error: "Please sign in to delete this project.",
    };
  }

  const result = await deleteProjectForUser(input, {
    id: ctx.user.id,
    role: ctx.user.role,
  });

  if (result.ok) {
    revalidatePath("/dashboard");
    revalidatePath("/published");
    revalidatePath("/exports");
  }

  return result;
}
