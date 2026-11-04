import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CreateProjectWizard } from "./create-project-wizard";
import { validateTemplateDocument, type TemplateDocument } from "@/lib/template/schema";
import type { PublishedTemplateItem } from "@/lib/template/types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

function loadOrbitDoc(): TemplateDocument {
  for (const candidate of [
    resolve(process.cwd(), "reference/template.example.json"),
    resolve(process.cwd(), "../../reference/template.example.json"),
  ]) {
    if (existsSync(candidate)) {
      const parsed = validateTemplateDocument(JSON.parse(readFileSync(candidate, "utf-8")));
      if (parsed.ok) return parsed.data;
    }
  }
  throw new Error("Missing Orbit template fixture");
}

function buildTemplates(): PublishedTemplateItem[] {
  const orbitDoc = loadOrbitDoc();
  return [
    {
      id: "11111111-1111-4111-8111-111111111111",
      versionId: "22222222-2222-4222-8222-222222222222",
      slug: "orbit",
      name: "Orbit",
      type: "mobile",
      tier: "free",
      coverUrl: orbitDoc.template.cover.src,
      categoryName: "Fintech",
      categorySlug: "fintech",
      version: "1.0.0",
      sectionCount: 6,
      slotCount: 5,
      document: orbitDoc,
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      versionId: "44444444-4444-4444-8444-444444444444",
      slug: "atlas",
      name: "Atlas",
      type: "web",
      tier: "free",
      coverUrl: orbitDoc.template.cover.src,
      categoryName: "SaaS",
      categorySlug: "saas",
      version: "1.0.0",
      sectionCount: 6,
      slotCount: 5,
      document: {
        ...orbitDoc,
        template: { ...orbitDoc.template, name: "Atlas", slug: "atlas", type: "web" },
      },
    },
  ];
}

describe("CreateProjectWizard (C-401)", () => {
  it("preserves wizard state across Back and Next navigation and submits to editor", async () => {
    pushMock.mockReset();
    const onCreateProject = vi.fn().mockResolvedValue({
      ok: true,
      projectId: "99999999-9999-4999-8999-999999999999",
      templateVersionId: "22222222-2222-4222-8222-222222222222",
    });

    render(
      <CreateProjectWizard
        templates={buildTemplates()}
        userPlan="free"
        existingProjectCount={0}
        onCreateProject={onCreateProject}
      />,
    );

    // Step 1: Select Mobile app -> Next
    expect(screen.getByTestId("wizard-step-type")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("type-card-mobile"));
    fireEvent.click(screen.getByTestId("wizard-next-to-template"));

    // Step 2: Orbit is shown -> Next to Details
    expect(screen.getByTestId("wizard-step-template")).toBeInTheDocument();
    expect(screen.getByText(/Selected: Mobile app · Orbit/i)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("wizard-next-to-details"));

    // Step 3: Fill project name & details
    expect(screen.getByTestId("wizard-step-details")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Project name *"), {
      target: { value: "Mosaed — Smart debt management" },
    });
    fireEvent.change(screen.getByLabelText("Short description"), {
      target: { value: "Calm personal debt tracker for iOS." },
    });
    fireEvent.change(screen.getByLabelText("Client"), {
      target: { value: "Mosaed" },
    });
    fireEvent.change(screen.getByLabelText("Your role"), {
      target: { value: "Lead product designer" },
    });

    // Navigate Back -> Template -> Back -> Type -> Next -> Template -> Next -> Details
    fireEvent.click(screen.getByTestId("wizard-back-to-template"));
    expect(screen.getByTestId("wizard-step-template")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("wizard-back-to-type"));
    expect(screen.getByTestId("wizard-step-type")).toBeInTheDocument();
    expect(screen.getByTestId("type-card-mobile")).toHaveAttribute("aria-checked", "true");

    fireEvent.click(screen.getByTestId("wizard-next-to-template"));
    fireEvent.click(screen.getByTestId("wizard-next-to-details"));

    // Verify all entered fields persisted!
    expect(screen.getByLabelText("Project name *")).toHaveValue(
      "Mosaed — Smart debt management",
    );
    expect(screen.getByLabelText("Short description")).toHaveValue(
      "Calm personal debt tracker for iOS.",
    );
    expect(screen.getByLabelText("Client")).toHaveValue("Mosaed");
    expect(screen.getByLabelText("Your role")).toHaveValue("Lead product designer");

    // Submit form
    fireEvent.click(screen.getByTestId("wizard-submit-create"));

    await waitFor(() => {
      expect(onCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "mobile",
          templateId: "11111111-1111-4111-8111-111111111111",
          name: "Mosaed — Smart debt management",
          description: "Calm personal debt tracker for iOS.",
          client: "Mosaed",
          role: "Lead product designer",
        }),
      );
      expect(pushMock).toHaveBeenCalledWith("/editor/99999999-9999-4999-8999-999999999999");
    });
  });
});
