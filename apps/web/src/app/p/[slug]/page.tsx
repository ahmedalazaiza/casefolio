import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { cache } from "react";
import { TemplatePuckRenderer } from "@/components/editor/puck-config";
import { ReportCaseStudyButton } from "@/components/public/report-case-study-button";
import { CasefolioWatermark } from "@/components/sections/casefolio-watermark";
import { recordPublishedProjectView } from "@/lib/analytics/page-views";
import {
  buildPublicCaseStudyUrl,
  getPublishedProjectBySlug,
  resolvePublicAppBaseUrl,
} from "@/lib/projects/publish";

export const dynamic = "force-dynamic";

const getCachedPublishedProjectBySlug = cache((slug: string) =>
  getPublishedProjectBySlug(slug),
);

interface PublicCaseStudyPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PublicCaseStudyPageProps): Promise<Metadata> {
  const { slug } = await params;
  const published = await getCachedPublishedProjectBySlug(slug);

  if (!published) {
    return {
      title: "Case Study Not Found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const whiteLabel = published.project.whiteLabelEnabled;
  const baseUrl =
    whiteLabel && published.project.customDomain
      ? `https://${published.project.customDomain}`
      : resolvePublicAppBaseUrl();
  const publicUrl = buildPublicCaseStudyUrl(published.project.slug, baseUrl);
  const ogImageUrl = `${resolvePublicAppBaseUrl()}/p/${encodeURIComponent(published.project.slug)}/opengraph-image`;
  const pageTitle = whiteLabel
    ? published.meta.title
    : `${published.meta.title} · Casefolio`;

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
      ...(whiteLabel ? {} : { siteName: "Casefolio" }),
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
  const published = await getCachedPublishedProjectBySlug(slug);

  if (!published) {
    notFound();
  }

  const requestHeaders = await headers();
  const trackPromise = recordPublishedProjectView({
    projectId: published.project.id,
    headers: requestHeaders,
  }).catch(() => undefined);

  try {
    after(() => trackPromise);
  } catch {
    await trackPromise;
  }

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
      <CasefolioWatermark visible={!published.project.brandingRemoved} />
      <ReportCaseStudyButton
        projectId={published.project.id}
        projectName={published.project.name}
      />
    </main>
  );
}

