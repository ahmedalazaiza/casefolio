import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProjectExportsPanel } from "@/components/projects/project-exports-panel";
import type { ProjectExportsOverviewPayload } from "@/lib/exports/types";

const FREE_OVERVIEW: ProjectExportsOverviewPayload = {
  projectId: "550e8400-e29b-41d4-a716-446655440000",
  projectName: "Orbit Mobile Banking",
  templateName: "Orbit",
  slug: "orbit-mobile-banking",
  isPublished: true,
  ownerPlan: "free",
  hasWatermark: true,
  monthlyExportsUsed: 1,
  monthlyExportsLimit: 5,
  exports: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      projectId: "550e8400-e29b-41d4-a716-446655440000",
      format: "png_long",
      status: "completed",
      r2Key: "exports/550e8400/11111111.png",
      error: null,
      createdAtIso: "2026-11-05T10:00:00.000Z",
      downloadUrl: "/api/exports/11111111-1111-4111-8111-111111111111/download",
    },
  ],
};

describe("ProjectExportsPanel & ExportCaseStudyDialog (C-603)", () => {
  it("shows past export re-download links and locks PDF/Behance on Free plan with upgrade CTA", async () => {
    const user = userEvent.setup();

    render(<ProjectExportsPanel initialOverview={FREE_OVERVIEW} />);

    expect(screen.getByTestId("free-export-quota-badge")).toHaveTextContent(
      "1 of 5 Free exports this month",
    );

    // Past export can be re-downloaded
    const pastDownload = screen.getByTestId(
      "download-export-11111111-1111-4111-8111-111111111111",
    );
    expect(pastDownload).toHaveAttribute(
      "href",
      "/api/exports/11111111-1111-4111-8111-111111111111/download",
    );

    // Selecting PDF on Free plan replaces export button with Upgrade CTA
    await user.click(screen.getByTestId("export-preset-pdf"));
    expect(screen.getByTestId("upgrade-export-cta")).toHaveAttribute("href", "/account");

    // Export modal dialog opens and shows all 3 presets
    await user.click(screen.getByTestId("open-export-dialog-button"));
    expect(screen.getByTestId("export-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-preset-png_long")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-preset-pdf")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-preset-behance")).toBeInTheDocument();
  });

  it("queues a Pro PDF export, polls live progress until completed, and enables download", async () => {
    const user = userEvent.setup();
    const newJobId = "22222222-2222-4222-8222-222222222222";

    const proOverview: ProjectExportsOverviewPayload = {
      ...FREE_OVERVIEW,
      ownerPlan: "pro",
      hasWatermark: false,
      monthlyExportsLimit: null,
      exports: [],
    };

    const requestExport = vi.fn().mockResolvedValue({
      ok: true as const,
      exportJob: {
        id: newJobId,
        projectId: proOverview.projectId,
        format: "pdf" as const,
        status: "queued" as const,
        r2Key: null,
        error: null,
        createdAtIso: "2026-11-05T10:15:00.000Z",
        downloadUrl: null,
      },
      hasWatermark: false,
      monthlyExportsUsed: 1,
      monthlyExportsLimit: null,
    });

    const pollOverview = vi.fn().mockResolvedValue({
      ...proOverview,
      exports: [
        {
          id: newJobId,
          projectId: proOverview.projectId,
          format: "pdf" as const,
          status: "completed" as const,
          r2Key: `exports/${proOverview.projectId}/${newJobId}.pdf`,
          error: null,
          createdAtIso: "2026-11-05T10:15:00.000Z",
          downloadUrl: `/api/exports/${newJobId}/download`,
        },
      ],
    });

    render(
      <ProjectExportsPanel
        initialOverview={proOverview}
        requestExport={requestExport}
        pollOverview={pollOverview}
      />,
    );

    await user.click(screen.getByTestId("export-preset-pdf"));
    await user.click(screen.getByTestId("start-export-button"));

    await waitFor(() => {
      expect(requestExport).toHaveBeenCalledWith({
        projectId: proOverview.projectId,
        format: "pdf",
      });
    });

    await waitFor(
      () => {
        expect(screen.getByTestId(`download-export-${newJobId}`)).toHaveAttribute(
          "href",
          `/api/exports/${newJobId}/download`,
        );
      },
      { timeout: 3_000 },
    );
  });
});

