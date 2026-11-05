import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import {
  authorizeAndReadAsset,
  deleteAssetForUser,
  updateAssetCropForUser,
} from "@/lib/storage/service";

interface RouteContext {
  params: Promise<{ assetId: string }>;
}

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  const { assetId } = await context.params;
  const ctx = await getServerSession();

  const access = await authorizeAndReadAsset(
    assetId,
    ctx
      ? {
          id: ctx.user.id,
          role: ctx.user.role,
          plan: ctx.user.plan,
        }
      : null,
  );

  if (access.status === "not_found") {
    return NextResponse.json(
      { ok: false, code: "NOT_FOUND", error: "Asset not found." },
      { status: 404 },
    );
  }

  if (access.status === "forbidden") {
    return NextResponse.json(
      {
        ok: false,
        code: "FORBIDDEN",
        error: "This image belongs to a private project and cannot be accessed until published.",
      },
      {
        status: 403,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      },
    );
  }

  return new Response(Buffer.from(access.bytes), {
    status: 200,
    headers: {
      "Content-Type": access.contentType,
      "Content-Length": String(access.bytes.byteLength),
      "Cache-Control": access.cacheControl,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  const { assetId } = await context.params;
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
      { ok: false, code: "VALIDATION_ERROR", error: "Invalid JSON payload." },
      { status: 400 },
    );
  }

  const result = await updateAssetCropForUser(assetId, body, {
    id: ctx.user.id,
    role: ctx.user.role,
    plan: ctx.user.plan,
  });

  if (!result.ok) {
    const status =
      result.code === "FORBIDDEN" ? 403 : result.code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json({ ok: true, asset: result.asset }, { status: 200 });
}

export async function DELETE(_request: Request, context: RouteContext): Promise<NextResponse> {
  const { assetId } = await context.params;
  const ctx = await getServerSession();
  if (!ctx) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", error: "Sign in required." },
      { status: 401 },
    );
  }

  const result = await deleteAssetForUser(assetId, {
    id: ctx.user.id,
    role: ctx.user.role,
    plan: ctx.user.plan,
  });

  if (!result.ok) {
    const status = result.code === "FORBIDDEN" ? 403 : 404;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
