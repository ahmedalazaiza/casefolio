// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminCategoriesPanel } from "@/components/admin/admin-categories-panel";
import type { AdminCategoriesOverview } from "@/lib/admin/categories-types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
});

const fixture: AdminCategoriesOverview = {
  types: [
    {
      type: "mobile",
      label: "Mobile app",
      description: "Phone frames, app-store style story",
      templateCount: 6,
      projectCount: 128,
      order: 1,
    },
    {
      type: "web",
      label: "Website",
      description: "Browser frames, long-scroll pages",
      templateCount: 5,
      projectCount: 94,
      order: 2,
    },
    {
      type: "both",
      label: "Mobile + Web",
      description: "Mixed device showcase",
      templateCount: 3,
      projectCount: 41,
      order: 3,
    },
  ],
  categories: [
    {
      id: "cat-1",
      name: "Fintech",
      slug: "fintech",
      sort: 10,
      templateCount: 2,
      publishedTemplateCount: 2,
      createdAtIso: new Date().toISOString(),
    },
    {
      id: "cat-2",
      name: "Health",
      slug: "health",
      sort: 20,
      templateCount: 0,
      publishedTemplateCount: 0,
      createdAtIso: new Date().toISOString(),
    },
  ],
};

describe("AdminCategoriesPanel UI (C-903)", () => {
  it("renders Types summary table, Categories list, and Edit/New inspector matching Figma 32:8745", () => {
    render(<AdminCategoriesPanel initialOverview={fixture} />);

    expect(screen.getByRole("heading", { name: "Categories & types" })).toBeDefined();
    expect(screen.getByText("Phone frames, app-store style story")).toBeDefined();
    expect(screen.getByText("Fintech")).toBeDefined();
    expect(screen.getByText("Health")).toBeDefined();

    // Switch to create mode and verify automatic slug generation
    fireEvent.click(screen.getByRole("button", { name: "Add category" }));
    expect(screen.getByRole("heading", { name: "New category" })).toBeDefined();

    fireEvent.change(screen.getByLabelText("Category name"), {
      target: { value: "SaaS Dashboard" },
    });
    expect((screen.getByLabelText(/URL & filter slug/i) as HTMLInputElement).value).toBe(
      "saas-dashboard",
    );
  });
});
