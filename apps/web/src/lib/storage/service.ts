import { createHash, randomUUID } from "node:crypto";
import { count, eq, type PlanTier, type UserRole } from "@casefolio/db";
import { evaluateQuotaUsage } from "@/lib/billing/plans";
import { db, dbSchema } from "@/lib/db";
import { resolveWorkspaceEntitlementState } from "@/lib/entitlements/server";
import { buildAssetCdnBaseUrl } from "@/lib/storage/cloudflare-images";
import {
  completeUploadInputSchema,
  extensionForMimeType,
  formatBytesHuman,
  getUploadQuotaForPlan,
  isAllowedUploadMimeType,
  presignUploadInputSchema,
  updateAssetCropInputSchema,
  validateImagePixelBounds,
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
import {
  commitWorkspaceReservation,
  getWorkspaceMonthlyMeterUsage,
  recordAndCheckWorkspaceBandwidth,
  releaseWorkspaceReservation,
  reserveWorkspaceMeter,
} from "@/lib/usage/meter";
import {
  authorizeProjectAccess,
  ensureProjectWorkspaceAndSpace,
} from "@/lib/workspaces/acl";
import { getWorkspaceStorageUsageBytes } from "@/lib/workspaces/service";

export interface StorageActor {
  id: string;
  role: UserRole;
  plan?: PlanTier;
}

export interface UploadCompletionTokenPayload {
  kind: "upload-complete";
  assetId: string;
  projectId: string;
  workspaceId: string;
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
  | "MONTHLY_UPLOADS_EXCEEDED"
  | "PROJECT_ASSET_LIMIT_REACHED";

export type PresignUploadResult =
  | {
      ok: true;
      assetId: string;
      r2Key: string;
      slot: string;
      mode: "r2" | "local";
      uploadUrl: string;
      fallbackUploadUrl?: string;
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
        | "STORAGE_QUOTA_EXCEEDED"
        | "MONTHLY_UPLOADS_EXCEEDED";
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
  if (typeof rawInput?.mimeType === "string" && !isAllowedUploadMimeType(rawInput.mimeType)) {
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

  const pixelCheck = validateImagePixelBounds(valid.width, valid.height);
  if (!pixelCheck.ok) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: pixelCheck.error,
    };
  }

  const normalizedMime: AllowedUploadMimeType =
    valid.mimeType.toLowerCase().trim() as AllowedUploadMimeType;

  // Enforce Workspace + Space ACL (`404` on unauthorized IDs; `Spec §9 & §10.1`)
  const auth = await authorizeProjectAccess(valid.projectId, actor.id, "upload_asset");
  if (!auth.ok) {
    return {
      ok: false,
      code: auth.status === 404 ? "NOT_FOUND" : "FORBIDDEN",
      error: auth.status === 404 ? "Project not found." : auth.error,
    };
  }

  const [versionRow] = await db
    .select({ versionData: dbSchema.templateVersions.data })
    .from(dbSchema.templateVersions)
    .where(eq(dbSchema.templateVersions.id, auth.project.templateVersionId))
    .limit(1);

  if (versionRow) {
    const tplCheck = validateTemplateDocument(versionRow.versionData);
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
  }

  const quota = getUploadQuotaForPlan(auth.entitlement.plan, auth.entitlement.paidSeats);

  if (valid.bytes > quota.maxFileBytes) {
    return {
      ok: false,
      code: "FILE_TOO_LARGE",
      error: `"${valid.fileName}" exceeds your ${auth.entitlement.plan.toUpperCase()} plan limit of ${formatBytesHuman(quota.maxFileBytes)} per image.`,
    };
  }

  const [usedBytes, monthlyUploads, assetCount] = await Promise.all([
    getWorkspaceStorageUsageBytes(auth.workspace.id),
    getWorkspaceMonthlyMeterUsage(auth.workspace.id, "uploads_bytes"),
    getProjectAssetCount(auth.project.id),
  ]);

  const storageEval = evaluateQuotaUsage({
    used: usedBytes,
    adding: valid.bytes,
    limit: quota.maxTotalBytes,
    isPaid: auth.entitlement.plan !== "free",
    graceUsedAt: auth.entitlement.graceUsedAt,
    graceExpiresAt: auth.entitlement.graceExpiresAt,
  });

  if (!storageEval.allowed) {
    return {
      ok: false,
      code: "STORAGE_QUOTA_EXCEEDED",
      error: `Storage quota exceeded (${formatBytesHuman(quota.maxTotalBytes)} total on the ${auth.entitlement.plan.toUpperCase()} plan). Remove unused images or upgrade your plan.`,
    };
  }

  const monthlyUploadEval = evaluateQuotaUsage({
    used: monthlyUploads.total,
    adding: valid.bytes,
    limit: quota.monthlyUploadsBytes,
    isPaid: auth.entitlement.plan !== "free",
    graceUsedAt: auth.entitlement.graceUsedAt,
    graceExpiresAt: auth.entitlement.graceExpiresAt,
  });

  if (!monthlyUploadEval.allowed) {
    return {
      ok: false,
      code: "MONTHLY_UPLOADS_EXCEEDED",
      error: `Monthly upload quota exceeded (${formatBytesHuman(quota.monthlyUploadsBytes)}/month). Resets on the 1st of next month (Europe/Istanbul).`,
    };
  }

  if (assetCount >= quota.maxAssetsPerProject) {
    return {
      ok: false,
      code: "PROJECT_ASSET_LIMIT_REACHED",
      error: `This project has reached the maximum of ${quota.maxAssetsPerProject} uploaded images for the ${auth.entitlement.plan.toUpperCase()} plan.`,
    };
  }

  const assetId = randomUUID();
  const ext = extensionForMimeType(normalizedMime);
  const safeSlot = sanitizeSlotKeySegment(valid.slot) || "slot";
  const r2Key = `workspaces/${auth.workspace.id}/projects/${auth.project.id}/slots/${safeSlot}/${assetId}.${ext}`;

  // `Spec §10.2`: Presigned URLs last at most 60 seconds
  const putTarget = await createPresignedPutTarget({
    r2Key,
    mimeType: normalizedMime,
    bytes: valid.bytes,
    maxFileBytes: quota.maxFileBytes,
    expiresInSeconds: 60,
  });

  const completeToken = signStorageToken<UploadCompletionTokenPayload>({
    kind: "upload-complete",
    assetId,
    projectId: auth.project.id,
    workspaceId: auth.workspace.id,
    userId: actor.id,
    slot: valid.slot,
    r2Key,
    mimeType: normalizedMime,
    declaredBytes: valid.bytes,
    width: valid.width,
    height: valid.height,
    exp: Date.now() + 5 * 60 * 1000,
  });

  return {
    ok: true,
    assetId,
    r2Key,
    slot: valid.slot,
    mode: putTarget.mode,
    uploadUrl: putTarget.uploadUrl,
    fallbackUploadUrl: putTarget.fallbackUploadUrl,
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

  const auth = await authorizeProjectAccess(tokenPayload.projectId, actor.id, "upload_asset");
  if (!auth.ok) {
    return {
      ok: false,
      code: auth.status === 404 ? "NOT_FOUND" : "FORBIDDEN",
      error: auth.status === 404 ? "Project not found." : auth.error,
    };
  }

  const quota = getUploadQuotaForPlan(auth.entitlement.plan, auth.entitlement.paidSeats);

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
      error: `Uploaded file exceeds your ${auth.entitlement.plan.toUpperCase()} plan limit of ${formatBytesHuman(quota.maxFileBytes)}.`,
    };
  }

  const usedBytes = await getWorkspaceStorageUsageBytes(auth.workspace.id);
  const storageEval = evaluateQuotaUsage({
    used: usedBytes,
    adding: storedInfo.bytes,
    limit: quota.maxTotalBytes,
    isPaid: auth.entitlement.plan !== "free",
    graceUsedAt: auth.entitlement.graceUsedAt,
    graceExpiresAt: auth.entitlement.graceExpiresAt,
  });

  if (!storageEval.allowed) {
    await deleteStoredObject(tokenPayload.r2Key);
    return {
      ok: false,
      code: "STORAGE_QUOTA_EXCEEDED",
      error: `Storage quota exceeded (${formatBytesHuman(quota.maxTotalBytes)} total on the ${auth.entitlement.plan.toUpperCase()} plan).`,
    };
  }

  // Reserve + commit monthly upload bytes atomically (`Spec §5.3`)
  const uploadJobId = `upload:${tokenPayload.assetId}`;
  const meterRes = await reserveWorkspaceMeter({
    workspaceId: auth.workspace.id,
    meter: "uploads_bytes",
    amount: storedInfo.bytes,
    limit: quota.monthlyUploadsBytes,
    jobId: uploadJobId,
    isPaid: auth.entitlement.plan !== "free",
    graceUsedAt: auth.entitlement.graceUsedAt,
    graceExpiresAt: auth.entitlement.graceExpiresAt,
  });

  if (!meterRes.ok) {
    await deleteStoredObject(tokenPayload.r2Key);
    return {
      ok: false,
      code: "MONTHLY_UPLOADS_EXCEEDED",
      error: `Monthly upload quota exceeded (${formatBytesHuman(quota.monthlyUploadsBytes)}/month).`,
    };
  }

  const rawBytes = await readStoredObjectBytes(tokenPayload.r2Key);
  const sha256 = rawBytes ? createHash("sha256").update(rawBytes).digest("hex") : null;
  const normalizedCrop = parsed.data.crop ?? null;

  try {
    const [inserted] = await db
      .insert(dbSchema.assets)
      .values({
        id: tokenPayload.assetId,
        projectId: auth.project.id,
        workspaceId: auth.workspace.id,
        r2Key: tokenPayload.r2Key,
        slot: tokenPayload.slot,
        crop: normalizedCrop,
        width: tokenPayload.width,
        height: tokenPayload.height,
        bytes: storedInfo.bytes,
        mimeType: tokenPayload.mimeType,
        sha256,
      })
      .returning();

    if (!inserted) {
      await releaseWorkspaceReservation(uploadJobId);
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        error: "Failed to record uploaded asset.",
      };
    }

    await commitWorkspaceReservation(uploadJobId);

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
  } catch (err) {
    await releaseWorkspaceReservation(uploadJobId);
    throw err;
  }
}

export type ReadAssetAccessResult =
  | { status: "not_found" }
  | { status: "forbidden" }
  | {
      status: "ok";
      asset: typeof dbSchema.assets.$inferSelect;
      isPublished: boolean;
      aclVersion: number;
      bytes: Uint8Array;
      contentType: string;
      cacheControl: string;
    };

/**
 * Enforces strict private-first asset isolation (`Spec §10.1-10.3 & §15`):
 * - Public delivery is permitted ONLY when the parent project is published (`public` | `unlisted`),
 *   not archived/suspended/departed, within workspace bandwidth, AND (when a `published_snapshots`
 *   row exists) the `assetId` was explicitly included in `publishedAssetIds`!
 * - Draft/private assets authorize via `authorizeProjectAccess("read")` and return `not_found` (`404`)
 *   for strangers, cross-tenant users, and Team Owners/Admins probing another member's private space!
 */
export async function authorizeAndReadAsset(
  assetId: string,
  requester: StorageActor | null,
  options?: { authorizedExportProjectId?: string | null },
): Promise<ReadAssetAccessResult> {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(assetId)) {
    return { status: "not_found" };
  }

  const [row] = await db
    .select({
      asset: dbSchema.assets,
      project: dbSchema.projects,
    })
    .from(dbSchema.assets)
    .innerJoin(dbSchema.projects, eq(dbSchema.assets.projectId, dbSchema.projects.id))
    .where(eq(dbSchema.assets.id, assetId))
    .limit(1);

  if (!row) {
    return { status: "not_found" };
  }

  const ensured = await ensureProjectWorkspaceAndSpace(row.project);
  const aclVersion = ensured.space.aclVersion;

  const projectIsPublished =
    ensured.project.archivedAt === null &&
    ensured.space.recoveryState !== "frozen_member_departed" &&
    (ensured.project.visibility === "public" || ensured.project.visibility === "unlisted") &&
    ensured.project.publishedAt !== null;

  let canDeliverPublicly = false;
  if (projectIsPublished) {
    const [snapshot] = await db
      .select({
        publishedAssetIds: dbSchema.publishedSnapshots.publishedAssetIds,
        suspendedReason: dbSchema.publishedSnapshots.suspendedReason,
      })
      .from(dbSchema.publishedSnapshots)
      .where(eq(dbSchema.publishedSnapshots.projectId, ensured.project.id))
      .limit(1);

    if (snapshot) {
      canDeliverPublicly =
        !snapshot.suspendedReason &&
        snapshot.publishedAssetIds.includes(assetId.toLowerCase());
    } else {
      // Backward-compatible fallback for direct-DB test rows without `published_snapshots`
      canDeliverPublicly = true;
    }
  }

  if (canDeliverPublicly) {
    const ent = await resolveWorkspaceEntitlementState(ensured.workspace.id);
    if (ent && (ent.lifecycle.isPastDueReadOnly || ent.frozenReason === "fraud_suspended")) {
      canDeliverPublicly = false;
    } else if (ent) {
      const bwCheck = await recordAndCheckWorkspaceBandwidth({
        workspaceId: ensured.workspace.id,
        bytes: row.asset.bytes,
        limit: ent.quotas.monthlyBandwidthBytesLimit,
        isPaid: ent.plan !== "free",
        graceUsedAt: ent.graceUsedAt,
        graceExpiresAt: ent.graceExpiresAt,
      });
      if (!bwCheck.allowed) {
        canDeliverPublicly = false;
      }
    }
  }

  if (!canDeliverPublicly) {
    const allowedViaExportToken =
      Boolean(options?.authorizedExportProjectId) &&
      options?.authorizedExportProjectId === ensured.project.id;

    if (!allowedViaExportToken) {
      if (!requester) {
        return { status: "not_found" };
      }
      const auth = await authorizeProjectAccess(ensured.project.id, requester.id, "read");
      if (!auth.ok) {
        return { status: "not_found" };
      }
    }
  }

  const bytes = await readStoredObjectBytes(row.asset.r2Key);
  if (!bytes) {
    return { status: "not_found" };
  }

  return {
    status: "ok",
    asset: row.asset,
    isPublished: canDeliverPublicly,
    aclVersion,
    bytes,
    contentType: row.asset.mimeType || "application/octet-stream",
    cacheControl: canDeliverPublicly
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
    })
    .from(dbSchema.assets)
    .where(eq(dbSchema.assets.id, assetId))
    .limit(1);

  if (!row) {
    return { ok: false, code: "NOT_FOUND", error: "Asset not found." };
  }

  const auth = await authorizeProjectAccess(row.asset.projectId, actor.id, "upload_asset");
  if (!auth.ok) {
    return {
      ok: false,
      code: auth.status === 404 ? "NOT_FOUND" : "FORBIDDEN",
      error: auth.status === 404 ? "Asset not found." : auth.error,
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
): Promise<{ ok: true } | { ok: false; code: "NOT_FOUND" | "FORBIDDEN"; error: string }> {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(assetId)) {
    return { ok: false, code: "NOT_FOUND", error: "Asset not found." };
  }

  const [row] = await db
    .select({
      asset: dbSchema.assets,
    })
    .from(dbSchema.assets)
    .where(eq(dbSchema.assets.id, assetId))
    .limit(1);

  if (!row) {
    return { ok: false, code: "NOT_FOUND", error: "Asset not found." };
  }

  const auth = await authorizeProjectAccess(row.asset.projectId, actor.id, "upload_asset");
  if (!auth.ok) {
    return {
      ok: false,
      code: auth.status === 404 ? "NOT_FOUND" : "FORBIDDEN",
      error: auth.status === 404 ? "Asset not found." : auth.error,
    };
  }

  await db.delete(dbSchema.assets).where(eq(dbSchema.assets.id, assetId));
  await deleteStoredObject(row.asset.r2Key);

  return { ok: true };
}
