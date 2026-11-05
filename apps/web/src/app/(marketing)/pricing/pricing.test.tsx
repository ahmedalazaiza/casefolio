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
      screen.getByText(`$${BILLING_PLAN_CATALOG.pro.monthlyPriceUsd}`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`$${BILLING_PLAN_CATALOG.team.monthlyPriceUsd}`),
    ).toBeInTheDocument();

    // Config-sourced quotas in plan cards + comparison matrix
    expect(
      screen.getAllByText(`Up to ${FREE_PROJECT_LIMIT} projects`).length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByText(`${FREE_MONTHLY_EXPORT_LIMIT}/mo (watermarked)`),
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
    await user.click(screen.getByRole("button", { name: /Yearly/i }));
    expect(
      screen.getByText(
        `$${BILLING_PLAN_CATALOG.pro.yearlyMonthlyEquivalentUsd}`,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Upgrade to Pro" }),
    ).toHaveAttribute("href", "/sign-up?plan=pro&interval=yearly");
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
