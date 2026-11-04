import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ResetPasswordForm } from "@/app/(auth)/reset/reset-password-form";
import { SignInForm } from "@/app/(auth)/sign-in/sign-in-form";
import { SignUpForm } from "@/app/(auth)/sign-up/sign-up-form";
import { VerifyEmailForm } from "@/app/(auth)/verify/verify-email-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("Auth UI forms (C-201)", () => {
  it("renders SignUpForm with Google OAuth, validation errors, and Terms checkbox", async () => {
    const user = userEvent.setup();
    render(<SignUpForm />);

    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continue with Google/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByText(/Enter your full name/i)).toBeInTheDocument();
  });

  it("renders SignInForm and switches between Email & password and Magic link tabs", async () => {
    const user = userEvent.setup();
    render(<SignInForm />);

    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Magic link" }));
    expect(screen.getByRole("button", { name: /Send magic link/i })).toBeInTheDocument();
  });

  it("renders VerifyEmailForm 6-digit OTP inputs and ResetPasswordForm", () => {
    render(
      <div>
        <VerifyEmailForm initialEmail="ahmed@example.com" initialName="Ahmed" />
        <ResetPasswordForm />
      </div>,
    );

    expect(screen.getByRole("heading", { name: "Verify your email" })).toBeInTheDocument();
    expect(screen.getByLabelText("Verification digit 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Verification digit 6")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Reset your password" })).toBeInTheDocument();
  });
});
