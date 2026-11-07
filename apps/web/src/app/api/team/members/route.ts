import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/session";
import {
  removeTeamMemberWithRecovery,
  updateTeamMemberRole,
} from "@/lib/entitlements/team-invitations";

const updateRoleSchema = z.object({
  organizationId: z.string().uuid(),
  targetUserId: z.string().uuid(),
  role: z.enum(["admin", "member"]),
});

const removeMemberSchema = z.object({
  organizationId: z.string().uuid(),
  targetUserId: z.string().uuid(),
});

export async function PATCH(request: Request): Promise<NextResponse> {
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

  const parsed = updateRoleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        error: parsed.error.issues[0]?.message ?? "Invalid role update payload.",
      },
      { status: 400 },
    );
  }

  const res = await updateTeamMemberRole({
    actorUserId: ctx.user.id,
    organizationId: parsed.data.organizationId,
    targetUserId: parsed.data.targetUserId,
    newRole: parsed.data.role,
  });

  if (!res.ok) {
    return NextResponse.json(
      { ok: false, code: res.code, error: res.error },
      { status: res.status },
    );
  }

  return NextResponse.json(res);
}

export async function DELETE(request: Request): Promise<NextResponse> {
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

  const parsed = removeMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        error: parsed.error.issues[0]?.message ?? "Invalid member removal payload.",
      },
      { status: 400 },
    );
  }

  const res = await removeTeamMemberWithRecovery({
    actorUserId: ctx.user.id,
    organizationId: parsed.data.organizationId,
    targetUserId: parsed.data.targetUserId,
  });

  if (!res.ok) {
    return NextResponse.json(
      { ok: false, code: res.code, error: res.error },
      { status: res.status },
    );
  }

  return NextResponse.json(res);
}

