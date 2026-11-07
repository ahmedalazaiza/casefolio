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

  it("requires a cover / thumbnail image when JSON omits cover and saves uploaded cover URL", async () => {
    pushMock.mockReset();
    const saveDraftMock = vi.fn().mockResolvedValue({
      ok: true as const,
      templateId: "tpl-cover-999",
      versionId: "ver-cover-999",
      slug: "pulse-mobile",
      version: "1.0.0" as const,
      status: "draft" as const,
    });

    const rawOrbit = JSON.parse(loadOrbitJson()) as {
      template: { name: string; slug: string; cover?: unknown };
    };
    rawOrbit.template.name = "Pulse Mobile";
    rawOrbit.template.slug = "pulse-mobile";
    delete rawOrbit.template.cover;

    const tinyPng = Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x02,
      0x08, 0x02, 0x00, 0x00, 0x00, 0xfd, 0xd4, 0x9a,
      0x73, 0x00, 0x00, 0x00, 0x10, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9c, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
      0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d,
      0xb0, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
      0x44, 0xae, 0x42, 0x60, 0x82,
    ]);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { action?: string };
      if (body.action === "presign") {
        return new Response(
          JSON.stringify({
            ok: true,
            coverId: "11111111-1111-4111-8111-111111111111",
            r2Key: "templates/covers/11111111-1111-4111-8111-111111111111.png",
            mode: "local",
            uploadUrl: "/api/uploads/local-put?token=mock",
            uploadMethod: "PUT",
            uploadHeaders: { "Content-Type": "image/png" },
            completeToken: "mock-complete-token-123456",
            expiresInSeconds: 300,
            maxFileBytes: 10_485_760,
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          ok: true,
          coverUrl: "/cdn/covers/11111111-1111-4111-8111-111111111111.png",
          r2Key: "templates/covers/11111111-1111-4111-8111-111111111111.png",
          width: 2,
          height: 2,
          bytes: tinyPng.byteLength,
          mimeType: "image/png",
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    try {
      render(
        <UploadTemplateWizard
          categories={[{ id: "cat-1", name: "Fintech", slug: "fintech" }]}
          saveDraftAction={saveDraftMock}
          coverPutTransport={vi.fn().mockResolvedValue(undefined)}
        />,
      );

      fireEvent.change(screen.getByLabelText("Template JSON"), {
        target: { value: JSON.stringify(rawOrbit) },
      });
      fireEvent.click(screen.getByRole("button", { name: /Validate JSON/i }));

      expect(screen.getByTestId("validation-success-panel")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /Preview template/i }));
      fireEvent.click(screen.getByRole("button", { name: /Continue to metadata/i }));

      // Attempting to save without cover blocks submission
      fireEvent.click(screen.getByRole("button", { name: /Save as draft \(v1\.0\.0\)/i }));
      expect(
        screen.getByText(/A cover \/ thumbnail image is required when adding a template/i),
      ).toBeInTheDocument();
      expect(saveDraftMock).not.toHaveBeenCalled();

      // Upload PNG cover file
      const file = new File([tinyPng], "pulse-cover.png", { type: "image/png" });
      fireEvent.change(screen.getByTestId("template-cover-file-input"), {
        target: { files: [file] },
      });

      await waitFor(() => {
        expect(screen.getByTestId("template-cover-live-preview")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /Save as draft \(v1\.0\.0\)/i }));

      await waitFor(() => {
        expect(saveDraftMock).toHaveBeenCalledTimes(1);
      });
      expect(saveDraftMock.mock.calls[0]?.[0].metadata.coverUrl).toBe(
        "/cdn/covers/11111111-1111-4111-8111-111111111111.png",
      );
      expect(pushMock).toHaveBeenCalledWith("/admin/templates/tpl-cover-999");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
