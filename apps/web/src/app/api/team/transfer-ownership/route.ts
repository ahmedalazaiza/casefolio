import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/session";
import { consumeStepUpToken } from "@/lib/auth/step-up";
import {
  acceptOwnerTransfer,
  cancelOrDeclineOwnerTransfer,
  requestOwnerTransfer,
} from "@/lib/entitlements/team-invitations";
import { consumeSharedRateLimit } from "@/lib/security/shared-rate-limit";

const ownerTransferSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("request"),
    organizationId: z.string().uuid(),
    targetMemberUserId: z.string().uuid(),
    stepUpToken: z.string().trim().min(20),
  }),
  z.object({
    action: z.literal("accept"),
    transferRequestId: z.string().uuid(),
    stepUpToken: z.string().trim().min(20),
  }),
  z.object({
    action: z.literal("cancel"),
    transferRequestId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("decline"),
    transferRequestId: z.string().uuid(),
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

  const rate = await consumeSharedRateLimit({
    key: `owner-transfer:${ctx.user.id}`,
    limit: 8,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      {
        ok: false,
        code: "RATE_LIMITED",
        error: "Too many ownership transfer attempts. Please wait a minute.",
      },
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

  if (parsed.data.action === "cancel" || parsed.data.action === "decline") {
    const res = await cancelOrDeclineOwnerTransfer({
      actorUserId: ctx.user.id,
      transferRequestId: parsed.data.transferRequestId,
      action: parsed.data.action,
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, code: res.code, error: res.error },
        { status: res.status },
      );
    }
    return NextResponse.json(res);
  }

  const stepUp = await consumeStepUpToken({
    userId: ctx.user.id,
    sessionId: ctx.session.id,
    purpose: "ownership_transfer",
    stepUpToken: parsed.data.stepUpToken,
  });
  if (!stepUp.ok) {
    return NextResponse.json(
      { ok: false, code: stepUp.code, error: stepUp.error },
      { status: stepUp.status },
    );
  }

  if (parsed.data.action === "request") {
    const res = await requestOwnerTransfer({
      actorUserId: ctx.user.id,
      organizationId: parsed.data.organizationId,
      targetMemberUserId: parsed.data.targetMemberUserId,
      reauthenticated: true,
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
    reauthenticated: true,
  });
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, code: res.code, error: res.error },
      { status: res.status },
    );
  }
  return NextResponse.json(res);
}
