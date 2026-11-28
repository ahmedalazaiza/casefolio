import { eq } from "@casefolio/db";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { db, dbSchema } from "@/lib/db";
import { recordAdminAuditLog } from "@/lib/template/service";
import {
  CMS_SECTION_SCHEMAS,
  DEFAULT_SITE_CMS_CONTENT,
  siteCmsContentSchema,
  type CmsSectionKey,
  type SiteCmsContent,
} from "./schema";

export const SITE_CMS_ROW_KEY = "site_cms_v1";
export const SITE_CMS_CACHE_TAG = "cms-site-content";

function cloneDefaultCms(): SiteCmsContent {
  return structuredClone(DEFAULT_SITE_CMS_CONTENT);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMergeWithDefaults<T>(defaults: T, incoming: unknown): T {
  if (incoming === undefined || incoming === null) {
    return structuredClone(defaults);
  }
  if (Array.isArray(defaults)) {
    return (Array.isArray(incoming) ? incoming : structuredClone(defaults)) as T;
  }
  if (isPlainObject(defaults) && isPlainObject(incoming)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(defaults)) {
      out[key] = deepMergeWithDefaults(
        (defaults as Record<string, unknown>)[key],
        incoming[key],
      );
    }
    return out as T;
  }
  return incoming as T;
}

function migrateLegacyCmsExportBrand(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(/\bPNG, PDF & Behance 1400px\b/g, "PNG, PDF & full Layerat export")
      .replace(/\bBehance 1,400 px slice pack\b/g, "Full case study Layerat export (1,400 px pack)")
      .replace(/\bPNG, Behance & A4 PDF Exports\b/g, "Layerat, PNG & A4 PDF Exports")
      .replace(/\bBehance 1400px\b/g, "Layerat 1400px")
      .replace(/\bBehance boards\b/g, "Layerat packs")
      .replace(/\bBehance vertical presentations\b/g, "Layerat full case study packs")
      .replace(/\bBehance showcases\b/g, "Layerat portfolios")
      .replace(/\bBehance\b/g, "Layerat");
  }
  if (Array.isArray(value)) {
    return value.map((item) => migrateLegacyCmsExportBrand(item));
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === "platform") {
        out[k] = v;
      } else {
        out[k] = migrateLegacyCmsExportBrand(v);
      }
    }
    return out;
  }
  return value;
}

export function normalizeStoredCmsDocument(raw: unknown): SiteCmsContent {
  if (!isPlainObject(raw)) {
    return cloneDefaultCms();
  }
  const merged = deepMergeWithDefaults(
    DEFAULT_SITE_CMS_CONTENT,
    migrateLegacyCmsExportBrand(raw),
  );
  const parsed = siteCmsContentSchema.safeParse(merged);
  if (parsed.success) {
    return parsed.data;
  }

  // Fallback section-by-section so a corrupt section never breaks the whole site
  const safe = cloneDefaultCms();
  if (typeof raw.updatedAtIso === "string") {
    safe.updatedAtIso = raw.updatedAtIso;
  }
  for (const key of Object.keys(CMS_SECTION_SCHEMAS) as CmsSectionKey[]) {
    const sectionSchema = CMS_SECTION_SCHEMAS[key];
    const sectionMerged = deepMergeWithDefaults(DEFAULT_SITE_CMS_CONTENT[key], raw[key]);
    const res = sectionSchema.safeParse(sectionMerged);
    if (res.success) {
      (safe as Record<string, unknown>)[key] = res.data;
    }
  }
  return safe;
}

export async function getUncachedSiteCmsContent(): Promise<SiteCmsContent> {
  try {
    const [row] = await db
      .select({
        value: dbSchema.platformSettings.value,
        updatedAt: dbSchema.platformSettings.updatedAt,
      })
      .from(dbSchema.platformSettings)
      .where(eq(dbSchema.platformSettings.key, SITE_CMS_ROW_KEY))
      .limit(1);

    if (!row) {
      return cloneDefaultCms();
    }

    const doc = normalizeStoredCmsDocument(row.value);
    if (!doc.updatedAtIso && row.updatedAt) {
      doc.updatedAtIso = row.updatedAt.toISOString();
    }
    return doc;
  } catch {
    return cloneDefaultCms();
  }
}

const getCachedCmsInternal = unstable_cache(
  async () => getUncachedSiteCmsContent(),
  ["site-cms-content-v2"],
  { revalidate: 300, tags: [SITE_CMS_CACHE_TAG] },
);

export async function getSiteCmsContent(): Promise<SiteCmsContent> {
  try {
    return await getCachedCmsInternal();
  } catch {
    return getUncachedSiteCmsContent();
  }
}

export function revalidateSiteCmsCache(): void {
  try {
    revalidateTag(SITE_CMS_CACHE_TAG, "max");
  } catch {
    // Ignore outside Next request/cache lifecycle (e.g. unit tests)
  }

  const paths = [
    "/",
    "/pricing",
    "/team",
    "/about",
    "/privacy",
    "/terms",
    "/help",
    "/templates",
    "/admin/cms",
  ];
  for (const p of paths) {
    try {
      revalidatePath(p);
    } catch {
      // Ignore outside Next runtime
    }
  }
}

export async function updateSiteCmsSection<K extends CmsSectionKey>(args: {
  actorId: string;
  section: K;
  data: unknown;
}): Promise<
  | { ok: true; content: SiteCmsContent }
  | { ok: false; error: string }
> {
  const schema = CMS_SECTION_SCHEMAS[args.section];
  const parsed = schema.safeParse(args.data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.length ? `${issue.path.join(".")}: ` : "";
    return {
      ok: false,
      error: `${path}${issue?.message ?? "Invalid CMS section payload."}`,
    };
  }

  const current = await getUncachedSiteCmsContent();
  const now = new Date();
  const nextDoc: SiteCmsContent = {
    ...current,
    version: (current.version ?? 1) + 1,
    updatedAtIso: now.toISOString(),
    [args.section]: parsed.data,
  };

  await db
    .insert(dbSchema.platformSettings)
    .values({
      key: SITE_CMS_ROW_KEY,
      value: nextDoc,
      updatedBy: args.actorId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: dbSchema.platformSettings.key,
      set: {
        value: nextDoc,
        updatedBy: args.actorId,
        updatedAt: now,
      },
    });

  await recordAdminAuditLog(args.actorId, "admin.cms.updated", {
    section: args.section,
    version: nextDoc.version,
  });

  revalidateSiteCmsCache();

  return { ok: true, content: nextDoc };
}

export async function resetSiteCmsContent(args: {
  actorId: string;
  section?: CmsSectionKey | "all";
}): Promise<SiteCmsContent> {
  const current = await getUncachedSiteCmsContent();
  const now = new Date();

  let nextDoc: SiteCmsContent;
  if (!args.section || args.section === "all") {
    nextDoc = {
      ...cloneDefaultCms(),
      version: (current.version ?? 1) + 1,
      updatedAtIso: now.toISOString(),
    };
  } else {
    nextDoc = {
      ...current,
      version: (current.version ?? 1) + 1,
      updatedAtIso: now.toISOString(),
      [args.section]: structuredClone(DEFAULT_SITE_CMS_CONTENT[args.section]),
    };
  }

  await db
    .insert(dbSchema.platformSettings)
    .values({
      key: SITE_CMS_ROW_KEY,
      value: nextDoc,
      updatedBy: args.actorId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: dbSchema.platformSettings.key,
      set: {
        value: nextDoc,
        updatedBy: args.actorId,
        updatedAt: now,
      },
    });

  await recordAdminAuditLog(args.actorId, "admin.cms.reset", {
    section: args.section ?? "all",
    version: nextDoc.version,
  });

  revalidateSiteCmsCache();

  return nextDoc;
}
