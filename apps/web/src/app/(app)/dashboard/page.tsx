import type { Metadata } from "next";
import { DashboardProjectsClient } from "@/components/projects/dashboard-projects-client";
import { requireSession } from "@/lib/auth/session";
import { listDashboardProjectsForUser } from "@/lib/projects/dashboard";
import { getActiveSpaceCookie, resolveActiveSpaceFilter } from "@/lib/workspaces/active-space";
import { listWorkspaceSwitcherState } from "@/lib/workspaces/service";

export const metadata: Metadata = {
  title: "Projects — Casefolio",
};

export default async function DashboardPage() {
  const [{ user, session }, activeSpaceCookie] = await Promise.all([
    requireSession("/dashboard"),
    getActiveSpaceCookie(),
  ]);
  const activeOrgId = session.activeOrganizationId ?? null;

  const [userProjects, workspaceContext] = await Promise.all([
    listDashboardProjectsForUser(user.id, activeOrgId, { includeArchived: true }),
    listWorkspaceSwitcherState(user.id, activeOrgId),
  ]);
  const initialSpaceId = resolveActiveSpaceFilter(workspaceContext.spaces, activeSpaceCookie);

  return (
    <DashboardProjectsClient
      initialProjects={userProjects}
      workspaceContext={workspaceContext}
      initialSpaceId={initialSpaceId}
    />
  );
}
