import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import type { PresignUploadInput } from "@/lib/storage/quotas";
import { consumeUploadRateLimit } from "@/lib/storage/rate-limit";
import { createPresignedUpload, type PresignUploadErrorCode } from "@/lib/storage/service";

function statusForPresignError(code: PresignUploadErrorCode): number {
  switch (code) {
    case "UNSUPPORTED_MIME_TYPE":
      return 415;
    case "FILE_TOO_LARGE":
    case "STORAGE_QUOTA_EXCEEDED":
    case "PROJECT_ASSET_LIMIT_REACHED":
      return 413;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "VALIDATION_ERROR":
    case "INVALID_SLOT":
      return 400;
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const ctx = await getServerSession();
  if (!ctx) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", error: "Sign in required to upload images." },
      { status: 401 },
    );
  }

  const rateLimit = consumeUploadRateLimit(`presign:${ctx.user.id}`);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        code: "RATE_LIMITED",
        error: "Too many upload requests. Please wait a moment and try again.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  let body: PresignUploadInput;
  try {
    body = (await request.json()) as PresignUploadInput;
  } catch {
    return NextResponse.json(
      { ok: false, code: "VALIDATION_ERROR", error: "Invalid JSON payload." },
      { status: 400 },
    );
  }

  const result = await createPresignedUpload(body, {
    id: ctx.user.id,
    role: ctx.user.role,
    plan: ctx.user.plan,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: statusForPresignError(result.code) });
  }

  return NextResponse.json(result, { status: 200 });
}
