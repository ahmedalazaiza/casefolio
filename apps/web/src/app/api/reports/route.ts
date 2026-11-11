import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { submitPublicProjectReport } from "@/lib/admin/moderation";
import { createCaseStudyReportSchema } from "@/lib/admin/moderation-types";
import { getServerSession } from "@/lib/auth/session";
import { extractClientIp } from "@/lib/security/auth-rate-limit";
import { consumeUploadRateLimit } from "@/lib/storage/rate-limit";

export async function POST(request: Request) {
  const clientIp = extractClientIp(request.headers);

  const rateCheck = consumeUploadRateLimit(`report:${clientIp}`, 10, 60_000);
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
