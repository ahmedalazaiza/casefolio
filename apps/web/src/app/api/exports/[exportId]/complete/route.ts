import type { PlanTier, UserRole } from "@casefolio/db";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import {
  completeQueuedExportFromClient,
  failQueuedExportFromClient,
  finalizePresignedExportFromClient,
  MAX_CLIENT_EXPORT_BYTES,
  presignQueuedExportFromClient,
} from "@/lib/exports/service";
import { clientExportCompleteActionSchema } from "@/lib/exports/types";
import { sanitizeErrorForLogging } from "@/lib/security/redact";
import { consumeSharedRateLimit } from "@/lib/security/shared-rate-limit";

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
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, code: "UNAUTHORIZED", error: "Please sign in to finalize exports." },
        { status: 401 },
      );
    }

    const rate = await consumeSharedRateLimit(`export-complete:${session.user.id}`, 36, 60_000);
    if (!rate.allowed) {
      return NextResponse.json(
        { ok: false, code: "RATE_LIMITED", error: "Too many export completion requests." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }

    const actor = {
      id: session.user.id,
      role: ((session.user.role as UserRole | undefined) ?? "user") as UserRole,
      plan: ((session.user.plan as PlanTier | undefined) ?? "free") as PlanTier,
    };

    const { exportId } = await context.params;
    const contentTypeHeader = (request.headers.get("content-type") ?? "").toLowerCase();

    if (contentTypeHeader.includes("application/json")) {
      let rawJson: unknown;
      try {
        rawJson = await request.json();
      } catch {
        return NextResponse.json(
          { ok: false, code: "VALIDATION_ERROR", error: "Invalid JSON request body." },
          { status: 400 },
        );
      }

      const parsedAction = clientExportCompleteActionSchema.safeParse(rawJson);
      if (!parsedAction.success) {
        return NextResponse.json(
          {
            ok: false,
            code: "VALIDATION_ERROR",
            error: parsedAction.error.issues[0]?.message ?? "Invalid export completion action.",
          },
          { status: 400 },
        );
      }

      const actionInput = parsedAction.data;
      if (actionInput.action === "presign") {
        const presignRes = await presignQueuedExportFromClient(
          exportId,
          {
            contentType: actionInput.contentType,
            byteLength: actionInput.byteLength,
          },
          actor,
        );

        if (presignRes.status === "not_found") {
          return NextResponse.json(
            { ok: false, code: "NOT_FOUND", error: "Export job not found." },
            { status: 404 },
          );
        }
        if (presignRes.status === "forbidden") {
          return NextResponse.json(
            { ok: false, code: "FORBIDDEN", error: "You do not have access to this export job." },
            { status: 403 },
          );
        }
        if (presignRes.status === "invalid_payload") {
          return NextResponse.json(
            { ok: false, code: "VALIDATION_ERROR", error: presignRes.error },
            { status: 400 },
          );
        }
        if (presignRes.status === "conflict") {
          return NextResponse.json(
            {
              ok: false,
              code: "EXPORT_IN_PROGRESS",
              error: `Export is already ${presignRes.jobStatus}.`,
            },
            { status: 409 },
          );
        }
        if (presignRes.status === "already_completed") {
          return NextResponse.json({
            ok: true,
            mode: "already_completed" as const,
            exportJob: presignRes.exportJob,
          });
        }

        return NextResponse.json({
          ok: true,
          ...presignRes,
        });
      }

      if (actionInput.action === "finalize") {
        const finalizeRes = await finalizePresignedExportFromClient(
          exportId,
          {
            r2Key: actionInput.r2Key,
            contentType: actionInput.contentType,
            byteLength: actionInput.byteLength,
          },
          actor,
        );

        if (finalizeRes.status === "not_found") {
          return NextResponse.json(
            { ok: false, code: "NOT_FOUND", error: "Export job not found." },
            { status: 404 },
          );
        }
        if (finalizeRes.status === "forbidden") {
          return NextResponse.json(
            { ok: false, code: "FORBIDDEN", error: "You do not have access to this export job." },
            { status: 403 },
          );
        }
        if (finalizeRes.status === "invalid_payload") {
          return NextResponse.json(
            { ok: false, code: "VALIDATION_ERROR", error: finalizeRes.error },
            { status: 400 },
          );
        }

        return NextResponse.json({
          ok: true,
          exportJob: finalizeRes.exportJob,
        });
      }

      const failRes = await failQueuedExportFromClient(exportId, actionInput.error, actor);
      if (failRes.status === "not_found") {
        return NextResponse.json(
          { ok: false, code: "NOT_FOUND", error: "Export job not found." },
          { status: 404 },
        );
      }
      if (failRes.status === "forbidden") {
        return NextResponse.json(
          { ok: false, code: "FORBIDDEN", error: "You do not have access to this export job." },
          { status: 403 },
        );
      }
      return NextResponse.json({
        ok: true,
        exportJob: failRes.exportJob,
      });
    }

    const declaredLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > MAX_CLIENT_EXPORT_BYTES) {
      return NextResponse.json(
        { ok: false, code: "VALIDATION_ERROR", error: "Rendered export payload exceeds maximum size." },
        { status: 413 },
      );
    }

    const streamRead = await readExportStreamWithLimit(request, MAX_CLIENT_EXPORT_BYTES);
    if (!streamRead.ok) {
      return NextResponse.json(
        { ok: false, code: "VALIDATION_ERROR", error: "Rendered export payload exceeds maximum size." },
        { status: 413 },
      );
    }
    const bytes = streamRead.bytes;

    const result = await completeQueuedExportFromClient(exportId, bytes, actor);

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
  } catch (err) {
    const safeErr = sanitizeErrorForLogging(err);
    console.error("[api/exports/[exportId]/complete] unexpected POST error:", safeErr.message);
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        error: "Unable to finalize export right now.",
      },
      { status: 500 },
    );
  }
}
