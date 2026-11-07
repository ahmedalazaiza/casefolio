import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { authorizeProjectAccess } from "@/lib/workspaces/acl";
import {
  acquireOrRefreshEditLease,
  inspectProjectEditLease,
  releaseEditLease,
} from "@/lib/workspaces/leases";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  const ctx = await getServerSession();
  if (!ctx) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", error: "Sign in required." },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json(
      { ok: false, code: "NOT_FOUND", error: "Project not found." },
      { status: 404 },
    );
  }

  const auth = await authorizeProjectAccess(id, ctx.user.id, "read");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, error: auth.error },
      { status: auth.status },
    );
  }

  const lease = await inspectProjectEditLease(id, ctx.user.id);
  return NextResponse.json(
    { ok: true, lease },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const ctx = await getServerSession();
  if (!ctx) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", error: "Sign in required." },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json(
      { ok: false, code: "NOT_FOUND", error: "Project not found." },
      { status: 404 },
    );
  }

  let leaseToken: string | undefined;
  try {
    const body = (await request.json()) as { leaseToken?: string };
    if (typeof body?.leaseToken === "string") leaseToken = body.leaseToken;
  } catch {
    // Optional body
  }

  const res = await acquireOrRefreshEditLease({
    projectId: id,
    actorUserId: ctx.user.id,
    leaseToken,
  });

  if (!res.ok) {
    return NextResponse.json(
      { ok: false, code: res.code, error: res.error, lease: res.lease ?? null },
      { status: res.status },
    );
  }

  return NextResponse.json({ ok: true, lease: res.lease });
}

export async function DELETE(request: Request, context: RouteContext): Promise<NextResponse> {
  const ctx = await getServerSession();
  if (!ctx) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", error: "Sign in required." },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json(
      { ok: false, code: "NOT_FOUND", error: "Project not found." },
      { status: 404 },
    );
  }

  let leaseToken: string | undefined;
  try {
    const body = (await request.json()) as { leaseToken?: string };
    if (typeof body?.leaseToken === "string") leaseToken = body.leaseToken;
  } catch {
    // Optional body
  }

  const res = await releaseEditLease({
    projectId: id,
    actorUserId: ctx.user.id,
    leaseToken,
  });

  return NextResponse.json({ ok: true, released: res.released });
}

