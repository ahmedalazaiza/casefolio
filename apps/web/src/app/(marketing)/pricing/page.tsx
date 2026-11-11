import type { Metadata } from "next";
import { PricingPageClient } from "@/components/marketing/pricing-page-client";
import { env } from "@/env";
import { getServerSession } from "@/lib/auth/session";
import type { BillingInterval } from "@/lib/billing/plans";
import { resolveServerPaddlePriceId } from "@/lib/billing/server-config";
import { resolveEffectivePlanForUser } from "@/lib/entitlements/server";

export const metadata: Metadata = {
  title: "Pricing — Casefolio",
  description:
    "Compare Free, Pro and Team Casefolio plans. Start free with two projects, or upgrade for 20+ active case studies and unwatermarked PNG & PDF exports.",
  alternates: {
    canonical: "/pricing",
  },
};

export default async function PricingPage({
  searchParams,
}: {
  searchParams?: Promise<{ interval?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const initialInterval: BillingInterval =
    params.interval === "yearly" ? "yearly" : "monthly";

  const sessionCtx = await getServerSession();
  const currentTier = sessionCtx
    ? await resolveEffectivePlanForUser(sessionCtx.user.id)
    : null;

  const paddlePriceMap = {
    environment: env.PADDLE_ENV,
    pro_monthly: resolveServerPaddlePriceId("pro", "monthly"),
    pro_yearly: resolveServerPaddlePriceId("pro", "yearly"),
    team_monthly: resolveServerPaddlePriceId("team", "monthly"),
    team_yearly: resolveServerPaddlePriceId("team", "yearly"),
  };

  return (
    <PricingPageClient
      isAuthenticated={Boolean(sessionCtx)}
      currentTier={currentTier}
      activeOrgId={sessionCtx?.session.activeOrganizationId ?? null}
      paddlePriceMap={paddlePriceMap}
      initialInterval={initialInterval}
    />
  );
}

