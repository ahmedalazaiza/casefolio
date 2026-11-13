import type { PlanTier } from "@casefolio/db";
import { z } from "zod";
import {
  puckDocumentSchema,
  templateThemeSchema,
  type ImageSlotValue,
  type PuckDocument,
  type PuckSectionItem,
  type TemplateProjectType,
  type TemplateSlotDefinition,
  type TemplateTheme,
} from "@/lib/template/schema";

export const FREE_PROJECT_LIMIT = 1;
export const PRO_PROJECT_LIMIT = -1;
export const TEAMS_PROJECT_LIMIT_PER_SEAT = -1;

export const FREE_PUBLISHED_LIMIT = 1;
export const PRO_PUBLISHED_LIMIT = -1;
export const TEAMS_PUBLISHED_LIMIT_PER_SEAT = -1;

export const FREE_RETAINED_LIMIT = 999_999;
export const PRO_RETAINED_LIMIT = 999_999;
export const TEAMS_RETAINED_LIMIT_PER_SEAT = 999_999;

export const CONSTRAINED_PUCK_PERMISSIONS = {
  insert: false,
  delete: false,
  duplicate: false,
  drag: false,
  edit: true,
} as const;

export interface EditorLeaseState {
  isHolder: boolean;
  isHeldByCurrentUser: boolean;
  readOnly: boolean;
  holderUserId: string | null;
  holderName: string | null;
  leaseToken: string | null;
  expiresAtIso: string | null;
  reason?:
    | "active_writer"
    | "held_by_teammate"
    | "archived"
    | "workspace_frozen"
    | "past_due_read_only"
    | "pro_template_downgraded"
    | "free_tier_extra_project_locked";
}

export interface ProjectEditorPayload {
  project: {
    id: string;
    name: string;
    type: TemplateProjectType;
    puckData: PuckDocument;
    theme: TemplateTheme;
    revision?: number;
    visibility: "private" | "unlisted" | "public";
    brandingRemoved?: boolean;
    archivedAtIso?: string | null;
    slug: string | null;
    updatedAtIso: string;
    workspaceId?: string | null;
    spaceId?: string | null;
    spaceVisibility?: "private" | "shared";
  };
  lease?: EditorLeaseState | null;
  isReadOnly?: boolean;
  readOnlyReason?: string | null;
  workspacePlan?: PlanTier;
  template: {
    id: string;
    name: string;
    slug: string;
    tier?: "free" | "pro";
    version: string;
    slots: Record<string, TemplateSlotDefinition>;
    defaultTheme: TemplateTheme;
    defaultPuck: PuckDocument;
    allowSectionMutations?: boolean;
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
  spaceId: z.string().uuid().optional().nullable(),
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
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "PLAN_LIMIT_REACHED"
  | "PRO_TEMPLATE_LOCKED"
  | "TEMPLATE_NOT_FOUND";

export type CreateProjectResult =
  | {
      ok: true;
      projectId: string;
      templateVersionId: string;
      workspaceId?: string;
      spaceId?: string;
    }
  | {
      ok: false;
      code: CreateProjectErrorCode;
      error: string;
      fieldErrors?: Record<string, string>;
    };

export const saveProjectEditorInputSchema = z.object({
  projectId: z.string().uuid("Invalid project ID."),
  expectedUpdatedAtIso: z.string().datetime({ offset: true }).optional(),
  expectedRevision: z.number().int().positive().optional(),
  leaseToken: z.string().min(8).max(200).optional(),
  brandingRemoved: z.boolean().optional(),
  puckData: puckDocumentSchema,
  theme: templateThemeSchema,
});

export type SaveProjectEditorInput = z.infer<typeof saveProjectEditorInputSchema>;

export type SaveProjectEditorErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "LEASE_HELD"
  | "STORAGE_QUOTA_EXCEEDED"
  | "SAVE_FAILED";

export type SaveProjectEditorResult =
  | {
      ok: true;
      updatedAtIso: string;
      revision: number;
    }
  | {
      ok: false;
      code: SaveProjectEditorErrorCode;
      error: string;
      serverUpdatedAtIso?: string;
      serverRevision?: number;
      holderName?: string | null;
      lease?: EditorLeaseState;
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

export function formatSectionSummaryLabel(section: PuckSectionItem): string {
  if (section.type === "Hero") {
    return "Hero";
  }
  if (section.type === "Quote") {
    return section.props.author ? `Quote · ${section.props.author}` : "Quote";
  }
  const heading = "heading" in section.props ? section.props.heading?.trim() : "";
  if (heading && heading.length > 0) {
    return heading;
  }
  return formatSectionTypeLabel(section.type);
}

export function isSectionRequired(type: PuckSectionItem["type"]): boolean {
  return type === "Hero";
}

export type SectionPresetKey =
  | "overview"
  | "problem"
  | "user-flow"
  | "ux-pillars"
  | "process-cards"
  | "screens-gallery"
  | "feature-spotlight"
  | "comparison"
  | "persona"
  | "design-system"
  | "results"
  | "quote"
  | "cta";

export interface SectionPresetOption {
  key: SectionPresetKey;
  label: string;
  description: string;
  sectionType: PuckSectionItem["type"];
}

export const SECTION_PRESET_OPTIONS: ReadonlyArray<SectionPresetOption> = [
  {
    key: "overview",
    label: "Overview & Metadata",
    description: "Summary narrative with role, timeline, and tools cards",
    sectionType: "Overview",
  },
  {
    key: "problem",
    label: "Problem / Pain Points",
    description: "2–4 column audit of user friction and research insights",
    sectionType: "Problem",
  },
  {
    key: "user-flow",
    label: "User Flow Timeline",
    description: "Connected step-by-step product journey",
    sectionType: "Process",
  },
  {
    key: "ux-pillars",
    label: "UX Architecture Pillars",
    description: "3-column product strategy and solution cards",
    sectionType: "Process",
  },
  {
    key: "process-cards",
    label: "Process Steps",
    description: "2-column design process cards with optional visuals",
    sectionType: "Process",
  },
  {
    key: "screens-gallery",
    label: "Screens Showcase",
    description: "2–5 column mobile, tablet, MacBook, or wireframe gallery",
    sectionType: "ScreensGallery",
  },
  {
    key: "feature-spotlight",
    label: "Feature Spotlight",
    description: "Split callout with feature bullets and device mockup",
    sectionType: "Custom",
  },
  {
    key: "comparison",
    label: "Competitive Analysis",
    description: "Side-by-side competitor comparison cards",
    sectionType: "Custom",
  },
  {
    key: "persona",
    label: "Target Persona",
    description: "User profile with goals, frustrations, and bio cards",
    sectionType: "Custom",
  },
  {
    key: "design-system",
    label: "Design System",
    description: "Live typography specimen and theme color swatches",
    sectionType: "Custom",
  },
  {
    key: "results",
    label: "Impact & Takeaways",
    description: "Headline metrics and key project learnings",
    sectionType: "Results",
  },
  {
    key: "quote",
    label: "Testimonial Quote",
    description: "Stakeholder or user research quote",
    sectionType: "Quote",
  },
  {
    key: "cta",
    label: "Call to Action",
    description: "Interactive prototype or contact link banner",
    sectionType: "CTA",
  },
];

function createUniqueSectionId(puckData: PuckDocument, prefix: string): string {
  const existing = new Set(puckData.content.map((item) => item.props.id));
  let counter = puckData.content.length + 1;
  let candidate = `${prefix}-${counter}`;
  while (existing.has(candidate)) {
    counter += 1;
    candidate = `${prefix}-${counter}`;
  }
  return candidate;
}

function resolveAvailableSlotKey(
  slots: Record<string, TemplateSlotDefinition>,
  preferredKeys: readonly string[],
): string | null {
  for (const key of preferredKeys) {
    if (key in slots) {
      return key;
    }
  }
  const firstKey = Object.keys(slots)[0];
  return firstKey ?? null;
}

export function moveSectionInDocument(
  puckData: PuckDocument,
  fromIndex: number,
  direction: "up" | "down",
): { puckData: PuckDocument; nextIndex: number } {
  const target = puckData.content[fromIndex];
  if (!target || isSectionRequired(target.type)) {
    return { puckData, nextIndex: fromIndex };
  }

  const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
  if (toIndex < 0 || toIndex >= puckData.content.length) {
    return { puckData, nextIndex: fromIndex };
  }

  const neighbor = puckData.content[toIndex];
  if (!neighbor || (direction === "up" && isSectionRequired(neighbor.type))) {
    return { puckData, nextIndex: fromIndex };
  }

  const nextContent = [...puckData.content];
  nextContent[fromIndex] = neighbor;
  nextContent[toIndex] = target;

  return {
    puckData: {
      ...puckData,
      content: nextContent,
    },
    nextIndex: toIndex,
  };
}

export function duplicateSectionInDocument(
  puckData: PuckDocument,
  sectionIndex: number,
): { puckData: PuckDocument; insertedIndex: number } {
  const source = puckData.content[sectionIndex];
  if (!source || isSectionRequired(source.type)) {
    return { puckData, insertedIndex: sectionIndex };
  }

  const cloned = structuredClone(source);
  cloned.props.id = createUniqueSectionId(puckData, source.type);
  cloned.props.hidden = false;

  const insertAt = sectionIndex + 1;
  const nextContent = [
    ...puckData.content.slice(0, insertAt),
    cloned,
    ...puckData.content.slice(insertAt),
  ];

  return {
    puckData: {
      ...puckData,
      content: nextContent,
    },
    insertedIndex: insertAt,
  };
}

export function removeSectionFromDocument(
  puckData: PuckDocument,
  sectionIndex: number,
): { puckData: PuckDocument; nextSelectedIndex: number } {
  const target = puckData.content[sectionIndex];
  if (!target || isSectionRequired(target.type) || puckData.content.length <= 1) {
    return { puckData, nextSelectedIndex: sectionIndex };
  }

  const nextContent = puckData.content.filter((_, idx) => idx !== sectionIndex);
  const nextSelectedIndex = Math.max(0, Math.min(sectionIndex, nextContent.length - 1));

  return {
    puckData: {
      ...puckData,
      content: nextContent,
    },
    nextSelectedIndex,
  };
}

export function insertSectionPresetIntoDocument(
  puckData: PuckDocument,
  presetKey: SectionPresetKey,
  slots: Record<string, TemplateSlotDefinition>,
  afterIndex?: number | null,
): { puckData: PuckDocument; insertedIndex: number } {
  const screenSlotKey = resolveAvailableSlotKey(slots, [
    "gallery.screen",
    "custom.image",
    "hero.mockup",
  ]);
  const spotlightSlotKey = resolveAvailableSlotKey(slots, [
    "custom.image",
    "gallery.screen",
    "hero.mockup",
  ]);

  let newSection: PuckSectionItem;

  switch (presetKey) {
    case "overview":
      newSection = {
        type: "Overview",
        props: {
          id: createUniqueSectionId(puckData, "Overview"),
          eyebrow: "OVERVIEW",
          heading: "Project overview",
          summary: "Summarize the product context, business challenge, and design scope.",
          meta: [
            { label: "Role", value: "Product Designer" },
            { label: "Timeline", value: "8 weeks" },
          ],
          background: "surface",
        },
      };
      break;
    case "problem":
      newSection = {
        type: "Problem",
        props: {
          id: createUniqueSectionId(puckData, "Problem"),
          eyebrow: "USER RESEARCH",
          heading: "Key user pain points",
          statement: "Core friction uncovered during discovery interviews and usability audits.",
          columns: 3,
          painPoints: [
            { title: "Fragmented journey", body: "Users switched across multiple screens to complete a single task." },
            { title: "Hidden pricing", body: "Important fees appeared only at the final confirmation step." },
            { title: "Cognitive overload", body: "Dense hierarchy slowed down first-time decision making." },
          ],
          background: "background",
        },
      };
      break;
    case "user-flow":
      newSection = {
        type: "Process",
        props: {
          id: createUniqueSectionId(puckData, "Process"),
          eyebrow: "USER FLOW",
          heading: "End-to-end user journey",
          subtitle: "Streamlined path from entry point to core conversion.",
          layout: "timeline",
          accent: "primary",
          steps: [
            { number: "01", title: "Entry", body: "Instant launch into personalized discovery." },
            { number: "02", title: "Selection", body: "Interactive filtering with live availability." },
            { number: "03", title: "Checkout", body: "One-tap payment with transparent totals." },
            { number: "04", title: "Confirmation", body: "Live pass ready for immediate use." },
          ],
          background: "surface",
        },
      };
      break;
    case "ux-pillars":
      newSection = {
        type: "Process",
        props: {
          id: createUniqueSectionId(puckData, "Process"),
          eyebrow: "UX STRATEGY",
          heading: "Core product pillars",
          layout: "grid-3",
          accent: "primary",
          steps: [
            { number: "01", title: "Speed first", body: "Eliminate redundant steps from the critical path." },
            { number: "02", title: "Visual clarity", body: "High-contrast hierarchy tailored to real-world context." },
            { number: "03", title: "Confidence", body: "Clear feedback and reversible actions at every stage." },
          ],
          background: "background",
        },
      };
      break;
    case "process-cards":
      newSection = {
        type: "Process",
        props: {
          id: createUniqueSectionId(puckData, "Process"),
          eyebrow: "PROCESS",
          heading: "How we solved it",
          layout: "cards",
          steps: [
            { number: "01", title: "Discovery", body: "Synthesized interviews into actionable design principles." },
            { number: "02", title: "Prototyping", body: "Validated interactive flows with target users." },
          ],
          background: "surface",
        },
      };
      break;
    case "screens-gallery":
      newSection = {
        type: "ScreensGallery",
        props: {
          id: createUniqueSectionId(puckData, "ScreensGallery"),
          eyebrow: "UI DESIGN",
          heading: "Key product screens",
          columns: 3,
          showcaseLayout: "grid",
          deviceFrame: "auto",
          screens: [1, 2, 3].map((num) => ({
            caption: `Screen 0${num}`,
            image: {
              slot: screenSlotKey ?? "gallery.screen",
              src: "",
              alt: `Screen 0${num}`,
              crop: null,
            },
          })),
          background: "background",
        },
      };
      break;
    case "feature-spotlight":
      newSection = {
        type: "Custom",
        props: {
          id: createUniqueSectionId(puckData, "Custom"),
          eyebrow: "FEATURE SPOTLIGHT",
          heading: "Signature interaction",
          layout: "split-right",
          mockupStyle: "straight",
          accent: "primary",
          body: "Deep dive into the highest-impact workflow and the micro-interactions that made it effortless.",
          bullets: [
            { text: "Real-time visual feedback without page reloads" },
            { text: "Thumb-friendly controls anchored in the primary reach zone" },
            { text: "Accessible contrast across light and dark environments" },
          ],
          ...(spotlightSlotKey
            ? {
                image: {
                  slot: spotlightSlotKey,
                  src: "",
                  alt: "Feature spotlight mockup",
                  crop: null,
                },
              }
            : {}),
          background: "background",
        },
      };
      break;
    case "comparison":
      newSection = {
        type: "Custom",
        props: {
          id: createUniqueSectionId(puckData, "Custom"),
          eyebrow: "COMPETITIVE ANALYSIS",
          heading: "Market comparison",
          layout: "comparison",
          accent: "primary",
          body: "Evaluating existing alternatives to identify clear UX differentiation.",
          cards: [
            {
              title: "Legacy App A",
              subtitle: "3.6 ★ · 7 steps",
              body: "• Cluttered seat map\n• Mandatory account wall\n• Slow checkout",
              highlighted: false,
            },
            {
              title: "Competitor B",
              subtitle: "4.0 ★ · 6 steps",
              body: "• Hidden service fees\n• No live availability\n• Dated UI",
              highlighted: false,
            },
            {
              title: "Our Solution",
              subtitle: "4.9 ★ · 3 steps",
              body: "• Instant interactive map\n• Guest Apple/Google Pay\n• Live QR wallet pass",
              highlighted: true,
            },
          ],
          background: "surface",
        },
      };
      break;
    case "persona":
      newSection = {
        type: "Custom",
        props: {
          id: createUniqueSectionId(puckData, "Custom"),
          eyebrow: "TARGET AUDIENCE",
          heading: "Primary user persona",
          layout: "persona",
          accent: "primary",
          body: "Omar Al-Mansoor · 26 · Frequent social planner who books on mobile minutes before heading out.",
          cards: [
            {
              title: "Goals",
              body: "• Pick the best seats in under 2 minutes\n• Share tickets effortlessly with friends",
            },
            {
              title: "Frustrations",
              body: "• Pinch-zooming tiny seat grids\n• Re-entering card details every visit",
            },
            {
              title: "Behaviors",
              body: "• Browses trailers at night in dark mode\n• Pays exclusively via digital wallet",
            },
          ],
          background: "background",
        },
      };
      break;
    case "design-system":
      newSection = {
        type: "Custom",
        props: {
          id: createUniqueSectionId(puckData, "Custom"),
          eyebrow: "DESIGN SYSTEM",
          heading: "Typography & color tokens",
          layout: "design-system",
          accent: "primary",
          body: "A cohesive token architecture balancing expressive brand energy with effortless readability.",
          swatches: [
            { label: "Primary", token: "primary", role: "Brand actions & key highlights" },
            { label: "Background", token: "background", role: "Primary canvas surface" },
            { label: "Surface", token: "surface", role: "Elevated cards & containers" },
            { label: "Text", token: "text", role: "High-contrast primary copy" },
          ],
          background: "surface",
        },
      };
      break;
    case "results":
      newSection = {
        type: "Results",
        props: {
          id: createUniqueSectionId(puckData, "Results"),
          eyebrow: "IMPACT",
          heading: "Measurable outcomes",
          columns: 3,
          accent: "primary",
          metrics: [
            { value: "+44%", label: "Task completion rate" },
            { value: "2.1x", label: "Faster checkout speed" },
            { value: "4.9★", label: "Usability test score" },
          ],
          takeaways: [
            {
              title: "Progressive disclosure",
              body: "Surfacing only essential choices per step dramatically reduced drop-off.",
            },
            {
              title: "System thinking",
              body: "Reusable tokens kept dark-room contrast consistent across every flow.",
            },
            {
              title: "Validate early",
              body: "Low-fi wireframe testing caught seat-map ergonomics issues before hi-fi.",
            },
          ],
          background: "background",
        },
      };
      break;
    case "quote":
      newSection = {
        type: "Quote",
        props: {
          id: createUniqueSectionId(puckData, "Quote"),
          quote: "Booking seats went from the most frustrating part of movie night to a 30-second delight.",
          author: "Layla H.",
          role: "Usability Study Participant",
          background: "surface",
        },
      };
      break;
    case "cta":
      newSection = {
        type: "CTA",
        props: {
          id: createUniqueSectionId(puckData, "CTA"),
          heading: "Want to explore the interactive prototype?",
          subheading: "Available for product walkthroughs and design discussions.",
          primaryLabel: "View prototype",
          primaryHref: "https://casefolio-gamma.vercel.app",
          background: "background",
          accent: "primary",
        },
      };
      break;
  }

  const baseInsertIndex =
    afterIndex !== null && afterIndex !== undefined && afterIndex >= 0
      ? Math.min(afterIndex + 1, puckData.content.length)
      : puckData.content.length;
  const safeInsertIndex = Math.max(1, baseInsertIndex);

  const nextContent = [
    ...puckData.content.slice(0, safeInsertIndex),
    newSection,
    ...puckData.content.slice(safeInsertIndex),
  ];

  return {
    puckData: {
      ...puckData,
      content: nextContent,
    },
    insertedIndex: safeInsertIndex,
  };
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
    const resolvedDevice = image?.device ?? def?.device;
    const device = resolvedDevice && resolvedDevice !== "none" ? resolvedDevice : "Frame";
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
