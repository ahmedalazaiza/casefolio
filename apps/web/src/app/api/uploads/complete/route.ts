import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import type { CompleteUploadInput } from "@/lib/storage/quotas";
import { consumeUploadRateLimit } from "@/lib/storage/rate-limit";
import { completePresignedUpload } from "@/lib/storage/service";

export async function POST(request: Request): Promise<NextResponse> {
  const ctx = await getServerSession();
  if (!ctx) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", error: "Sign in required to complete uploads." },
      { status: 401 },
    );
  }

  const rateLimit = consumeUploadRateLimit(`complete:${ctx.user.id}`, 60);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        code: "RATE_LIMITED",
        error: "Too many upload completion requests. Please wait a moment.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  let body: CompleteUploadInput;
  try {
    body = (await request.json()) as CompleteUploadInput;
  } catch {
    return NextResponse.json(
      { ok: false, code: "VALIDATION_ERROR", error: "Invalid JSON payload." },
      { status: 400 },
    );
  }

  const result = await completePresignedUpload(body, {
    id: ctx.user.id,
    role: ctx.user.role,
    plan: ctx.user.plan,
  });

  if (!result.ok) {
    const status =
      result.code === "FILE_TOO_LARGE" ||
      result.code === "STORAGE_QUOTA_EXCEEDED" ||
      result.code === "MONTHLY_UPLOADS_EXCEEDED"
        ? 413
        : result.code === "FORBIDDEN" || result.code === "INVALID_TOKEN"
          ? 403
          : result.code === "NOT_FOUND"
            ? 404
            : 400;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result, { status: 201 });
}
