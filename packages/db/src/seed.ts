import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { backfillBusinessTenancy } from "./backfill";
import { createDbConnection, type Database } from "./client";
import {
  categories,
  templates,
  templateVersions,
  users,
  type ProjectType,
  type TemplateTier,
} from "./schema";

function resolveReferenceJsonPath(fileName: string): string {
  for (const candidate of [
    resolve(process.cwd(), `reference/${fileName}`),
    resolve(process.cwd(), `../../reference/${fileName}`),
  ]) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return resolve(process.cwd(), `reference/${fileName}`);
}

const ORBIT_TEMPLATE_JSON_PATH = resolveReferenceJsonPath("template.example.json");
const CINEMA_TEMPLATE_JSON_PATH = resolveReferenceJsonPath("template.cinema.json");
const NORTHWIND_TEMPLATE_JSON_PATH = resolveReferenceJsonPath("template.northwind.json");
const PULSE_TEMPLATE_JSON_PATH = resolveReferenceJsonPath("template.pulse.json");
const ATLAS_TEMPLATE_JSON_PATH = resolveReferenceJsonPath("template.atlas.json");

interface OrbitSeedJson {
  template: {
    slug: string;
    name: string;
    type: ProjectType;
    version: string;
    category: string;
    tier: TemplateTier;
    cover: { src: string; ratio: string };
  };
  puck: Record<string, unknown>;
}

export interface SeedResult {
  adminUserId: string;
  categoryId: string;
  templateId: string;
  templateVersionId: string;
}

const DEFAULT_SEED_COVERS = new Set([
  "/landing/orbit-home.svg",
  "/landing/orbit-plan.svg",
  "/landing/meridian-dashboard.svg",
  "/templates/orbit/cover.svg",
  "/templates/meridian-pro/cover.svg",
  "/templates/cinema/cover.svg",
  "/templates/atlas/cover.svg",
  "/templates/northwind/cover.svg",
  "/templates/pulse/cover.svg",
]);

function resolveSeedCoverUrl(
  existingCoverUrl: string | null | undefined,
  defaultCoverUrl: string,
): string {
  const trimmed = existingCoverUrl?.trim() ?? "";
  if (
    trimmed.length > 0 &&
    !DEFAULT_SEED_COVERS.has(trimmed) &&
    !trimmed.startsWith("https://cdn.casefolio.app/")
  ) {
    return trimmed;
  }
  return defaultCoverUrl;
}

export async function seedDatabase(dbInstance?: Database): Promise<SeedResult> {
  const ownsConnection = !dbInstance;
  const conn = dbInstance ? null : createDbConnection();
  const db = dbInstance ?? conn!.db;

  try {
    const existingTemplateRows = await db
      .select({ slug: templates.slug, coverUrl: templates.coverUrl })
      .from(templates);
    const existingCoverBySlug = new Map(
      existingTemplateRows.map((row) => [row.slug, row.coverUrl]),
    );

    const rawOrbit = readFileSync(ORBIT_TEMPLATE_JSON_PATH, "utf-8");
    const orbitPayload = JSON.parse(rawOrbit) as OrbitSeedJson & Record<string, unknown>;
    const orbitCoverUrl = resolveSeedCoverUrl(
      existingCoverBySlug.get(orbitPayload.template.slug),
      "/templates/orbit/cover.svg",
    );
    orbitPayload.template.cover = {
      src: orbitCoverUrl,
      ratio: orbitPayload.template.cover.ratio || "4:3",
    };

    const [admin] = await db
      .insert(users)
      .values({
        email: "admin@casefolio.app",
        emailVerified: true,
        name: "Casefolio Admin",
        role: "superadmin",
        plan: "pro",
        suspended: false,
        jobTitle: "Platform Administrator",
        designFocus: "both",
        onboardingCompletedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          role: "superadmin",
          plan: "pro",
          emailVerified: true,
          updatedAt: new Date(),
        },
      })
      .returning({ id: users.id });

    if (!admin) {
      throw new Error("Failed to seed admin user.");
    }

    const categorySlug = orbitPayload.template.category.toLowerCase().replace(/\s+/g, "-");
    const [category] = await db
      .insert(categories)
      .values({
        name: orbitPayload.template.category,
        slug: categorySlug,
        sort: 1,
      })
      .onConflictDoUpdate({
        target: categories.slug,
        set: {
          name: orbitPayload.template.category,
          sort: 1,
        },
      })
      .returning({ id: categories.id });

    if (!category) {
      throw new Error("Failed to seed Fintech category.");
    }

    const [tpl] = await db
      .insert(templates)
      .values({
        slug: orbitPayload.template.slug,
        name: orbitPayload.template.name,
        type: orbitPayload.template.type,
        categoryId: category.id,
        tier: orbitPayload.template.tier,
        status: "published",
        coverUrl: orbitPayload.template.cover.src,
      })
      .onConflictDoUpdate({
        target: templates.slug,
        set: {
          name: orbitPayload.template.name,
          type: orbitPayload.template.type,
          categoryId: category.id,
          tier: orbitPayload.template.tier,
          status: "published",
          coverUrl: orbitPayload.template.cover.src,
          updatedAt: new Date(),
        },
      })
      .returning({ id: templates.id });

    if (!tpl) {
      throw new Error("Failed to seed Orbit template.");
    }

    const [versionRow] = await db
      .insert(templateVersions)
      .values({
        templateId: tpl.id,
        version: orbitPayload.template.version,
        data: orbitPayload,
        changelog: "Initial Orbit mobile fintech template",
        publishedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [templateVersions.templateId, templateVersions.version],
        set: {
          data: orbitPayload,
          publishedAt: new Date(),
        },
      })
      .returning({ id: templateVersions.id });

    if (!versionRow) {
      throw new Error("Failed to seed Orbit template version.");
    }

    await db
      .update(templates)
      .set({ currentVersionId: versionRow.id, updatedAt: new Date() })
      .where(eq(templates.id, tpl.id));

    // Seed published Pro template ("Meridian") for Pro badge & entitlement gating
    const [saasCategory] = await db
      .insert(categories)
      .values({
        name: "SaaS",
        slug: "saas",
        sort: 2,
      })
      .onConflictDoUpdate({
        target: categories.slug,
        set: {
          name: "SaaS",
          sort: 2,
        },
      })
      .returning({ id: categories.id });

    if (saasCategory) {
      const meridianPayload = structuredClone(orbitPayload) as unknown as Record<
        string,
        unknown
      > & {
        template: Record<string, unknown>;
        puck: {
          root: { props: Record<string, unknown> };
          content: Array<{ type: string; props: Record<string, unknown> }>;
        };
      };
      const meridianCoverUrl = resolveSeedCoverUrl(
        existingCoverBySlug.get("meridian-pro"),
        "/templates/meridian-pro/cover.svg",
      );
      meridianPayload.template.id = "tpl_meridian_web_v1";
      meridianPayload.template.slug = "meridian-pro";
      meridianPayload.template.name = "Meridian";
      meridianPayload.template.type = "web";
      meridianPayload.template.version = "1.0.0";
      meridianPayload.template.status = "published";
      meridianPayload.template.category = "SaaS";
      meridianPayload.template.tier = "pro";
      meridianPayload.template.cover = {
        src: meridianCoverUrl,
        ratio: "4:3",
      };
      meridianPayload.template.slots = {
        "hero.mockup": { ratio: "16:10", minWidth: 1200, device: "browser" },
        "hero.logo": { ratio: "1:1", minWidth: 120 },
        "overview.banner": { ratio: "16:9", minWidth: 1200 },
        "process.step.image": { ratio: "4:3", minWidth: 600 },
        "gallery.screen": { ratio: "16:10", minWidth: 1200, device: "browser" },
      };
      meridianPayload.puck.root.props.title = "Meridian — B2B Revenue OS";
      const heroNode = meridianPayload.puck.content.find((item) => item.type === "Hero");
      if (heroNode) {
        heroNode.props.eyebrow = "Case Study · Web SaaS";
        heroNode.props.title = "Meridian — Revenue analytics without spreadsheets";
        heroNode.props.subtitle =
          "Designing a unified forecasting workspace for enterprise RevOps teams.";
      }

      const [proTpl] = await db
        .insert(templates)
        .values({
          slug: "meridian-pro",
          name: "Meridian",
          type: "web",
          categoryId: saasCategory.id,
          tier: "pro",
          status: "published",
          coverUrl: meridianCoverUrl,
        })
        .onConflictDoUpdate({
          target: templates.slug,
          set: {
            name: "Meridian",
            type: "web",
            categoryId: saasCategory.id,
            tier: "pro",
            status: "published",
            coverUrl: meridianCoverUrl,
            updatedAt: new Date(),
          },
        })
        .returning({ id: templates.id });

      if (proTpl) {
        const [proVersion] = await db
          .insert(templateVersions)
          .values({
            templateId: proTpl.id,
            version: "1.0.0",
            data: meridianPayload,
            changelog: "Initial Meridian Pro web SaaS template",
            publishedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [templateVersions.templateId, templateVersions.version],
            set: {
              data: meridianPayload,
              publishedAt: new Date(),
            },
          })
          .returning({ id: templateVersions.id });

        if (proVersion) {
          await db
            .update(templates)
            .set({ currentVersionId: proVersion.id, updatedAt: new Date() })
            .where(eq(templates.id, proTpl.id));
        }
      }
    }

    // Seed published Free template ("Cinema") from reference/template.cinema.json
    if (existsSync(CINEMA_TEMPLATE_JSON_PATH)) {
      const rawCinema = readFileSync(CINEMA_TEMPLATE_JSON_PATH, "utf-8");
      const cinemaPayload = JSON.parse(rawCinema) as OrbitSeedJson & Record<string, unknown>;
      const cinemaCategorySlug = cinemaPayload.template.category
        .toLowerCase()
        .replace(/\s+/g, "-");

      const [entertainmentCategory] = await db
        .insert(categories)
        .values({
          name: cinemaPayload.template.category,
          slug: cinemaCategorySlug,
          sort: 3,
        })
        .onConflictDoUpdate({
          target: categories.slug,
          set: {
            name: cinemaPayload.template.category,
            sort: 3,
          },
        })
        .returning({ id: categories.id });

      if (entertainmentCategory) {
        const cinemaCoverUrl = resolveSeedCoverUrl(
          existingCoverBySlug.get(cinemaPayload.template.slug),
          cinemaPayload.template.cover.src || "/templates/cinema/cover.svg",
        );
        cinemaPayload.template.cover = {
          src: cinemaCoverUrl,
          ratio: cinemaPayload.template.cover.ratio || "4:3",
        };
        const [cinemaTpl] = await db
          .insert(templates)
          .values({
            slug: cinemaPayload.template.slug,
            name: cinemaPayload.template.name,
            type: cinemaPayload.template.type,
            categoryId: entertainmentCategory.id,
            tier: cinemaPayload.template.tier,
            status: "published",
            coverUrl: cinemaCoverUrl,
          })
          .onConflictDoUpdate({
            target: templates.slug,
            set: {
              name: cinemaPayload.template.name,
              type: cinemaPayload.template.type,
              categoryId: entertainmentCategory.id,
              tier: cinemaPayload.template.tier,
              status: "published",
              coverUrl: cinemaCoverUrl,
              updatedAt: new Date(),
            },
          })
          .returning({ id: templates.id });

        if (cinemaTpl) {
          const [cinemaVersion] = await db
            .insert(templateVersions)
            .values({
              templateId: cinemaTpl.id,
              version: cinemaPayload.template.version,
              data: cinemaPayload,
              changelog: "Initial .Cinema entertainment case study template",
              publishedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [templateVersions.templateId, templateVersions.version],
              set: {
                data: cinemaPayload,
                publishedAt: new Date(),
              },
            })
            .returning({ id: templateVersions.id });

          if (cinemaVersion) {
            await db
              .update(templates)
              .set({ currentVersionId: cinemaVersion.id, updatedAt: new Date() })
              .where(eq(templates.id, cinemaTpl.id));
          }
        }
      }
    }

    // Seed Figma Case Study Set v1 templates ("Northwind", "Pulse", "Atlas")
    const figmaSetTemplates: Array<{
      jsonPath: string;
      defaultCover: string;
      categorySort: number;
      changelog: string;
    }> = [
      {
        jsonPath: NORTHWIND_TEMPLATE_JSON_PATH,
        defaultCover: "/templates/northwind/cover.svg",
        categorySort: 2,
        changelog: "Northwind B2B SaaS dispatch console template (Figma node 119:6861)",
      },
      {
        jsonPath: PULSE_TEMPLATE_JSON_PATH,
        defaultCover: "/templates/pulse/cover.svg",
        categorySort: 5,
        changelog: "Pulse habit-first mobile fitness coach template (Figma node 120:6651)",
      },
      {
        jsonPath: ATLAS_TEMPLATE_JSON_PATH,
        defaultCover: "/templates/atlas/cover.svg",
        categorySort: 4,
        changelog: "Atlas cross-platform travel planner template (Figma node 121:6651)",
      },
    ];

    for (const entry of figmaSetTemplates) {
      if (!existsSync(entry.jsonPath)) continue;

      const rawJson = readFileSync(entry.jsonPath, "utf-8");
      const payload = JSON.parse(rawJson) as OrbitSeedJson & Record<string, unknown>;
      const catSlug = payload.template.category
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      const [catRow] = await db
        .insert(categories)
        .values({
          name: payload.template.category,
          slug: catSlug,
          sort: entry.categorySort,
        })
        .onConflictDoUpdate({
          target: categories.slug,
          set: {
            name: payload.template.category,
            sort: entry.categorySort,
          },
        })
        .returning({ id: categories.id });

      if (!catRow) continue;

      const resolvedCoverUrl = resolveSeedCoverUrl(
        existingCoverBySlug.get(payload.template.slug),
        payload.template.cover.src || entry.defaultCover,
      );
      payload.template.cover = {
        src: resolvedCoverUrl,
        ratio: payload.template.cover.ratio || "4:3",
      };

      const [tplRow] = await db
        .insert(templates)
        .values({
          slug: payload.template.slug,
          name: payload.template.name,
          type: payload.template.type,
          categoryId: catRow.id,
          tier: payload.template.tier,
          status: "published",
          coverUrl: resolvedCoverUrl,
        })
        .onConflictDoUpdate({
          target: templates.slug,
          set: {
            name: payload.template.name,
            type: payload.template.type,
            categoryId: catRow.id,
            tier: payload.template.tier,
            status: "published",
            coverUrl: resolvedCoverUrl,
            updatedAt: new Date(),
          },
        })
        .returning({ id: templates.id });

      if (!tplRow) continue;

      const [verRow] = await db
        .insert(templateVersions)
        .values({
          templateId: tplRow.id,
          version: payload.template.version,
          data: payload,
          changelog: entry.changelog,
          publishedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [templateVersions.templateId, templateVersions.version],
          set: {
            data: payload,
            changelog: entry.changelog,
            publishedAt: new Date(),
          },
        })
        .returning({ id: templateVersions.id });

      if (verRow) {
        await db
          .update(templates)
          .set({ currentVersionId: verRow.id, updatedAt: new Date() })
          .where(eq(templates.id, tplRow.id));
      }
    }

    await backfillBusinessTenancy(db);

    return {
      adminUserId: admin.id,
      categoryId: category.id,
      templateId: tpl.id,
      templateVersionId: versionRow.id,
    };
  } finally {
    if (ownsConnection && conn) {
      await conn.pool.end();
    }
  }
}

const isEntrypoint =
  process.argv[1] !== undefined && process.argv[1].endsWith("seed.ts");

if (isEntrypoint) {
  seedDatabase()
    .then((result) => {
      console.log("Database seed completed:", result);
    })
    .catch((err: unknown) => {
      console.error("Database seed failed:", err);
      process.exit(1);
    });
}
