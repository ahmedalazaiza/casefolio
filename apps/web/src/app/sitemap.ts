import { and, desc, eq, isNotNull, isNull, sql } from "@casefolio/db";
import type { MetadataRoute } from "next";
import { db, dbSchema } from "@/lib/db";
import { listHelpArticles } from "@/lib/help/articles";
import { resolvePublicAppBaseUrl } from "@/lib/projects/publish";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = resolvePublicAppBaseUrl();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${baseUrl}/templates`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/pricing`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/team`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/help`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/help/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];

  const helpRoutes: MetadataRoute.Sitemap = listHelpArticles().map((topic) => ({
    url: `${baseUrl}/help/${encodeURIComponent(topic.slug)}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  let publicCaseStudies: MetadataRoute.Sitemap = [];
  try {
    const rows = await db
      .select({
        slug: dbSchema.projects.slug,
        publishedAt: dbSchema.publishedSnapshots.publishedAt,
        projectUpdatedAt: dbSchema.projects.updatedAt,
      })
      .from(dbSchema.publishedSnapshots)
      .innerJoin(
        dbSchema.projects,
        eq(dbSchema.publishedSnapshots.projectId, dbSchema.projects.id),
      )
      .innerJoin(dbSchema.users, eq(dbSchema.projects.ownerId, dbSchema.users.id))
      .where(
        and(
          eq(dbSchema.projects.visibility, "public"),
          isNotNull(dbSchema.projects.slug),
          isNull(dbSchema.projects.archivedAt),
          isNull(dbSchema.publishedSnapshots.suspendedReason),
          eq(dbSchema.users.suspended, false),
          isNull(dbSchema.users.deletionScheduledFor),
          sql`not exists (
            select 1 from reports r
            where r.project_id = ${dbSchema.projects.id}
              and r.status = 'takedown'
          )`,
        ),
      )
      .orderBy(desc(dbSchema.publishedSnapshots.publishedAt))
      .limit(5000);

    publicCaseStudies = rows
      .filter(
        (row): row is typeof row & { slug: string } =>
          typeof row.slug === "string" && row.slug.length > 0,
      )
      .map((row) => ({
        url: `${baseUrl}/p/${encodeURIComponent(row.slug)}`,
        lastModified: row.projectUpdatedAt ?? row.publishedAt,
        changeFrequency: "weekly",
        priority: 0.8,
      }));
  } catch {
    // Allow static sitemap entries to render cleanly even if DB is temporarily unreachable
  }

  return [...staticRoutes, ...helpRoutes, ...publicCaseStudies];
}
