import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { LandingExperience } from "@/components/marketing/landing-experience";
import { LandingFaqAccordion } from "@/components/marketing/landing-faq-accordion";
import { DEFAULT_SITE_CMS_CONTENT } from "@/lib/cms/schema";
import { buildLandingSnapshot } from "@/lib/marketing/landing-stats";

describe("HomePage — Editorial Studio Landing Page", () => {
  it("renders Acid Lime Hero, Trust strip, Better Way, Templates, Publish channels, Showcase, 3 Pricing Packages, and Test the Canvas CTA", () => {
    const snapshot = buildLandingSnapshot();
    render(<LandingExperience snapshot={snapshot} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Great work deserves\s+a great story\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Free to start · No credit card required/i)).toBeInTheDocument();

    expect(
      screen.getByRole("figure", {
        name: /Interactive preview of the Casefolio case-study editor/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(".Cinema — Ticket Booking"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("editor-canvas-preview")).toBeInTheDocument();

    // Better Way (without leading section number)
    expect(screen.queryByText(/01\s+The better way/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /Your portfolio shouldn’t be another project\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Structure that guides" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Screens that behave" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Publish it anywhere" })).toBeInTheDocument();

    // Templates
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /Designed to tell different stories\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("The App Story")).toBeInTheDocument();
    expect(screen.getByText("The Digital Experience")).toBeInTheDocument();
    expect(screen.getByText("The System Story")).toBeInTheDocument();

    // Publish Channels
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /Publish once\.\s*Show up anywhere\./i,
      }),
    ).toBeInTheDocument();

    // Showcase (2-line headline without 04)
    expect(screen.queryByText(/04\s+MADE WITH CASEFOLIO/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /Stories worth\s+stopping for\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Moving cities forward.")).toBeInTheDocument();
    expect(screen.getByText("Built to belong.")).toBeInTheDocument();
    expect(screen.getByText("Small rituals. Real change.")).toBeInTheDocument();

    // Start with your best work: 3 pricing packages (Free, Pro, Teams) without 4-box specs
    const grid = screen.getByTestId("paid-plan-cards-grid");
    expect(within(grid).getByTestId("plan-card-free")).toBeInTheDocument();
    expect(within(grid).getByTestId("plan-card-pro")).toBeInTheDocument();
    expect(within(grid).getByTestId("plan-card-team")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Compare all plans/i })).toHaveAttribute(
      "href",
      "/pricing#plan-comparison",
    );

    // Bottom Test the canvas CTA (FAQs moved to /faq)
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /Test the canvas before paying a single cent\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Can I use my own brand styles\?/i })).not.toBeInTheDocument();
  });

  it("interacts with real Studio Builder Hero controls (sections, styles, fields, viewport) and supports custom CMS image override", async () => {
    const user = userEvent.setup();
    const snapshot = buildLandingSnapshot();
    const { rerender } = render(<LandingExperience snapshot={snapshot} />);

    // Left panel section outline switching selects section & updates right inspector
    const overviewBtn = screen.getByRole("button", { name: /02\s*Cinema booking is broken\./i });
    await user.click(overviewBtn);
    expect(screen.getByDisplayValue("01 · OVERVIEW")).toBeInTheDocument();

    // Editing Eyebrow field updates the real live .Cinema canvas section immediately
    const eyebrowInput = screen.getByLabelText("Eyebrow");
    await user.clear(eyebrowInput);
    await user.type(eyebrowInput, "01 · LIVE STUDIO EDIT");
    expect(screen.getByText("01 · LIVE STUDIO EDIT")).toBeInTheDocument();

    // Switching left tab to Style exposes curated presets from ThemePanel & syncs gradient canvas
    await user.click(screen.getByRole("tab", { name: "Style" }));
    const indigoBtn = screen.getByRole("button", { name: /Indigo Studio/i });
    await user.click(indigoBtn);
    expect(indigoBtn).toHaveAttribute("aria-pressed", "true");
    const canvasPreview = screen.getByTestId("editor-canvas-preview");
    expect(canvasPreview.querySelectorAll('[data-slot-state="gradient"]').length).toBeGreaterThan(0);
    expect(canvasPreview.querySelector('img[src*="/templates/cinema/"]')).toBeNull();

    // Hero Mobile/Desktop toggle updates live canvas viewport attribute
    const mobileBtn = screen.getByRole("button", { name: /^Mobile$/i });
    expect(mobileBtn).toHaveAttribute("aria-pressed", "false");
    await user.click(mobileBtn);
    expect(mobileBtn).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("editor-canvas-preview")).toHaveAttribute("data-viewport", "mobile");

    // Preview, Export, and Publish topbar actions route visitors to sign-up / login
    expect(
      screen.getByRole("link", { name: /Preview case study — register or log in/i }),
    ).toHaveAttribute("href", "/sign-up?template=cinema");
    expect(
      screen.getByRole("link", { name: /Export case study — register or log in/i }),
    ).toHaveAttribute("href", "/sign-up?template=cinema");
    expect(
      screen.getByRole("link", { name: /Publish case study — register or log in/i }),
    ).toHaveAttribute("href", "/sign-up?template=cinema");

    // Publishing Channel Switcher
    const liveTab = screen.getByRole("tab", { name: "Live site" });
    const pdfTab = screen.getByRole("tab", { name: "PDF" });
    const pngTab = screen.getByRole("tab", { name: "PNG" });
    const layeratTab = screen.getByRole("tab", { name: "Layerat" });

    expect(layeratTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("mono-layerat-full-case-study.zip")).toBeInTheDocument();

    await user.click(liveTab);
    expect(liveTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("https://casefolio.app/p/mono-finance")).toBeInTheDocument();

    await user.click(pdfTab);
    expect(pdfTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("mono-case-study-a4.pdf")).toBeInTheDocument();

    await user.click(pngTab);
    expect(pngTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("mono-presentation-2x.png")).toBeInTheDocument();

    // Uploading heroMockupImageUrl in Admin CMS switches Hero frame to custom image only
    rerender(
      <LandingExperience
        snapshot={snapshot}
        cms={{
          ...DEFAULT_SITE_CMS_CONTENT.landing,
          heroMockupImageUrl: "/cdn/cms/hero-preview.png",
        }}
      />,
    );
    const customFrame = screen.getByTestId("hero-custom-image-frame");
    expect(customFrame.querySelector("img")).toHaveAttribute(
      "src",
      "/cdn/cms/hero-preview.png",
    );
    expect(screen.queryByTestId("hero-builder-preview")).not.toBeInTheDocument();
  });

  it("wires hero, showcase, and template CTAs into /sign-up, #showcase, /showcase, and /templates", () => {
    const snapshot = buildLandingSnapshot();
    render(<LandingExperience snapshot={snapshot} />);

    const primaryCta = screen.getByRole("link", { name: /Create your first case study/i });
    expect(primaryCta).toHaveAttribute("href", "/sign-up");
    expect(primaryCta.className).toContain("bg-[var(--cf-lp-dark)]");
    expect(primaryCta.className).toContain("text-[var(--cf-lp-dark-ink)]");

    const secondaryCta = screen.getByRole("link", { name: /Explore the showcase/i });
    expect(secondaryCta).toHaveAttribute("href", "#showcase");
    expect(secondaryCta.className).toContain("bg-[var(--cf-lp-hero-sec-bg)]");
    expect(secondaryCta.className).toContain("text-[var(--cf-lp-on-lime)]");

    const heroSection = primaryCta.closest("section");
    expect(heroSection?.className).toContain("cf-lp-hero-grid");
    expect(
      screen.getByRole("link", { name: /View all case studies in Showcase/i }),
    ).toHaveAttribute("href", "/showcase");
    expect(screen.getByRole("link", { name: /Browse all templates/i })).toHaveAttribute(
      "href",
      "/templates",
    );
    const startFreeLinks = screen.getAllByRole("link", { name: /^Start free$/i });
    expect(startFreeLinks.length).toBeGreaterThanOrEqual(2);
    for (const link of startFreeLinks) {
      expect(link).toHaveAttribute("href", "/sign-up");
    }
  });

  it("expands and collapses the FAQ accordion items on the FAQ component", async () => {
    const user = userEvent.setup();
    render(<LandingFaqAccordion items={DEFAULT_SITE_CMS_CONTENT.landing.faqItems} />);

    const firstTrigger = screen.getByRole("button", { name: /Can I use my own brand styles\?/i });
    const secondTrigger = screen.getByRole("button", { name: /What can I export\?/i });

    expect(firstTrigger).toHaveAttribute("aria-expanded", "true");
    expect(secondTrigger).toHaveAttribute("aria-expanded", "false");

    await user.click(secondTrigger);
    expect(secondTrigger).toHaveAttribute("aria-expanded", "true");
    expect(firstTrigger).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.getByText(/Export your full case study to Layerat.*selectable-text PDF/i),
    ).toBeInTheDocument();
  });
});
