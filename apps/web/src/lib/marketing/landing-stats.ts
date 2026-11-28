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
import { resolveTemplateCoverUrl } from "@/lib/template/cover-url";
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

export interface LandingPublishedTemplateItem {
  id: string;
  name: string;
  slug: string;
  tier: "free" | "pro";
  categoryName: string | null;
  coverUrl: string;
  version: string;
  type: "mobile" | "web" | "both";
  sectionCount: number;
  slotCount: number;
  theme?: {
    bg?: string;
    fg?: string;
    accent?: string;
  };
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
  publishedTemplates: LandingPublishedTemplateItem[];
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
    headline: "Cinema — Mobile Movie Ticket Booking Case Study",
    summary:
      "Dark-mode ticketing UX narrative featuring a 5-column staggered iPhone Pro showcase, live design tokens, and interactive auditorium seat selection.",
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
    coverSrc: "/templates/orbit/cover.svg",
    headline: "Orbit — Personal Debt & Wallet Mobile App",
    summary:
      "Focused fintech case study walking through calm onboarding, payoff snowball milestones, and quantified conversion outcomes.",
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
    coverSrc: "/templates/meridian-pro/cover.svg",
    headline: "Meridian — B2B Revenue Operations SaaS Platform",
    summary:
      "Widescreen browser and MacBook case study crafted for enterprise SaaS dashboards, cohort builders, and executive KPIs.",
  },
  {
    slug: "northwind",
    name: "Northwind",
    type: "web",
    categoryName: "SaaS",
    tier: "free",
    version: "1.0.0",
    sectionCount: 8,
    slotCount: 6,
    coverSrc: "/templates/northwind/cover.svg",
    headline: "Northwind — Real-Time Freight & Dispatch Workspace",
    summary:
      "Redesigning the logistics dispatch console used by 1,200 operators to route 40,000 daily shipments calmly.",
  },
  {
    slug: "pulse",
    name: "Pulse",
    type: "mobile",
    categoryName: "Health & Fitness",
    tier: "free",
    version: "1.0.0",
    sectionCount: 8,
    slotCount: 5,
    coverSrc: "/templates/pulse/cover.svg",
    headline: "Pulse — Habit-First Mobile Fitness & Coaching App",
    summary:
      "Designing a focused workout companion that helps busy schedules fit ten minutes of daily training.",
  },
  {
    slug: "atlas",
    name: "Atlas",
    type: "both",
    categoryName: "Product Story",
    tier: "free",
    version: "1.0.0",
    sectionCount: 9,
    slotCount: 7,
    coverSrc: "/templates/atlas/cover.svg",
    headline: "Atlas — Cross-Platform Travel & Itinerary Planner",
    summary:
      "A hybrid desktop-and-mobile travel product story keeping itineraries, bookings, and maps in sync from planning to boarding pass.",
  },
] as const;

function mapPublishedItemToShowcase(
  item: PublishedTemplateItem,
): LandingTemplateShowcaseItem {
  const known = DEFAULT_LANDING_TEMPLATES.find((d) => d.slug === item.slug);
  const resolvedCover =
    resolveTemplateCoverUrl(item.coverUrl, item.slug) ??
    known?.coverSrc ??
    (item.type === "web"
      ? "/templates/meridian-pro/cover.svg"
      : item.type === "both"
        ? "/templates/cinema/cover.svg"
        : "/templates/orbit/cover.svg");

  return {
    slug: item.slug,
    name: item.name,
    type: item.type,
    categoryName: item.categoryName ?? known?.categoryName ?? "Case Study",
    tier: item.tier,
    version: item.version,
    sectionCount: item.sectionCount,
    slotCount: item.slotCount,
    coverSrc: resolvedCover,
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
  publishedTemplates: readonly LandingPublishedTemplateItem[] = [],
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
    publishedTemplates: [...publishedTemplates],
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

    const publishedTemplates: LandingPublishedTemplateItem[] = published.map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      tier: item.tier,
      categoryName: item.categoryName,
      coverUrl: resolveTemplateCoverUrl(item.coverUrl, item.slug) ?? item.coverUrl ?? "",
      version: item.version,
      type: item.type,
      sectionCount: item.sectionCount,
      slotCount: item.slotCount,
      theme: {
        bg: item.document.template.theme.colors.background,
        fg: item.document.template.theme.colors.text,
        accent: item.document.template.theme.colors.primary,
      },
    }));

    return buildLandingSnapshot(
      mappedTemplates,
      {
        projectsCount: Number(projectRow[0]?.value ?? 0),
        pageViewsCount: Number(viewRow[0]?.value ?? 0),
        exportsCount: Number(exportRow[0]?.value ?? 0),
      },
      publishedTemplates,
    );
  } catch {
    return buildLandingSnapshot(DEFAULT_LANDING_TEMPLATES);
  }
}
