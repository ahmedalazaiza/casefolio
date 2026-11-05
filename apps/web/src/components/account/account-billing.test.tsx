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
    expect(screen.getByTestId("plan-card-pro")).toHaveTextContent("$12");

    await user.click(screen.getByTestId("picker-interval-yearly"));
    expect(screen.getByTestId("plan-card-pro")).toHaveTextContent("$10");
    expect(screen.getByTestId("plan-card-pro")).toHaveTextContent("($120/yr)");
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
});
