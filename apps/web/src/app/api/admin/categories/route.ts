import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createAdminCategory,
  deleteAdminCategory,
  getAdminCategoriesOverview,
  reorderAdminCategories,
  updateAdminCategory,
} from "@/lib/admin/categories";
import { hasAdminRole } from "@/lib/auth/guards";
import { getServerSession } from "@/lib/auth/session";

const patchActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update"),
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(60),
    slug: z.string().trim().min(1).max(60),
    sort: z.number().int().min(0).max(9999),
  }),
  z.object({
    action: z.literal("reorder"),
    orderedIds: z.array(z.string().uuid()).min(1),
  }),
]);

const postBodySchema = z.object({
  name: z.string().trim().min(1, "Category name is required.").max(60),
  slug: z.string().trim().max(60).optional(),
  sort: z.number().int().min(0).max(9999).optional(),
});

const deleteBodySchema = z.object({
  id: z.string().uuid("Invalid category ID."),
});

function revalidateCategoryConsumers() {
  revalidatePath("/admin/categories");
  revalidatePath("/admin/templates");
  revalidatePath("/templates");
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

  const overview = await getAdminCategoriesOverview();
  return NextResponse.json(overview);
}

export async function POST(request: Request) {
  const auth = await ensureAdminApi();
  if ("error" in auth) return auth.error;

  const json = await request.json().catch(() => null);
  const parsed = postBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 },
    );
  }

  const res = await createAdminCategory({
    actorId: auth.user.id,
    ...parsed.data,
  });
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 400 });
  }

  revalidateCategoryConsumers();
  const overview = await getAdminCategoriesOverview();
  return NextResponse.json({ ok: true, category: res.category, overview }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await ensureAdminApi();
  if ("error" in auth) return auth.error;

  const json = await request.json().catch(() => null);
  const parsed = patchActionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid update payload." },
      { status: 400 },
    );
  }

  const res =
    parsed.data.action === "reorder"
      ? await reorderAdminCategories({
          actorId: auth.user.id,
          orderedIds: parsed.data.orderedIds,
        })
      : await updateAdminCategory({
          actorId: auth.user.id,
          id: parsed.data.id,
          name: parsed.data.name,
          slug: parsed.data.slug,
          sort: parsed.data.sort,
        });

  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 400 });
  }

  revalidateCategoryConsumers();
  const overview = await getAdminCategoriesOverview();
  return NextResponse.json({ ok: true, overview });
}

export async function DELETE(request: Request) {
  const auth = await ensureAdminApi();
  if ("error" in auth) return auth.error;

  const json = await request.json().catch(() => null);
  const parsed = deleteBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid delete payload." },
      { status: 400 },
    );
  }

  const res = await deleteAdminCategory({
    actorId: auth.user.id,
    id: parsed.data.id,
  });
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 400 });
  }

  revalidateCategoryConsumers();
  const overview = await getAdminCategoriesOverview();
  return NextResponse.json({ ok: true, overview });
}
