import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import {
  cancelUserSubscription,
  createPaddlePortalSessionForUser,
  resumeUserSubscription,
} from "@/lib/billing/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const sessionData = await getServerSession();
  if (!sessionData) {
    return NextResponse.json(
      { ok: false, error: "Sign in required." },
      { status: 401 },
    );
  }

  let orgId: string | null = null;
  try {
    const body = (await request.json()) as { orgId?: string | null };
    if (typeof body?.orgId === "string") orgId = body.orgId;
  } catch {
    // Optional body
  }

  const result = await createPaddlePortalSessionForUser(sessionData.user.id, orgId);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}

export async function DELETE(request: Request) {
  const sessionData = await getServerSession();
  if (!sessionData) {
    return NextResponse.json(
      { ok: false, error: "Sign in required." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const result = await cancelUserSubscription(
    {
      id: sessionData.user.id,
      email: sessionData.user.email,
      name: sessionData.user.name,
    },
    body,
  );

  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}

export async function PATCH(request: Request) {
  const sessionData = await getServerSession();
  if (!sessionData) {
    return NextResponse.json(
      { ok: false, error: "Sign in required." },
      { status: 401 },
    );
  }

  let orgId: string | null = null;
  try {
    const body = (await request.json()) as { orgId?: string | null };
    if (typeof body?.orgId === "string") orgId = body.orgId;
  } catch {
    // Optional body
  }

  const result = await resumeUserSubscription(
    {
      id: sessionData.user.id,
      email: sessionData.user.email,
      name: sessionData.user.name,
    },
    orgId,
  );

  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
