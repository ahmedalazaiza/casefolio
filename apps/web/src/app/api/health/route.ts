import { NextResponse } from "next/server";
import { checkWebHealth } from "@/lib/monitoring/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const report = await checkWebHealth();
  return NextResponse.json(report, {
    status: report.ok ? 200 : 503,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
