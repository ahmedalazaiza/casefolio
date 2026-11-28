import { eq } from "@casefolio/db";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { storeUserAvatarImage } from "@/lib/account/avatar-storage";
import { getServerSession } from "@/lib/auth/session";
import { db, dbSchema } from "@/lib/db";
import { consumeUploadRateLimit } from "@/lib/storage/rate-limit";

export async function POST(request: Request): Promise<NextResponse> {
  const ctx = await getServerSession();
  if (!ctx?.user?.id) {
    return NextResponse.json(
      { ok: false, error: "Please sign in to upload a profile photo." },
      { status: 401 },
    );
  }

  const rate = consumeUploadRateLimit(`avatar:${ctx.user.id}`, 30, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: `Too many avatar uploads. Retry in ${rate.retryAfterSeconds}s.` },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Expected multipart form upload." },
      { status: 400 },
    );
  }

  const fileEntry = formData.get("file");
  if (!(fileEntry instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "Missing image file." },
      { status: 400 },
    );
  }

  const arrayBuffer = await fileEntry.arrayBuffer();
  const stored = await storeUserAvatarImage({
    bytes: new Uint8Array(arrayBuffer),
    previousAvatarUrl: ctx.user.image,
  });
  if (!stored.ok) {
    return NextResponse.json({ ok: false, error: stored.error }, { status: stored.status });
  }

  const skipDbUpdate = formData.get("skipDbUpdate") === "1";
  if (!skipDbUpdate) {
    await db
      .update(dbSchema.users)
      .set({
        image: stored.avatarUrl,
        updatedAt: new Date(),
      })
      .where(eq(dbSchema.users.id, ctx.user.id));

    revalidatePath("/account");
    revalidatePath("/dashboard");
  }

  return NextResponse.json(
    {
      ok: true,
      avatarUrl: stored.avatarUrl,
      mimeType: stored.mimeType,
    },
    { status: 200 },
  );
}
