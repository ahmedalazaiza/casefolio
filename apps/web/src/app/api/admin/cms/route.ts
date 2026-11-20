import { NextResponse } from "next/server";
import { z } from "zod";
import { hasAdminRole } from "@/lib/auth/guards";
import { getServerSession } from "@/lib/auth/session";
import {
  getUncachedSiteCmsContent,
  resetSiteCmsContent,
  updateSiteCmsSection,
} from "@/lib/cms/service";
import type { CmsSectionKey } from "@/lib/cms/schema";

const putSectionSchema = z.object({
  section: z.enum(["brand", "landing", "team", "about", "pricing", "legalAndHelp"]),
  data: z.unknown(),
});

const resetSectionSchema = z.object({
  action: z.literal("reset"),
  section: z.enum(["all", "brand", "landing", "team", "about", "pricing", "legalAndHelp"]).default("all"),
});

async function ensureAdminApi() {
  const session = await getServerSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  }
  if (!hasAdminRole(session.user.role)) {
    return { error: NextResponse.json({ error: "Admin access required." }, { status: 403 }) };
  }
  return { user: session.user };
}

export async function GET() {
  const auth = await ensureAdminApi();
  if ("error" in auth) return auth.error;

  const content = await getUncachedSiteCmsContent();
  return NextResponse.json({ ok: true, content });
}

export async function PUT(request: Request) {
  const auth = await ensureAdminApi();
  if ("error" in auth) return auth.error;

  const json = await request.json().catch(() => null);
  const parsed = putSectionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid CMS section request." },
      { status: 400 },
    );
  }

  const res = await updateSiteCmsSection({
    actorId: auth.user.id,
    section: parsed.data.section as CmsSectionKey,
    data: parsed.data.data,
  });

  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, content: res.content });
}

export async function POST(request: Request) {
  const auth = await ensureAdminApi();
  if ("error" in auth) return auth.error;

  const json = await request.json().catch(() => null);
  const parsed = resetSectionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid reset payload." },
      { status: 400 },
    );
  }

  const content = await resetSiteCmsContent({
    actorId: auth.user.id,
    section: parsed.data.section,
  });

  return NextResponse.json({ ok: true, content });
}
