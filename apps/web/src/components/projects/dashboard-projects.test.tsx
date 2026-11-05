import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardProjectsClient } from "./dashboard-projects-client";
import type { DashboardProjectItem } from "@/lib/projects/dashboard-types";

const refreshMock = vi.fn();
const renameActionMock = vi.fn();
const duplicateActionMock = vi.fn();
const deleteActionMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: refreshMock,
  }),
}));

vi.mock("@/lib/projects/actions", () => ({
  renameProjectAction: (...args: unknown[]) => renameActionMock(...args),
  duplicateProjectAction: (...args: unknown[]) => duplicateActionMock(...args),
  deleteProjectAction: (...args: unknown[]) => deleteActionMock(...args),
}));

const SAMPLE_PROJECTS: DashboardProjectItem[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Mosaed — Debt app",
    type: "mobile",
    visibility: "public",
    slug: "mosaed-debt-app",
    publishedAtIso: "2026-04-14T10:00:00.000Z",
    createdAtIso: "2026-04-10T10:00:00.000Z",
    updatedAtIso: "2026-04-15T10:00:00.000Z",
    templateName: "Orbit",
    templateTier: "free",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Ghaith donation platform",
    type: "web",
    visibility: "private",
    slug: null,
    publishedAtIso: null,
    createdAtIso: "2026-04-09T10:00:00.000Z",
    updatedAtIso: "2026-04-12T10:00:00.000Z",
    templateName: "Frame",
    templateTier: "free",
  },
];

describe("DashboardProjectsClient (C-1004 · Figma 2:2003 / 2:2172 / 2:2980)", () => {
  beforeEach(() => {
    refreshMock.mockReset();
    renameActionMock.mockReset();
    duplicateActionMock.mockReset();
    deleteActionMock.mockReset();
  });

  it("renders the exact Figma 2:2172 empty state when the workspace has zero projects", () => {
    render(<DashboardProjectsClient initialProjects={[]} />);

    expect(screen.getByTestId("dashboard-empty-state")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Your first case study starts here",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Create your first project/i })).toHaveAttribute(
      "href",
      "/new",
    );
    expect(screen.getByRole("link", { name: "Browse templates" })).toHaveAttribute(
      "href",
      "/templates",
    );
    expect(screen.getByText("Pick a template")).toBeInTheDocument();
    expect(screen.getByText("Fill the slots")).toBeInTheDocument();
    expect(screen.getByText("Publish or export")).toBeInTheDocument();
  });

  it("renders status badges, filters/searches projects, and handles duplicate + rename + delete", async () => {
    const user = userEvent.setup();

    duplicateActionMock.mockResolvedValueOnce({
      ok: true,
      project: {
        ...SAMPLE_PROJECTS[0]!,
        id: "33333333-3333-4333-8333-333333333333",
        name: "Mosaed — Debt app (Copy)",
        visibility: "private",
        slug: null,
        publishedAtIso: null,
      },
    });
    renameActionMock.mockResolvedValueOnce({
      ok: true,
      projectId: SAMPLE_PROJECTS[1]!.id,
      name: "Ghaith Giving v2",
      updatedAtIso: "2026-04-16T10:00:00.000Z",
    });
    deleteActionMock.mockResolvedValueOnce({
      ok: true,
      deletedProjectId: "33333333-3333-4333-8333-333333333333",
    });

    render(<DashboardProjectsClient initialProjects={SAMPLE_PROJECTS} />);

    // Status badges rendered accurately
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();

    // Search -> No results state (Figma 2:3694) -> Clear filters
    const searchInput = screen.getByRole("searchbox", {
      name: "Search projects",
    });
    await user.type(searchInput, "portfolio 2019");
    expect(screen.getByText(/No projects match “portfolio 2019”/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    // Duplicate from card menu
    await user.click(screen.getByRole("button", { name: "Actions for Mosaed — Debt app" }));
    await user.click(await screen.findByText("Duplicate"));
    expect(await screen.findByText("Mosaed — Debt app (Copy)")).toBeInTheDocument();

    // Rename from card menu
    await user.click(
      screen.getByRole("button", {
        name: "Actions for Ghaith donation platform",
      }),
    );
    await user.click(await screen.findByText("Rename"));
    const renameInput = await screen.findByLabelText("Project name");
    await user.clear(renameInput);
    await user.type(renameInput, "Ghaith Giving v2");
    await user.click(screen.getByRole("button", { name: "Save name" }));
    expect(await screen.findByText("Ghaith Giving v2")).toBeInTheDocument();

    // Delete with confirmation name guard
    await user.click(
      screen.getByRole("button", {
        name: "Actions for Mosaed — Debt app (Copy)",
      }),
    );
    await user.click(await screen.findByText("Delete"));
    const confirmBtn = await screen.findByRole("button", {
      name: "Delete project",
    });
    expect(confirmBtn).toBeDisabled();

    await user.type(
      screen.getByLabelText("Type the project name to confirm"),
      "Mosaed — Debt app (Copy)",
    );
    expect(confirmBtn).toBeEnabled();
    await user.click(confirmBtn);

    expect(screen.queryByText("Mosaed — Debt app (Copy)")).not.toBeInTheDocument();
  });
});
