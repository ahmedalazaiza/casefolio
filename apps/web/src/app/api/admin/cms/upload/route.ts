import type { UserRole } from "@casefolio/db";
import { NextResponse } from "next/server";
import { hasAdminRole } from "@/lib/auth/guards";
import { getServerSession } from "@/lib/auth/session";
import {
  completeAdminCmsMediaUpload,
  createAdminCmsMediaPresign,
  uploadAdminCmsSvgDirect,
} from "@/lib/cms/media-storage";
import { consumeUploadRateLimit } from "@/lib/storage/rate-limit";

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

  const rate = consumeUploadRateLimit(`admin-cms-media:${session.user.id}`, 60, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        ok: false,
        code: "RATE_LIMITED",
        error: `Too many CMS media uploads. Retry in ${rate.retryAfterSeconds}s.`,
      },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  let body: { action?: string };
  try {
    body = (await request.json()) as { action?: string };
  } catch {
    return NextResponse.json(
      { ok: false, code: "VALIDATION_ERROR", error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const actor = { id: session.user.id, role };

  if (body?.action === "presign") {
    const result = await createAdminCmsMediaPresign(body, actor);
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
    const result = await completeAdminCmsMediaUpload(body, actor);
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

  if (body?.action === "upload_svg") {
    const result = await uploadAdminCmsSvgDirect(body, actor);
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
    { ok: false, code: "VALIDATION_ERROR", error: "Unsupported CMS upload action." },
    { status: 400 },
  );
}
