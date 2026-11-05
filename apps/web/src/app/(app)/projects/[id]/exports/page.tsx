import { forbidden, notFound } from "next/navigation";
import { ProjectExportsPanel } from "@/components/projects/project-exports-panel";
import { requireSession } from "@/lib/auth/session";
import { getProjectExportsOverviewForUser } from "@/lib/exports/service";

export const dynamic = "force-dynamic";

interface ProjectExportsPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectExportsPage({ params }: ProjectExportsPageProps) {
  const { id } = await params;
  const { user } = await requireSession(`/projects/${id}/exports`);

  const access = await getProjectExportsOverviewForUser(id, {
    id: user.id,
    role: user.role,
    plan: user.plan,
  });

  if (access.status === "not_found") {
    notFound();
  }

  if (access.status === "forbidden") {
    forbidden();
  }

  return <ProjectExportsPanel initialOverview={access.overview} />;
}
