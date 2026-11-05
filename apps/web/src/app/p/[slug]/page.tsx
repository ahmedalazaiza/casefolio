import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { TemplatePuckRenderer } from "@/components/editor/puck-config";
import { ReportCaseStudyButton } from "@/components/public/report-case-study-button";
import { CasefolioWatermark } from "@/components/sections/casefolio-watermark";
import { recordPublishedProjectView } from "@/lib/analytics/page-views";
import { can } from "@/lib/entitlements";
import {
  buildPublicCaseStudyUrl,
  getPublishedProjectBySlug,
  resolvePublicAppBaseUrl,
} from "@/lib/projects/publish";

export const dynamic = "force-dynamic";

interface PublicCaseStudyPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PublicCaseStudyPageProps): Promise<Metadata> {
  const { slug } = await params;
  const published = await getPublishedProjectBySlug(slug);

  if (!published) {
    return {
      title: "Case Study Not Found · Casefolio",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const baseUrl = resolvePublicAppBaseUrl();
  const publicUrl = buildPublicCaseStudyUrl(published.project.slug, baseUrl);
  const ogImageUrl = `${baseUrl}/p/${encodeURIComponent(published.project.slug)}/opengraph-image`;
  const pageTitle = `${published.meta.title} · Casefolio`;

  return {
    title: pageTitle,
    description: published.meta.description,
    alternates: {
      canonical: publicUrl,
    },
    robots:
      published.project.visibility === "unlisted"
        ? {
            index: false,
            follow: false,
            nocache: true,
          }
        : {
            index: true,
            follow: true,
          },
    openGraph: {
      title: published.meta.title,
      description: published.meta.description,
      url: publicUrl,
      siteName: "Casefolio",
      type: "article",
      publishedTime: published.project.publishedAtIso,
      modifiedTime: published.project.updatedAtIso,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: published.meta.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: published.meta.title,
      description: published.meta.description,
      images: [ogImageUrl],
    },
  };
}

export default async function PublicCaseStudyPage({ params }: PublicCaseStudyPageProps) {
  const { slug } = await params;
  const published = await getPublishedProjectBySlug(slug);

  if (!published) {
    notFound();
  }

  const requestHeaders = await headers();
  await recordPublishedProjectView({
    projectId: published.project.id,
    headers: requestHeaders,
  }).catch(() => undefined);

  return (
    <main
      data-testid="public-case-study-page"
      data-project-slug={published.project.slug}
      data-visibility={published.project.visibility}
      className="bg-background text-foreground min-h-screen w-full"
    >
      <TemplatePuckRenderer
        puckData={published.puckData}
        theme={published.theme}
        slots={published.slots}
        projectType={published.project.type}
        className="rounded-none"
      />
      <CasefolioWatermark visible={!can(published.owner.plan, "remove_watermark")} />
      <ReportCaseStudyButton
        projectId={published.project.id}
        projectName={published.project.name}
      />
    </main>
  );
}

