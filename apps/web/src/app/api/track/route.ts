import { NextResponse } from "next/server";
import {
  recordPublishedProjectView,
  trackPageViewInputSchema,
} from "@/lib/analytics/page-views";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = trackPageViewInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid tracking payload.",
      },
      { status: 400 },
    );
  }

  const result = await recordPublishedProjectView({
    projectId: parsed.data.projectId,
    headers: request.headers,
    explicitReferrer: parsed.data.referrer ?? undefined,
  });

  if (!result.recorded && result.reason === "rate_limited") {
    return NextResponse.json(
      { ok: false, recorded: false, reason: result.reason },
      { status: 429 },
    );
  }

  return NextResponse.json({
    ok: true,
    recorded: result.recorded,
    reason: result.recorded ? undefined : result.reason,
  });
}
