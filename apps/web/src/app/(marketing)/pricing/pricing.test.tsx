import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PricingPageClient } from "@/components/marketing/pricing-page-client";
import { BILLING_PLAN_CATALOG } from "@/lib/billing/plans";
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
};

describe("PricingPageClient (C-1002 · Figma 2:8841)", () => {
  it("loads plan prices, yearly discounts, quotas, and Paddle price IDs from config", async () => {
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

    // Config-sourced monthly prices
    expect(
      screen.getAllByText(`$${BILLING_PLAN_CATALOG.pro.monthlyPriceUsd}`).length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText(`$${BILLING_PLAN_CATALOG.team.monthlyPriceUsd}`).length,
    ).toBeGreaterThanOrEqual(1);

    // Config-sourced quotas in plan cards + comparison matrix
    expect(
      screen.getByText(
        `Up to ${FREE_PROJECT_LIMIT} active projects (1 published, 10 total retained)`,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`Up to ${FREE_PROJECT_LIMIT} active (1 live, 10 retained)`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`${FREE_MONTHLY_EXPORT_LIMIT}/mo · 1x (1,440 px, branded)`),
    ).toBeInTheDocument();

    // Paddle price config summary wired cleanly
    const paddleSummary = screen.getByTestId("paddle-config-summary");
    expect(paddleSummary).toHaveAttribute(
      "data-pro-monthly",
      "pri_pro_monthly_cfg",
    );
    expect(paddleSummary).toHaveAttribute(
      "data-team-yearly",
      "pri_team_yearly_cfg",
    );

    // Unauthenticated CTAs link to /sign-up with plan + interval
    const proUpgradeLink = screen.getByRole("link", { name: "Upgrade to Pro" });
    expect(proUpgradeLink).toHaveAttribute(
      "href",
      "/sign-up?plan=pro&interval=monthly",
    );

    // Switch to Yearly interval
    await user.click(screen.getAllByRole("button", { name: /^Yearly/i })[0]!);
    expect(
      screen.getAllByText(
        `$${BILLING_PLAN_CATALOG.pro.yearlyMonthlyEquivalentUsd}`,
      ).length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByRole("link", { name: "Upgrade to Pro" }),
    ).toHaveAttribute("href", "/sign-up?plan=pro&interval=yearly");
  });

  it("computes Teams Seat Calculator math client-side for 1..25 seats and 26+ capacity review with zero network calls", async () => {
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

    // Default calculator state: 3 seats monthly = $54/mo ($18 × 3)
    expect(screen.getByTestId("teams-calc-seat-count")).toHaveTextContent("3");
    expect(screen.getByTestId("teams-calc-headline-price")).toHaveTextContent("$54");
    expect(screen.getByTestId("teams-calc-disclaimer")).toHaveTextContent(
      "Before tax; this calculator saves nothing and charges nothing.",
    );

    // Select 5 seats preset -> $90/mo ($900/yr — save $180/yr)
    await user.click(screen.getByTestId("teams-calc-preset-5"));
    expect(screen.getByTestId("teams-calc-seat-count")).toHaveTextContent("5");
    expect(screen.getByTestId("teams-calc-headline-price")).toHaveTextContent("$90");
    expect(screen.getByTestId("teams-calc-billing-detail")).toHaveTextContent("$900/yr");

    // Select 26+ seats -> capacity review state
    await user.click(screen.getByTestId("teams-calc-preset-26"));
    expect(screen.getByTestId("teams-calc-capacity-review")).toHaveTextContent(
      "Capacity review required above 25 seats",
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
