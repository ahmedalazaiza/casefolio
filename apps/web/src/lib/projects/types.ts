import { z } from "zod";
import type {
  ImageSlotValue,
  PuckDocument,
  PuckSectionItem,
  TemplateProjectType,
  TemplateSlotDefinition,
  TemplateTheme,
} from "@/lib/template/schema";

export const FREE_PROJECT_LIMIT = 2;

export const CONSTRAINED_PUCK_PERMISSIONS = {
  insert: false,
  delete: false,
  duplicate: false,
  drag: false,
  edit: true,
} as const;

export interface ProjectEditorPayload {
  project: {
    id: string;
    name: string;
    type: TemplateProjectType;
    puckData: PuckDocument;
    theme: TemplateTheme;
    visibility: "private" | "unlisted" | "public";
    slug: string | null;
    updatedAtIso: string;
  };
  template: {
    id: string;
    name: string;
    slug: string;
    version: string;
    slots: Record<string, TemplateSlotDefinition>;
    defaultTheme: TemplateTheme;
    defaultPuck: PuckDocument;
  };
}

export interface ProjectSlotChecklistItem {
  id: string;
  slotKey: string;
  label: string;
  sectionIndex: number;
  sectionLabel: string;
  ratio: string;
  device: string;
  required: boolean;
  filled: boolean;
  src: string;
}

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

const SECTION_LABELS: Record<PuckSectionItem["type"], string> = {
  Hero: "Hero",
  Overview: "Overview",
  Problem: "Problem",
  Process: "Process",
  ScreensGallery: "Key screens",
  Results: "Results",
  Quote: "Quote",
  CTA: "Call to action",
  Custom: "Custom section",
};

export function formatSectionTypeLabel(type: PuckSectionItem["type"]): string {
  return SECTION_LABELS[type] ?? type;
}

export function isSectionRequired(type: PuckSectionItem["type"]): boolean {
  return type === "Hero";
}

export function toggleSectionVisibility(
  puckData: PuckDocument,
  sectionIndex: number,
): PuckDocument {
  const target = puckData.content[sectionIndex];
  if (!target || isSectionRequired(target.type)) {
    return puckData;
  }

  const nextHidden = !target.props.hidden;
  return {
    ...puckData,
    content: puckData.content.map((item, idx) =>
      idx === sectionIndex
        ? ({
            ...item,
            props: {
              ...item.props,
              hidden: nextHidden,
            },
          } as PuckSectionItem)
        : item,
    ),
  };
}

export function collectProjectSlotStatus(
  puckData: PuckDocument,
  slots: Record<string, TemplateSlotDefinition>,
): ProjectSlotChecklistItem[] {
  const items: ProjectSlotChecklistItem[] = [];

  const pushSlot = (
    id: string,
    fallbackKey: string,
    label: string,
    sectionIndex: number,
    sectionType: PuckSectionItem["type"],
    image: ImageSlotValue | undefined,
  ) => {
    const slotKey = image?.slot || fallbackKey;
    const def = slots[slotKey];
    const ratio = def?.ratio ?? "16:10";
    const device = def?.device && def.device !== "none" ? def.device : "Frame";
    const required = slotKey === "hero.mockup";
    const src = image?.src?.trim() ?? "";

    items.push({
      id,
      slotKey,
      label,
      sectionIndex,
      sectionLabel: formatSectionTypeLabel(sectionType),
      ratio,
      device,
      required,
      filled: src.length > 0,
      src,
    });
  };

  puckData.content.forEach((section, sectionIndex) => {
    if (section.props.hidden) return;

    switch (section.type) {
      case "Hero":
        if (section.props.mockup || slots["hero.mockup"]) {
          pushSlot(
            `${section.props.id}-mockup`,
            "hero.mockup",
            "Hero mockup",
            sectionIndex,
            section.type,
            section.props.mockup,
          );
        }
        if (section.props.logo) {
          pushSlot(
            `${section.props.id}-logo`,
            "hero.logo",
            "Brand logo",
            sectionIndex,
            section.type,
            section.props.logo,
          );
        }
        break;
      case "Overview":
        if (section.props.banner || slots["overview.banner"]) {
          pushSlot(
            `${section.props.id}-banner`,
            "overview.banner",
            "Overview banner",
            sectionIndex,
            section.type,
            section.props.banner,
          );
        }
        break;
      case "Process":
        section.props.steps.forEach((step, idx) => {
          if (step.image) {
            pushSlot(
              `${section.props.id}-step-${idx}`,
              "process.step.image",
              step.title || `Step ${idx + 1}`,
              sectionIndex,
              section.type,
              step.image,
            );
          }
        });
        break;
      case "ScreensGallery":
        section.props.screens.forEach((screen, idx) => {
          pushSlot(
            `${section.props.id}-screen-${idx}`,
            "gallery.screen",
            screen.caption || `Screen ${idx + 1}`,
            sectionIndex,
            section.type,
            screen.image,
          );
        });
        break;
      case "Quote":
        if (section.props.avatar) {
          pushSlot(
            `${section.props.id}-avatar`,
            "quote.avatar",
            "Author avatar",
            sectionIndex,
            section.type,
            section.props.avatar,
          );
        }
        break;
      case "Custom":
        if (section.props.image) {
          pushSlot(
            `${section.props.id}-image`,
            "custom.image",
            section.props.heading || "Custom image",
            sectionIndex,
            section.type,
            section.props.image,
          );
        }
        break;
      default:
        break;
    }
  });

  return items;
}
