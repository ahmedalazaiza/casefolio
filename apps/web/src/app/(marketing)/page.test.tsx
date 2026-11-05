import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { BILLING_PLAN_CATALOG } from "@/lib/billing/plans";
import HomePage from "./page";

describe("HomePage (Figma 27:6665)", () => {
  it("renders all 13 Figma landing sections with CTAs and template showcases", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Turn finished projects into publishable case studies",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("figure", {
        name: /Casefolio editor preview/i,
      }),
    ).toBeInTheDocument();

    // Core section headings matching Figma 27:6666
    expect(
      screen.getByRole("heading", {
        name: "Case studies take longer than the project",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "From finished UI to case study in four steps",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Templates for what you actually design",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Start from a layout that already works",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "A full editor, without the busywork",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "One case study, everywhere you need it",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Know who is reading your work",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Simple plans for every designer",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Designers ship case studies faster",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Questions, answered",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Your next case study is one template away",
      }),
    ).toBeInTheDocument();
  });

  it("toggles pricing between monthly and yearly prices from BILLING_PLAN_CATALOG", async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    expect(
      screen.getByText(`$${BILLING_PLAN_CATALOG.pro.monthlyPriceUsd}`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`$${BILLING_PLAN_CATALOG.team.monthlyPriceUsd}`),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Yearly/i }));

    expect(
      screen.getByText(
        `$${BILLING_PLAN_CATALOG.pro.yearlyMonthlyEquivalentUsd}`,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        `$${BILLING_PLAN_CATALOG.team.yearlyMonthlyEquivalentUsd}`,
      ),
    ).toBeInTheDocument();
  });

  it("expands and collapses FAQ accordion items", async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    // First FAQ item is open by default per Figma 29:6922
    expect(
      screen.getByText(
        /The Casefolio team designs, versions and uploads every template/i,
      ),
    ).toBeInTheDocument();

    const secondTrigger = screen.getByRole("button", {
      name: "Can I use my own colors and fonts?",
    });
    expect(secondTrigger).toHaveAttribute("aria-expanded", "false");

    await user.click(secondTrigger);
    expect(secondTrigger).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByText(/curated theme tokens/i),
    ).toBeInTheDocument();
  });
});
