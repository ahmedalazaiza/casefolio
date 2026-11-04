import type { Metadata } from "next";
import { forbidden, notFound, redirect } from "next/navigation";
import { ConstrainedEditor } from "@/components/editor/constrained-editor";
import { requireSession } from "@/lib/auth/session";
import { saveProjectEditorAction } from "@/lib/projects/actions";
import { getProjectEditorAccess } from "@/lib/projects/service";

export const metadata: Metadata = {
  title: "Editor — Casefolio",
};

export default async function ProjectEditorPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { user } = await requireSession(`/editor/${projectId}`);

  if (user.role === "user" && !user.onboardingCompletedAt) {
    redirect("/onboarding");
  }

  const access = await getProjectEditorAccess(projectId, {
    id: user.id,
    role: user.role,
  });

  if (access.status === "not_found") {
    notFound();
  }
  if (access.status === "forbidden") {
    forbidden();
  }

  return <ConstrainedEditor initialPayload={access.payload} onSaveProject={saveProjectEditorAction} />;
}
