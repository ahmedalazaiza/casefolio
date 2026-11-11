import { NextResponse } from "next/server";
import { handleSignedPaddleWebhookRequest } from "@/lib/billing/webhooks";
import { consumeUploadRateLimit } from "@/lib/storage/rate-limit";

export const runtime = "nodejs";

const MAX_WEBHOOK_BODY_BYTES = 512 * 1024; // 512 KiB

function resolveTrustedWebhookIp(headers: Headers): string {
  const cfIp = headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (hops.length > 0) {
      return hops[hops.length - 1]!;
    }
  }
  return "local";
}

async function readWebhookTextWithLimit(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; text: string } | { ok: false }> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false };
  }
  if (!request.body) {
    return { ok: true, text: "" };
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, text: new TextDecoder("utf-8").decode(combined) };
}

export async function POST(request: Request) {
  const signatureHeader =
    request.headers.get("Paddle-Signature") ??
    request.headers.get("paddle-signature");

  const bodyRead = await readWebhookTextWithLimit(request, MAX_WEBHOOK_BODY_BYTES);
  if (!bodyRead.ok) {
    return NextResponse.json(
      { ok: false, code: "PAYLOAD_TOO_LARGE", error: "Webhook payload exceeds 512 KB limit." },
      { status: 413 },
    );
  }

  // Verify HMAC-SHA256 signature BEFORE applying IP rate limits so spoofed X-Forwarded-For
  // bursts can NEVER 429-block genuine Paddle webhook deliveries.
  const result = await handleSignedPaddleWebhookRequest({
    rawBody: bodyRead.text,
    signatureHeader,
  });

  if (!result.ok) {
    if (result.httpStatus === 401) {
      const clientIp = resolveTrustedWebhookIp(request.headers);
      const invalidRate = consumeUploadRateLimit(
        `paddle-webhook-invalid:${clientIp}`,
        30,
        60_000,
      );
      if (!invalidRate.allowed) {
        return NextResponse.json(
          { ok: false, error: "Too many invalid webhook requests." },
          { status: 429, headers: { "Retry-After": String(invalidRate.retryAfterSeconds) } },
        );
      }
    }

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
