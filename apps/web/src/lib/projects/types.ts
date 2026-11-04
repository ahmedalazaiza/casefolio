import { z } from "zod";
import type { PuckDocument, PuckSectionItem, TemplateProjectType } from "@/lib/template/schema";

export const FREE_PROJECT_LIMIT = 2;

export const createProjectInputSchema = z.object({
  type: z.enum(["mobile", "web", "both"]),
  templateId: z.string().uuid("Select a valid template."),
  name: z
    .string()
    .trim()
    .min(2, "Project name must be at least 2 characters.")
    .max(120, "Project name must be 120 characters or fewer."),
  description: z.string().trim().max(300, "Description must be 300 characters or fewer.").optional(),
  client: z.string().trim().max(80, "Client must be 80 characters or fewer.").optional(),
  role: z.string().trim().max(80, "Role must be 80 characters or fewer.").optional(),
  year: z.string().trim().max(20, "Year must be 20 characters or fewer.").optional(),
  tools: z.string().trim().max(120, "Tools must be 120 characters or fewer.").optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;

export type CreateProjectErrorCode =
  | "UNAUTHORIZED"
  | "VALIDATION_ERROR"
  | "PLAN_LIMIT_REACHED"
  | "PRO_TEMPLATE_LOCKED"
  | "TEMPLATE_NOT_FOUND";

export type CreateProjectResult =
  | {
      ok: true;
      projectId: string;
      templateVersionId: string;
    }
  | {
      ok: false;
      code: CreateProjectErrorCode;
      error: string;
      fieldErrors?: Record<string, string>;
    };

export function slugifyProjectName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  return base || "untitled-case-study";
}

export function isTemplateCompatibleWithProjectType(
  templateType: TemplateProjectType,
  selectedType: TemplateProjectType,
): boolean {
  if (selectedType === "both") {
    return true;
  }
  return templateType === selectedType || templateType === "both";
}

export function buildInitialProjectPuckData(
  basePuck: PuckDocument,
  input: Pick<CreateProjectInput, "name" | "description" | "client" | "role" | "year" | "tools">,
): PuckDocument {
  const cloned = structuredClone(basePuck);
  const cleanName = input.name.trim();
  const cleanDesc = input.description?.trim() ?? "";
  const cleanClient = input.client?.trim() ?? "";
  const cleanRole = input.role?.trim() ?? "";
  const cleanYear = input.year?.trim() ?? "";
  const cleanTools = input.tools?.trim() ?? "";

  cloned.root = {
    ...cloned.root,
    props: {
      ...cloned.root.props,
      title: cleanName,
    },
  };

  let heroPatched = false;
  let overviewPatched = false;

  cloned.content = cloned.content.map((section): PuckSectionItem => {
    if (!heroPatched && section.type === "Hero") {
      heroPatched = true;
      return {
        ...section,
        props: {
          ...section.props,
          title: cleanName,
          ...(cleanDesc ? { subtitle: cleanDesc } : {}),
          ...(cleanYear ? { eyebrow: `CASE STUDY · ${cleanYear}` } : {}),
        },
      };
    }

    if (
      !overviewPatched &&
      section.type === "Overview" &&
      (cleanRole || cleanClient || cleanYear || cleanTools)
    ) {
      overviewPatched = true;
      const existingMeta = [...(section.props.meta ?? [])];
      const updates: Array<{ match: RegExp; label: string; value: string }> = [
        { match: /^role$/i, label: "Role", value: cleanRole },
        { match: /^client|company$/i, label: "Client", value: cleanClient },
        { match: /^year|timeline$/i, label: "Year", value: cleanYear },
        { match: /^tools|stack$/i, label: "Tools", value: cleanTools },
      ];

      for (const entry of updates) {
        if (!entry.value) continue;
        const foundIdx = existingMeta.findIndex((item) => entry.match.test(item.label.trim()));
        if (foundIdx >= 0) {
          const prev = existingMeta[foundIdx];
          if (prev) {
            existingMeta[foundIdx] = { label: prev.label, value: entry.value };
          }
        } else if (existingMeta.length < 8) {
          existingMeta.push({ label: entry.label, value: entry.value });
        }
      }

      return {
        ...section,
        props: {
          ...section.props,
          meta: existingMeta,
        },
      };
    }

    return section;
  });

  return cloned;
}
