import type { UserRole } from "@casefolio/db";
import { NextResponse } from "next/server";
import { hasAdminRole } from "@/lib/auth/guards";
import { getServerSession } from "@/lib/auth/session";
import { consumeUploadRateLimit } from "@/lib/storage/rate-limit";
import {
  completeAdminTemplateCoverUpload,
  createAdminTemplateCoverPresign,
} from "@/lib/template/cover-storage";

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", error: "Please sign in to continue." },
      { status: 401 },
    );
  }

  const role = ((session.user.role as UserRole | undefined) ?? "user") as UserRole;
  if (!hasAdminRole(role)) {
    return NextResponse.json(
      { ok: false, code: "FORBIDDEN", error: "Admin role required." },
      { status: 403 },
    );
  }

  const rate = consumeUploadRateLimit(`admin-cover:${session.user.id}`, 40, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        ok: false,
        code: "RATE_LIMITED",
        error: `Too many cover uploads. Retry in ${rate.retryAfterSeconds}s.`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  let body: { action?: string };
  try {
    body = (await request.json()) as { action?: string };
  } catch {
    return NextResponse.json(
      { ok: false, code: "VALIDATION_ERROR", error: "Invalid JSON request body." },
      { status: 400 },
    );
  }

  const actor = { id: session.user.id, role };

  if (body?.action === "presign") {
    const result = await createAdminTemplateCoverPresign(body, actor);
    if (!result.ok) {
      const status =
        result.code === "FORBIDDEN"
          ? 403
          : result.code === "UNSUPPORTED_MIME_TYPE"
            ? 415
            : result.code === "FILE_TOO_LARGE"
              ? 413
              : 400;
      return NextResponse.json(result, { status });
    }
    return NextResponse.json(result, { status: 200 });
  }

  if (body?.action === "complete") {
    const result = await completeAdminTemplateCoverUpload(body, actor);
    if (!result.ok) {
      const status =
        result.code === "FORBIDDEN"
          ? 403
          : result.code === "FILE_TOO_LARGE"
            ? 413
            : 400;
      return NextResponse.json(result, { status });
    }
    return NextResponse.json(result, { status: 200 });
  }

  return NextResponse.json(
    { ok: false, code: "VALIDATION_ERROR", error: "Unsupported cover action." },
    { status: 400 },
  );
}
