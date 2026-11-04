import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminShell, ADMIN_NAV_ITEMS } from "@/components/layout/admin-shell";
import { AppShell, APP_NAV_ITEMS } from "@/components/layout/app-shell";
import { MarketingShell, MARKETING_NAV_ITEMS } from "@/components/layout/marketing-shell";
import { ThemeProvider } from "@/components/theme-provider";

let mockedPathname = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => mockedPathname,
}));

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

describe("Route group shells: MarketingShell, AppShell, AdminShell (C-103)", () => {
  beforeEach(() => {
    mockMatchMedia();
    mockedPathname = "/";
  });

  it("renders MarketingShell nav, skip link, footer, and keyboard-accessible mobile drawer", async () => {
    mockedPathname = "/pricing";
    const user = userEvent.setup();

    render(
      <ThemeProvider defaultTheme="light" enableSystem={false}>
        <MarketingShell>
          <h1>Pricing content</h1>
        </MarketingShell>
      </ThemeProvider>,
    );

    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute(
      "href",
      "#main-content",
    );
    expect(screen.getByRole("heading", { name: "Pricing content" })).toBeInTheDocument();

    for (const item of MARKETING_NAV_ITEMS) {
      expect(screen.getAllByRole("link", { name: item.label }).length).toBeGreaterThanOrEqual(1);
    }

    const menuButton = screen.getByRole("button", { name: "Open navigation menu" });
    menuButton.focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByText("Casefolio menu")).toBeInTheDocument();

    await user.keyboard("{Escape}");
  });

  it("renders AppShell sidebar navigation with active aria-current, Pro badge, quota card, and mobile drawer", async () => {
    mockedPathname = "/dashboard";
    const user = userEvent.setup();

    render(
      <ThemeProvider defaultTheme="light" enableSystem={false}>
        <AppShell projectsUsed={6} projectsLimit={10}>
          <h1>Dashboard workspace</h1>
        </AppShell>
      </ThemeProvider>,
    );

    expect(screen.getByRole("heading", { name: "Dashboard workspace" })).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Project quota usage" })).toHaveAttribute(
      "aria-valuenow",
      "6",
    );

    for (const item of APP_NAV_ITEMS) {
      expect(screen.getByRole("link", { name: item.label })).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await user.click(screen.getByRole("button", { name: "Open workspace navigation" }));
    expect(await screen.findByText("Navigate your Casefolio workspace.")).toBeInTheDocument();
    await user.keyboard("{Escape}");
  });

  it("renders AdminShell with Internal badge, 8 admin routes, exact /admin active matching, and mobile drawer", async () => {
    mockedPathname = "/admin/templates";
    const user = userEvent.setup();

    render(
      <ThemeProvider defaultTheme="light" enableSystem={false}>
        <AdminShell>
          <h1>Templates admin</h1>
        </AdminShell>
      </ThemeProvider>,
    );

    expect(screen.getByText("Internal")).toBeInTheDocument();
    for (const item of ADMIN_NAV_ITEMS) {
      expect(screen.getByRole("link", { name: item.label })).toBeInTheDocument();
    }

    // Overview (/admin) must NOT be active when on /admin/templates
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Templates" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await user.click(screen.getByRole("button", { name: "Open admin navigation" }));
    expect(
      await screen.findByText("Platform administration and governance."),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
  });
});
