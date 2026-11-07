import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/session";
import { consumeUploadRateLimit } from "@/lib/storage/rate-limit";
import {
  copyProjectAcrossWorkspaces,
  exportProjectPortabilityJson,
  listRecoverySpacesForUser,
} from "@/lib/workspaces/service";

const recoveryActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("copy_to_personal"),
    projectId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("export_portability"),
    projectId: z.string().uuid(),
  }),
]);

export async function GET(): Promise<NextResponse> {
  const ctx = await getServerSession();
  if (!ctx) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", error: "Sign in required." },
      { status: 401 },
    );
  }

  const recoverySpaces = await listRecoverySpacesForUser(ctx.user.id);
  return NextResponse.json({
    ok: true,
    recoverySpaces,
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const ctx = await getServerSession();
  if (!ctx) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", error: "Sign in required." },
      { status: 401 },
    );
  }

  const rate = consumeUploadRateLimit(`recovery:${ctx.user.id}`, 20, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        ok: false,
        code: "RATE_LIMITED",
        error: `Too many recovery requests. Retry in ${rate.retryAfterSeconds}s.`,
      },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: "VALIDATION_ERROR", error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const parsed = recoveryActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, code: "VALIDATION_ERROR", error: "Invalid recovery action." },
      { status: 400 },
    );
  }

  if (parsed.data.action === "copy_to_personal") {
    const res = await copyProjectAcrossWorkspaces({
      actorUserId: ctx.user.id,
      projectId: parsed.data.projectId,
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, code: res.code, error: res.error },
        { status: res.status },
      );
    }
    return NextResponse.json(res, { status: 201 });
  }

  const res = await exportProjectPortabilityJson({
    actorUserId: ctx.user.id,
    projectId: parsed.data.projectId,
  });
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, code: res.code, error: res.error },
      { status: res.status },
    );
  }
  return NextResponse.json(res, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}

