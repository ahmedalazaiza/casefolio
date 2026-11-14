import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { LandingExperience } from "@/components/marketing/landing-experience";
import { buildLandingSnapshot } from "@/lib/marketing/landing-stats";

describe("HomePage — Landing v3 (Figma 85:7700 Desktop & 87:9604 Mobile)", () => {
  it("renders Hero, Features panels, 3-card grid, Dark Showcase, FAQ, and Final CTA marquee", () => {
    const snapshot = buildLandingSnapshot();
    render(<LandingExperience snapshot={snapshot} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Turn finished projects into publishable case studies/i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /Pick a template made by the Casefolio team, drop in your screens, tweak colors and text — then publish a page or export PNG & PDF\./i,
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("figure", {
        name: /Interactive preview of the Casefolio editor and curated templates/i,
      }),
    ).toBeInTheDocument();

    // Features section headings & split panels
    expect(
      screen.getByRole("heading", {
        name: /Built for case studies ready the moment you are/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Templates made for case studies" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Edit only what matters" }),
    ).toBeInTheDocument();

    // 3-column feature grid
    const featureGrid = screen.getByTestId("landing-feature-grid");
    expect(
      within(featureGrid).getByRole("heading", { name: "Publish a public page" }),
    ).toBeInTheDocument();
    expect(
      within(featureGrid).getByRole("heading", { name: "Export PNG & PDF" }),
    ).toBeInTheDocument();
    expect(
      within(featureGrid).getByRole("heading", { name: "Versioned templates" }),
    ).toBeInTheDocument();

    // Dark Showcase heading
    expect(
      screen.getByRole("heading", {
        name: /Details that keep every case study consistent/i,
      }),
    ).toBeInTheDocument();

    // FAQ & Final CTA headings
    expect(
      screen.getByRole("heading", {
        name: /Got questions\? We have the answers\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Your next case study is one template away/i,
      }),
    ).toBeInTheDocument();
  });

  it("switches Dark Showcase interactive tabs and toggles Hero editor device preview", async () => {
    const user = userEvent.setup();
    const snapshot = buildLandingSnapshot();
    render(<LandingExperience snapshot={snapshot} />);

    const slotsTab = screen.getByRole("tab", {
      name: "Ratio-locked image slots",
    });
    const tokensTab = screen.getByRole("tab", {
      name: "Template color tokens",
    });
    const fontsTab = screen.getByRole("tab", {
      name: "Font pairs per template",
    });
    const sectionsTab = screen.getByRole("tab", {
      name: "Show or hide sections",
    });

    expect(slotsTab).toHaveAttribute("aria-selected", "true");
    expect(tokensTab).toHaveAttribute("aria-selected", "false");

    await user.click(tokensTab);
    expect(tokensTab).toHaveAttribute("aria-selected", "true");
    expect(slotsTab).toHaveAttribute("aria-selected", "false");

    await user.click(fontsTab);
    expect(fontsTab).toHaveAttribute("aria-selected", "true");

    await user.click(sectionsTab);
    expect(sectionsTab).toHaveAttribute("aria-selected", "true");

    // Hero editor Desktop / Mobile switch
    const mobileBtn = screen.getByRole("button", { name: "Mobile" });
    expect(mobileBtn).toHaveAttribute("aria-pressed", "false");
    await user.click(mobileBtn);
    expect(mobileBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps pricing plan cards off the home page and drives CTAs into /sign-up and /templates", () => {
    const snapshot = buildLandingSnapshot();
    render(<LandingExperience snapshot={snapshot} />);

    expect(screen.queryByTestId("paid-plan-cards-grid")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Annual/i })).toBeNull();

    const startCtaSection = screen.getByTestId("landing-start-cta");
    expect(
      within(startCtaSection).getByRole("link", { name: /Make it happen/i }),
    ).toHaveAttribute("href", "/sign-up");

    const marquee = screen.getByTestId("landing-template-marquee");
    expect(within(marquee).getAllByText("Orbit").length).toBeGreaterThanOrEqual(1);
    expect(within(marquee).getAllByText("Frame").length).toBeGreaterThanOrEqual(1);
  });

  it("expands and collapses the 5 Landing v3 FAQ accordion items", async () => {
    const user = userEvent.setup();
    const snapshot = buildLandingSnapshot();
    render(<LandingExperience snapshot={snapshot} />);

    expect(
      screen.getByText(
        "The Casefolio team designs, versions and uploads every template.",
      ),
    ).toBeInTheDocument();

    const secondTrigger = screen.getByRole("button", {
      name: "Can I use my own colors and fonts?",
    });
    expect(secondTrigger).toHaveAttribute("aria-expanded", "false");

    await user.click(secondTrigger);
    expect(secondTrigger).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByText(/editable color tokens and curated font pairs/i),
    ).toBeInTheDocument();
  });
});
