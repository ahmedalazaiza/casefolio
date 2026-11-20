import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/session";
import {
  STEP_UP_PURPOSES,
  sendStepUpOtp,
  verifyStepUpWithOtp,
  verifyStepUpWithPassword,
} from "@/lib/auth/step-up";

const stepUpRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("send_otp"),
    purpose: z.enum(STEP_UP_PURPOSES),
    confirmEmail: z.string().trim().email().optional(),
  }),
  z.object({
    action: z.literal("verify_password"),
    purpose: z.enum(STEP_UP_PURPOSES),
    password: z.string().min(1, "Password is required.").max(256),
  }),
  z.object({
    action: z.literal("verify_otp"),
    purpose: z.enum(STEP_UP_PURPOSES),
    otp: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit security code."),
  }),
]);

export async function POST(request: Request): Promise<NextResponse> {
  const ctx = await getServerSession();
  if (!ctx) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", error: "Authentication required." },
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

  const parsed = stepUpRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        error: parsed.error.issues[0]?.message ?? "Invalid confirmation payload.",
      },
      { status: 400 },
    );
  }

  if (parsed.data.action === "send_otp") {
    if (
      parsed.data.confirmEmail &&
      parsed.data.confirmEmail.toLowerCase() !== ctx.user.email.toLowerCase()
    ) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          error: "Email confirmation does not match your account email.",
        },
        { status: 400 },
      );
    }
    const res = await sendStepUpOtp({
      userId: ctx.user.id,
      userEmail: ctx.user.email,
      sessionId: ctx.session.id,
      purpose: parsed.data.purpose,
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, code: res.code, error: res.error },
        {
          status: res.status,
          headers: res.retryAfterSeconds
            ? { "Retry-After": String(res.retryAfterSeconds) }
            : undefined,
        },
      );
    }
    return NextResponse.json(res);
  }

  if (parsed.data.action === "verify_password") {
    const res = await verifyStepUpWithPassword({
      userId: ctx.user.id,
      sessionId: ctx.session.id,
      purpose: parsed.data.purpose,
      password: parsed.data.password,
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, code: res.code, error: res.error },
        {
          status: res.status,
          headers: res.retryAfterSeconds
            ? { "Retry-After": String(res.retryAfterSeconds) }
            : undefined,
        },
      );
    }
    return NextResponse.json(res);
  }

  const res = await verifyStepUpWithOtp({
    userId: ctx.user.id,
    sessionId: ctx.session.id,
    purpose: parsed.data.purpose,
    otp: parsed.data.otp,
  });
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, code: res.code, error: res.error },
      {
        status: res.status,
        headers: res.retryAfterSeconds
          ? { "Retry-After": String(res.retryAfterSeconds) }
          : undefined,
      },
    );
  }
  return NextResponse.json(res);
}

