import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getUserBillingOverview } from "@/lib/billing/service";

export const runtime = "nodejs";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Lightweight, no-store entitlement probe used after a Paddle checkout completes. The overlay
 * reports "completed" the moment the customer pays, but the plan only changes once the signed
 * webhook has been processed — the UI polls this endpoint so it can show the VERIFIED plan
 * instead of optimistically claiming an upgrade.
 */
export async function GET(request: Request) {
  const sessionData = await getServerSession();
  if (!sessionData) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", error: "Sign in required." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const rawOrgId = new URL(request.url).searchParams.get("orgId");
  const orgId = rawOrgId && UUID_REGEX.test(rawOrgId) ? rawOrgId : null;

  const overview = await getUserBillingOverview(sessionData.user.id, new Date(), orgId);

  return NextResponse.json(
    {
      ok: true,
      personal: {
        plan: overview.effectivePlan,
        status: overview.subscription?.status ?? null,
      },
      team: overview.teamBilling
        ? {
            organizationId: overview.teamBilling.organizationId,
            plan: overview.teamBilling.plan,
            status: overview.teamBilling.status,
            paidSeats: overview.teamBilling.paidSeats,
          }
        : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
