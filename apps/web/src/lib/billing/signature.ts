import { createHmac, timingSafeEqual } from "node:crypto";

export const DEFAULT_PADDLE_WEBHOOK_TOLERANCE_SECONDS = 300;

export interface ParsedPaddleSignature {
  timestampSeconds: number;
  h1Signatures: string[];
}

export type PaddleSignatureVerifyResult =
  | {
      ok: true;
      timestampSeconds: number;
    }
  | {
      ok: false;
      code:
        | "MISSING_SIGNATURE"
        | "MALFORMED_SIGNATURE"
        | "TIMESTAMP_EXPIRED"
        | "INVALID_SIGNATURE";
      error: string;
    };

/**
 * Parses Paddle Billing `Paddle-Signature` header (`ts=1671552777;h1=<hex>[;h1=<hex>]`).
 */
export function parsePaddleSignatureHeader(
  signatureHeader: string | null | undefined,
): ParsedPaddleSignature | null {
  if (!signatureHeader || !signatureHeader.trim()) {
    return null;
  }

  let timestampSeconds: number | null = null;
  const h1Signatures: string[] = [];

  for (const rawPart of signatureHeader.split(";")) {
    const part = rawPart.trim();
    if (!part) continue;
    const eqIndex = part.indexOf("=");
    if (eqIndex <= 0) continue;

    const key = part.slice(0, eqIndex).trim();
    const value = part.slice(eqIndex + 1).trim();

    if (key === "ts") {
      if (!/^\d+$/.test(value)) {
        return null;
      }
      const parsed = Number.parseInt(value, 10);
      if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        return null;
      }
      timestampSeconds = parsed;
    } else if (key === "h1") {
      if (/^[a-fA-F0-9]{64}$/.test(value)) {
        h1Signatures.push(value.toLowerCase());
      }
    }
  }

  if (timestampSeconds === null || h1Signatures.length === 0) {
    return null;
  }

  return {
    timestampSeconds,
    h1Signatures,
  };
}

export function computePaddleWebhookHmacHex(
  rawBody: string,
  secret: string,
  timestampSeconds: number,
): string {
  const signedPayload = `${timestampSeconds}:${rawBody}`;
  return createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");
}

export function signPaddleWebhookPayload(
  rawBody: string,
  secret: string,
  timestampSeconds = Math.floor(Date.now() / 1000),
): string {
  const h1 = computePaddleWebhookHmacHex(rawBody, secret, timestampSeconds);
  return `ts=${timestampSeconds};h1=${h1}`;
}

export function verifyPaddleWebhookSignature(args: {
  rawBody: string;
  signatureHeader: string | null | undefined;
  secret: string;
  nowMs?: number;
  toleranceSeconds?: number;
}): PaddleSignatureVerifyResult {
  const {
    rawBody,
    signatureHeader,
    secret,
    nowMs = Date.now(),
    toleranceSeconds = DEFAULT_PADDLE_WEBHOOK_TOLERANCE_SECONDS,
  } = args;

  if (!signatureHeader || !signatureHeader.trim()) {
    return {
      ok: false,
      code: "MISSING_SIGNATURE",
      error: "Missing Paddle-Signature header.",
    };
  }

  const parsed = parsePaddleSignatureHeader(signatureHeader);
  if (!parsed) {
    return {
      ok: false,
      code: "MALFORMED_SIGNATURE",
      error: "Malformed Paddle-Signature header.",
    };
  }

  const nowSeconds = Math.floor(nowMs / 1000);
  const ageSeconds = Math.abs(nowSeconds - parsed.timestampSeconds);
  if (ageSeconds > toleranceSeconds) {
    return {
      ok: false,
      code: "TIMESTAMP_EXPIRED",
      error: "Paddle webhook timestamp is outside the allowed replay window.",
    };
  }

  const expectedHex = computePaddleWebhookHmacHex(rawBody, secret, parsed.timestampSeconds);
  const expectedBuf = Buffer.from(expectedHex, "hex");

  let matched = false;
  for (const candidateHex of parsed.h1Signatures) {
    const candidateBuf = Buffer.from(candidateHex, "hex");
    if (
      candidateBuf.length === expectedBuf.length &&
      timingSafeEqual(candidateBuf, expectedBuf)
    ) {
      matched = true;
      break;
    }
  }

  if (!matched) {
    return {
      ok: false,
      code: "INVALID_SIGNATURE",
      error: "Paddle webhook signature verification failed.",
    };
  }

  return {
    ok: true,
    timestampSeconds: parsed.timestampSeconds,
  };
}
