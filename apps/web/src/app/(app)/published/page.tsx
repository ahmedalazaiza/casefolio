import { and, desc, eq, isNotNull } from "@casefolio/db";
import { BarChart3, ExternalLink, Globe, Settings2 } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { requireSession } from "@/lib/auth/session";
import { db, dbSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function WorkspacePublishedPagesList() {
  const { user } = await requireSession("/published");

  const rows = await db
    .select()
    .from(dbSchema.projects)
    .where(
      and(
        eq(dbSchema.projects.ownerId, user.id),
        isNotNull(dbSchema.projects.publishedAt),
      ),
    )
    .orderBy(desc(dbSchema.projects.publishedAt))
    .limit(50);

  const liveProjects = rows.filter(
    (p) => (p.visibility === "public" || p.visibility === "unlisted") && Boolean(p.slug),
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-2 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Eyebrow className="w-fit">Live Portfolio</Eyebrow>
          <h1 className="text-foreground type-display-m">Published Case Studies</h1>
          <p className="text-muted-foreground type-body-m">
            Manage live share links and discovery settings across your portfolio.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/dashboard">All Projects</Link>
        </Button>
      </div>

      {liveProjects.length === 0 ? (
        <div className="border-border/80 bg-elevated shadow-card flex flex-col items-center justify-center gap-4 rounded-3xl border px-6 py-20 text-center">
          <span className="bg-accent text-primary inline-flex size-14 items-center justify-center rounded-2xl">
            <Globe className="size-6" />
          </span>
          <div className="flex flex-col gap-1.5">
            <p className="text-foreground type-heading-m">No published case studies yet</p>
            <p className="text-muted-foreground type-body-s max-w-md">
              Open any project and click Publish to claim a custom /p/slug URL with OpenGraph social
              previews.
            </p>
          </div>
          <Button asChild size="sm" className="mt-1">
            <Link href="/dashboard">Go to Projects</Link>
          </Button>
        </div>
      ) : (
        <div className="border-border/80 bg-elevated shadow-card divide-border/70 divide-y rounded-3xl border p-6 sm:p-8">
          {liveProjects.map((project) => (
            <div
              key={project.id}
              className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
            >
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-foreground type-heading-s">{project.name}</span>
                  <Badge tone="published">
                    {project.visibility === "unlisted" ? "Unlisted" : "Public"}
                  </Badge>
                </div>
                <span className="text-tertiary type-caption font-mono">/p/{project.slug}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/projects/${project.id}/analytics`}>
                    <BarChart3 className="size-3.5" />
                    <span>Analytics</span>
                  </Link>
                </Button>
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/projects/${project.id}/share`}>
                    <Settings2 className="size-3.5" />
                    <span>Share Settings</span>
                  </Link>
                </Button>
                <Button asChild size="sm">
                  <Link href={`/p/${project.slug}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-3.5" />
                    <span>Open Live</span>
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

