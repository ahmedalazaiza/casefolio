import { NextResponse } from "next/server";
import { getAdminPlatformAnalytics } from "@/lib/admin/overview";
import {
  ADMIN_ANALYTICS_RANGES,
  serializeAdminAnalyticsCsv,
  serializeExportsTelemetryCsv,
  serializeSubscribersTelemetryCsv,
  serializeVisitsTelemetryCsv,
  type AdminAnalyticsRange,
} from "@/lib/admin/overview-types";
import { hasAdminRole } from "@/lib/auth/guards";
import { getServerSession } from "@/lib/auth/session";
import {
  getAdminFeedbackOverview,
  serializeAdminFeedbackCsv,
} from "@/lib/feedback/service";

export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!hasAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const url = new URL(request.url);
  const rawRange = url.searchParams.get("range");
  const range: AdminAnalyticsRange = ADMIN_ANALYTICS_RANGES.includes(
    rawRange as AdminAnalyticsRange,
  )
    ? (rawRange as AdminAnalyticsRange)
    : "30d";
  const report = url.searchParams.get("report") || "overview";

  if (report === "feedback") {
    const fb = await getAdminFeedbackOverview();
    return new NextResponse(serializeAdminFeedbackCsv(fb), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="casefolio-feedback-report.csv"',
      },
    });
  }

  const analytics = await getAdminPlatformAnalytics(range);
  const csv =
    report === "subscribers"
      ? serializeSubscribersTelemetryCsv(analytics)
      : report === "exports"
        ? serializeExportsTelemetryCsv(analytics)
        : report === "visits"
          ? serializeVisitsTelemetryCsv(analytics)
          : serializeAdminAnalyticsCsv(analytics);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="casefolio-${report}-${range}.csv"`,
    },
  });
}
