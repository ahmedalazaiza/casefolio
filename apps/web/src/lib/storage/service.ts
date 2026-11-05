import { randomUUID } from "node:crypto";
import { and, count, eq, sql, type PlanTier, type UserRole } from "@casefolio/db";
import { db, dbSchema } from "@/lib/db";
import { buildAssetCdnBaseUrl } from "@/lib/storage/cloudflare-images";
import {
  completeUploadInputSchema,
  extensionForMimeType,
  formatBytesHuman,
  getUploadQuotaForPlan,
  isAllowedUploadMimeType,
  presignUploadInputSchema,
  updateAssetCropInputSchema,
  type AllowedUploadMimeType,
  type CompleteUploadInput,
  type PresignUploadInput,
} from "@/lib/storage/quotas";
import {
  createPresignedPutTarget,
  deleteStoredObject,
  headStoredObject,
  readStoredObjectBytes,
  signStorageToken,
  verifyStorageToken,
} from "@/lib/storage/r2";
import { validateTemplateDocument, type CropRect } from "@/lib/template/schema";

export interface StorageActor {
  id: string;
  role: UserRole;
  plan?: PlanTier;
}

export interface UploadCompletionTokenPayload {
  kind: "upload-complete";
  assetId: string;
  projectId: string;
  userId: string;
  slot: string;
  r2Key: string;
  mimeType: AllowedUploadMimeType;
  declaredBytes: number;
  width: number;
  height: number;
  exp: number;
}

export type PresignUploadErrorCode =
  | "VALIDATION_ERROR"
  | "UNSUPPORTED_MIME_TYPE"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "INVALID_SLOT"
  | "FILE_TOO_LARGE"
  | "STORAGE_QUOTA_EXCEEDED"
  | "PROJECT_ASSET_LIMIT_REACHED";

export type PresignUploadResult =
  | {
      ok: true;
      assetId: string;
      r2Key: string;
      slot: string;
      mode: "r2" | "local";
      uploadUrl: string;
      uploadMethod: "PUT";
      uploadHeaders: Record<string, string>;
      completeToken: string;
      expiresInSeconds: number;
      maxFileBytes: number;
    }
  | {
      ok: false;
      code: PresignUploadErrorCode;
      error: string;
    };

export interface PersistedAssetRecord {
  id: string;
  projectId: string;
  r2Key: string;
  slot: string;
  crop: CropRect | null;
  width: number;
  height: number;
  bytes: number;
  mimeType: string | null;
  deliveryUrl: string;
}

export type CompleteUploadResult =
  | {
      ok: true;
      asset: PersistedAssetRecord;
    }
  | {
      ok: false;
      code:
        | "VALIDATION_ERROR"
        | "INVALID_TOKEN"
        | "NOT_FOUND"
        | "FORBIDDEN"
        | "UPLOAD_MISSING"
        | "FILE_TOO_LARGE"
        | "STORAGE_QUOTA_EXCEEDED";
      error: string;
    };

function sanitizeSlotKeySegment(slot: string): string {
  return slot
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function buildPrivateOrPublicAssetPath(
  assetId: string,
  width?: number,
  height?: number,
): string {
  return buildAssetCdnBaseUrl(assetId, width, height);
}

async function canActorEditProject(
  project: { ownerId: string; orgId: string | null },
  actor: StorageActor,
): Promise<boolean> {
  if (
    project.ownerId === actor.id ||
    actor.role === "admin" ||
    actor.role === "superadmin"
  ) {
    return true;
  }

  if (project.orgId) {
    const [membership] = await db
      .select({ role: dbSchema.memberships.role })
      .from(dbSchema.memberships)
      .where(
        and(
          eq(dbSchema.memberships.orgId, project.orgId),
          eq(dbSchema.memberships.userId, actor.id),
        ),
      )
      .limit(1);

    if (membership && (membership.role === "owner" || membership.role === "editor")) {
      return true;
    }
  }

  return false;
}

async function canActorViewUnpublishedProject(
  project: { ownerId: string; orgId: string | null },
  actor: StorageActor | null,
): Promise<boolean> {
  if (!actor) {
    return false;
  }

  if (
    project.ownerId === actor.id ||
    actor.role === "admin" ||
    actor.role === "superadmin"
  ) {
    return true;
  }

  if (project.orgId) {
    const [membership] = await db
      .select({ role: dbSchema.memberships.role })
      .from(dbSchema.memberships)
      .where(
        and(
          eq(dbSchema.memberships.orgId, project.orgId),
          eq(dbSchema.memberships.userId, actor.id),
        ),
      )
      .limit(1);

    if (membership) {
      return true;
    }
  }

  return false;
}

async function getOwnerAuthoritativePlan(ownerId: string): Promise<PlanTier> {
  const [owner] = await db
    .select({ plan: dbSchema.users.plan })
    .from(dbSchema.users)
    .where(eq(dbSchema.users.id, ownerId))
    .limit(1);

  return owner?.plan ?? "free";
}

async function getOwnerStorageUsageBytes(ownerId: string): Promise<number> {
  const [row] = await db
    .select({
      totalBytes: sql<string>`coalesce(sum(${dbSchema.assets.bytes}), 0)`,
    })
    .from(dbSchema.assets)
    .innerJoin(dbSchema.projects, eq(dbSchema.assets.projectId, dbSchema.projects.id))
    .where(eq(dbSchema.projects.ownerId, ownerId));

  return Number(row?.totalBytes ?? 0);
}

async function getProjectAssetCount(projectId: string): Promise<number> {
  const [row] = await db
    .select({ totalCount: count() })
    .from(dbSchema.assets)
    .where(eq(dbSchema.assets.projectId, projectId));

  return Number(row?.totalCount ?? 0);
}

export async function createPresignedUpload(
  rawInput: PresignUploadInput,
  actor: StorageActor,
): Promise<PresignUploadResult> {
  // Check MIME first so unsupported file extensions/types get a clear Figma-aligned message
  if (
    typeof rawInput?.mimeType === "string" &&
    !isAllowedUploadMimeType(rawInput.mimeType)
  ) {
    const displayName =
      typeof rawInput.fileName === "string" && rawInput.fileName.trim().length > 0
        ? rawInput.fileName.trim()
        : "Selected file";
    return {
      ok: false,
      code: "UNSUPPORTED_MIME_TYPE",
      error: `"${displayName}" isn't a supported file type. Upload a PNG, JPG, or WebP image.`,
    };
  }

  const parsed = presignUploadInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: parsed.error.issues[0]?.message ?? "Invalid upload request.",
    };
  }

  const valid = parsed.data;
  if (!isAllowedUploadMimeType(valid.mimeType)) {
    return {
      ok: false,
      code: "UNSUPPORTED_MIME_TYPE",
      error: `"${valid.fileName}" isn't a supported file type. Upload a PNG, JPG, or WebP image.`,
    };
  }
  const normalizedMime: AllowedUploadMimeType = valid.mimeType.toLowerCase().trim() as AllowedUploadMimeType;

  const [projectRow] = await db
    .select({
      project: dbSchema.projects,
      versionData: dbSchema.templateVersions.data,
    })
    .from(dbSchema.projects)
    .innerJoin(
      dbSchema.templateVersions,
      eq(dbSchema.projects.templateVersionId, dbSchema.templateVersions.id),
    )
    .where(eq(dbSchema.projects.id, valid.projectId))
    .limit(1);

  if (!projectRow) {
    return {
      ok: false,
      code: "NOT_FOUND",
      error: "Project not found.",
    };
  }

  const allowed = await canActorEditProject(projectRow.project, actor);
  if (!allowed) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "You do not have permission to upload assets to this project.",
    };
  }

  const tplCheck = validateTemplateDocument(projectRow.versionData);
  if (tplCheck.ok) {
    const definedSlots = tplCheck.data.template.slots;
    if (!(valid.slot in definedSlots)) {
      return {
        ok: false,
        code: "INVALID_SLOT",
        error: `Slot "${valid.slot}" does not exist on this template.`,
      };
    }
  }

  const ownerPlan = await getOwnerAuthoritativePlan(projectRow.project.ownerId);
  const quota = getUploadQuotaForPlan(ownerPlan);

  if (valid.bytes > quota.maxFileBytes) {
    return {
      ok: false,
      code: "FILE_TOO_LARGE",
      error: `"${valid.fileName}" exceeds your ${ownerPlan.toUpperCase()} plan limit of ${formatBytesHuman(quota.maxFileBytes)} per image.`,
    };
  }

  const [usedBytes, assetCount] = await Promise.all([
    getOwnerStorageUsageBytes(projectRow.project.ownerId),
    getProjectAssetCount(projectRow.project.id),
  ]);

  if (usedBytes + valid.bytes > quota.maxTotalBytes) {
    return {
      ok: false,
      code: "STORAGE_QUOTA_EXCEEDED",
      error: `Storage quota exceeded (${formatBytesHuman(quota.maxTotalBytes)} total on the ${ownerPlan.toUpperCase()} plan). Remove unused images or upgrade your plan.`,
    };
  }

  if (assetCount >= quota.maxAssetsPerProject) {
    return {
      ok: false,
      code: "PROJECT_ASSET_LIMIT_REACHED",
      error: `This project has reached the maximum of ${quota.maxAssetsPerProject} uploaded images for the ${ownerPlan.toUpperCase()} plan.`,
    };
  }

  const assetId = randomUUID();
  const ext = extensionForMimeType(normalizedMime);
  const safeSlot = sanitizeSlotKeySegment(valid.slot) || "slot";
  const r2Key = `projects/${projectRow.project.id}/slots/${safeSlot}/${assetId}.${ext}`;

  const putTarget = await createPresignedPutTarget({
    r2Key,
    mimeType: normalizedMime,
    bytes: valid.bytes,
    maxFileBytes: quota.maxFileBytes,
  });

  const completeToken = signStorageToken<UploadCompletionTokenPayload>({
    kind: "upload-complete",
    assetId,
    projectId: projectRow.project.id,
    userId: actor.id,
    slot: valid.slot,
    r2Key,
    mimeType: normalizedMime,
    declaredBytes: valid.bytes,
    width: valid.width,
    height: valid.height,
    exp: Date.now() + 10 * 60 * 1000,
  });

  return {
    ok: true,
    assetId,
    r2Key,
    slot: valid.slot,
    mode: putTarget.mode,
    uploadUrl: putTarget.uploadUrl,
    uploadMethod: putTarget.uploadMethod,
    uploadHeaders: putTarget.uploadHeaders,
    completeToken,
    expiresInSeconds: putTarget.expiresInSeconds,
    maxFileBytes: quota.maxFileBytes,
  };
}

export async function completePresignedUpload(
  rawInput: CompleteUploadInput,
  actor: StorageActor,
): Promise<CompleteUploadResult> {
  const parsed = completeUploadInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: parsed.error.issues[0]?.message ?? "Invalid upload completion payload.",
    };
  }

  const tokenPayload = verifyStorageToken<UploadCompletionTokenPayload>(parsed.data.completeToken);
  if (
    !tokenPayload ||
    tokenPayload.kind !== "upload-complete" ||
    tokenPayload.userId !== actor.id
  ) {
    return {
      ok: false,
      code: "INVALID_TOKEN",
      error: "Upload session expired or is invalid. Please try uploading again.",
    };
  }

  const [project] = await db
    .select()
    .from(dbSchema.projects)
    .where(eq(dbSchema.projects.id, tokenPayload.projectId))
    .limit(1);

  if (!project) {
    return {
      ok: false,
      code: "NOT_FOUND",
      error: "Project not found.",
    };
  }

  const allowed = await canActorEditProject(project, actor);
  if (!allowed) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "You do not have permission to edit this project.",
    };
  }

  const ownerPlan = await getOwnerAuthoritativePlan(project.ownerId);
  const quota = getUploadQuotaForPlan(ownerPlan);

  const storedInfo = await headStoredObject(tokenPayload.r2Key);
  if (!storedInfo.exists || storedInfo.bytes <= 0) {
    return {
      ok: false,
      code: "UPLOAD_MISSING",
      error: "Uploaded image bytes were not found in storage. Please retry.",
    };
  }

  if (storedInfo.bytes > quota.maxFileBytes) {
    await deleteStoredObject(tokenPayload.r2Key);
    return {
      ok: false,
      code: "FILE_TOO_LARGE",
      error: `Uploaded file exceeds your ${ownerPlan.toUpperCase()} plan limit of ${formatBytesHuman(quota.maxFileBytes)}.`,
    };
  }

  const usedBytes = await getOwnerStorageUsageBytes(project.ownerId);
  if (usedBytes + storedInfo.bytes > quota.maxTotalBytes) {
    await deleteStoredObject(tokenPayload.r2Key);
    return {
      ok: false,
      code: "STORAGE_QUOTA_EXCEEDED",
      error: `Storage quota exceeded (${formatBytesHuman(quota.maxTotalBytes)} total on the ${ownerPlan.toUpperCase()} plan).`,
    };
  }

  const normalizedCrop = parsed.data.crop ?? null;

  const [inserted] = await db
    .insert(dbSchema.assets)
    .values({
      id: tokenPayload.assetId,
      projectId: project.id,
      r2Key: tokenPayload.r2Key,
      slot: tokenPayload.slot,
      crop: normalizedCrop,
      width: tokenPayload.width,
      height: tokenPayload.height,
      bytes: storedInfo.bytes,
      mimeType: tokenPayload.mimeType,
    })
    .returning();

  if (!inserted) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: "Failed to record uploaded asset.",
    };
  }

  return {
    ok: true,
    asset: {
      id: inserted.id,
      projectId: inserted.projectId,
      r2Key: inserted.r2Key,
      slot: inserted.slot,
      crop: inserted.crop ?? null,
      width: inserted.width,
      height: inserted.height,
      bytes: inserted.bytes,
      mimeType: inserted.mimeType,
      deliveryUrl: buildPrivateOrPublicAssetPath(
        inserted.id,
        inserted.width,
        inserted.height,
      ),
    },
  };
}

export type ReadAssetAccessResult =
  | { status: "not_found" }
  | { status: "forbidden" }
  | {
      status: "ok";
      asset: typeof dbSchema.assets.$inferSelect;
      isPublished: boolean;
      bytes: Uint8Array;
      contentType: string;
      cacheControl: string;
    };

/**
 * Enforces C-501 "Files private until published":
 * - When the parent project is private or unpublished (`publishedAt === null`),
 *   only the project owner, org members, or platform admins can read the asset (`Cache-Control: private, no-store`).
 * - Once the project is published (`visibility` in `public` | `unlisted` AND `publishedAt !== null`),
 *   public visitors can read the asset (`Cache-Control: public, max-age=31536000, immutable`).
 */
export async function authorizeAndReadAsset(
  assetId: string,
  requester: StorageActor | null,
): Promise<ReadAssetAccessResult> {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(assetId)) {
    return { status: "not_found" };
  }

  const [row] = await db
    .select({
      asset: dbSchema.assets,
      project: {
        id: dbSchema.projects.id,
        ownerId: dbSchema.projects.ownerId,
        orgId: dbSchema.projects.orgId,
        visibility: dbSchema.projects.visibility,
        publishedAt: dbSchema.projects.publishedAt,
      },
    })
    .from(dbSchema.assets)
    .innerJoin(dbSchema.projects, eq(dbSchema.assets.projectId, dbSchema.projects.id))
    .where(eq(dbSchema.assets.id, assetId))
    .limit(1);

  if (!row) {
    return { status: "not_found" };
  }

  const isPublished =
    (row.project.visibility === "public" || row.project.visibility === "unlisted") &&
    row.project.publishedAt !== null;

  if (!isPublished) {
    const canViewPrivate = await canActorViewUnpublishedProject(row.project, requester);
    if (!canViewPrivate) {
      return { status: "forbidden" };
    }
  }

  const bytes = await readStoredObjectBytes(row.asset.r2Key);
  if (!bytes) {
    return { status: "not_found" };
  }

  return {
    status: "ok",
    asset: row.asset,
    isPublished,
    bytes,
    contentType: row.asset.mimeType || "application/octet-stream",
    cacheControl: isPublished
      ? "public, max-age=31536000, immutable"
      : "private, no-store, max-age=0",
  };
}

export async function updateAssetCropForUser(
  assetId: string,
  rawInput: unknown,
  actor: StorageActor,
): Promise<
  | { ok: true; asset: typeof dbSchema.assets.$inferSelect }
  | { ok: false; code: "VALIDATION_ERROR" | "NOT_FOUND" | "FORBIDDEN"; error: string }
> {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(assetId)) {
    return { ok: false, code: "NOT_FOUND", error: "Asset not found." };
  }

  const parsed = updateAssetCropInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: parsed.error.issues[0]?.message ?? "Invalid crop rectangle.",
    };
  }

  const [row] = await db
    .select({
      asset: dbSchema.assets,
      project: {
        ownerId: dbSchema.projects.ownerId,
        orgId: dbSchema.projects.orgId,
      },
    })
    .from(dbSchema.assets)
    .innerJoin(dbSchema.projects, eq(dbSchema.assets.projectId, dbSchema.projects.id))
    .where(eq(dbSchema.assets.id, assetId))
    .limit(1);

  if (!row) {
    return { ok: false, code: "NOT_FOUND", error: "Asset not found." };
  }

  const allowed = await canActorEditProject(row.project, actor);
  if (!allowed) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "You do not have permission to update this asset.",
    };
  }

  const [updated] = await db
    .update(dbSchema.assets)
    .set({ crop: parsed.data.crop })
    .where(eq(dbSchema.assets.id, assetId))
    .returning();

  if (!updated) {
    return { ok: false, code: "NOT_FOUND", error: "Asset not found." };
  }

  return { ok: true, asset: updated };
}

export async function deleteAssetForUser(
  assetId: string,
  actor: StorageActor,
): Promise<
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "FORBIDDEN"; error: string }
> {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(assetId)) {
    return { ok: false, code: "NOT_FOUND", error: "Asset not found." };
  }

  const [row] = await db
    .select({
      asset: dbSchema.assets,
      project: {
        ownerId: dbSchema.projects.ownerId,
        orgId: dbSchema.projects.orgId,
      },
    })
    .from(dbSchema.assets)
    .innerJoin(dbSchema.projects, eq(dbSchema.assets.projectId, dbSchema.projects.id))
    .where(eq(dbSchema.assets.id, assetId))
    .limit(1);

  if (!row) {
    return { ok: false, code: "NOT_FOUND", error: "Asset not found." };
  }

  const allowed = await canActorEditProject(row.project, actor);
  if (!allowed) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "You do not have permission to delete this asset.",
    };
  }

  await db.delete(dbSchema.assets).where(eq(dbSchema.assets.id, assetId));
  await deleteStoredObject(row.asset.r2Key);

  return { ok: true };
}
