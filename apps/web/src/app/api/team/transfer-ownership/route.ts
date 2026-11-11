import { eq } from "@casefolio/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/session";
import { db, dbSchema } from "@/lib/db";
import {
  acceptOwnerTransfer,
  requestOwnerTransfer,
} from "@/lib/entitlements/team-invitations";
import { consumeUploadRateLimit } from "@/lib/storage/rate-limit";

const MAX_RECENT_SESSION_AGE_MS = 24 * 60 * 60 * 1000;

const ownerTransferSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("request"),
    organizationId: z.string().uuid(),
    targetMemberUserId: z.string().uuid(),
    reauthenticated: z.boolean(),
  }),
  z.object({
    action: z.literal("accept"),
    transferRequestId: z.string().uuid(),
    reauthenticated: z.boolean(),
  }),
]);

export async function POST(request: Request): Promise<NextResponse> {
  const ctx = await getServerSession();
  if (!ctx) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", error: "Sign in required." },
      { status: 401 },
    );
  }

  const rate = consumeUploadRateLimit(`owner-transfer:${ctx.user.id}`, 8, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, code: "RATE_LIMITED", error: "Too many ownership transfer attempts. Please wait a minute." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
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

  const parsed = ownerTransferSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        error: parsed.error.issues[0]?.message ?? "Invalid ownership transfer payload.",
      },
      { status: 400 },
    );
  }

  const [sessionRow] = await db
    .select({
      createdAt: dbSchema.sessions.createdAt,
      updatedAt: dbSchema.sessions.updatedAt,
    })
    .from(dbSchema.sessions)
    .where(eq(dbSchema.sessions.id, ctx.session.id))
    .limit(1);
  const sessionStamp = sessionRow?.updatedAt ?? sessionRow?.createdAt;
  const isSessionFresh =
    sessionStamp instanceof Date
      ? Date.now() - sessionStamp.getTime() <= MAX_RECENT_SESSION_AGE_MS
      : true;
  const verifiedReauthenticated = Boolean(parsed.data.reauthenticated && isSessionFresh);
  if (!verifiedReauthenticated) {
    return NextResponse.json(
      {
        ok: false,
        code: "REAUTH_REQUIRED",
        error: "Recent sign-in confirmation is required before transferring workspace ownership.",
      },
      { status: 400 },
    );
  }

  if (parsed.data.action === "request") {
    const res = await requestOwnerTransfer({
      actorUserId: ctx.user.id,
      organizationId: parsed.data.organizationId,
      targetMemberUserId: parsed.data.targetMemberUserId,
      reauthenticated: parsed.data.reauthenticated,
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, code: res.code, error: res.error },
        { status: res.status },
      );
    }
    return NextResponse.json(res);
  }

  const res = await acceptOwnerTransfer({
    actorUserId: ctx.user.id,
    transferRequestId: parsed.data.transferRequestId,
    reauthenticated: parsed.data.reauthenticated,
  });
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, code: res.code, error: res.error },
      { status: res.status },
    );
  }
  return NextResponse.json(res);
}

