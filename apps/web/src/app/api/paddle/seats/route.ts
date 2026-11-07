import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/session";
import {
  cancelPendingTeamSeatDecrease,
  confirmTeamSeatIncrease,
  previewTeamSeatIncrease,
  scheduleTeamSeatDecrease,
  selectPersonalKeepPublicProject,
} from "@/lib/billing/service";

export const runtime = "nodejs";

const seatActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("preview_increase"),
    organizationId: z.string().uuid(),
    targetSeats: z.number().int().min(1),
  }),
  z.object({
    action: z.literal("confirm_increase"),
    organizationId: z.string().uuid(),
    operationId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("schedule_decrease"),
    organizationId: z.string().uuid(),
    targetSeats: z.number().int().min(1),
  }),
  z.object({
    action: z.literal("cancel_decrease"),
    organizationId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("keep_public_project"),
    projectId: z.string().uuid().nullable(),
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

  const parsed = seatActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        error: parsed.error.issues[0]?.message ?? "Invalid seat operation request.",
      },
      { status: 400 },
    );
  }

  const data = parsed.data;

  if (data.action === "preview_increase") {
    const res = await previewTeamSeatIncrease({
      actorUserId: ctx.user.id,
      organizationId: data.organizationId,
      targetSeats: data.targetSeats,
    });
    if (!res.ok) {
      const status =
        res.code === "FORBIDDEN"
          ? 403
          : res.code === "QUANTITY_LOCKED" || res.code === "PENDING_DECREASE_CONFLICT"
            ? 409
            : 400;
      return NextResponse.json(res, { status });
    }
    return NextResponse.json(res);
  }

  if (data.action === "confirm_increase") {
    const res = await confirmTeamSeatIncrease({
      actorUserId: ctx.user.id,
      organizationId: data.organizationId,
      operationId: data.operationId,
    });
    if (!res.ok) {
      const status =
        res.code === "FORBIDDEN"
          ? 403
          : res.code === "NOT_FOUND"
            ? 404
            : res.code === "PAYMENT_FAILED"
              ? 402
              : 409;
      return NextResponse.json(res, { status });
    }
    return NextResponse.json(res);
  }

  if (data.action === "schedule_decrease") {
    const res = await scheduleTeamSeatDecrease({
      actorUserId: ctx.user.id,
      organizationId: data.organizationId,
      targetSeats: data.targetSeats,
    });
    if (!res.ok) {
      const status =
        res.code === "FORBIDDEN"
          ? 403
          : res.code === "SEATS_IN_USE" || res.code === "QUANTITY_LOCKED"
            ? 409
            : 400;
      return NextResponse.json(res, { status });
    }
    return NextResponse.json(res);
  }

  if (data.action === "cancel_decrease") {
    const res = await cancelPendingTeamSeatDecrease({
      actorUserId: ctx.user.id,
      organizationId: data.organizationId,
    });
    if (!res.ok) {
      const status =
        res.code === "FORBIDDEN"
          ? 403
          : res.code === "NO_PENDING_DECREASE" || res.code === "QUANTITY_LOCKED"
            ? 409
            : 400;
      return NextResponse.json(res, { status });
    }
    return NextResponse.json(res);
  }

  const res = await selectPersonalKeepPublicProject({
    actorUserId: ctx.user.id,
    projectId: data.projectId,
  });
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  }
  return NextResponse.json(res);
}

