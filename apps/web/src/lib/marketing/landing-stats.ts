import { EXPORT_FORMATS } from "@casefolio/db";
import { SLOT_DEVICES, SUPPORTED_SECTION_TYPES } from "@casefolio/template-schema";
import {
  FREE_PROJECT_LIMIT,
  SECTION_PRESET_OPTIONS,
} from "@/lib/projects/types";
import {
  CURATED_COLOR_PRESETS,
  CURATED_FONT_PAIRS,
} from "@/lib/template/curated-themes";
import type { PublishedTemplateItem } from "@/lib/template/types";

export interface LandingTemplateShowcaseItem {
  slug: string;
  name: string;
  type: "mobile" | "web" | "both";
  categoryName: string;
  tier: "free" | "pro";
  version: string;
  sectionCount: number;
  slotCount: number;
  coverSrc: string;
  previewSecondarySrc?: string;
  headline: string;
  summary: string;
}

export interface LandingPlatformSnapshot {
  publishedTemplatesCount: number;
  mobileTemplatesCount: number;
  webTemplatesCount: number;
  crossPlatformTemplatesCount: number;
  totalTemplateSections: number;
  totalTemplateSlots: number;
  deviceFramesCount: number;
  sectionPresetsCount: number;
  sectionTypesCount: number;
  exportFormatsCount: number;
  curatedPalettesCount: number;
  curatedFontPairsCount: number;
  freeProjectsIncluded: number;
  liveProjectsCount: number;
  livePageViewsCount: number;
  liveExportsCount: number;
  templates: LandingTemplateShowcaseItem[];
}

export const DEFAULT_LANDING_TEMPLATES: readonly LandingTemplateShowcaseItem[] = [
  {
    slug: "cinema",
    name: "Cinema",
    type: "both",
    categoryName: "Entertainment",
    tier: "free",
    version: "1.0.0",
    sectionCount: 14,
    slotCount: 8,
    coverSrc: "/templates/cinema/cover.svg",
    previewSecondarySrc: "/templates/cinema/screen-seats.svg",
    headline: ".Cinema — Movie Ticket Booking Experience",
    summary:
      "End-to-end dark-room booking narrative with 5-column staggered iPhone Pro gallery, live design system, and auditorium seat map.",
  },
  {
    slug: "orbit",
    name: "Orbit",
    type: "mobile",
    categoryName: "Fintech",
    tier: "free",
    version: "1.0.0",
    sectionCount: 6,
    slotCount: 5,
    coverSrc: "/landing/orbit-home.svg",
    previewSecondarySrc: "/landing/orbit-plan.svg",
    headline: "Orbit — Calm Personal Debt & Wallet App",
    summary:
      "Focused mobile fintech flow spanning onboarding, payoff snowball milestones, and quantified conversion outcomes.",
  },
  {
    slug: "meridian-pro",
    name: "Meridian",
    type: "web",
    categoryName: "SaaS",
    tier: "pro",
    version: "1.0.0",
    sectionCount: 6,
    slotCount: 5,
    coverSrc: "/landing/meridian-dashboard.svg",
    headline: "Meridian — B2B Revenue OS Workspace",
    summary:
      "Widescreen browser & MacBook case study crafted for enterprise SaaS dashboards, cohort builders, and executive KPIs.",
  },
] as const;

function mapPublishedItemToShowcase(
  item: PublishedTemplateItem,
): LandingTemplateShowcaseItem {
  const known = DEFAULT_LANDING_TEMPLATES.find((d) => d.slug === item.slug);
  const localCover =
    item.coverUrl && item.coverUrl.startsWith("/")
      ? item.coverUrl
      : known?.coverSrc ??
        (item.type === "web"
          ? "/landing/meridian-dashboard.svg"
          : "/landing/orbit-home.svg");

  return {
    slug: item.slug,
    name: item.name,
    type: item.type,
    categoryName: item.categoryName ?? known?.categoryName ?? "Case Study",
    tier: item.tier,
    version: item.version,
    sectionCount: item.sectionCount,
    slotCount: item.slotCount,
    coverSrc: localCover,
    previewSecondarySrc: known?.previewSecondarySrc,
    headline:
      item.document.puck.root?.props?.title ||
      known?.headline ||
      `${item.name} Case Study`,
    summary:
      known?.summary ??
      `${item.sectionCount} structured sections and ${item.slotCount} ratio-locked screenshot slots.`,
  };
}

export function buildLandingSnapshot(
  templates: readonly LandingTemplateShowcaseItem[] = DEFAULT_LANDING_TEMPLATES,
  liveCounts?: {
    projectsCount?: number;
    pageViewsCount?: number;
    exportsCount?: number;
  },
): LandingPlatformSnapshot {
  const mobileOnly = templates.filter((t) => t.type === "mobile").length;
  const webOnly = templates.filter((t) => t.type === "web").length;
  const bothCount = templates.filter((t) => t.type === "both").length;

  const totalTemplateSections = templates.reduce(
    (sum, item) => sum + item.sectionCount,
    0,
  );
  const totalTemplateSlots = templates.reduce(
    (sum, item) => sum + item.slotCount,
    0,
  );

  return {
    publishedTemplatesCount: templates.length,
    mobileTemplatesCount: mobileOnly,
    webTemplatesCount: webOnly,
    crossPlatformTemplatesCount: bothCount,
    totalTemplateSections,
    totalTemplateSlots,
    deviceFramesCount: SLOT_DEVICES.length,
    sectionPresetsCount: SECTION_PRESET_OPTIONS.length,
    sectionTypesCount: SUPPORTED_SECTION_TYPES.length,
    exportFormatsCount: EXPORT_FORMATS.length,
    curatedPalettesCount: CURATED_COLOR_PRESETS.length,
    curatedFontPairsCount: CURATED_FONT_PAIRS.length,
    freeProjectsIncluded: FREE_PROJECT_LIMIT,
    liveProjectsCount: liveCounts?.projectsCount ?? 0,
    livePageViewsCount: liveCounts?.pageViewsCount ?? 0,
    liveExportsCount: liveCounts?.exportsCount ?? 0,
    templates: [...templates],
  };
}

export async function getLandingPlatformSnapshot(): Promise<LandingPlatformSnapshot> {
  if (typeof window !== "undefined") {
    return buildLandingSnapshot(DEFAULT_LANDING_TEMPLATES);
  }

  try {
    const [{ count, eq }, { db, dbSchema }, { listPublishedLibraryTemplates }] =
      await Promise.all([
        import("@casefolio/db"),
        import("@/lib/db"),
        import("@/lib/template/service"),
      ]);

    const [published, projectRow, viewRow, exportRow] = await Promise.all([
      listPublishedLibraryTemplates(),
      db.select({ value: count() }).from(dbSchema.projects),
      db.select({ value: count() }).from(dbSchema.pageViews),
      db
        .select({ value: count() })
        .from(dbSchema.exportsTable)
        .where(eq(dbSchema.exportsTable.status, "completed")),
    ]);

    const mappedTemplates =
      published.length > 0
        ? published.map(mapPublishedItemToShowcase)
        : DEFAULT_LANDING_TEMPLATES;

    return buildLandingSnapshot(mappedTemplates, {
      projectsCount: Number(projectRow[0]?.value ?? 0),
      pageViewsCount: Number(viewRow[0]?.value ?? 0),
      exportsCount: Number(exportRow[0]?.value ?? 0),
    });
  } catch {
    return buildLandingSnapshot(DEFAULT_LANDING_TEMPLATES);
  }
}
