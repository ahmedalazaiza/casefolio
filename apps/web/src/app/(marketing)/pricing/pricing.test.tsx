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

describe("PricingPageClient (3 Cards: Free Left · Pro Most Popular · Teams Dynamic Seats + 3-Tier Matrix)", () => {
  it("renders Free, Pro (Most popular), and Teams in a 3-card row with dynamic seat pricing and Annual total headline prices", async () => {
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

    const cardsGrid = screen.getByTestId("paid-plan-cards-grid");
    const freeCard = within(cardsGrid).getByTestId("plan-card-free");
    const proCard = within(cardsGrid).getByTestId("plan-card-pro");
    const teamCard = within(cardsGrid).getByTestId("plan-card-team");

    // Wide Free bottom strip is removed; Free sits first on the left of the 3-card grid
    expect(screen.queryByTestId("free-onboarding-callout")).not.toBeInTheDocument();
    expect(within(cardsGrid).queryByTestId("plan-card-plus")).not.toBeInTheDocument();
    expect(
      freeCard.compareDocumentPosition(proCard) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      proCard.compareDocumentPosition(teamCard) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // Pro is Most popular (highlighted); Teams & Free are not
    expect(proCard).toHaveAttribute("data-highlighted", "true");
    expect(within(proCard).getByText(/Most popular/i)).toBeInTheDocument();
    expect(teamCard).toHaveAttribute("data-highlighted", "false");
    expect(within(teamCard).queryByText(/Most popular/i)).not.toBeInTheDocument();

    // Monthly big headline prices ($0 Free, $7.99 Pro, $17.97 Teams for default 3 seats)
    expect(within(freeCard).getByTestId("plan-card-price")).toHaveTextContent("$0");
    expect(within(proCard).getByTestId("plan-card-price")).toHaveTextContent(
      formatUsdFromCents(BILLING_PLAN_CATALOG.pro.monthlyPriceCents),
    );
    expect(within(teamCard).getByTestId("plan-card-price")).toHaveTextContent("$17.97");
    expect(within(teamCard).getByTestId("plan-card-period")).toHaveTextContent("/mo");

    // Incrementing & decrementing Teams card seats updates the big headline price live
    await user.click(within(teamCard).getByTestId("team-card-seats-increment"));
    expect(within(teamCard).getByTestId("team-card-seats-value")).toHaveTextContent("4");
    expect(within(teamCard).getByTestId("plan-card-price")).toHaveTextContent("$23.96");

    await user.click(within(teamCard).getByTestId("team-card-seats-decrement"));
    await user.click(within(teamCard).getByTestId("team-card-seats-decrement"));
    expect(within(teamCard).getByTestId("team-card-seats-value")).toHaveTextContent("2");
    expect(within(teamCard).getByTestId("plan-card-price")).toHaveTextContent("$11.98");

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

    const freeStartLink = within(freeCard).getByRole("link", { name: /Start free/i });
    const teamStartLink = within(teamCard).getByRole("link", { name: /Start Teams plan/i });
    expect(proUpgradeLink.className).toContain("bg-[var(--cf-lp-lime)]");
    expect(freeStartLink.className).not.toContain("bg-[var(--cf-lp-lime)]");
    expect(teamStartLink.className).not.toContain("bg-[var(--cf-lp-lime)]");
    expect(freeStartLink.className).toContain("bg-[var(--cf-lp-plan-btn-bg)]");
    expect(teamStartLink.className).toContain("bg-[var(--cf-lp-plan-btn-bg)]");
    expect(proCard.className).toContain("lg:grid-rows-subgrid");

    // Switching to Annual displays the annual subscription total right in the big headline prices
    await user.click(screen.getAllByRole("button", { name: /^Annual/i })[0]!);
    expect(within(proCard).getByTestId("plan-card-price")).toHaveTextContent(
      formatUsdFromCents(BILLING_PLAN_CATALOG.pro.yearlyTotalCents),
    );
    expect(within(proCard).getByTestId("plan-card-period")).toHaveTextContent("/yr");
    expect(within(teamCard).getByTestId("plan-card-price")).toHaveTextContent("$119.80");
    expect(within(teamCard).getByTestId("plan-card-period")).toHaveTextContent("/yr");

    // Changing Teams seats while Annual is selected updates the annual big headline price ($179.70 for 3 seats)
    await user.click(within(teamCard).getByTestId("team-card-seats-increment"));
    expect(within(teamCard).getByTestId("plan-card-price")).toHaveTextContent("$179.70");

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

  it("removes the standalone seat calculator & pricing FAQ section while supporting Teams stepper in-card with zero network calls", async () => {
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

    expect(screen.queryByTestId("teams-calc-seat-count")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Plans, seats &/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Billing FAQ/i })).toHaveAttribute("href", "/faq");

    const cardsGrid = screen.getByTestId("paid-plan-cards-grid");
    const teamCard = within(cardsGrid).getByTestId("plan-card-team");

    expect(within(teamCard).getByTestId("team-card-seats-value")).toHaveTextContent("3");
    expect(within(teamCard).getByTestId("plan-card-price")).toHaveTextContent("$17.97");

    await user.click(within(teamCard).getByTestId("team-card-seats-increment"));
    await user.click(within(teamCard).getByTestId("team-card-seats-increment"));
    expect(within(teamCard).getByTestId("team-card-seats-value")).toHaveTextContent("5");
    expect(within(teamCard).getByTestId("plan-card-price")).toHaveTextContent("$29.95");

    // Switching interval to Annual puts the annual total ($299.50 / year) in the big headline price
    await user.click(screen.getAllByRole("button", { name: /^Annual/i })[0]!);
    expect(within(teamCard).getByTestId("plan-card-price")).toHaveTextContent("$299.50");

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
