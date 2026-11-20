import { NextResponse } from "next/server";
import { readPublicCmsAssetByFileName } from "@/lib/cms/media-storage";

interface CmsMediaRouteContext {
  params: Promise<{ file: string }>;
}

export async function GET(
  _request: Request,
  context: CmsMediaRouteContext,
): Promise<NextResponse> {
  const { file } = await context.params;
  const result = await readPublicCmsAssetByFileName(file);

  if (result.status === "not_found") {
    return NextResponse.json({ error: "CMS asset not found." }, { status: 404 });
  }

  const bodyBuffer = result.bytes.buffer.slice(
    result.bytes.byteOffset,
    result.bytes.byteOffset + result.bytes.byteLength,
  ) as ArrayBuffer;

  const headers: Record<string, string> = {
    "Content-Type": result.contentType,
    "Content-Length": String(result.bytes.byteLength),
    "Cache-Control": result.cacheControl,
    "X-Content-Type-Options": "nosniff",
  };

  if (result.isSvg) {
    headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
  }

  return new NextResponse(bodyBuffer, { status: 200, headers });
}
