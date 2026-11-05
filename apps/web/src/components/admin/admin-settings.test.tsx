// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminSettingsPanel } from "@/components/admin/admin-settings-panel";
import type { AdminSettingsOverview } from "@/lib/admin/settings-types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
});

const sampleOverview: AdminSettingsOverview = {
  team: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Ahmed Hamdan",
      email: "ahmed@casefolio.app",
      role: "superadmin",
      emailVerified: true,
      lastActiveIso: new Date().toISOString(),
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      name: "Rana Khoury",
      email: "rana@casefolio.app",
      role: "admin",
      emailVerified: true,
      lastActiveIso: new Date().toISOString(),
    },
  ],
  platform: {
    newSignupsOpen: true,
    requireEmailVerification: true,
    maintenanceMode: false,
  },
  auditLogs: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      actorId: "11111111-1111-4111-8111-111111111111",
      actorName: "Ahmed Hamdan",
      actorRole: "superadmin",
      action: "admin.moderation.takedown",
      category: "moderation",
      meta: { projectName: "Crypto pump landing" },
      atIso: new Date().toISOString(),
    },
    {
      id: "44444444-4444-4444-8444-444444444444",
      actorId: "11111111-1111-4111-8111-111111111111",
      actorName: "Ahmed Hamdan",
      actorRole: "superadmin",
      action: "admin.category.created",
      category: "categories",
      meta: { name: "Fintech" },
      atIso: new Date().toISOString(),
    },
  ],
};

describe("AdminSettingsPanel UI (C-906)", () => {
  it("renders Settings & roles team table, permissions matrix, platform switches, and searchable Audit log (Figma 32:10233)", () => {
    render(
      <AdminSettingsPanel
        initialOverview={sampleOverview}
        currentAdminId="11111111-1111-4111-8111-111111111111"
        currentAdminRole="superadmin"
      />,
    );

    expect(screen.getByRole("heading", { name: "Settings & roles" })).toBeDefined();
    expect(screen.getByText("Ahmed Hamdan")).toBeDefined();
    expect(screen.getByText("Rana Khoury")).toBeDefined();
    expect(screen.getByText("Upload & publish templates")).toBeDefined();
    expect(screen.getByLabelText("New sign-ups open")).toBeDefined();

    // Switch to Audit log tab and filter by category
    fireEvent.click(screen.getByRole("tab", { name: /Audit log/i }));
    expect(screen.getByText("admin.moderation.takedown")).toBeDefined();
    expect(screen.getByText("admin.category.created")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "moderation" }));
    expect(screen.getByText("admin.moderation.takedown")).toBeDefined();
    expect(screen.queryByText("admin.category.created")).toBeNull();
  });
});
