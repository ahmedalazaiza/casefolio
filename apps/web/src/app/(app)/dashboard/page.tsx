import type { Metadata } from "next";
import { DashboardProjectsClient } from "@/components/projects/dashboard-projects-client";
import { requireSession } from "@/lib/auth/session";
import { listDashboardProjectsForUser } from "@/lib/projects/dashboard";
import { listWorkspaceSwitcherState } from "@/lib/workspaces/service";

export const metadata: Metadata = {
  title: "Projects — Casefolio",
};

export default async function DashboardPage() {
  const { user, session } = await requireSession("/dashboard");
  const activeOrgId = session.activeOrganizationId ?? null;

  const [userProjects, workspaceContext] = await Promise.all([
    listDashboardProjectsForUser(user.id, activeOrgId, { includeArchived: true }),
    listWorkspaceSwitcherState(user.id, activeOrgId),
  ]);

  return (
    <DashboardProjectsClient
      initialProjects={userProjects}
      workspaceContext={workspaceContext}
    />
  );
}
