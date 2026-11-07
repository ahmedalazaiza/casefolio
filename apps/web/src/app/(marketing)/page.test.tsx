import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { LandingExperience } from "@/components/marketing/landing-experience";
import { BILLING_PLAN_CATALOG } from "@/lib/billing/plans";
import { buildLandingSnapshot } from "@/lib/marketing/landing-stats";

describe("HomePage — Clean Studio Experience & Real Platform Metrics", () => {
  it("renders all landing sections with real numbers and removes 'Trusted by designers from'", () => {
    const snapshot = buildLandingSnapshot();
    render(<LandingExperience snapshot={snapshot} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Turn finished projects into publishable case studies",
      }),
    ).toBeInTheDocument();

    // Verify "Trusted by designers from" section and gamification/XP are completely absent
    expect(screen.queryByText(/Trusted by designers from/i)).toBeNull();
    expect(screen.queryByText(/Studio Quest/i)).toBeNull();
    expect(screen.queryByText(/Studio XP/i)).toBeNull();
    expect(screen.queryByText(/\+20 XP/i)).toBeNull();

    expect(
      screen.getByRole("figure", {
        name: /Casefolio editor preview/i,
      }),
    ).toBeInTheDocument();

    // Core section headings
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

    // Real published template names rendered
    expect(screen.getAllByText("Cinema").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Orbit").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Meridian").length).toBeGreaterThanOrEqual(1);
  });

  it("supports interactive editor preview, 4-step workflow selector, and public URL state toggle", async () => {
    const user = userEvent.setup();
    const snapshot = buildLandingSnapshot();
    render(<LandingExperience snapshot={snapshot} />);

    // Switch live template tab in hero editor
    await user.click(screen.getByRole("tab", { name: /Orbit · Mobile App/i }));
    expect(
      screen.getByText(/Orbit — Calm debt & wallet planner/i),
    ).toBeInTheDocument();

    // Switch color token palette
    await user.click(screen.getByRole("button", { name: /Emerald Signal/i }));

    // Snap missing screenshot into slot
    await user.click(
      screen.getByRole("button", { name: /Snap screen into slot/i }),
    );
    expect(
      screen.getByText(/Pre-publish check passed/i),
    ).toBeInTheDocument();

    // Switch 4-step workflow step
    await user.click(screen.getByRole("button", { name: /02 Pick a template/i }));
    expect(screen.getByText(/Step 02 of 04/i)).toBeInTheDocument();

    // Toggle public URL preview state
    await user.click(
      screen.getByRole("button", { name: /Preview live public URL state/i }),
    );
    expect(screen.getByText(/Published · Live/i)).toBeInTheDocument();
  });

  it("toggles pricing between monthly and yearly prices from BILLING_PLAN_CATALOG", async () => {
    const user = userEvent.setup();
    const snapshot = buildLandingSnapshot();
    render(<LandingExperience snapshot={snapshot} />);

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
    const snapshot = buildLandingSnapshot();
    render(<LandingExperience snapshot={snapshot} />);

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
    expect(screen.getByText(/curated theme tokens/i)).toBeInTheDocument();
  });
});
