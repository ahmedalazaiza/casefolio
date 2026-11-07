import type { PlanTier, UserRole } from "@casefolio/db";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { completeQueuedExportFromClient } from "@/lib/exports/service";

interface ExportCompleteContext {
  params: Promise<{ exportId: string }>;
}

export async function POST(
  request: Request,
  context: ExportCompleteContext,
): Promise<NextResponse> {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", error: "Please sign in to finalize exports." },
      { status: 401 },
    );
  }

  const { exportId } = await context.params;
  const rawBuffer = await request.arrayBuffer();
  const bytes = new Uint8Array(rawBuffer);

  const result = await completeQueuedExportFromClient(exportId, bytes, {
    id: session.user.id,
    role: ((session.user.role as UserRole | undefined) ?? "user") as UserRole,
    plan: ((session.user.plan as PlanTier | undefined) ?? "free") as PlanTier,
  });

  if (result.status === "not_found") {
    return NextResponse.json(
      { ok: false, code: "NOT_FOUND", error: "Export job not found." },
      { status: 404 },
    );
  }

  if (result.status === "forbidden") {
    return NextResponse.json(
      { ok: false, code: "FORBIDDEN", error: "You do not have access to this export job." },
      { status: 403 },
    );
  }

  if (result.status === "invalid_payload") {
    return NextResponse.json(
      { ok: false, code: "VALIDATION_ERROR", error: result.error },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      exportJob: result.exportJob,
    },
    { status: 200 },
  );
}

