import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SecuritySettingsPanel } from "@/components/account/security-settings-panel";

const { deleteAccountMock } = vi.hoisted(() => ({
  deleteAccountMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
}));

vi.mock("@/lib/account/actions", () => ({
  cancelScheduledAccountDeletionAction: vi.fn(async () => ({ ok: true })),
  deleteUserAccountAction: deleteAccountMock,
  revokeOtherUserSessionsAction: vi.fn(async () => ({ ok: true })),
  revokeUserSessionAction: vi.fn(async () => ({ ok: true })),
}));

describe("SecuritySettingsPanel — 2-Step Permanent Account Deletion", () => {
  beforeEach(() => {
    deleteAccountMock.mockReset();
    vi.restoreAllMocks();
  });

  it("walks through Step 1 (email -> send code) and Step 2 (6-digit code + checkboxes -> immediate delete)", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, deliveryChannel: "email" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, stepUpToken: "step-up-token-1234567890" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    deleteAccountMock.mockResolvedValue({ ok: true, deletedImmediately: true });

    render(
      <SecuritySettingsPanel
        email="ahmed@example.com"
        emailVerified
        hasPasswordAccount
        passwordUpdatedLabel="12 Nov 2026"
        googleConnected={false}
        projectsCount={4}
        publishedCount={2}
        sessions={[
          { id: "s1", deviceLabel: "Chrome · macOS", subLabel: "active now", isCurrent: true },
        ]}
        soleOwnedTeams={[
          {
            organizationId: "org-1",
            organizationName: "Orion Studio",
            otherMembersCount: 2,
            hasLiveSubscription: true,
          },
        ]}
      />,
    );

    await user.click(screen.getByTestId("open-delete-account-modal"));
    expect(screen.getByTestId("delete-step-email-form")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 2")).toBeInTheDocument();

    const sendBtn = screen.getByTestId("send-delete-code-btn");
    expect(sendBtn).toBeDisabled();

    await user.type(screen.getByLabelText(/Type ahmed@example.com/i), "ahmed@example.com");
    expect(sendBtn).toBeEnabled();
    await user.click(sendBtn);

    await screen.findByTestId("delete-step-verify-form");
    expect(screen.getByText("Step 2 of 2")).toBeInTheDocument();
    expect(screen.getByTestId("delete-sole-owned-teams-box")).toBeInTheDocument();

    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      "/api/account/step-up",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          action: "send_otp",
          purpose: "account_deletion",
          confirmEmail: "ahmed@example.com",
        }),
      }),
    );

    const submitBtn = screen.getByTestId("confirm-permanent-delete-btn");
    expect(submitBtn).toBeDisabled();

    await user.type(screen.getByTestId("delete-stepup-otp"), "123456");
    await user.click(screen.getByTestId("delete-permanent-ack-checkbox"));
    // Still disabled until sole-owned team dissolve checkbox is also checked
    expect(submitBtn).toBeDisabled();

    await user.click(screen.getByTestId("dissolve-owned-teams-checkbox"));
    expect(submitBtn).toBeEnabled();

    await user.click(submitBtn);
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenNthCalledWith(
        2,
        "/api/account/step-up",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            action: "verify_otp",
            purpose: "account_deletion",
            otp: "123456",
          }),
        }),
      );
      expect(deleteAccountMock).toHaveBeenCalledWith({
        confirmEmail: "ahmed@example.com",
        stepUpToken: "step-up-token-1234567890",
        dissolveOwnedTeams: true,
      });
    });
  });

  it("stays on Step 1 when code delivery fails and lets user go back via Change email", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: false,
            error: "Could not deliver confirmation code right now. Please try again shortly.",
          }),
          { status: 502, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, deliveryChannel: "email" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    render(
      <SecuritySettingsPanel
        email="ahmed@example.com"
        emailVerified
        hasPasswordAccount={false}
        passwordUpdatedLabel={null}
        googleConnected
        projectsCount={1}
        publishedCount={0}
        sessions={[
          { id: "s1", deviceLabel: "Chrome · macOS", subLabel: "active now", isCurrent: true },
        ]}
        soleOwnedTeams={[]}
      />,
    );

    await user.click(screen.getByTestId("open-delete-account-modal"));
    await user.type(screen.getByLabelText(/Type ahmed@example.com/i), "ahmed@example.com");
    await user.click(screen.getByTestId("send-delete-code-btn"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Could not deliver confirmation code right now/i,
    );
    expect(screen.getByTestId("delete-step-email-form")).toBeInTheDocument();

    // Retry succeeds and advances to Step 2, then user can jump back to Step 1
    await user.click(screen.getByTestId("send-delete-code-btn"));
    await screen.findByTestId("delete-step-verify-form");

    await user.click(screen.getByTestId("change-delete-email-btn"));
    expect(screen.getByTestId("delete-step-email-form")).toBeInTheDocument();
  });
});
