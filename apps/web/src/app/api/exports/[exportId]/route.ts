import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getExportJobForUser } from "@/lib/exports/service";

interface ExportStatusRouteContext {
  params: Promise<{ exportId: string }>;
}

export async function GET(
  _request: Request,
  context: ExportStatusRouteContext,
): Promise<Response> {
  const ctx = await getServerSession();
  if (!ctx) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", error: "Please sign in to inspect export status." },
      { status: 401 },
    );
  }

  const { exportId } = await context.params;
  const access = await getExportJobForUser(exportId, {
    id: ctx.user.id,
    role: ctx.user.role,
    plan: ctx.user.plan,
  });

  if (access.status === "not_found") {
    return NextResponse.json(
      { ok: false, code: "NOT_FOUND", error: "Export job not found." },
      { status: 404 },
    );
  }

  if (access.status === "forbidden") {
    return NextResponse.json(
      { ok: false, code: "FORBIDDEN", error: "You do not have access to this export job." },
      { status: 403 },
    );
  }

  return NextResponse.json({
    ok: true,
    exportJob: access.exportJob,
  });
}

