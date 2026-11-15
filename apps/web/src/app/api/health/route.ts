import { NextResponse } from "next/server";
import { hasAdminRole } from "@/lib/auth/guards";
import { getServerSession } from "@/lib/auth/session";
import { checkWebHealth, toPublicHealthReport } from "@/lib/monitoring/health";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" } as const;

/**
 * Public: `{ ok, status, timestamp, database }` only (no environment, latency or catalog data).
 * `?details=1` returns the full diagnostic report and requires an authenticated admin session.
 */
export async function GET(request?: Request) {
  const wantsDetails = request ? new URL(request.url).searchParams.get("details") === "1" : false;

  if (wantsDetails) {
    const session = await getServerSession().catch(() => null);
    if (!session) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401, headers: NO_STORE },
      );
    }
    if (!hasAdminRole(session.user.role)) {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403, headers: NO_STORE },
      );
    }
    const detailed = await checkWebHealth();
    return NextResponse.json(detailed, { status: detailed.ok ? 200 : 503, headers: NO_STORE });
  }

  const report = await checkWebHealth();
  return NextResponse.json(toPublicHealthReport(report), {
    status: report.ok ? 200 : 503,
    headers: NO_STORE,
  });
}
