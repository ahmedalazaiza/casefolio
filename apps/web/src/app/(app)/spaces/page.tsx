import type { Metadata } from "next";
import { SpacesManagementClient } from "@/components/spaces/spaces-management-client";
import { requireSession } from "@/lib/auth/session";
import { getActiveSpaceCookie, resolveActiveSpaceFilter } from "@/lib/workspaces/active-space";
import {
  listSpacesWithCountsForWorkspace,
  listWorkspaceSwitcherState,
} from "@/lib/workspaces/service";

export const metadata: Metadata = {
  title: "Spaces — Casefolio",
  description: "Create, organize, and switch between spaces in your Casefolio workspace.",
};

export default async function SpacesPage() {
  const [{ user, session }, activeSpaceCookie] = await Promise.all([
    requireSession("/spaces"),
    getActiveSpaceCookie(),
  ]);

  const switcher = await listWorkspaceSwitcherState(
    user.id,
    session.activeOrganizationId ?? null,
  );
  const spaces = await listSpacesWithCountsForWorkspace(
    switcher.activeWorkspace.workspaceId,
    user.id,
  );
  const initialActiveSpaceId = resolveActiveSpaceFilter(spaces, activeSpaceCookie);

  return (
    <SpacesManagementClient
      workspace={switcher.activeWorkspace}
      initialSpaces={spaces}
      initialActiveSpaceId={initialActiveSpaceId}
    />
  );
}
