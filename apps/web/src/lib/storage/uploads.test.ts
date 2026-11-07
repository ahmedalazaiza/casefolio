// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "@casefolio/db";
import { describe, expect, it } from "vitest";
import { PUT as localPutRoute } from "@/app/api/uploads/local-put/route";
import { db, dbSchema } from "@/lib/db";
import { createProjectFromTemplate } from "@/lib/projects/service";
import { stripImageExifAndMetadata } from "@/lib/storage/exif";
import {
  detectImageMimeFromMagicBytes,
  PLAN_UPLOAD_QUOTAS,
} from "@/lib/storage/quotas";
import {
  createPresignedPutTarget,
  deleteStoredObject,
  isRealR2Configured,
  resolveSafeLocalFilePath,
} from "@/lib/storage/r2";
import {
  authorizeAndReadAsset,
  completePresignedUpload,
  createPresignedUpload,
  deleteAssetForUser,
  updateAssetCropForUser,
} from "@/lib/storage/service";
import {
  publishTemplateVersion,
  saveTemplateDraftFromWizard,
} from "@/lib/template/service";

function readOrbitJson(): string {
  for (const candidate of [
    resolve(process.cwd(), "reference/template.example.json"),
    resolve(process.cwd(), "../../reference/template.example.json"),
  ]) {
    if (existsSync(candidate)) {
      return readFileSync(candidate, "utf-8");
    }
  }
  throw new Error("Missing reference/template.example.json");
}

function buildMinimalPngWithExif(): Uint8Array {
  // Valid 1x1 RGB PNG chunks + an eXIf chunk and tEXt chunk that must be stripped
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  function makeChunk(type: string, data: Uint8Array): Uint8Array {
    const out = new Uint8Array(12 + data.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, data.length, false);
    for (let i = 0; i < 4; i += 1) {
      out[4 + i] = type.charCodeAt(i);
    }
    out.set(data, 8);
    // 4-byte placeholder CRC (chunk parser inspects lengths + ASCII codes)
    view.setUint32(8 + data.length, 0x12345678, false);
    return out;
  }

  const ihdr = makeChunk(
    "IHDR",
    new Uint8Array([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]),
  );
  const exif = makeChunk(
    "eXIf",
    new TextEncoder().encode("Exif\0\0GPS-LAT-37.7749-LON-122.4194"),
  );
  const text = makeChunk(
    "tEXt",
    new TextEncoder().encode("Author\0Secret Camera Serial 998877"),
  );
  const idat = makeChunk("IDAT", new Uint8Array([0x78, 0x9c, 0x63, 0x60, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01]));
  const iend = makeChunk("IEND", new Uint8Array(0));

  const chunks = [signature, ihdr, exif, text, idat, iend];
  const total = chunks.reduce((acc, c) => acc + c.length, 0);
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    combined.set(c, offset);
    offset += c.length;
  }
  return combined;
}

function buildMinimalJpegWithExif(): Uint8Array {
  const exifPayload = new TextEncoder().encode("Exif\0\0CameraOwnerSecretGPS");
  const app1Len = 2 + exifPayload.length;
  const app1 = new Uint8Array(2 + app1Len);
  app1[0] = 0xff;
  app1[1] = 0xe1; // APP1
  app1[2] = (app1Len >> 8) & 0xff;
  app1[3] = app1Len & 0xff;
  app1.set(exifPayload, 4);

  const sof0 = new Uint8Array([0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00]);
  const sosAndScan = new Uint8Array([0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xaa, 0xff, 0xd9]);

  const soi = new Uint8Array([0xff, 0xd8]);
  const total = soi.length + app1.length + sof0.length + sosAndScan.length;
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const seg of [soi, app1, sof0, sosAndScan]) {
    out.set(seg, cursor);
    cursor += seg.length;
  }
  return out;
}

describe("R2 presigned uploads, EXIF stripping, quotas, and private-until-published (C-501)", () => {
  it("generates genuine Cloudflare R2 S3v4 presigned PUT URLs when R2 credentials are configured", async () => {
    const r2Config = {
      accountId: "cf998877665544332211",
      accessKeyId: "99887766554433221100aabbccddeeff",
      secretAccessKey: "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
      bucket: "casefolio-prod-assets",
      signingSecret: "prod-signing-secret-at-least-32-characters",
      appUrl: "https://casefolio.app",
    };

    expect(isRealR2Configured(r2Config)).toBe(true);

    const target = await createPresignedPutTarget({
      r2Key: "projects/proj-1/slots/hero.mockup/asset-1.png",
      mimeType: "image/png",
      bytes: 240_000,
      maxFileBytes: PLAN_UPLOAD_QUOTAS.free.maxFileBytes,
      expiresInSeconds: 300,
      config: r2Config,
    });

    expect(target.mode).toBe("r2");
    expect(target.uploadMethod).toBe("PUT");
    expect(target.uploadHeaders["Content-Type"]).toBe("image/png");

    const parsedUrl = new URL(target.uploadUrl);
    expect(parsedUrl.hostname).toContain("cf998877665544332211.r2.cloudflarestorage.com");
    expect(parsedUrl.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(parsedUrl.searchParams.get("X-Amz-Signature")).toBeTruthy();
  });

  it("blocks path traversal in local storage keys, validates magic bytes, and strips EXIF/GPS metadata", () => {
    expect(() => resolveSafeLocalFilePath("../../etc/passwd")).toThrow(/traversal/i);
    expect(() => resolveSafeLocalFilePath("/../../secret.txt")).toThrow(/traversal/i);

    const spoofedSvg = new TextEncoder().encode("<svg onload='alert(1)'></svg>");
    expect(detectImageMimeFromMagicBytes(spoofedSvg)).toBeNull();

    const pngWithExif = buildMinimalPngWithExif();
    expect(detectImageMimeFromMagicBytes(pngWithExif)).toBe("image/png");
    const pngTextBefore = new TextDecoder().decode(pngWithExif);
    expect(pngTextBefore).toContain("GPS-LAT-37.7749");
    expect(pngTextBefore).toContain("Secret Camera Serial");

    const strippedPng = stripImageExifAndMetadata(pngWithExif, "image/png");
    expect(detectImageMimeFromMagicBytes(strippedPng)).toBe("image/png");
    const pngTextAfter = new TextDecoder().decode(strippedPng);
    expect(pngTextAfter).not.toContain("GPS-LAT-37.7749");
    expect(pngTextAfter).not.toContain("Secret Camera Serial");

    const jpegWithExif = buildMinimalJpegWithExif();
    expect(detectImageMimeFromMagicBytes(jpegWithExif)).toBe("image/jpeg");
    expect(new TextDecoder().decode(jpegWithExif)).toContain("CameraOwnerSecretGPS");

    const strippedJpeg = stripImageExifAndMetadata(jpegWithExif, "image/jpeg");
    expect(detectImageMimeFromMagicBytes(strippedJpeg)).toBe("image/jpeg");
    expect(new TextDecoder().decode(strippedJpeg)).not.toContain("CameraOwnerSecretGPS");
  });

  it("enforces MIME type, per-file size limits, per-plan storage quotas, and private-until-published access control", async () => {
    const rawOrbit = readOrbitJson();
    const stamp = Date.now();
    const tplSlug = `c501-orbit-${stamp}`;

    let ownerId: string | null = null;
    let strangerId: string | null = null;
    let templateId: string | null = null;
    const uploadedR2Keys: string[] = [];

    try {
      const [owner] = await db
        .insert(dbSchema.users)
        .values({
          email: `c501-owner-${stamp}@casefolio.test`,
          name: "Asset Owner",
          emailVerified: true,
          plan: "free",
        })
        .returning({ id: dbSchema.users.id });
      ownerId = owner!.id;

      const [stranger] = await db
        .insert(dbSchema.users)
        .values({
          email: `c501-stranger-${stamp}@casefolio.test`,
          name: "Other User",
          emailVerified: true,
          plan: "free",
        })
        .returning({ id: dbSchema.users.id });
      strangerId = stranger!.id;

      const draft = await saveTemplateDraftFromWizard({
        actorId: ownerId,
        rawJson: rawOrbit,
        metadata: {
          name: "Orbit C501",
          slug: tplSlug,
          type: "mobile",
          category: "Fintech",
          tier: "free",
          coverUrl: "https://cdn.casefolio.app/templates/orbit/cover.png",
          coverRatio: "4:3",
        },
      });
      expect(draft.ok).toBe(true);
      if (!draft.ok) return;
      templateId = draft.templateId;

      await publishTemplateVersion({
        actorId: ownerId,
        templateId: draft.templateId,
        versionId: draft.versionId,
      });

      const createdProject = await createProjectFromTemplate({
        userId: ownerId,
        userPlan: "free",
        input: {
          type: "mobile",
          templateId: draft.templateId,
          name: "Private Orbit Upload Test",
        },
      });
      expect(createdProject.ok).toBe(true);
      if (!createdProject.ok) return;
      const projectId = createdProject.projectId;

      // 1. Unsupported MIME type (.heic) is rejected with clear Figma-aligned message
      const badMime = await createPresignedUpload(
        {
          projectId,
          slot: "hero.mockup",
          fileName: "settings.heic",
          mimeType: "image/heic",
          bytes: 512_000,
          width: 900,
          height: 1950,
        },
        { id: ownerId, role: "user", plan: "free" },
      );
      expect(badMime.ok).toBe(false);
      if (!badMime.ok) {
        expect(badMime.code).toBe("UNSUPPORTED_MIME_TYPE");
        expect(badMime.error).toContain('"settings.heic" isn\'t a supported file type');
      }

      // 2. Non-existent template slot is rejected
      const badSlot = await createPresignedUpload(
        {
          projectId,
          slot: "unknown.slot",
          fileName: "screen.png",
          mimeType: "image/png",
          bytes: 512_000,
          width: 900,
          height: 1950,
        },
        { id: ownerId, role: "user", plan: "free" },
      );
      expect(badSlot.ok).toBe(false);
      if (!badSlot.ok) {
        expect(badSlot.code).toBe("INVALID_SLOT");
      }

      // 3. Cross-tenant upload attempt returns NOT_FOUND (404 per Spec §10.2 & §15)
      const unauthorizedUpload = await createPresignedUpload(
        {
          projectId,
          slot: "hero.mockup",
          fileName: "screen.png",
          mimeType: "image/png",
          bytes: 512_000,
          width: 900,
          height: 1950,
        },
        { id: strangerId, role: "user", plan: "free" },
      );
      expect(unauthorizedUpload.ok).toBe(false);
      if (!unauthorizedUpload.ok) {
        expect(unauthorizedUpload.code).toBe("NOT_FOUND");
      }

      // 4. Uploads > Free plan limit (10 MB) are rejected
      const overFreeFileLimit = await createPresignedUpload(
        {
          projectId,
          slot: "hero.mockup",
          fileName: "huge-render.png",
          mimeType: "image/png",
          bytes: 11 * 1_000_000, // 11 MB > 10 MB Free limit
          width: 1800,
          height: 3900,
        },
        { id: ownerId, role: "user", plan: "free" },
      );
      expect(overFreeFileLimit.ok).toBe(false);
      if (!overFreeFileLimit.ok) {
        expect(overFreeFileLimit.code).toBe("FILE_TOO_LARGE");
        expect(overFreeFileLimit.error).toContain("10 MB");
      }

      // 5. Upgrading owner to Pro allows 12 MB file, still rejects > 25 MB
      await db
        .update(dbSchema.users)
        .set({ plan: "pro" })
        .where(eq(dbSchema.users.id, ownerId));

      const allowedOnPro = await createPresignedUpload(
        {
          projectId,
          slot: "hero.mockup",
          fileName: "pro-render.png",
          mimeType: "image/png",
          bytes: 12 * 1_000_000,
          width: 1800,
          height: 3900,
        },
        { id: ownerId, role: "user", plan: "pro" },
      );
      expect(allowedOnPro.ok).toBe(true);

      const overProLimit = await createPresignedUpload(
        {
          projectId,
          slot: "hero.mockup",
          fileName: "massive-render.png",
          mimeType: "image/png",
          bytes: 26 * 1_000_000,
          width: 2400,
          height: 5200,
        },
        { id: ownerId, role: "user", plan: "pro" },
      );
      expect(overProLimit.ok).toBe(false);
      if (!overProLimit.ok) {
        expect(overProLimit.code).toBe("FILE_TOO_LARGE");
        expect(overProLimit.error).toContain("25 MB");
      }

      // Reset back to Free plan for end-to-end upload + total quota + private-until-published check
      await db
        .update(dbSchema.users)
        .set({ plan: "free" })
        .where(eq(dbSchema.users.id, ownerId));

      // 6. Real upload flow through signed PUT + completePresignedUpload
      const pngBytes = buildMinimalPngWithExif();
      const presigned = await createPresignedUpload(
        {
          projectId,
          slot: "hero.mockup",
          fileName: "home-screen.png",
          mimeType: "image/png",
          bytes: pngBytes.byteLength,
          width: 900,
          height: 1950,
        },
        { id: ownerId, role: "user", plan: "free" },
      );
      expect(presigned.ok).toBe(true);
      if (!presigned.ok) return;
      uploadedR2Keys.push(presigned.r2Key);

      const putReq = new Request(`http://localhost:3000${presigned.uploadUrl}`, {
        method: "PUT",
        headers: presigned.uploadHeaders,
        body: Buffer.from(pngBytes),
      });
      const putRes = await localPutRoute(putReq);
      expect(putRes.status).toBe(200);

      const completed = await completePresignedUpload(
        {
          completeToken: presigned.completeToken,
          crop: { x: 0, y: 0, width: 900, height: 1950 },
        },
        { id: ownerId, role: "user", plan: "free" },
      );
      expect(completed.ok).toBe(true);
      if (!completed.ok) return;
      expect(completed.asset.slot).toBe("hero.mockup");
      expect(completed.asset.crop).toEqual({ x: 0, y: 0, width: 900, height: 1950 });

      const assetId = completed.asset.id;

      // 7. FILES PRIVATE UNTIL PUBLISHED (404 not_found per Spec §10.2 & §15):
      // 7a. Logged-out visitor cannot read asset while project is private/unpublished
      const anonymousPrivateRead = await authorizeAndReadAsset(assetId, null);
      expect(anonymousPrivateRead.status).toBe("not_found");

      // 7b. Logged-in non-owner cannot read asset while project is private/unpublished
      const strangerPrivateRead = await authorizeAndReadAsset(assetId, {
        id: strangerId,
        role: "user",
        plan: "free",
      });
      expect(strangerPrivateRead.status).toBe("not_found");

      // 7c. Project owner CAN read asset in editor with private no-store cache header, and EXIF was stripped!
      const ownerPrivateRead = await authorizeAndReadAsset(assetId, {
        id: ownerId,
        role: "user",
        plan: "free",
      });
      expect(ownerPrivateRead.status).toBe("ok");
      if (ownerPrivateRead.status === "ok") {
        expect(ownerPrivateRead.isPublished).toBe(false);
        expect(ownerPrivateRead.cacheControl).toContain("private");
        expect(new TextDecoder().decode(ownerPrivateRead.bytes)).not.toContain("GPS-LAT-37.7749");
      }

      // 7d. Publish the project -> anonymous visitors can now read with public cache header!
      await db
        .update(dbSchema.projects)
        .set({
          visibility: "public",
          publishedAt: new Date(),
        })
        .where(eq(dbSchema.projects.id, projectId));

      const anonymousPublicRead = await authorizeAndReadAsset(assetId, null);
      expect(anonymousPublicRead.status).toBe("ok");
      if (anonymousPublicRead.status === "ok") {
        expect(anonymousPublicRead.isPublished).toBe(true);
        expect(anonymousPublicRead.cacheControl).toContain("public");
      }

      // 7e. Unpublish the project -> immediately private (404) again!
      await db
        .update(dbSchema.projects)
        .set({
          visibility: "private",
          publishedAt: null,
        })
        .where(eq(dbSchema.projects.id, projectId));

      const afterUnpublishRead = await authorizeAndReadAsset(assetId, null);
      expect(afterUnpublishRead.status).toBe("not_found");

      // 8. Re-editing crop and cumulative quota check (> 250 MB total on Free plan)
      const updatedCrop = await updateAssetCropForUser(
        assetId,
        { crop: { x: 45, y: 90, width: 810, height: 1755 } },
        { id: ownerId, role: "user", plan: "free" },
      );
      expect(updatedCrop.ok).toBe(true);
      if (updatedCrop.ok) {
        expect(updatedCrop.asset.crop).toEqual({ x: 45, y: 90, width: 810, height: 1755 });
      }

      // Simulate 248 MB already used on Free plan -> 4 MB upload exceeds 250 MB total quota
      await db.insert(dbSchema.assets).values({
        projectId,
        r2Key: `projects/${projectId}/slots/gallery.screen/quota-fill.png`,
        slot: "gallery.screen",
        width: 1200,
        height: 2600,
        bytes: 248 * 1_000_000,
        mimeType: "image/png",
      });

      const quotaExceeded = await createPresignedUpload(
        {
          projectId,
          slot: "gallery.screen",
          fileName: "next-screen.png",
          mimeType: "image/png",
          bytes: 4 * 1_000_000, // 248 MB + 4 MB = 252 MB > 250 MB Free quota
          width: 900,
          height: 1950,
        },
        { id: ownerId, role: "user", plan: "free" },
      );
      expect(quotaExceeded.ok).toBe(false);
      if (!quotaExceeded.ok) {
        expect(quotaExceeded.code).toBe("STORAGE_QUOTA_EXCEEDED");
      }

      // 9. Deleting asset removes DB row and local stored object
      const deleted = await deleteAssetForUser(assetId, {
        id: ownerId,
        role: "user",
        plan: "free",
      });
      expect(deleted.ok).toBe(true);
      const afterDeleteRead = await authorizeAndReadAsset(assetId, {
        id: ownerId,
        role: "user",
        plan: "free",
      });
      expect(afterDeleteRead.status).toBe("not_found");
    } finally {
      for (const r2Key of uploadedR2Keys) {
        await deleteStoredObject(r2Key);
      }
      if (ownerId) {
        await db.delete(dbSchema.projects).where(eq(dbSchema.projects.ownerId, ownerId));
      }
      if (templateId) {
        await db.delete(dbSchema.templates).where(eq(dbSchema.templates.id, templateId));
      }
      if (strangerId) {
        await db.delete(dbSchema.users).where(eq(dbSchema.users.id, strangerId));
      }
      if (ownerId) {
        await db.delete(dbSchema.users).where(eq(dbSchema.users.id, ownerId));
      }
    }
  });
});
