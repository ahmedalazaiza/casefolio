import { NextResponse } from "next/server";
import { stripImageExifAndMetadata } from "@/lib/storage/exif";
import { detectImageMimeFromMagicBytes, formatBytesHuman } from "@/lib/storage/quotas";
import {
  verifyStorageToken,
  writeLocalStoredObject,
  type LocalPutTokenPayload,
} from "@/lib/storage/r2";

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

  const buffer = await request.arrayBuffer();
  const rawBytes = new Uint8Array(buffer);

  if (rawBytes.byteLength === 0) {
    return NextResponse.json(
      { ok: false, code: "EMPTY_UPLOAD", error: "Uploaded file is empty." },
      { status: 400 },
    );
  }

  if (rawBytes.byteLength > payload.maxBytes) {
    return NextResponse.json(
      {
        ok: false,
        code: "FILE_TOO_LARGE",
        error: `Uploaded file exceeds the signed limit of ${formatBytesHuman(payload.maxBytes)}.`,
      },
      { status: 413 },
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
  await writeLocalStoredObject(payload.r2Key, sanitizedBytes);

  return NextResponse.json(
    {
      ok: true,
      bytes: sanitizedBytes.byteLength,
    },
    { status: 200 },
  );
}
