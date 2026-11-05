// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminModerationPanel } from "@/components/admin/admin-moderation-panel";
import { ReportCaseStudyButton } from "@/components/public/report-case-study-button";
import type { AdminModerationOverview } from "@/lib/admin/moderation-types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
});

const populatedOverview: AdminModerationOverview = {
  openCount: 1,
  dismissedCount: 0,
  takedownCount: 1,
  items: [
    {
      id: "proj-1:open",
      projectId: "11111111-1111-4111-8111-111111111111",
      projectName: "Crypto pump landing",
      projectSlug: "crypto-pump",
      projectVisibility: "public",
      publishedAtIso: new Date().toISOString(),
      authorId: "22222222-2222-4222-8222-222222222222",
      authorName: "Omar Khalil",
      authorEmail: "omar@casefolio.design",
      queueBucket: "open",
      primaryReason: "Spam or scam",
      reportNotes: [
        "Spam or scam: Promotes a token scheme and links to an external wallet.",
      ],
      reportCount: 7,
      latestReportedAtIso: new Date().toISOString(),
    },
    {
      id: "proj-2:takedown",
      projectId: "33333333-3333-4333-8333-333333333333",
      projectName: "Phishing clone",
      projectSlug: "phishing-clone",
      projectVisibility: "private",
      publishedAtIso: new Date().toISOString(),
      authorId: "44444444-4444-4444-8444-444444444444",
      authorName: "Anon Actor",
      authorEmail: "anon@casefolio.design",
      queueBucket: "takedown",
      primaryReason: "Phishing or malware",
      reportNotes: ["Phishing or malware"],
      reportCount: 3,
      latestReportedAtIso: new Date().toISOString(),
    },
  ],
};

describe("Admin moderation & public report UI (C-905)", () => {
  it("renders moderation queue, review panel (Figma 32:9737), and empty state (Figma 32:10481)", () => {
    render(<AdminModerationPanel initialOverview={populatedOverview} />);

    expect(screen.getByRole("heading", { name: "Moderation" })).toBeDefined();
    expect(screen.getByText("Crypto pump landing")).toBeDefined();
    expect(screen.getByText(/Reviewing · Crypto pump landing/i)).toBeDefined();

    // Switch to Reviewed (0) segment -> shows Figma 32:10481 empty state
    fireEvent.click(screen.getByRole("tab", { name: "Reviewed (0)" }));
    expect(screen.getByRole("heading", { name: "Nothing to review" })).toBeDefined();

    // Switch to Taken down (1) segment -> shows taken down item
    fireEvent.click(screen.getByRole("tab", { name: "Taken down (1)" }));
    expect(screen.getByText("Phishing clone")).toBeDefined();
  });

  it("opens the Report case study dialog on public pages", () => {
    render(
      <ReportCaseStudyButton
        projectId="11111111-1111-4111-8111-111111111111"
        projectName="Souq — checkout redesign"
      />,
    );

    fireEvent.click(screen.getByTestId("report-case-study-trigger"));
    expect(screen.getByRole("heading", { name: "Report case study" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Submit report" })).toBeDefined();
  });
});
