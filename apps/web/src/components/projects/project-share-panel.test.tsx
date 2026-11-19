import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProjectSharePanel } from "@/components/projects/project-share-panel";
import type { ProjectShareSettingsPayload } from "@/lib/projects/publish";
import { CURATED_COLOR_PRESETS } from "@/lib/template/curated-themes";

const BASE_SETTINGS: ProjectShareSettingsPayload = {
  projectId: "550e8400-e29b-41d4-a716-446655440000",
  projectName: "Orbit Mobile Banking",
  projectType: "mobile",
  templateName: "Orbit",
  slug: null,
  suggestedSlug: "orbit-mobile-banking",
  visibility: "private",
  isPublished: false,
  publishedAtIso: null,
  updatedAtIso: new Date("2026-11-05T10:00:00.000Z").toISOString(),
  ownerPlan: "pro",
  workspaceKind: "personal",
  spaceVisibility: "private",
  requiresTeamPrivatePublicAck: false,
  publicAcknowledged: true,
  canPublish: true,
  canCustomizeSlug: true,
  brandingRemoved: true,
  canRemoveBranding: true,
  whiteLabelEnabled: false,
  customDomain: null,
  publishedCount: 0,
  maxPublishedProjects: 10,
  appBaseUrl: "http://localhost:3000",
  preview: {
    eyebrow: "Fintech · iOS",
    title: "Orbit Mobile Banking",
    subtitle: "Reimagining consumer savings for everyday clarity.",
  },
  theme: {
    colors: { ...CURATED_COLOR_PRESETS[0]!.colors },
    fonts: {
      heading: { family: "Instrument Serif", weights: [400] },
      body: { family: "Geist", weights: [400, 500, 600] },
    },
    typography: {
      h1: { font: "heading", size: 48, weight: 400, lineHeight: 1.15 },
      body: { font: "body", size: 16, weight: 400, lineHeight: 1.6 },
    },
  },
};

describe("ProjectSharePanel (C-601)", () => {
  it("allows editing slug, choosing visibility, publishing, and unpublishing", async () => {
    const user = userEvent.setup();
    const onCheckSlug = vi.fn().mockResolvedValue({
      available: true,
      normalizedSlug: "orbit-banking-live",
    });
    const onPublish = vi.fn().mockResolvedValue({
      ok: true as const,
      projectId: BASE_SETTINGS.projectId,
      slug: "orbit-banking-live",
      visibility: "unlisted" as const,
      brandingRemoved: false,
      publishedAtIso: "2026-11-05T10:05:00.000Z",
      publicPath: "/p/orbit-banking-live",
      publicUrl: "http://localhost:3000/p/orbit-banking-live",
    });
    const onUnpublish = vi.fn().mockResolvedValue({
      ok: true as const,
      projectId: BASE_SETTINGS.projectId,
      visibility: "private" as const,
      slug: "orbit-banking-live",
      updatedAtIso: "2026-11-05T10:10:00.000Z",
    });

    render(
      <ProjectSharePanel
        initialSettings={BASE_SETTINGS}
        onCheckSlug={onCheckSlug}
        onPublish={onPublish}
        onUnpublish={onUnpublish}
      />,
    );

    expect(screen.getByTestId("share-status-badge")).toHaveTextContent("Draft · Private");

    const slugInput = screen.getByTestId("publish-slug-input");
    await user.clear(slugInput);
    await user.type(slugInput, "orbit-banking-live");

    await user.click(screen.getByTestId("visibility-option-unlisted"));
    await user.click(screen.getByTestId("publish-project-button"));

    await waitFor(() => {
      expect(onPublish).toHaveBeenCalledWith({
        projectId: BASE_SETTINGS.projectId,
        slug: "orbit-banking-live",
        visibility: "unlisted",
        brandingRemoved: true,
      });
    });

    expect(screen.getByTestId("share-status-badge")).toHaveTextContent("Published · Unlisted");
    expect(screen.getByTestId("open-public-link")).toHaveAttribute(
      "href",
      "/p/orbit-banking-live",
    );

    await user.click(screen.getByTestId("unpublish-project-button"));

    await waitFor(() => {
      expect(onUnpublish).toHaveBeenCalledWith(BASE_SETTINGS.projectId);
    });

    expect(screen.getByTestId("share-status-badge")).toHaveTextContent("Draft · Private");
  });

  it("locks custom Case Study URL editing on Free while still allowing auto-slug publishing, and hides Casefolio OpenGraph badge on Pro/Teams", async () => {
    const user = userEvent.setup();
    const onCheckSlug = vi.fn();
    const onPublish = vi.fn().mockResolvedValue({
      ok: true as const,
      projectId: BASE_SETTINGS.projectId,
      slug: "orbit-mobile-banking-550e84",
      visibility: "public" as const,
      brandingRemoved: false,
      publishedAtIso: "2026-11-05T10:05:00.000Z",
      publicPath: "/p/orbit-mobile-banking-550e84",
      publicUrl: "http://localhost:3000/p/orbit-mobile-banking-550e84",
    });

    const { unmount } = render(
      <ProjectSharePanel
        initialSettings={{
          ...BASE_SETTINGS,
          ownerPlan: "free",
          canCustomizeSlug: false,
          canRemoveBranding: false,
          brandingRemoved: false,
          maxPublishedProjects: 1,
          suggestedSlug: "orbit-mobile-banking-550e84",
        }}
        onCheckSlug={onCheckSlug}
        onPublish={onPublish}
        onUnpublish={vi.fn()}
      />,
    );

    const slugInput = screen.getByTestId("publish-slug-input");
    expect(slugInput).toHaveAttribute("readonly");
    expect(onCheckSlug).not.toHaveBeenCalled();

    await user.click(screen.getByTestId("publish-project-button"));
    await waitFor(() => {
      expect(onPublish).toHaveBeenCalled();
    });
    unmount();

    render(
      <ProjectSharePanel
        initialSettings={{
          ...BASE_SETTINGS,
          ownerPlan: "team",
          workspaceKind: "team",
          canCustomizeSlug: true,
          canRemoveBranding: true,
          brandingRemoved: true,
          whiteLabelEnabled: true,
        }}
        onCheckSlug={vi.fn()}
        onPublish={vi.fn()}
        onUnpublish={vi.fn()}
      />,
    );

    const ogPreview = screen.getByTestId("og-card-preview");
    expect(ogPreview).not.toHaveTextContent("Casefolio");
  });
});
