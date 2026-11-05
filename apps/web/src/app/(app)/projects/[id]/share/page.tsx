import { forbidden, notFound } from "next/navigation";
import { ProjectSharePanel } from "@/components/projects/project-share-panel";
import { requireSession } from "@/lib/auth/session";
import {
  checkProjectSlugAction,
  publishProjectAction,
  unpublishProjectAction,
} from "@/lib/projects/actions";
import { getProjectShareSettingsForUser } from "@/lib/projects/publish";

export const dynamic = "force-dynamic";

interface ProjectSharePageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectSharePage({ params }: ProjectSharePageProps) {
  const { id } = await params;
  const { user } = await requireSession(`/projects/${id}/share`);

  const access = await getProjectShareSettingsForUser(id, {
    id: user.id,
    role: user.role,
  });

  if (access.status === "not_found") {
    notFound();
  }

  if (access.status === "forbidden") {
    forbidden();
  }

  return (
    <ProjectSharePanel
      initialSettings={access.settings}
      onPublish={publishProjectAction}
      onUnpublish={unpublishProjectAction}
      onCheckSlug={checkProjectSlugAction}
    />
  );
}
