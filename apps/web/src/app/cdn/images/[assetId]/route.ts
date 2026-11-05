import { verifyExportRenderToken } from "@casefolio/worker/token";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { authorizeAndReadAsset } from "@/lib/storage/service";

interface CdnRouteContext {
  params: Promise<{ assetId: string }>;
}

export async function GET(request: Request, context: CdnRouteContext): Promise<Response> {
  const { assetId } = await context.params;
  const ctx = await getServerSession();
  const reqUrl = new URL(request.url);
  const rawExportToken =
    request.headers.get("x-casefolio-export-token") ?? reqUrl.searchParams.get("exportToken");
  const verifiedExport = verifyExportRenderToken(rawExportToken);

  const access = await authorizeAndReadAsset(
    assetId,
    ctx
      ? {
          id: ctx.user.id,
          role: ctx.user.role,
          plan: ctx.user.plan,
        }
      : null,
    {
      authorizedExportProjectId: verifiedExport?.projectId ?? null,
    },
  );

  if (access.status === "not_found") {
    return NextResponse.json(
      { ok: false, code: "NOT_FOUND", error: "Image not found." },
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

  const rawW = reqUrl.searchParams.get("w");
  const requestedWidth = rawW && /^\d{1,5}$/.test(rawW) ? rawW : String(access.asset.width);
  const cx = reqUrl.searchParams.get("cx");
  const cy = reqUrl.searchParams.get("cy");
  const cw = reqUrl.searchParams.get("cw");
  const ch = reqUrl.searchParams.get("ch");

  const headers = new Headers({
    "Content-Type": access.contentType,
    "Content-Length": String(access.bytes.byteLength),
    "Cache-Control": access.cacheControl,
    "X-Content-Type-Options": "nosniff",
    "X-Casefolio-CDN": "cloudflare-images-compat",
    "X-Casefolio-Variant-Width": requestedWidth,
    Vary: "Accept",
  });

  const numRegex = /^\d{1,5}(?:\.\d{1,4})?$/;
  if (
    cx &&
    cy &&
    cw &&
    ch &&
    numRegex.test(cx) &&
    numRegex.test(cy) &&
    numRegex.test(cw) &&
    numRegex.test(ch)
  ) {
    headers.set("X-Casefolio-Crop", `${cx},${cy},${cw},${ch}`);
  }

  return new Response(Buffer.from(access.bytes), {
    status: 200,
    headers,
  });
}
