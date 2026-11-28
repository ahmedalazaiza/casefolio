import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hasAdminRole } from "@/lib/auth/guards";
import { getServerSession } from "@/lib/auth/session";
import {
  listAdminTemplates,
  publishTemplateVersion,
  saveTemplateDraftFromWizard,
  wizardMetadataInputSchema,
} from "@/lib/template/service";

const postTemplateBodySchema = z.object({
  rawJson: z.string().min(1, "Template JSON is required.").max(512_000),
  metadata: wizardMetadataInputSchema.partial().optional(),
  publishImmediately: z.boolean().optional().default(false),
});

function revalidateTemplateSurfaces(templateId?: string) {
  revalidateTag("templates", "max");
  revalidatePath("/", "page");
  revalidatePath("/templates", "page");
  revalidatePath("/showcase", "page");
  revalidatePath("/new");
  revalidatePath("/dashboard");
  revalidatePath("/published");
  revalidatePath("/admin");
  revalidatePath("/admin/templates");
  if (templateId) {
    revalidatePath(`/admin/templates/${templateId}`);
  }
}

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

  const templates = await listAdminTemplates();
  return NextResponse.json({ ok: true, templates });
}

export async function POST(request: Request) {
  const auth = await ensureAdminApi();
  if ("error" in auth) return auth.error;

  const json = await request.json().catch(() => null);
  const parsed = postTemplateBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid template payload.",
      },
      { status: 400 },
    );
  }

  const draftRes = await saveTemplateDraftFromWizard({
    actorId: auth.user.id,
    rawJson: parsed.data.rawJson,
    metadata: parsed.data.metadata,
  });

  if (!draftRes.ok) {
    return NextResponse.json(draftRes, { status: 400 });
  }

  if (parsed.data.publishImmediately) {
    const pubRes = await publishTemplateVersion({
      actorId: auth.user.id,
      templateId: draftRes.templateId,
      versionId: draftRes.versionId,
    });
    if (!pubRes.ok) {
      return NextResponse.json(pubRes, { status: 400 });
    }
    revalidateTemplateSurfaces(draftRes.templateId);
    return NextResponse.json({
      ok: true,
      templateId: draftRes.templateId,
      versionId: draftRes.versionId,
      slug: draftRes.slug,
      version: draftRes.version,
      status: "published",
    });
  }

  revalidateTemplateSurfaces(draftRes.templateId);
  return NextResponse.json(draftRes);
}
