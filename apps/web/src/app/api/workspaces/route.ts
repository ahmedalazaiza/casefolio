import { and, eq } from "@casefolio/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/session";
import { db, dbSchema } from "@/lib/db";
import {
  getWorkspaceUsageSnapshot,
  listVisibleSpacesForWorkspace,
  listWorkspaceSwitcherState,
} from "@/lib/workspaces/service";

const switchWorkspaceSchema = z.object({
  organizationId: z.string().uuid().nullable(),
});

export async function GET(): Promise<NextResponse> {
  const ctx = await getServerSession();
  if (!ctx) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", error: "Sign in required." },
      { status: 401 },
    );
  }

  const switcher = await listWorkspaceSwitcherState(
    ctx.user.id,
    ctx.session.activeOrganizationId ?? null,
  );
  const [spaces, usage] = await Promise.all([
    listVisibleSpacesForWorkspace(switcher.activeWorkspace.workspaceId, ctx.user.id),
    getWorkspaceUsageSnapshot(switcher.activeWorkspace.workspaceId),
  ]);

  return NextResponse.json({
    ok: true,
    switcher,
    spaces,
    usage,
  });
}

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

  const parsed = switchWorkspaceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, code: "VALIDATION_ERROR", error: "Invalid workspace switch payload." },
      { status: 400 },
    );
  }

  const targetOrgId = parsed.data.organizationId;

  if (targetOrgId !== null) {
    const [mem] = await db
      .select({ id: dbSchema.memberships.id })
      .from(dbSchema.memberships)
      .where(
        and(
          eq(dbSchema.memberships.orgId, targetOrgId),
          eq(dbSchema.memberships.userId, ctx.user.id),
        ),
      )
      .limit(1);

    if (!mem) {
      return NextResponse.json(
        { ok: false, code: "NOT_FOUND", error: "Workspace not found." },
        { status: 404 },
      );
    }
  }

  await db
    .update(dbSchema.sessions)
    .set({
      activeOrganizationId: targetOrgId,
      updatedAt: new Date(),
    })
    .where(eq(dbSchema.sessions.id, ctx.session.id));

  const switcher = await listWorkspaceSwitcherState(ctx.user.id, targetOrgId);
  return NextResponse.json({
    ok: true,
    switcher,
  });
}
