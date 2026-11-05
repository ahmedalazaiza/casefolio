import type { Metadata } from "next";
import { forbidden, notFound } from "next/navigation";
import { ProjectAnalyticsPanel } from "@/components/analytics/project-analytics-panel";
import { getProjectAnalyticsForActor } from "@/lib/analytics/page-views";
import { requireSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Case Study Analytics — Casefolio",
};

interface ProjectAnalyticsPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string }>;
}

export default async function ProjectAnalyticsPage({
  params,
  searchParams,
}: ProjectAnalyticsPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const { user } = await requireSession(`/projects/${id}/analytics`);

  const access = await getProjectAnalyticsForActor({
    projectId: id,
    actor: {
      id: user.id,
      role: user.role,
    },
    requestedRange: query.range ?? "30d",
  });

  if (access.status === "not_found") {
    notFound();
  }

  if (access.status === "forbidden") {
    forbidden();
  }

  return <ProjectAnalyticsPanel analytics={access.analytics} />;
}
