import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { createGatedTeamInvitation } from "@/lib/entitlements/team-invitations";

export async function POST(request: Request) {
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

  const result = await createGatedTeamInvitation({
    actorUserId: ctx.user.id,
    rawInput: body,
    requestHeaders: request.headers,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, code: result.code, error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    invitation: {
      id: result.invitationId,
      email: result.email,
      role: result.role,
    },
  });
}
