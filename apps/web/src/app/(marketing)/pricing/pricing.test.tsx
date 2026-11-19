import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PricingPageClient } from "@/components/marketing/pricing-page-client";
import {
  BILLING_PLAN_CATALOG,
  formatUsdFromCents,
  FREE_LIFETIME_PROJECT_LIMIT,
  PRO_MAX_PROJECTS,
} from "@/lib/billing/plans";
import { FREE_MONTHLY_EXPORT_LIMIT } from "@/lib/exports/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const MOCK_PADDLE_PRICE_MAP = {
  environment: "sandbox" as const,
  pro_monthly: "pri_pro_monthly_cfg",
  pro_yearly: "pri_pro_yearly_cfg",
  team_monthly: "pri_team_monthly_cfg",
  team_yearly: "pri_team_yearly_cfg",
};

describe("PricingPageClient (2 Paid Cards: Pro & Teams + Free Onboarding + 3-Tier Matrix)", () => {
  it("loads Pro and Teams paid cards, Free onboarding callout, 3-column matrix, and 4 Paddle price IDs", async () => {
    const user = userEvent.setup();

    render(
      <PricingPageClient
        isAuthenticated={false}
        currentTier={null}
        activeOrgId={null}
        paddlePriceMap={MOCK_PADDLE_PRICE_MAP}
      />,
    );

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();

    const paidGrid = screen.getByTestId("paid-plan-cards-grid");
    expect(within(paidGrid).getByTestId("plan-card-pro")).toBeInTheDocument();
    expect(within(paidGrid).getByTestId("plan-card-team")).toBeInTheDocument();
    expect(within(paidGrid).queryByTestId("plan-card-plus")).not.toBeInTheDocument();
    expect(screen.getByTestId("free-onboarding-callout")).toHaveTextContent(/Free/i);

    expect(
      screen.getAllByText(formatUsdFromCents(BILLING_PLAN_CATALOG.pro.monthlyPriceCents)).length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText(formatUsdFromCents(BILLING_PLAN_CATALOG.team.monthlyPriceCents)).length,
    ).toBeGreaterThanOrEqual(1);

    expect(
      screen.getByText(`${FREE_LIFETIME_PROJECT_LIMIT} lifetime Case Study credit`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`Up to ${PRO_MAX_PROJECTS} active (rotatable)`),
    ).toBeInTheDocument();
    expect(screen.getByText(`${FREE_MONTHLY_EXPORT_LIMIT}/mo`)).toBeInTheDocument();

    const paddleSummary = screen.getByTestId("paddle-config-summary");
    expect(paddleSummary).toHaveAttribute("data-pro-monthly", "pri_pro_monthly_cfg");
    expect(paddleSummary).toHaveAttribute("data-team-yearly", "pri_team_yearly_cfg");

    const proUpgradeLink = screen.getByRole("link", { name: "Upgrade to Pro" });
    expect(proUpgradeLink).toHaveAttribute("href", "/sign-up?plan=pro&interval=monthly");

    await user.click(screen.getAllByRole("button", { name: /^Annual/i })[0]!);
    expect(
      screen.getAllByText(
        formatUsdFromCents(BILLING_PLAN_CATALOG.pro.yearlyMonthlyEquivalentCents),
      ).length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText(
        formatUsdFromCents(BILLING_PLAN_CATALOG.team.yearlyMonthlyEquivalentCents),
      ).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("link", { name: "Upgrade to Pro" })).toHaveAttribute(
      "href",
      "/sign-up?plan=pro&interval=yearly",
    );

    const plansSection = screen.getByRole("region", {
      name: "Subscription plans",
    });
    const comparisonSection = screen.getByTestId("plan-comparison-matrix");
    expect(
      plansSection.compareDocumentPosition(comparisonSection) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    expect(screen.getAllByText("Included").length).toBeGreaterThanOrEqual(6);
    expect(screen.getAllByText("Not included").length).toBeGreaterThanOrEqual(4);
  });

  it("computes Teams per-seat math (2..25 seats at $5.99/mo · $59.90/yr = 2 months free) and 26+ enterprise capacity with zero network calls", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const user = userEvent.setup();

    render(
      <PricingPageClient
        isAuthenticated={false}
        currentTier={null}
        activeOrgId={null}
        paddlePriceMap={MOCK_PADDLE_PRICE_MAP}
      />,
    );

    expect(screen.getByTestId("teams-calc-seat-count")).toHaveTextContent("3");
    expect(screen.getByTestId("teams-calc-headline-price")).toHaveTextContent("$17.97");
    expect(screen.getByTestId("teams-calc-disclaimer")).toHaveTextContent(
      "Before tax; this calculator saves nothing and charges nothing.",
    );

    await user.click(screen.getByTestId("teams-calc-preset-5"));
    expect(screen.getByTestId("teams-calc-seat-count")).toHaveTextContent("5");
    expect(screen.getByTestId("teams-calc-headline-price")).toHaveTextContent("$29.95");
    expect(screen.getByTestId("teams-calc-billing-detail")).toHaveTextContent("$299.50/yr");

    await user.click(screen.getByTestId("teams-calc-preset-15"));
    expect(screen.getByTestId("teams-calc-seat-count")).toHaveTextContent("15");
    expect(screen.getByTestId("teams-calc-headline-price")).toHaveTextContent("$89.85");

    await user.click(screen.getByTestId("teams-calc-preset-26"));
    expect(screen.getByTestId("teams-calc-capacity-review")).toHaveTextContent(
      /Enterprise capacity \(26\+ seats\)/i,
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("opens the Paddle checkout modal directly for authenticated users", async () => {
    const user = userEvent.setup();

    render(
      <PricingPageClient
        isAuthenticated={true}
        currentTier="free"
        activeOrgId={null}
        paddlePriceMap={MOCK_PADDLE_PRICE_MAP}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Upgrade to Pro" }));
    expect(await screen.findByTestId("paddle-checkout-dialog")).toBeInTheDocument();
  });
});
