import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { createDbConnection, type Database } from "./client";
import {
  categories,
  templates,
  templateVersions,
  users,
  type ProjectType,
  type TemplateTier,
} from "./schema";

const currentDir = dirname(fileURLToPath(import.meta.url));
const ORBIT_TEMPLATE_JSON_PATH = resolve(
  currentDir,
  "../../../reference/template.example.json",
);

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

export async function seedDatabase(dbInstance?: Database): Promise<SeedResult> {
  const ownsConnection = !dbInstance;
  const conn = dbInstance ? null : createDbConnection();
  const db = dbInstance ?? conn!.db;

  try {
    const rawOrbit = readFileSync(ORBIT_TEMPLATE_JSON_PATH, "utf-8");
    const orbitPayload = JSON.parse(rawOrbit) as OrbitSeedJson & Record<string, unknown>;

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
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

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
