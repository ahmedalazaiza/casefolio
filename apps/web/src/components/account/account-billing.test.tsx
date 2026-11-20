import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountSettingsShell } from "@/components/account/account-settings-shell";
import { BillingSettingsPanel } from "@/components/account/billing-settings-panel";
import type { UserBillingOverview } from "@/lib/billing/service";

const refreshMock = vi.fn();
const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: refreshMock,
    push: pushMock,
  }),
}));

const FREE_OVERVIEW: UserBillingOverview = {
  effectivePlan: "free",
  environment: "sandbox",
  hasLivePaddlePortal: false,
  subscription: null,
  invoices: [],
};

const PRO_ACTIVE_OVERVIEW: UserBillingOverview = {
  effectivePlan: "pro",
  environment: "sandbox",
  hasLivePaddlePortal: false,
  subscription: {
    id: "sub-row-1",
    paddleCustomerId: "ctm_sdbx_123",
    paddleSubscriptionId: "sub_sdbx_123",
    plan: "pro",
    interval: "monthly",
    status: "active",
    currentPeriodEndIso: "2026-12-05T12:00:00.000Z",
    paymentBrand: "VISA",
    paymentLast4: "4242",
    paymentExpiry: "08/29",
  },
  invoices: [
    {
      id: "evt_sdbx_001",
      invoiceNumber: "INV-2026-ABCDEF",
      occurredAtIso: "2026-11-05T12:00:00.000Z",
      planLabel: "Pro · Monthly",
      amountUsd: 12,
      status: "paid",
      receiptUrl: "/api/paddle/invoices/evt_sdbx_001",
    },
  ],
};

describe("AccountSettingsShell & BillingSettingsPanel (C-703)", () => {
  beforeEach(() => {
    refreshMock.mockReset();
    pushMock.mockReset();
    vi.restoreAllMocks();
  });

  it("renders AccountSettingsShell navigation with aria-current on the active tab", () => {
    render(
      <AccountSettingsShell activeTab="billing">
        <div>Billing content</div>
      </AccountSettingsShell>,
    );

    expect(screen.getByTestId("account-tab-profile")).toHaveAttribute("href", "/account");
    expect(screen.getByTestId("account-tab-security")).toHaveAttribute(
      "href",
      "/account/security",
    );
    expect(screen.getByTestId("account-tab-billing")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByTestId("account-tab-invoices")).toHaveAttribute(
      "href",
      "/account/invoices",
    );
    expect(screen.getByTestId("account-tab-team")).toHaveAttribute(
      "href",
      "/account/team",
    );
  });

  it("shows Free state and opens the Change Plan picker with Monthly/Yearly pricing", async () => {
    const user = userEvent.setup();

    render(
      <BillingSettingsPanel
        overview={FREE_OVERVIEW}
        accountName="Ahmed Al-Azaiza"
        accountEmail="ahmed@example.com"
      />,
    );

    expect(screen.getByTestId("billing-current-plan-title")).toHaveTextContent("Free");
    expect(screen.getByTestId("billing-upgrade-pro-btn")).toBeInTheDocument();

    await user.click(screen.getByTestId("open-change-plan-modal"));
    expect(screen.getByTestId("change-plan-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("plan-card-pro")).toHaveTextContent("$7.99");
    expect(screen.getByTestId("plan-card-pro")).toHaveTextContent("Most popular");
    expect(screen.getByTestId("plan-card-team")).toHaveTextContent("$5.99");
    expect(screen.queryByTestId("plan-card-plus")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("picker-interval-yearly"));
    expect(screen.getByTestId("plan-card-pro")).toHaveTextContent("$79.90");
    expect(screen.getByTestId("plan-card-pro")).toHaveTextContent("($6.66/mo");
    expect(screen.getByTestId("plan-card-team")).toHaveTextContent("$59.90");
    expect(screen.getByTestId("plan-card-team")).toHaveTextContent("($4.99/seat/mo");
  });

  it("walks through the 2-step subscription cancellation flow and calls DELETE /api/paddle/portal", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          status: "cancel_at_period_end",
          effectivePlan: "pro",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    render(
      <BillingSettingsPanel
        overview={PRO_ACTIVE_OVERVIEW}
        accountName="Ahmed Al-Azaiza"
        accountEmail="ahmed@example.com"
      />,
    );

    expect(screen.getByTestId("billing-current-plan-title")).toHaveTextContent(
      "Pro · Monthly",
    );
    expect(screen.getByTestId("billing-payment-method-card")).toHaveTextContent(
      "Visa ending 4242",
    );

    await user.click(screen.getByTestId("open-cancel-subscription-modal"));
    expect(screen.getByTestId("cancel-step1-dialog")).toBeInTheDocument();

    await user.click(screen.getByTestId("cancel-step1-continue"));
    expect(screen.getByTestId("cancel-step2-dialog")).toBeInTheDocument();

    const confirmBtn = screen.getByTestId("confirm-cancel-subscription-btn");
    expect(confirmBtn).toBeDisabled();

    await user.click(screen.getByTestId("cancel-confirm-checkbox"));
    expect(confirmBtn).toBeEnabled();

    await user.click(confirmBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/paddle/portal",
        expect.objectContaining({
          method: "DELETE",
        }),
      );
      expect(refreshMock).toHaveBeenCalled();
    });
  });

  it("renders past_due and cancel_at_period_end banners and resumes subscription", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true, effectivePlan: "pro" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { rerender } = render(
      <BillingSettingsPanel
        overview={{
          ...PRO_ACTIVE_OVERVIEW,
          subscription: {
            ...PRO_ACTIVE_OVERVIEW.subscription!,
            status: "past_due",
          },
        }}
        accountName="Ahmed Al-Azaiza"
        accountEmail="ahmed@example.com"
      />,
    );

    expect(screen.getByTestId("billing-payment-failed-banner")).toBeInTheDocument();

    rerender(
      <BillingSettingsPanel
        overview={{
          ...PRO_ACTIVE_OVERVIEW,
          subscription: {
            ...PRO_ACTIVE_OVERVIEW.subscription!,
            status: "cancel_at_period_end",
          },
        }}
        accountName="Ahmed Al-Azaiza"
        accountEmail="ahmed@example.com"
      />,
    );

    expect(screen.getByTestId("billing-cancelled-banner")).toBeInTheDocument();

    await user.click(screen.getByTestId("resume-subscription-btn"));
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith("/api/paddle/portal", { method: "PATCH" });
      expect(refreshMock).toHaveBeenCalled();
    });
  });

  it("normalizes legacy Plus workspace billing cleanly into Teams seat controls without deprecated Plus cards", () => {
    render(
      <BillingSettingsPanel
        overview={{
          ...FREE_OVERVIEW,
          teamBilling: {
            organizationId: "org-teams-1",
            organizationName: "Northstar Studio",
            workspaceId: "ws-teams-1",
            role: "owner",
            isOwner: true,
            plan: "team",
            status: "active",
            interval: "yearly",
            currentPeriodEndIso: "2027-11-05T12:00:00.000Z",
            pastDueSinceIso: null,
            paidSeats: 10,
            renewalSeats: null,
            activeMembers: 8,
            reservedInvites: 2,
            occupiedSeats: 10,
            availableSeats: 0,
            isLockedForQuantityChange: false,
            lockReason: null,
            customDomain: null,
            customDomainEnabled: false,
          },
        }}
        accountName="Ahmed Al-Azaiza"
        accountEmail="ahmed@example.com"
      />,
    );

    expect(screen.getByText(/Northstar Studio/i)).toBeInTheDocument();
    expect(screen.queryByTestId("plus-custom-domain-section")).not.toBeInTheDocument();
  });

  it("shows 10-day grace alert, pre-downgrade case study picker, guided seat release modal, and Teams cancel modal", async () => {
    const user = userEvent.setup();
    render(
      <BillingSettingsPanel
        overview={{
          ...PRO_ACTIVE_OVERVIEW,
          subscription: {
            ...PRO_ACTIVE_OVERVIEW.subscription!,
            status: "past_due",
            pastDueSinceIso: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          },
          personalPublishedProjects: [
            { id: "p-1", name: "Primary Case Study", slug: "primary-cs", visibility: "public" },
            { id: "p-2", name: "Secondary Draft", slug: null, visibility: "private" },
          ],
          teamBilling: {
            organizationId: "org-teams-2",
            organizationName: "Orion Studio",
            workspaceId: "ws-teams-2",
            role: "owner",
            isOwner: true,
            plan: "team",
            status: "active",
            interval: "monthly",
            currentPeriodEndIso: "2027-11-05T12:00:00.000Z",
            pastDueSinceIso: null,
            paidSeats: 4,
            renewalSeats: null,
            activeMembers: 3,
            reservedInvites: 1,
            occupiedSeats: 4,
            availableSeats: 0,
            occupiedRoster: {
              members: [
                { userId: "u-owner", name: "Ahmed", email: "ahmed@example.com", role: "owner" },
                { userId: "u-m1", name: "Sara", email: "sara@example.com", role: "member" },
                { userId: "u-m2", name: "Tariq", email: "tariq@example.com", role: "member" },
              ],
              pendingInvites: [
                { id: "inv-1", email: "new@example.com", role: "member", expiresAtIso: "2027-01-01T00:00:00.000Z" },
              ],
            },
            isLockedForQuantityChange: false,
            lockReason: null,
          },
        }}
        accountName="Ahmed Al-Azaiza"
        accountEmail="ahmed@example.com"
      />,
    );

    expect(screen.getByTestId("billing-payment-failed-banner")).toHaveTextContent(/10-day grace window/i);

    await user.click(screen.getByTestId("open-change-plan-modal"));
    await user.click(screen.getByTestId("plan-card-free"));
    await user.click(screen.getByTestId("confirm-plan-selection-btn"));
    expect(screen.getByTestId("downgrade-keep-public-select")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await user.click(screen.getByLabelText("Decrease target seats"));
    await user.click(screen.getByTestId("apply-seat-change-btn"));
    expect(screen.getByTestId("seat-release-dialog")).toBeInTheDocument();
  });
});
