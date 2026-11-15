import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { submitPublicProjectReport } from "@/lib/admin/moderation";
import { createCaseStudyReportSchema } from "@/lib/admin/moderation-types";
import { getServerSession } from "@/lib/auth/session";
import { extractClientIp } from "@/lib/security/auth-rate-limit";
import { consumeSharedRateLimit } from "@/lib/security/shared-rate-limit";

const REPORT_BURST_LIMIT = 10;
const REPORT_BURST_WINDOW_MS = 60_000;
const REPORT_DEDUPE_WINDOW_MS = 10 * 60_000;

export async function POST(request: Request) {
  const clientIp = extractClientIp(request.headers);

  const rateCheck = await consumeSharedRateLimit(
    `report:${clientIp}`,
    REPORT_BURST_LIMIT,
    REPORT_BURST_WINDOW_MS,
  );
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many reports submitted. Please try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(rateCheck.retryAfterSeconds) },
      },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = createCaseStudyReportSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid report payload." },
      { status: 400 },
    );
  }

  const session = await getServerSession().catch(() => null);

  // Dedupe: the same reporter (or, for anonymous callers, the same IP) reporting the same project
  // again within 10 minutes is acknowledged without creating another moderation row.
  const reporterKey = session?.user.id ? `user:${session.user.id}` : `ip:${clientIp}`;
  const dedupe = await consumeSharedRateLimit(
    `report-dedupe:${reporterKey}:${parsed.data.projectId}`,
    1,
    REPORT_DEDUPE_WINDOW_MS,
  );
  if (!dedupe.allowed) {
    return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
  }

  const result = await submitPublicProjectReport({
    input: parsed.data,
    reporterId: session?.user.id ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  revalidatePath("/admin/moderation");
  revalidatePath("/admin");

  return NextResponse.json({ ok: true, reportId: result.reportId }, { status: 201 });
}
