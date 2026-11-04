import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OnboardingWizard } from "@/app/onboarding/onboarding-wizard";

const pushMock = vi.fn();
const refreshMock = vi.fn();
const completeActionMock = vi.fn().mockResolvedValue({ ok: true });
const skipActionMock = vi.fn().mockResolvedValue({ ok: true });

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}));

vi.mock("@/lib/auth/onboarding-actions", () => ({
  completeOnboardingAction: (...args: unknown[]) => completeActionMock(...args),
  skipOnboardingAction: (...args: unknown[]) => skipActionMock(...args),
}));

describe("Onboarding 3-step wizard UI (C-203)", () => {
  it("walks through Step 1 (Role) -> Step 2 (What you present) -> Step 3 (Profile) and saves profile", async () => {
    const user = userEvent.setup();

    render(
      <OnboardingWizard initialName="Ahmed Al-Azaiza" initialEmail="ahmed@casefolio.app" />,
    );

    // Step 1: Role selection
    expect(
      screen.getByRole("heading", { name: "What best describes you?" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Web designer/i }));
    await user.click(screen.getByRole("button", { name: /Continue/i }));

    // Step 2: What you present (Web designer preselected Website; also select Mobile app -> "both")
    expect(
      screen.getByRole("heading", { name: "What will you present first?" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Mobile app/i }));
    await user.click(screen.getByRole("button", { name: /Continue/i }));

    // Step 3: Public profile
    expect(
      screen.getByRole("heading", { name: "Set up your public profile" }),
    ).toBeInTheDocument();

    const headlineInput = screen.getByLabelText("Headline");
    expect(headlineInput).toHaveValue("Web designer");

    await user.clear(headlineInput);
    await user.type(headlineInput, "Lead Product & Web Designer");

    await user.click(screen.getByRole("button", { name: /Continue/i }));

    expect(completeActionMock).toHaveBeenCalledWith({
      name: "Ahmed Al-Azaiza",
      jobTitle: "Lead Product & Web Designer",
      designFocus: "both",
      image: null,
    });
    expect(pushMock).toHaveBeenCalledWith("/dashboard?welcome=1");
  });
});

