import type { PlanTier, UserRole } from "@casefolio/db";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import {
  completeQueuedExportFromClient,
  MAX_CLIENT_EXPORT_BYTES,
} from "@/lib/exports/service";
import { consumeUploadRateLimit } from "@/lib/storage/rate-limit";

interface ExportCompleteContext {
  params: Promise<{ exportId: string }>;
}

async function readExportStreamWithLimit(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; bytes: Uint8Array } | { ok: false }> {
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
        return { ok: false };
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

  const rate = consumeUploadRateLimit(`export-complete:${session.user.id}`, 12, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, code: "RATE_LIMITED", error: "Too many export completion requests." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_CLIENT_EXPORT_BYTES) {
    return NextResponse.json(
      { ok: false, code: "VALIDATION_ERROR", error: "Rendered export payload exceeds maximum size." },
      { status: 413 },
    );
  }

  const { exportId } = await context.params;
  const streamRead = await readExportStreamWithLimit(request, MAX_CLIENT_EXPORT_BYTES);
  if (!streamRead.ok) {
    return NextResponse.json(
      { ok: false, code: "VALIDATION_ERROR", error: "Rendered export payload exceeds maximum size." },
      { status: 413 },
    );
  }
  const bytes = streamRead.bytes;

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

