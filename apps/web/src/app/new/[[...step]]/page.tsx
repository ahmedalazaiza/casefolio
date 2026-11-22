import { eq } from "@casefolio/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { WizardStepKey } from "@/app/new/create-project-wizard";
import { WizardClient } from "@/app/new/wizard-client";
import { requireSession } from "@/lib/auth/session";
import { db, dbSchema } from "@/lib/db";
import { createProjectAction } from "@/lib/projects/actions";
import { getCachedPublishedTemplates } from "@/lib/template/cached-catalog";
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
    const now = new Date();
    await db
      .update(dbSchema.users)
      .set({ onboardingCompletedAt: now, updatedAt: now })
      .where(eq(dbSchema.users.id, user.id));
  }

  const [templates, workspaceContext] = await Promise.all([
    getCachedPublishedTemplates(),
    listWorkspaceSwitcherState(user.id, session.activeOrganizationId ?? null),
  ]);

  const lifetimeProjectsCreated = Math.max(
    workspaceContext.activeWorkspace.usage.lifetimeProjectsCreated,
    workspaceContext.activeWorkspace.usage.activeProjects,
  );

  return (
    <WizardClient
      templates={templates}
      userPlan={workspaceContext.activeWorkspace.plan}
      existingProjectCount={workspaceContext.activeWorkspace.usage.activeProjects}
      lifetimeProjectsCreated={lifetimeProjectsCreated}
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
