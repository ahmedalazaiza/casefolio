import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UploadTemplateWizard } from "./upload-template-wizard";

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}));

function loadOrbitJson(): string {
  for (const candidate of [
    resolve(process.cwd(), "reference/template.example.json"),
    resolve(process.cwd(), "../../reference/template.example.json"),
  ]) {
    if (existsSync(candidate)) {
      return readFileSync(candidate, "utf-8");
    }
  }
  throw new Error("Missing reference/template.example.json");
}

describe("UploadTemplateWizard UI (C-303)", () => {
  it("shows field-level validation errors on invalid JSON and blocks preview", () => {
    const orbit = JSON.parse(loadOrbitJson()) as {
      template: { slots: { "hero.mockup": { ratio: string } } };
    };
    orbit.template.slots["hero.mockup"].ratio = "invalid-ratio";

    render(
      <UploadTemplateWizard
        categories={[{ id: "cat-1", name: "Fintech", slug: "fintech" }]}
        saveDraftAction={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Template JSON"), {
      target: { value: JSON.stringify(orbit) },
    });
    fireEvent.click(screen.getByRole("button", { name: /Validate JSON/i }));

    expect(screen.getByTestId("validation-error-panel")).toBeInTheDocument();
    expect(screen.getByText("template.slots.hero.mockup.ratio")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continue to preview/i })).toBeDisabled();
  });

  it("walks through Upload -> Validate -> Preview -> Metadata and saves draft v1.0.0", async () => {
    pushMock.mockReset();
    const saveDraftMock = vi.fn().mockResolvedValue({
      ok: true as const,
      templateId: "tpl-uuid-123",
      versionId: "ver-uuid-123",
      slug: "orbit",
      version: "1.0.0" as const,
      status: "draft" as const,
    });

    render(
      <UploadTemplateWizard
        categories={[{ id: "cat-1", name: "Fintech", slug: "fintech" }]}
        saveDraftAction={saveDraftMock}
      />,
    );

    // Step 1: Enter valid Orbit JSON
    fireEvent.change(screen.getByLabelText("Template JSON"), {
      target: { value: loadOrbitJson() },
    });
    fireEvent.click(screen.getByRole("button", { name: /Validate JSON/i }));

    // Step 2: Validation succeeds
    expect(screen.getByTestId("validation-success-panel")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Preview template/i }));

    // Step 3: Live Puck preview renders Orbit
    expect(
      screen.getByRole("heading", { name: "Orbit — Banking that moves with you" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Continue to metadata/i }));

    // Step 4: Metadata & Save as draft (v1.0.0)
    expect(screen.getByLabelText("Template name *")).toHaveValue("Orbit");
    fireEvent.click(screen.getByRole("button", { name: /Save as draft \(v1\.0\.0\)/i }));

    await waitFor(() => {
      expect(saveDraftMock).toHaveBeenCalledTimes(1);
    });

    expect(saveDraftMock.mock.calls[0]?.[0].metadata).toMatchObject({
      name: "Orbit",
      slug: "orbit",
      type: "mobile",
      category: "Fintech",
      tier: "free",
      coverRatio: "4:3",
    });
    expect(pushMock).toHaveBeenCalledWith("/admin/templates/tpl-uuid-123");
  });
});
