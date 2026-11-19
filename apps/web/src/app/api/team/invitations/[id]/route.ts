import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/session";
import {
  acceptTeamInvitation,
  declineTeamInvitation,
  resendTeamInvitation,
  revokeTeamInvitation,
} from "@/lib/entitlements/team-invitations";
import { consumeSharedRateLimit } from "@/lib/security/shared-rate-limit";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const invitationPostSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("resend"),
  }),
  z.object({
    action: z.literal("accept"),
    token: z.string().min(8).optional(),
  }),
  z.object({
    action: z.literal("decline"),
    token: z.string().min(8).optional(),
  }),
]);

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const ctx = await getServerSession();
  if (!ctx) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", error: "Sign in required." },
      { status: 401 },
    );
  }

  const rate = await consumeSharedRateLimit({
    key: `team-invite-action:${ctx.user.id}`,
    limit: 20,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      {
        ok: false,
        code: "RATE_LIMITED",
        error: `Too many invitation actions. Retry in ${rate.retryAfterSeconds}s.`,
      },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = { action: "accept" };
  }

  const parsed = invitationPostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, code: "VALIDATION_ERROR", error: "Invalid invitation action." },
      { status: 400 },
    );
  }

  if (parsed.data.action === "resend") {
    const res = await resendTeamInvitation({
      actorUserId: ctx.user.id,
      invitationId: id,
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, code: res.code, error: res.error },
        { status: res.status },
      );
    }
    return NextResponse.json({
      ok: true,
      invitationId: res.invitationId,
      expiresAtIso: res.expiresAtIso,
      inviteUrl: res.inviteUrl,
      emailDelivered: res.emailDelivered,
    });
  }

  if (parsed.data.action === "decline") {
    const res = await declineTeamInvitation({
      actorUserId: ctx.user.id,
      invitationId: id,
      token: parsed.data.token,
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, code: res.code, error: res.error },
        { status: res.status },
      );
    }
    return NextResponse.json(res);
  }

  const res = await acceptTeamInvitation({
    actorUserId: ctx.user.id,
    invitationId: id,
    token: parsed.data.token,
  });
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, code: res.code, error: res.error },
      { status: res.status },
    );
  }
  return NextResponse.json(res);
}

export async function DELETE(_request: Request, context: RouteContext): Promise<NextResponse> {
  const ctx = await getServerSession();
  if (!ctx) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", error: "Sign in required." },
      { status: 401 },
    );
  }

  const rate = await consumeSharedRateLimit({
    key: `team-invite-action:${ctx.user.id}`,
    limit: 20,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      {
        ok: false,
        code: "RATE_LIMITED",
        error: `Too many invitation actions. Retry in ${rate.retryAfterSeconds}s.`,
      },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const { id } = await context.params;
  const res = await revokeTeamInvitation({
    actorUserId: ctx.user.id,
    invitationId: id,
  });
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, code: res.code, error: res.error },
      { status: res.status },
    );
  }
  return NextResponse.json(res);
}

