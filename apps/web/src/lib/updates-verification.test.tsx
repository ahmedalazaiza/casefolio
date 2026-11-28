import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/dashboard",
}));

vi.mock("@/lib/account/actions", () => ({
  updateAccountProfileAction: vi.fn(async () => ({ ok: true as const })),
}));

import { ProfileSettingsPanel } from "@/components/account/profile-settings-panel";
import { MARKETING_NAV_ITEMS } from "@/components/layout/marketing-shell";
import { APP_NAV_ITEMS } from "@/components/layout/app-shell";
import { resolveTimeBasedTheme } from "@/components/theme-provider";
import { resolveActiveSpaceFilter } from "@/lib/workspaces/active-space";

describe("Navigation, time-based theme, spaces filter & avatar file upload updates", () => {
  it("resolves auto time-based theme as light during day (06:00-18:59) and dark at night", () => {
    expect(resolveTimeBasedTheme(new Date(2026, 10, 27, 6, 0, 0))).toBe("light");
    expect(resolveTimeBasedTheme(new Date(2026, 10, 27, 14, 30, 0))).toBe("light");
    expect(resolveTimeBasedTheme(new Date(2026, 10, 27, 18, 59, 0))).toBe("light");
    expect(resolveTimeBasedTheme(new Date(2026, 10, 27, 19, 0, 0))).toBe("dark");
    expect(resolveTimeBasedTheme(new Date(2026, 10, 27, 23, 45, 0))).toBe("dark");
    expect(resolveTimeBasedTheme(new Date(2026, 10, 27, 3, 15, 0))).toBe("dark");
  });

  it("sets marketing navbar to Home, Templates, Showcase (/showcase), Pricing without Features, and workspace sidebar includes Spaces", () => {
    expect(MARKETING_NAV_ITEMS).toEqual([
      { label: "Home", href: "/" },
      { label: "Templates", href: "/templates" },
      { label: "Showcase", href: "/showcase" },
      { label: "Pricing", href: "/pricing" },
    ]);
    expect(APP_NAV_ITEMS.some((item) => item.href === "/spaces")).toBe(true);
  });

  it("resolves active space filter safely across visible workspace spaces", () => {
    const spaces = [{ id: "sp-1" }, { id: "sp-2" }];
    expect(resolveActiveSpaceFilter(spaces, undefined)).toBe("all");
    expect(resolveActiveSpaceFilter(spaces, "all")).toBe("all");
    expect(resolveActiveSpaceFilter(spaces, "sp-2")).toBe("sp-2");
    expect(resolveActiveSpaceFilter(spaces, "sp-unknown")).toBe("all");
  });

  it("renders file upload input for profile avatars and removes the legacy Avatar image URL text field", () => {
    render(
      <ProfileSettingsPanel
        initialProfile={{
          name: "Ahmed Al-Azaiza",
          email: "ahmed@casefolio.app",
          emailVerified: true,
          image: null,
          initials: "AA",
          role: "admin",
          effectivePlan: "pro",
          jobTitle: "Founder",
          designFocus: "both",
        }}
      />,
    );

    expect(screen.getByTestId("profile-avatar-file-input")).toHaveAttribute("type", "file");
    expect(screen.queryByLabelText(/Avatar image URL/i)).not.toBeInTheDocument();
  });
});
