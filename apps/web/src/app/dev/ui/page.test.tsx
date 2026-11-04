import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DevUiPage from "@/app/dev/ui/page";
import { ThemeProvider } from "@/components/theme-provider";
import { COLOR_TOKENS, RADIUS_TOKENS, TYPE_SCALE_TOKENS } from "@/lib/design-tokens";

function mockMatchMedia() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe("/dev/ui design system showcase (C-102)", () => {
  it("renders all color tokens, type scale styles, radii, and Figma component variants", () => {
    mockMatchMedia();
    const { container } = render(
      <ThemeProvider defaultTheme="light" enableSystem={false}>
        <DevUiPage />
      </ThemeProvider>,
    );

    expect(
      screen.getByRole("heading", { name: "Casefolio UI Tokens & Components" }),
    ).toBeInTheDocument();

    for (const token of COLOR_TOKENS) {
      expect(screen.getByText(token.figmaName)).toBeInTheDocument();
    }
    for (const typeToken of TYPE_SCALE_TOKENS) {
      expect(screen.getByText(typeToken.name)).toBeInTheDocument();
    }
    for (const radToken of RADIUS_TOKENS) {
      expect(screen.getByText(radToken.figmaName)).toBeInTheDocument();
    }

    // Buttons across variants & sizes
    expect(screen.getByRole("button", { name: /Primary action/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Secondary" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ghost" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Inverse" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Danger" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disabled" })).toBeDisabled();

    // Badges incl. ProBadge & Tags
    expect(screen.getAllByText("Pro").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("All templates")).toBeInTheDocument();

    // InputField states (error & disabled)
    const invalidInput = screen.getByLabelText("Custom domain");
    expect(invalidInput).toHaveAttribute("aria-invalid", "true");
    expect(
      screen.getByText("Enter a valid domain name such as work.alex.design."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Workspace ID")).toBeDisabled();

    // Domain cards
    expect(container.querySelectorAll('[data-slot="project-card"]')).toHaveLength(3);
    expect(
      container.querySelector('[data-slot="project-card"][data-state="skeleton"]'),
    ).not.toBeNull();
    expect(container.querySelectorAll('[data-slot="template-type-card"]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-slot="plan-card"]')).toHaveLength(2);
    expect(
      container.querySelector('[data-slot="plan-card"][data-highlighted="true"]'),
    ).not.toBeNull();
  });
});

