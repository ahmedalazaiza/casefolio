import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { LandingExperience } from "@/components/marketing/landing-experience";
import { buildLandingSnapshot } from "@/lib/marketing/landing-stats";

describe("HomePage — Minimalist Split-Hero Experience & App-Launch CTAs", () => {
  it("renders all landing sections with real numbers and removes 'Trusted by designers from'", () => {
    const snapshot = buildLandingSnapshot();
    render(<LandingExperience snapshot={snapshot} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Turn finished UI screens into published case studies",
      }),
    ).toBeInTheDocument();

    // Verify "Trusted by designers from" section and gamification/XP are completely absent
    expect(screen.queryByText(/Trusted by designers from/i)).toBeNull();
    expect(screen.queryByText(/Studio Quest/i)).toBeNull();
    expect(screen.queryByText(/Studio XP/i)).toBeNull();
    expect(screen.queryByText(/\+20 XP/i)).toBeNull();

    expect(
      screen.getByRole("figure", {
        name: /Interactive preview of the Casefolio/i,
      }),
    ).toBeInTheDocument();

    // Core section headings
    expect(
      screen.getByRole("heading", {
        name: "From finished UI to published case study in four steps",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Start from a case study structure that already works",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Structured editing, without formatting busywork",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "One case study, ready for live links, Behance, and PDFs",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Ready to publish your next case study?",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Common questions, answered",
      }),
    ).toBeInTheDocument();

    // Real published template names rendered
    expect(screen.getAllByText("Cinema").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Orbit").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Meridian").length).toBeGreaterThanOrEqual(1);
  });

  it("renders 4 horizontal How It Works cards, up to 6 templates (3 per row) with Browse all templates CTA, and public URL state toggle", async () => {
    const user = userEvent.setup();
    const baseSnapshot = buildLandingSnapshot();
    const extraTemplates = [
      ...baseSnapshot.templates,
      {
        ...baseSnapshot.templates[0]!,
        slug: "extra-seven",
        name: "Extra Seven",
      },
      {
        ...baseSnapshot.templates[1]!,
        slug: "extra-eight",
        name: "Extra Eight",
      },
    ];
    const snapshot = buildLandingSnapshot(extraTemplates);
    render(<LandingExperience snapshot={snapshot} />);

    // Hero frame renders crisp high-resolution editor images instead of an HTML form mockup
    const heroFigure = screen.getByRole("figure", {
      name: /Interactive preview of the Casefolio/i,
    });
    const heroImages = heroFigure.querySelectorAll("img");
    expect(heroImages.length).toBe(2);
    expect(heroImages[0]).toHaveAttribute("src", "/landing/hero-editor-light.png");
    expect(heroImages[1]).toHaveAttribute("src", "/landing/hero-editor-dark.png");

    // How it works: 4 horizontal cards in one row (lg:grid-cols-4)
    const howItWorksStage = screen.getByTestId("how-it-works-stage");
    expect(howItWorksStage.className).toContain("lg:grid-cols-4");
    expect(screen.getByTestId("how-it-works-step-1")).toBeInTheDocument();
    expect(screen.getByTestId("how-it-works-step-2")).toBeInTheDocument();
    expect(screen.getByTestId("how-it-works-step-3")).toBeInTheDocument();
    expect(screen.getByTestId("how-it-works-step-4")).toBeInTheDocument();

    // Templates showcase: max 6 cards shown on home page in a 3-column row + Browse all templates link
    const templateShowcase = screen.getByTestId("landing-template-showcase");
    expect(templateShowcase.className).toContain("lg:grid-cols-3");
    expect(templateShowcase.querySelectorAll("[data-stack-card]")).toHaveLength(6);
    expect(screen.queryByRole("heading", { name: "Extra Seven" })).toBeNull();
    expect(
      screen.getByRole("link", { name: /Browse all templates/i }),
    ).toHaveAttribute("href", "/templates");

    // Toggle public URL preview state
    await user.click(
      screen.getByRole("button", { name: /Preview live public URL state/i }),
    );
    expect(screen.getByText(/Published · Live/i)).toBeInTheDocument();
  });

  it("replaces home-page pricing cards with direct CTA actions driving into the app while linking to separate /pricing", () => {
    const snapshot = buildLandingSnapshot();
    render(<LandingExperience snapshot={snapshot} />);

    // Pricing plan cards live separately on /pricing — never rendered on /
    expect(screen.queryByTestId("paid-plan-cards-grid")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Annual/i })).toBeNull();

    const startCtaSection = screen.getByTestId("landing-start-cta");
    expect(
      within(startCtaSection).getByRole("link", { name: /^Start free/i }),
    ).toHaveAttribute("href", "/sign-up");
    expect(
      within(startCtaSection).getByRole("link", { name: /Choose a template/i }),
    ).toHaveAttribute("href", "/templates");
    expect(
      within(startCtaSection).getByRole("link", { name: /View pricing plans/i }),
    ).toHaveAttribute("href", "/pricing");

    const startActions = screen.getByTestId("landing-start-actions");
    expect(
      within(startActions).getByRole("link", {
        name: /Create your free workspace/i,
      }),
    ).toHaveAttribute("href", "/sign-up");
    expect(
      within(startActions).getByRole("link", {
        name: /Start with the Cinema template/i,
      }),
    ).toHaveAttribute("href", "/new?template=cinema");
  });

  it("expands and collapses FAQ accordion items", async () => {
    const user = userEvent.setup();
    const snapshot = buildLandingSnapshot();
    render(<LandingExperience snapshot={snapshot} />);

    expect(
      screen.getByText(
        /The Casefolio team designs, maintains, and versions every template/i,
      ),
    ).toBeInTheDocument();

    const secondTrigger = screen.getByRole("button", {
      name: "Can I use my own colors, fonts, and custom domain?",
    });
    expect(secondTrigger).toHaveAttribute("aria-expanded", "false");

    await user.click(secondTrigger);
    expect(secondTrigger).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByText(/Plus also includes custom domains/i),
    ).toBeInTheDocument();
  });
});
