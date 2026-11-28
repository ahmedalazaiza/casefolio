import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/session";
import {
  archiveProjectForUser,
  unarchiveProjectForUser,
} from "@/lib/projects/dashboard";
import { consumeSharedRateLimit } from "@/lib/security/shared-rate-limit";
import { ACTIVE_SPACE_COOKIE_NAME } from "@/lib/workspaces/active-space";
import {
  copyProjectAcrossWorkspaces,
  createSpaceForUser,
  deleteSpaceForUser,
  listWorkspaceSwitcherState,
  moveProjectBetweenSpaces,
  renameSpaceForUser,
  transitionSpaceVisibility,
} from "@/lib/workspaces/service";

const spacesActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("select_space"),
    spaceId: z.string().min(1),
  }),
  z.object({
    action: z.literal("create"),
    workspaceId: z.string().uuid(),
    name: z.string().min(2).max(60),
    visibility: z.enum(["private", "shared"]),
  }),
  z.object({
    action: z.literal("rename"),
    spaceId: z.string().uuid(),
    name: z.string().trim().min(2).max(60),
  }),
  z.object({
    action: z.literal("delete"),
    spaceId: z.string().uuid(),
    moveProjectsToSpaceId: z.string().uuid().optional(),
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

  const rate = await consumeSharedRateLimit({
    key:
      data.action === "copy_project"
        ? `spaces-copy:${ctx.user.id}`
        : `spaces-mutate:${ctx.user.id}`,
    limit: data.action === "copy_project" ? 10 : 60,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      {
        ok: false,
        code: "RATE_LIMITED",
        error: `Too many workspace operations. Please wait ${rate.retryAfterSeconds}s.`,
      },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  if (data.action === "select_space") {
    let nextActiveSpaceId = "all";
    if (data.spaceId !== "all") {
      if (!z.string().uuid().safeParse(data.spaceId).success) {
        return NextResponse.json(
          { ok: false, code: "VALIDATION_ERROR", error: "Invalid space identifier." },
          { status: 400 },
        );
      }
      const switcher = await listWorkspaceSwitcherState(
        ctx.user.id,
        ctx.session.activeOrganizationId ?? null,
      );
      if (!switcher.spaces.some((sp) => sp.id === data.spaceId)) {
        return NextResponse.json(
          { ok: false, code: "NOT_FOUND", error: "Space not found." },
          { status: 404 },
        );
      }
      nextActiveSpaceId = data.spaceId;
    }

    const response = NextResponse.json({ ok: true, activeSpaceId: nextActiveSpaceId });
    response.cookies.set(ACTIVE_SPACE_COOKIE_NAME, nextActiveSpaceId, {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  }

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
    revalidatePath("/spaces");
    revalidatePath("/dashboard");
    return NextResponse.json(res, { status: 201 });
  }

  if (data.action === "rename") {
    const res = await renameSpaceForUser({
      actorUserId: ctx.user.id,
      spaceId: data.spaceId,
      name: data.name,
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, code: res.code, error: res.error },
        { status: res.status },
      );
    }
    revalidatePath("/spaces");
    revalidatePath("/dashboard");
    return NextResponse.json(res);
  }

  if (data.action === "delete") {
    const res = await deleteSpaceForUser({
      actorUserId: ctx.user.id,
      spaceId: data.spaceId,
      moveProjectsToSpaceId: data.moveProjectsToSpaceId,
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, code: res.code, error: res.error },
        { status: res.status },
      );
    }
    revalidatePath("/spaces");
    revalidatePath("/dashboard");
    const response = NextResponse.json(res);
    response.cookies.set(ACTIVE_SPACE_COOKIE_NAME, "all", {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
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
    revalidatePath("/spaces");
    revalidatePath("/dashboard");
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
    revalidatePath("/spaces");
    revalidatePath("/dashboard");
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
    revalidatePath("/spaces");
    revalidatePath("/dashboard");
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
