import { NextResponse } from "next/server";
import { readPublicTemplateCoverByFileName } from "@/lib/template/cover-storage";

interface CoverRouteContext {
  params: Promise<{ file: string }>;
}

export async function GET(
  _request: Request,
  context: CoverRouteContext,
): Promise<NextResponse> {
  const { file } = await context.params;
  const result = await readPublicTemplateCoverByFileName(file);

  if (result.status === "not_found") {
    return NextResponse.json({ error: "Cover image not found." }, { status: 404 });
  }

  const bodyBuffer = result.bytes.buffer.slice(
    result.bytes.byteOffset,
    result.bytes.byteOffset + result.bytes.byteLength,
  ) as ArrayBuffer;

  return new NextResponse(bodyBuffer, {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Content-Length": String(result.bytes.byteLength),
      "Cache-Control": result.cacheControl,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

