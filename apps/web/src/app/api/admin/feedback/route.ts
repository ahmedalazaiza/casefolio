import { NextResponse } from "next/server";
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

  const overview = await getAdminFeedbackOverview();
  const url = new URL(request.url);
  if (url.searchParams.get("format") === "csv") {
    const csv = serializeAdminFeedbackCsv(overview);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="casefolio-feedback-report.csv"',
      },
    });
  }

  return NextResponse.json({ ok: true, overview });
}
