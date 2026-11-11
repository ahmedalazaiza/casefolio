import { NextResponse } from "next/server";
import { stripImageExifAndMetadata } from "@/lib/storage/exif";
import { detectImageMimeFromMagicBytes, formatBytesHuman } from "@/lib/storage/quotas";
import {
  verifyStorageToken,
  writeStoredObject,
  type LocalPutTokenPayload,
} from "@/lib/storage/r2";
import { consumeUploadRateLimit } from "@/lib/storage/rate-limit";

async function readStreamWithLimit(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; reason: "too_large" }> {
  if (!request.body) {
    return { ok: true, bytes: new Uint8Array(0) };
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
        return { ok: false, reason: "too_large" };
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
  return { ok: true, bytes: combined };
}

export async function PUT(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return NextResponse.json(
      { ok: false, code: "MISSING_TOKEN", error: "Missing signed upload token." },
      { status: 400 },
    );
  }

  const payload = verifyStorageToken<LocalPutTokenPayload>(token);
  if (!payload || payload.kind !== "local-put") {
    return NextResponse.json(
      { ok: false, code: "INVALID_UPLOAD_TOKEN", error: "Signed upload URL is invalid or expired." },
      { status: 403 },
    );
  }

  const keyRate = consumeUploadRateLimit(`local-put:${payload.r2Key}`, 4, 300_000);
  if (!keyRate.allowed) {
    return NextResponse.json(
      { ok: false, code: "RATE_LIMITED", error: "Too many upload attempts for this signed URL." },
      { status: 429, headers: { "Retry-After": String(keyRate.retryAfterSeconds) } },
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > payload.maxBytes) {
    return NextResponse.json(
      {
        ok: false,
        code: "FILE_TOO_LARGE",
        error: `Uploaded file exceeds the signed limit of ${formatBytesHuman(payload.maxBytes)}.`,
      },
      { status: 413 },
    );
  }

  const streamRead = await readStreamWithLimit(request, payload.maxBytes);
  if (!streamRead.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: "FILE_TOO_LARGE",
        error: `Uploaded file exceeds the signed limit of ${formatBytesHuman(payload.maxBytes)}.`,
      },
      { status: 413 },
    );
  }
  const rawBytes = streamRead.bytes;

  if (rawBytes.byteLength === 0) {
    return NextResponse.json(
      { ok: false, code: "EMPTY_UPLOAD", error: "Uploaded file is empty." },
      { status: 400 },
    );
  }

  const detectedMime = detectImageMimeFromMagicBytes(rawBytes);
  if (!detectedMime || detectedMime !== payload.mimeType) {
    return NextResponse.json(
      {
        ok: false,
        code: "MAGIC_BYTES_MISMATCH",
        error: "File binary header does not match an allowed PNG, JPG, or WebP image.",
      },
      { status: 415 },
    );
  }

  const sanitizedBytes = stripImageExifAndMetadata(rawBytes, detectedMime);
  await writeStoredObject(payload.r2Key, sanitizedBytes, {
    contentType: detectedMime,
    cacheControl: payload.cacheControl ?? "private, max-age=31536000, immutable",
  });

  return NextResponse.json(
    {
      ok: true,
      bytes: sanitizedBytes.byteLength,
    },
    { status: 200 },
  );
}
