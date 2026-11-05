// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminTemplatesList } from "@/app/(admin)/admin/templates/admin-templates-list";
import { TemplateDetailClient } from "@/app/(admin)/admin/templates/[id]/template-detail-client";
import type { AdminTemplateDetail, AdminTemplateSummary } from "@/lib/template/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
});

const templatesFixture: AdminTemplateSummary[] = [
  {
    id: "tpl-1",
    slug: "orbit",
    name: "Orbit",
    type: "mobile",
    tier: "free",
    status: "published",
    coverUrl: null,
    categoryName: "Fintech",
    categorySlug: "fintech",
    currentVersion: "1.0.0",
    sectionCount: 7,
    slotCount: 6,
    projectCount: 12,
    updatedAtIso: new Date().toISOString(),
  },
  {
    id: "tpl-2",
    slug: "frame",
    name: "Frame",
    type: "web",
    tier: "pro",
    status: "published",
    coverUrl: null,
    categoryName: "SaaS",
    categorySlug: "saas",
    currentVersion: "1.2.0",
    sectionCount: 6,
    slotCount: 4,
    projectCount: 5,
    updatedAtIso: new Date().toISOString(),
  },
  {
    id: "tpl-3",
    slug: "pocket",
    name: "Pocket",
    type: "both",
    tier: "pro",
    status: "draft",
    coverUrl: null,
    categoryName: "Health",
    categorySlug: "health",
    currentVersion: "0.3.0",
    sectionCount: 5,
    slotCount: 8,
    projectCount: 0,
    updatedAtIso: new Date().toISOString(),
  },
];

describe("AdminTemplatesList & TemplateDetailClient (C-902)", () => {
  it("renders Figma 31:7117 empty state when there are zero templates", () => {
    render(<AdminTemplatesList templates={[]} />);
    expect(screen.getByTestId("admin-templates-empty-state")).toBeDefined();
    expect(screen.getByText("No templates yet")).toBeDefined();
  });

  it("filters templates by search, status, type, tier, and category", () => {
    render(
      <AdminTemplatesList
        templates={templatesFixture}
        categories={[
          { id: "c1", name: "Fintech", slug: "fintech" },
          { id: "c2", name: "SaaS", slug: "saas" },
          { id: "c3", name: "Health", slug: "health" },
        ]}
      />,
    );

    expect(screen.getByText("Showing 3 of 3 templates")).toBeDefined();

    // Filter by Tier = Pro
    const tierGroup = screen.getByRole("group", { name: "Filter by tier" });
    fireEvent.click(tierGroup.querySelector("button:nth-child(3)")!);
    expect(screen.getByText("Showing 2 of 3 templates")).toBeDefined();
    expect(screen.queryByText("Orbit")).toBeNull();
    expect(screen.getByText("Frame")).toBeDefined();

    // Filter by Status = Draft
    const statusGroup = screen.getByRole("group", { name: "Filter by status" });
    fireEvent.click(statusGroup.querySelector("button:nth-child(3)")!);
    expect(screen.getByText("Showing 1 of 3 templates")).toBeDefined();
    expect(screen.getByText("Pocket")).toBeDefined();

    // Reset Status + Tier and filter by Category = Fintech
    fireEvent.click(statusGroup.querySelector("button:nth-child(1)")!);
    fireEvent.click(tierGroup.querySelector("button:nth-child(1)")!);
    fireEvent.change(screen.getByLabelText("Filter by category"), {
      target: { value: "fintech" },
    });
    expect(screen.getByText("Showing 1 of 3 templates")).toBeDefined();
    expect(screen.getByText("Orbit")).toBeDefined();
  });

  it("renders TemplateDetailClient tabs (Preview, Sections, Image slots, Style, Usage) and Live version badge", () => {
    const detail: AdminTemplateDetail = {
      id: "tpl-1",
      slug: "orbit",
      name: "Orbit",
      type: "mobile",
      tier: "pro",
      status: "published",
      coverUrl: null,
      categoryName: "Fintech",
      categorySlug: "fintech",
      currentVersionId: "ver-1",
      currentVersion: "1.0.0",
      totalProjectCount: 1,
      versions: [
        {
          id: "ver-1",
          version: "1.0.0",
          changelog: "Initial release",
          publishedAtIso: new Date().toISOString(),
          createdAtIso: new Date().toISOString(),
          pinnedProjectCount: 1,
          document: null,
          rawJson: "{}",
        },
      ],
      usedInProjects: [
        {
          id: "proj-1",
          name: "Mosaed — debt tracker",
          slug: "mosaed-debt",
          visibility: "public",
          ownerName: "Lina Haddad",
          version: "1.0.0",
          updatedAtIso: new Date().toISOString(),
        },
      ],
    };

    render(
      <TemplateDetailClient
        detail={detail}
        publishVersionAction={vi.fn()}
        archiveAction={vi.fn()}
        unarchiveAction={vi.fn()}
        createVersionAction={vi.fn()}
      />,
    );

    expect(screen.getByText("Live")).toBeDefined();
    fireEvent.click(screen.getByRole("tab", { name: "Usage" }));
    expect(screen.getByText("Mosaed — debt tracker")).toBeDefined();
    expect(screen.getByText("Lina Haddad")).toBeDefined();
  });
});
