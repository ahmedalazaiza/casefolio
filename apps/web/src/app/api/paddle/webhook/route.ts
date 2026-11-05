import { NextResponse } from "next/server";
import { handleSignedPaddleWebhookRequest } from "@/lib/billing/webhooks";
import { consumeUploadRateLimit } from "@/lib/storage/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const rate = consumeUploadRateLimit(`paddle-webhook:${clientIp}`, 120, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many webhook requests." },
      { status: 429 },
    );
  }

  const signatureHeader =
    request.headers.get("Paddle-Signature") ??
    request.headers.get("paddle-signature");

  const rawBody = await request.text();
  const result = await handleSignedPaddleWebhookRequest({
    rawBody,
    signatureHeader,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: result.code,
        error: result.error,
      },
      { status: result.httpStatus },
    );
  }

  return NextResponse.json({
    ok: true,
    eventId: result.eventId,
    eventType: result.eventType,
    deduplicated: result.deduplicated,
    subscriptionId: result.subscriptionId,
    effectivePlan: result.effectivePlan,
    lifecycleStatus: result.lifecycleStatus,
  });
}
