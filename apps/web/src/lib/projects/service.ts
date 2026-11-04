import { and, count, eq, type PlanTier } from "@casefolio/db";
import { db, dbSchema } from "@/lib/db";
import {
  buildInitialProjectPuckData,
  createProjectInputSchema,
  FREE_PROJECT_LIMIT,
  type CreateProjectInput,
  type CreateProjectResult,
} from "@/lib/projects/types";
import { validateTemplateDocument } from "@/lib/template/schema";

export interface CreateProjectServiceArgs {
  userId: string;
  userPlan: PlanTier;
  orgId?: string | null;
  input: CreateProjectInput;
}

export async function createProjectFromTemplate({
  userId,
  userPlan,
  orgId = null,
  input,
}: CreateProjectServiceArgs): Promise<CreateProjectResult> {
  const parsed = createProjectInputSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] ? String(issue.path[0]) : "root";
      if (!fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: parsed.error.issues[0]?.message ?? "Please review the project details.",
      fieldErrors,
    };
  }

  const valid = parsed.data;

  if (userPlan === "free") {
    const [existingCount] = await db
      .select({ total: count() })
      .from(dbSchema.projects)
      .where(eq(dbSchema.projects.ownerId, userId));

    if ((existingCount?.total ?? 0) >= FREE_PROJECT_LIMIT) {
      return {
        ok: false,
        code: "PLAN_LIMIT_REACHED",
        error: `Free plan includes up to ${FREE_PROJECT_LIMIT} projects. Upgrade to Pro for unlimited case studies.`,
      };
    }
  }

  const [tplRow] = await db
    .select({
      template: dbSchema.templates,
      version: dbSchema.templateVersions,
    })
    .from(dbSchema.templates)
    .innerJoin(
      dbSchema.templateVersions,
      eq(dbSchema.templates.currentVersionId, dbSchema.templateVersions.id),
    )
    .where(
      and(
        eq(dbSchema.templates.id, valid.templateId),
        eq(dbSchema.templates.status, "published"),
      ),
    )
    .limit(1);

  if (!tplRow) {
    return {
      ok: false,
      code: "TEMPLATE_NOT_FOUND",
      error: "Selected template is unavailable or has been unpublished.",
    };
  }

  if (tplRow.template.tier === "pro" && userPlan === "free") {
    return {
      ok: false,
      code: "PRO_TEMPLATE_LOCKED",
      error: "Pro templates require an active Pro or Team plan.",
    };
  }

  const docCheck = validateTemplateDocument(tplRow.version.data);
  if (!docCheck.ok) {
    return {
      ok: false,
      code: "TEMPLATE_NOT_FOUND",
      error: "Template version data could not be loaded.",
    };
  }

  const initialPuckData = buildInitialProjectPuckData(docCheck.data.puck, valid);
  const initialTheme = structuredClone(docCheck.data.template.theme);
  const now = new Date();

  const [created] = await db
    .insert(dbSchema.projects)
    .values({
      ownerId: userId,
      orgId: orgId ?? null,
      templateVersionId: tplRow.version.id,
      name: valid.name,
      type: valid.type,
      puckData: initialPuckData as unknown as Record<string, unknown>,
      theme: initialTheme as unknown as Record<string, unknown>,
      visibility: "private",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!created) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: "Failed to create project record.",
    };
  }

  return {
    ok: true,
    projectId: created.id,
    templateVersionId: tplRow.version.id,
  };
}
