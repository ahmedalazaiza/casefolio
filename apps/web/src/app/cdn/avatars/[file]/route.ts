import { NextResponse } from "next/server";
import { readPublicAvatarByFileName } from "@/lib/account/avatar-storage";

interface AvatarRouteContext {
  params: Promise<{ file: string }>;
}

export async function GET(
  _request: Request,
  context: AvatarRouteContext,
): Promise<NextResponse> {
  const { file } = await context.params;
  const result = await readPublicAvatarByFileName(file);

  if (result.status === "not_found") {
    return NextResponse.json({ error: "Avatar not found." }, { status: 404 });
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
