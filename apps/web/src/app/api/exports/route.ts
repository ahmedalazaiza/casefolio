import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import {
  enqueueProjectExportForUser,
  getProjectExportsOverviewForUser,
} from "@/lib/exports/service";

export async function GET(request: Request): Promise<Response> {
  const ctx = await getServerSession();
  if (!ctx) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", error: "Please sign in to view exports." },
      { status: 401 },
    );
  }

  const reqUrl = new URL(request.url);
  const projectId = reqUrl.searchParams.get("projectId") ?? "";
  if (!projectId) {
    return NextResponse.json(
      { ok: false, code: "VALIDATION_ERROR", error: "projectId query parameter is required." },
      { status: 400 },
    );
  }

  const access = await getProjectExportsOverviewForUser(projectId, {
    id: ctx.user.id,
    role: ctx.user.role,
    plan: ctx.user.plan,
  });

  if (access.status === "not_found") {
    return NextResponse.json(
      { ok: false, code: "NOT_FOUND", error: "Project not found." },
      { status: 404 },
    );
  }

  if (access.status === "forbidden") {
    return NextResponse.json(
      { ok: false, code: "FORBIDDEN", error: "You do not have access to this project." },
      { status: 403 },
    );
  }

  return NextResponse.json({
    ok: true,
    overview: access.overview,
  });
}

export async function POST(request: Request): Promise<Response> {
  const ctx = await getServerSession();
  if (!ctx) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", error: "Please sign in to export your case study." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: "VALIDATION_ERROR", error: "Invalid JSON request body." },
      { status: 400 },
    );
  }

  const reqOrigin = new URL(request.url).origin;
  const result = await enqueueProjectExportForUser(
    body,
    {
      id: ctx.user.id,
      role: ctx.user.role,
      plan: ctx.user.plan,
    },
    {
      appUrl: reqOrigin,
    },
  );

  if (!result.ok) {
    const statusMap = {
      UNAUTHORIZED: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      VALIDATION_ERROR: 400,
      PLAN_UPGRADE_REQUIRED: 403,
      EXPORT_LIMIT_REACHED: 403,
      RATE_LIMITED: 429,
    } as const;

    return NextResponse.json(result, {
      status: statusMap[result.code] ?? 400,
    });
  }

  return NextResponse.json(result, { status: 202 });
}

