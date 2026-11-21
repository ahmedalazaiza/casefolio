import { NextResponse } from "next/server";
import { env } from "@/env";
import { getPaddleApiBaseUrl } from "@/lib/billing/server-config";
import { handleSignedPaddleWebhookRequest } from "@/lib/billing/webhooks";
import { extractClientIp } from "@/lib/security/auth-rate-limit";
import { consumeSharedRateLimit } from "@/lib/security/shared-rate-limit";

export const runtime = "nodejs";

const MAX_WEBHOOK_BODY_BYTES = 512 * 1024; // 512 KiB
const PADDLE_IP_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface PaddleIpsApiResponse {
  data?: {
    ipv4_cidrs?: string[];
  };
}

let cachedPaddleAllowlist: { ips: Set<string>; expiresAt: number } | null = null;

function normalizeCidrToIp(cidr: string): string {
  const trimmed = cidr.trim();
  return trimmed.endsWith("/32") ? trimmed.slice(0, -3) : trimmed;
}

async function fetchPaddleLiveAllowlistIps(forceRefresh = false): Promise<Set<string> | null> {
  const now = Date.now();
  if (!forceRefresh && cachedPaddleAllowlist && cachedPaddleAllowlist.expiresAt > now) {
    return cachedPaddleAllowlist.ips;
  }

  const endpoint = `${getPaddleApiBaseUrl()}/ips`;
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      return cachedPaddleAllowlist?.ips ?? null;
    }
    const payload = (await response.json()) as PaddleIpsApiResponse;
    const cidrs = payload?.data?.ipv4_cidrs;
    if (!Array.isArray(cidrs) || cidrs.length === 0) {
      return cachedPaddleAllowlist?.ips ?? null;
    }
    const ips = new Set(cidrs.map(normalizeCidrToIp).filter(Boolean));
    cachedPaddleAllowlist = {
      ips,
      expiresAt: now + PADDLE_IP_CACHE_TTL_MS,
    };
    return ips;
  } catch {
    return cachedPaddleAllowlist?.ips ?? null;
  }
}

async function isAllowedPaddleWebhookIp(headers: Headers): Promise<boolean> {
  const enforceAllowlist =
    env.PADDLE_ENV === "production" || process.env.PADDLE_ENFORCE_IP_ALLOWLIST === "true";
  if (!enforceAllowlist) {
    return true;
  }

  const hasForwardedIp = Boolean(
    headers.get("x-forwarded-for") || headers.get("x-real-ip") || headers.get("cf-connecting-ip"),
  );
  if (!hasForwardedIp && process.env.PADDLE_ENFORCE_IP_ALLOWLIST !== "true") {
    return true;
  }

  const clientIp = extractClientIp(headers);
  if (!clientIp || clientIp === "unknown") {
    return false;
  }

  let allowlist = await fetchPaddleLiveAllowlistIps(false);
  if (allowlist && allowlist.has(clientIp)) {
    return true;
  }

  // Refresh once from https://api.paddle.com/ips in case Paddle added a new /32 CIDR.
  allowlist = await fetchPaddleLiveAllowlistIps(true);
  if (!allowlist) {
    return false;
  }
  return allowlist.has(clientIp);
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
  const ipAllowed = await isAllowedPaddleWebhookIp(request.headers);
  if (!ipAllowed) {
    return NextResponse.json(
      {
        ok: false,
        code: "FORBIDDEN_IP",
        error: "Webhook source IP is not in Paddle's allowlist.",
      },
      { status: 403 },
    );
  }

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
      const clientIp = extractClientIp(request.headers);
      const invalidRate = await consumeSharedRateLimit(
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
