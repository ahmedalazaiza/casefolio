import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/session";
import {
  archiveProjectForUser,
  unarchiveProjectForUser,
} from "@/lib/projects/dashboard";
import {
  copyProjectAcrossWorkspaces,
  createSpaceForUser,
  moveProjectBetweenSpaces,
  transitionSpaceVisibility,
} from "@/lib/workspaces/service";

const spacesActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    workspaceId: z.string().uuid(),
    name: z.string().min(2).max(60),
    visibility: z.enum(["private", "shared"]),
  }),
  z.object({
    action: z.literal("transition_visibility"),
    spaceId: z.string().uuid(),
    targetVisibility: z.enum(["private", "shared"]),
    confirmed: z.boolean(),
  }),
  z.object({
    action: z.literal("move_project"),
    projectId: z.string().uuid(),
    destinationSpaceId: z.string().uuid(),
    confirmed: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("copy_project"),
    projectId: z.string().uuid(),
    destinationSpaceId: z.string().uuid().optional(),
  }),
  z.object({
    action: z.literal("archive_project"),
    projectId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("unarchive_project"),
    projectId: z.string().uuid(),
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

  const parsed = spacesActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        error: parsed.error.issues[0]?.message ?? "Invalid space action payload.",
      },
      { status: 400 },
    );
  }

  const data = parsed.data;

  if (data.action === "create") {
    const res = await createSpaceForUser({
      actorUserId: ctx.user.id,
      workspaceId: data.workspaceId,
      name: data.name,
      visibility: data.visibility,
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, code: res.code, error: res.error },
        { status: res.status },
      );
    }
    return NextResponse.json(res, { status: 201 });
  }

  if (data.action === "transition_visibility") {
    const res = await transitionSpaceVisibility({
      actorUserId: ctx.user.id,
      spaceId: data.spaceId,
      targetVisibility: data.targetVisibility,
      confirmed: data.confirmed,
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, code: res.code, error: res.error },
        { status: res.status },
      );
    }
    return NextResponse.json(res);
  }

  if (data.action === "move_project") {
    const res = await moveProjectBetweenSpaces({
      actorUserId: ctx.user.id,
      projectId: data.projectId,
      destinationSpaceId: data.destinationSpaceId,
      confirmed: data.confirmed,
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, code: res.code, error: res.error },
        { status: res.status },
      );
    }
    return NextResponse.json(res);
  }

  if (data.action === "copy_project") {
    const res = await copyProjectAcrossWorkspaces({
      actorUserId: ctx.user.id,
      projectId: data.projectId,
      destinationSpaceId: data.destinationSpaceId,
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, code: res.code, error: res.error },
        { status: res.status },
      );
    }
    return NextResponse.json(res, { status: 201 });
  }

  if (data.action === "archive_project") {
    const res = await archiveProjectForUser(
      { projectId: data.projectId },
      { id: ctx.user.id, role: ctx.user.role },
    );
    if (!res.ok) {
      const status = res.code === "NOT_FOUND" ? 404 : 403;
      return NextResponse.json(res, { status });
    }
    return NextResponse.json(res);
  }

  const res = await unarchiveProjectForUser(
    { projectId: data.projectId },
    { id: ctx.user.id, role: ctx.user.role },
  );
  if (!res.ok) {
    const status = res.code === "NOT_FOUND" ? 404 : 403;
    return NextResponse.json(res, { status });
  }
  return NextResponse.json(res);
}
