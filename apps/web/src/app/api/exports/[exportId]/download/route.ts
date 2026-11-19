import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { authorizeExportDownloadForUser } from "@/lib/exports/service";
import { sanitizeErrorForLogging, sanitizeHeaderFilename } from "@/lib/security/redact";

interface ExportDownloadRouteContext {
  params: Promise<{ exportId: string }>;
}

export async function GET(
  _request: Request,
  context: ExportDownloadRouteContext,
): Promise<Response> {
  try {
    const ctx = await getServerSession();
    if (!ctx) {
      return NextResponse.json(
        { ok: false, code: "UNAUTHORIZED", error: "Please sign in to download exports." },
        { status: 401 },
      );
    }

    const { exportId } = await context.params;
    const result = await authorizeExportDownloadForUser(exportId, {
      id: ctx.user.id,
      role: ctx.user.role,
      plan: ctx.user.plan,
    });

    if (result.status === "not_found") {
      return NextResponse.json(
        { ok: false, code: "NOT_FOUND", error: "Export file not found." },
        { status: 404 },
      );
    }

    if (result.status === "forbidden") {
      return NextResponse.json(
        {
          ok: false,
          code: "FORBIDDEN",
          error: "You do not have permission to download this export.",
        },
        { status: 403 },
      );
    }

    if (result.status === "not_ready") {
      return NextResponse.json(
        {
          ok: false,
          code: "EXPORT_NOT_READY",
          error: `Export is currently ${result.jobStatus}.`,
        },
        { status: 409 },
      );
    }

    if (result.status === "redirect") {
      return NextResponse.redirect(result.redirectUrl, {
        status: 302,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    const safeFilename = sanitizeHeaderFilename(result.fileName, "casefolio-export");
    return new Response(Buffer.from(result.bytes), {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Length": String(result.bytes.byteLength),
        "Content-Disposition": `attachment; filename="${safeFilename}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    const safeErr = sanitizeErrorForLogging(err);
    console.error("[api/exports/[exportId]/download] unexpected GET error:", safeErr.message);
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        error: "Unable to download export right now.",
      },
      { status: 500 },
    );
  }
}
