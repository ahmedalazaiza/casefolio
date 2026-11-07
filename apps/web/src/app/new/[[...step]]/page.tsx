import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  CreateProjectWizard,
  type WizardStepKey,
} from "@/app/new/create-project-wizard";
import { requireSession } from "@/lib/auth/session";
import { createProjectAction } from "@/lib/projects/actions";
import { listPublishedLibraryTemplates } from "@/lib/template/service";
import { listWorkspaceSwitcherState } from "@/lib/workspaces/service";

export const metadata: Metadata = {
  title: "New Case Study — Casefolio",
  description: "Choose a project type, pick a Casefolio template, and name your case study.",
};

function resolveInitialStep(segments?: string[]): WizardStepKey {
  if (!segments || segments.length === 0) {
    return "type";
  }
  if (segments.length === 1) {
    const first = segments[0];
    if (first === "type" || first === "template" || first === "details") {
      return first;
    }
  }
  notFound();
}

export default async function NewProjectWizardPage({
  params,
  searchParams,
}: {
  params: Promise<{ step?: string[] }>;
  searchParams: Promise<{ template?: string; spaceId?: string }>;
}) {
  const [{ step }, { template, spaceId }] = await Promise.all([params, searchParams]);
  const initialStep = resolveInitialStep(step);

  const callbackPath = template ? `/new?template=${encodeURIComponent(template)}` : "/new";
  const { user, session } = await requireSession(callbackPath);

  if (user.role === "user" && !user.onboardingCompletedAt) {
    redirect("/onboarding");
  }

  const [templates, workspaceContext] = await Promise.all([
    listPublishedLibraryTemplates(),
    listWorkspaceSwitcherState(user.id, session.activeOrganizationId ?? null),
  ]);

  return (
    <CreateProjectWizard
      templates={templates}
      userPlan={workspaceContext.activeWorkspace.plan}
      existingProjectCount={workspaceContext.activeWorkspace.usage.activeProjects}
      activeProjectsLimit={workspaceContext.activeWorkspace.quotas.activeProjectsLimit}
      spaces={workspaceContext.spaces}
      workspaceName={workspaceContext.activeWorkspace.name}
      workspaceKind={workspaceContext.activeWorkspace.kind}
      initialSpaceId={spaceId}
      initialStep={initialStep}
      initialTemplateSlug={template}
      initialDesignFocus={user.designFocus}
      onCreateProject={createProjectAction}
    />
  );
}
