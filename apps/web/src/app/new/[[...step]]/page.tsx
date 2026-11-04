import { count, eq } from "@casefolio/db";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  CreateProjectWizard,
  type WizardStepKey,
} from "@/app/new/create-project-wizard";
import { requireSession } from "@/lib/auth/session";
import { db, dbSchema } from "@/lib/db";
import { createProjectAction } from "@/lib/projects/actions";
import { listPublishedLibraryTemplates } from "@/lib/template/service";

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
  searchParams: Promise<{ template?: string }>;
}) {
  const [{ step }, { template }] = await Promise.all([params, searchParams]);
  const initialStep = resolveInitialStep(step);

  const callbackPath = template ? `/new?template=${encodeURIComponent(template)}` : "/new";
  const { user } = await requireSession(callbackPath);

  if (user.role === "user" && !user.onboardingCompletedAt) {
    redirect("/onboarding");
  }

  const [templates, projectTotalRows] = await Promise.all([
    listPublishedLibraryTemplates(),
    db
      .select({ total: count() })
      .from(dbSchema.projects)
      .where(eq(dbSchema.projects.ownerId, user.id)),
  ]);

  const existingProjectCount = projectTotalRows[0]?.total ?? 0;

  return (
    <CreateProjectWizard
      templates={templates}
      userPlan={user.plan}
      existingProjectCount={existingProjectCount}
      initialStep={initialStep}
      initialTemplateSlug={template}
      initialDesignFocus={user.designFocus}
      onCreateProject={createProjectAction}
    />
  );
}
