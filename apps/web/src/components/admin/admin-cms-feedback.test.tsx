// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TeamPage from "@/app/(marketing)/team/page";
import { AdminCmsPanel } from "@/components/admin/admin-cms-panel";
import { AdminFeedbackPanel } from "@/components/admin/admin-feedback-panel";
import { AdminProjectsPanel } from "@/components/admin/admin-projects-panel";
import {
  dispatchOpenFeedbackSurvey,
  QuickFeedbackSurvey,
} from "@/components/feedback/quick-feedback-survey";
import { PricingPageClient } from "@/components/marketing/pricing-page-client";
import type { AdminProjectsOverview } from "@/lib/admin/projects-types";
import { DEFAULT_SITE_CMS_CONTENT } from "@/lib/cms/schema";
import type { AdminFeedbackOverview } from "@/lib/feedback/types";

vi.mock("@/lib/cms/service", () => ({
  getSiteCmsContent: async () => DEFAULT_SITE_CMS_CONTENT,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
});

describe("Admin CMS, Projects Explorer, Feedback Survey & Dynamic CMS Pricing UI", () => {
  it("renders AdminCmsPanel with 2 founding partners on Our Team tab and Pricing tab controls", () => {
    render(<AdminCmsPanel initialContent={DEFAULT_SITE_CMS_CONTENT} />);

    // Team tab is active by default showing both actual partners
    expect(screen.getByDisplayValue("Ahmed Al-Azaiza")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Founder & Product Architect")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Mohammed Kullab")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Co-Founder & Lead Full-Stack Engineer")).toBeInTheDocument();

    // Switch to Plans & Pricing tab
    fireEvent.click(screen.getByTestId("cms-tab-pricing"));
    expect(screen.getByTestId("cms-price-monthly-pro")).toBeInTheDocument();
    expect(screen.getByTestId("cms-price-yearly-team")).toBeInTheDocument();
  });

  it("reflects CMS pricing & highlight badge overrides immediately on PricingPageClient", () => {
    const overriddenPricing = structuredClone(DEFAULT_SITE_CMS_CONTENT.pricing);
    overriddenPricing.popularTier = "team";
    overriddenPricing.popularBadgeText = "Best Studio Deal";
    overriddenPricing.tiers.pro.monthlyPriceCents = 999;

    render(
      <PricingPageClient
        isAuthenticated={false}
        currentTier={null}
        activeOrgId={null}
        cmsPricing={overriddenPricing}
        paddlePriceMap={{
          environment: "sandbox",
          pro_monthly: "pri_1",
          pro_yearly: "pri_2",
          team_monthly: "pri_3",
          team_yearly: "pri_4",
        }}
      />,
    );

    const grid = screen.getByTestId("paid-plan-cards-grid");
    const proCard = within(grid).getByTestId("plan-card-pro");
    const teamCard = within(grid).getByTestId("plan-card-team");

    expect(within(proCard).getByTestId("plan-card-price")).toHaveTextContent("$9.99");
    expect(teamCard).toHaveAttribute("data-highlighted", "true");
    expect(within(teamCard).getByText("Best Studio Deal")).toBeInTheDocument();
  });

  it("renders AdminProjectsPanel with owner profile links & AdminFeedbackPanel ratings", () => {
    const projectsOverview: AdminProjectsOverview = {
      summary: {
        total: 1,
        published: 1,
        unlisted: 0,
        draft: 0,
        archived: 0,
        takedownOrSuspended: 0,
        team: 0,
      },
      projects: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Wallet App Redesign",
          slug: "wallet-app",
          type: "mobile",
          visibility: "public",
          archivedAtIso: null,
          suspendedReason: null,
          ownerId: "22222222-2222-4222-8222-222222222222",
          ownerName: "Sara Designer",
          ownerEmail: "sara@studio.co",
          ownerPlan: "pro",
          workspaceKind: "personal",
          orgName: null,
          templateName: "Orbit",
          templateCoverUrl: null,
          views: 420,
          exports: 3,
          publishedAtIso: new Date().toISOString(),
          updatedAtIso: new Date().toISOString(),
        },
      ],
    };

    render(<AdminProjectsPanel initialOverview={projectsOverview} />);
    const ownerLink = screen.getByTestId(
      "project-owner-link-11111111-1111-4111-8111-111111111111",
    );
    expect(ownerLink).toHaveAttribute("href", "/admin/users/22222222-2222-4222-8222-222222222222");

    cleanup();

    const feedbackOverview: AdminFeedbackOverview = {
      totalResponses: 2,
      averageRating: 4.5,
      promoterPercent: 100,
      distribution: [
        { stars: 5, count: 1, percent: 50 },
        { stars: 4, count: 1, percent: 50 },
        { stars: 3, count: 0, percent: 0 },
        { stars: 2, count: 0, percent: 0 },
        { stars: 1, count: 0, percent: 0 },
      ],
      topFeatureRequests: [{ feature: "More templates & layouts", count: 2 }],
      entries: [
        {
          id: "fb-1",
          userId: "22222222-2222-4222-8222-222222222222",
          userName: "Sara Designer",
          userEmail: "sara@studio.co",
          planTier: "pro",
          rating: 5,
          triggerMoment: "first_publish",
          primaryUseCase: "Job search / UX portfolio",
          topFeatureRequest: "More templates & layouts",
          sentimentTags: ["Fast workflow"],
          comment: "Shipped my case study in 15 mins!",
          createdAtIso: new Date().toISOString(),
        },
      ],
    };

    render(<AdminFeedbackPanel overview={feedbackOverview} />);
    expect(screen.getByText("4.50")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("Shipped my case study in 15 mins!")).toBeInTheDocument();
  });

  it("opens QuickFeedbackSurvey on manual event and enables submit after star selection", () => {
    render(<QuickFeedbackSurvey />);
    expect(screen.queryByTestId("quick-feedback-survey")).not.toBeInTheDocument();

    fireEvent(window, new CustomEvent("casefolio:open-feedback", { detail: { triggerMoment: "manual" } }));
    dispatchOpenFeedbackSurvey("manual");

    const dialog = screen.getByTestId("quick-feedback-survey");
    expect(dialog).toBeInTheDocument();

    const submitBtn = screen.getByTestId("feedback-submit-btn");
    expect(submitBtn).toBeDisabled();

    fireEvent.click(screen.getByTestId("feedback-star-5"));
    expect(submitBtn).not.toBeDisabled();
    expect(screen.getByText("5 / 5")).toBeInTheDocument();
  });

  it("renders TeamPage with strictly the two founding partners and zero fictional staff", async () => {
    const ui = await TeamPage();
    render(ui);

    expect(screen.getByText("Ahmed Al-Azaiza")).toBeInTheDocument();
    expect(screen.getByText("Founder & Product Architect")).toBeInTheDocument();
    expect(screen.getByText("Mohammed Kullab")).toBeInTheDocument();
    expect(screen.getByText("Co-Founder & Lead Full-Stack Engineer")).toBeInTheDocument();

    for (const removedName of [
      "Lina Nassar",
      "Kareem Mansour",
      "Sara Haddad",
      "Omar Tariq",
      "Noor Faris",
    ]) {
      expect(screen.queryByText(removedName)).not.toBeInTheDocument();
    }
  });
});
