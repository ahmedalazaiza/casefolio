import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PricingPageClient } from "@/components/marketing/pricing-page-client";
import { BILLING_PLAN_CATALOG, formatUsdFromCents } from "@/lib/billing/plans";
import { FREE_MONTHLY_EXPORT_LIMIT } from "@/lib/exports/types";
import { FREE_PROJECT_LIMIT } from "@/lib/projects/types";

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
  plus_monthly: "pri_plus_monthly_cfg",
  plus_yearly: "pri_plus_yearly_cfg",
};

describe("PricingPageClient (3 Paid Cards + Free Onboarding + 4-Tier Matrix)", () => {
  it("loads Pro, Team, and Plus paid cards, Free onboarding callout, 4-column matrix, and Paddle price IDs", async () => {
    const user = userEvent.setup();

    render(
      <PricingPageClient
        isAuthenticated={false}
        currentTier={null}
        activeOrgId={null}
        paddlePriceMap={MOCK_PADDLE_PRICE_MAP}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Unlock the full builder" }),
    ).toBeInTheDocument();

    // 3 main paid cards + Free onboarding callout
    const paidGrid = screen.getByTestId("paid-plan-cards-grid");
    expect(within(paidGrid).getByTestId("plan-card-pro")).toBeInTheDocument();
    expect(within(paidGrid).getByTestId("plan-card-team")).toBeInTheDocument();
    expect(within(paidGrid).getByTestId("plan-card-plus")).toBeInTheDocument();
    expect(screen.getByTestId("free-onboarding-callout")).toHaveTextContent(
      "Free — $0 / forever",
    );

    // Config-sourced monthly prices ($9.99, $6.99, $99)
    expect(
      screen.getAllByText(formatUsdFromCents(BILLING_PLAN_CATALOG.pro.monthlyPriceCents)).length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText(formatUsdFromCents(BILLING_PLAN_CATALOG.team.monthlyPriceCents)).length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText(formatUsdFromCents(BILLING_PLAN_CATALOG.plus.monthlyPriceCents)).length,
    ).toBeGreaterThanOrEqual(1);

    // Progressive feature headers on the 3 paid cards
    expect(screen.getByText("Includes everything in Free, plus")).toBeInTheDocument();
    expect(screen.getByText("Includes everything in Pro, plus")).toBeInTheDocument();
    expect(screen.getByText("Includes everything in Team, plus")).toBeInTheDocument();

    // Config-sourced quotas in comparison matrix
    expect(
      screen.getByText(`Maximum ${FREE_PROJECT_LIMIT} active Case Study`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`${FREE_MONTHLY_EXPORT_LIMIT}/mo`),
    ).toBeInTheDocument();

    // Paddle price config summary wired cleanly across Pro, Team, and Plus
    const paddleSummary = screen.getByTestId("paddle-config-summary");
    expect(paddleSummary).toHaveAttribute("data-pro-monthly", "pri_pro_monthly_cfg");
    expect(paddleSummary).toHaveAttribute("data-team-yearly", "pri_team_yearly_cfg");
    expect(paddleSummary).toHaveAttribute("data-plus-monthly", "pri_plus_monthly_cfg");
    expect(paddleSummary).toHaveAttribute("data-plus-yearly", "pri_plus_yearly_cfg");

    // Unauthenticated CTAs link to /sign-up with plan + interval
    const proUpgradeLink = screen.getByRole("link", { name: "Upgrade to Pro" });
    expect(proUpgradeLink).toHaveAttribute("href", "/sign-up?plan=pro&interval=monthly");
    expect(screen.getByRole("link", { name: "Upgrade to Plus" })).toHaveAttribute(
      "href",
      "/sign-up?plan=plus&interval=monthly",
    );

    // Switch to Annual interval (Save 20% · 2 months free)
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
    expect(
      screen.getAllByText(
        formatUsdFromCents(BILLING_PLAN_CATALOG.plus.yearlyMonthlyEquivalentCents),
      ).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("link", { name: "Upgrade to Pro" })).toHaveAttribute(
      "href",
      "/sign-up?plan=pro&interval=yearly",
    );

    // Top pricing cards appear above the detailed Included vs Not Included comparison matrix
    const plansSection = screen.getByRole("region", {
      name: "Subscription plans",
    });
    const comparisonSection = screen.getByTestId("plan-comparison-matrix");
    expect(
      plansSection.compareDocumentPosition(comparisonSection) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // Comparison matrix explicitly renders visible Included and Not included pills across all 4 tiers
    expect(screen.getAllByText("Included").length).toBeGreaterThanOrEqual(8);
    expect(screen.getAllByText("Not included").length).toBeGreaterThanOrEqual(8);
  });

  it("computes Team per-seat math (2..10 seats), Plus flat-rate recommendation (11..20 seats), and 21+ custom capacity with zero network calls", async () => {
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

    // Default calculator state: 3 seats monthly = $20.97/mo ($6.99 × 3)
    expect(screen.getByTestId("teams-calc-seat-count")).toHaveTextContent("3");
    expect(screen.getByTestId("teams-calc-headline-price")).toHaveTextContent("$20.97");
    expect(screen.getByTestId("teams-calc-disclaimer")).toHaveTextContent(
      "Before tax; this calculator saves nothing and charges nothing.",
    );

    // Select 5 seats preset -> $34.95/mo ($335.40/yr — save $84/yr)
    await user.click(screen.getByTestId("teams-calc-preset-5"));
    expect(screen.getByTestId("teams-calc-seat-count")).toHaveTextContent("5");
    expect(screen.getByTestId("teams-calc-headline-price")).toHaveTextContent("$34.95");
    expect(screen.getByTestId("teams-calc-billing-detail")).toHaveTextContent("$335.40/yr");

    // Select 11–20 seats (Plus) preset -> flat-rate Plus $99/mo recommendation
    await user.click(screen.getByTestId("teams-calc-preset-15"));
    expect(screen.getByTestId("teams-calc-plus-recommendation")).toHaveTextContent(
      "Casefolio Plus — up to 20 seats included",
    );
    expect(screen.getByTestId("teams-calc-headline-price")).toHaveTextContent("$99");

    // Select 21+ seats -> capacity review state
    await user.click(screen.getByTestId("teams-calc-preset-26"));
    expect(screen.getByTestId("teams-calc-capacity-review")).toHaveTextContent(
      "Custom capacity above 20 seats",
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
    expect(
      await screen.findByTestId("paddle-checkout-dialog"),
    ).toBeInTheDocument();
  });
});
