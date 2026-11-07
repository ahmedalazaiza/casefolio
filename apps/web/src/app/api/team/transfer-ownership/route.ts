import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/session";
import {
  acceptOwnerTransfer,
  requestOwnerTransfer,
} from "@/lib/entitlements/team-invitations";

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

