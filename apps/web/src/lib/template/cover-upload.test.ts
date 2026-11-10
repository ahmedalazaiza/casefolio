// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "@casefolio/db";
import { listZipEntryNames } from "@casefolio/worker";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db, dbSchema } from "@/lib/db";
import {
  buildBrowserZipArchive,
  buildMultiPageJpegPdf,
} from "@/lib/exports/client-renderer";
import {
  authorizeAndReadExportFile,
  completeQueuedExportFromClient,
} from "@/lib/exports/service";
import {
  putBinaryWithFallback,
  UploadClientError,
} from "@/lib/storage/client-upload";
import { deleteStoredObject, writeStoredObject } from "@/lib/storage/r2";
import {
  completeAdminTemplateCoverUpload,
  createAdminTemplateCoverPresign,
  readPublicTemplateCoverByFileName,
} from "@/lib/template/cover-storage";
import {
  isLegacyPlaceholderCoverUrl,
  resolveProjectOrTemplateThumbnailUrl,
  resolveTemplateCoverUrl,
} from "@/lib/template/cover-url";
import { normalizeRawTemplateJsonCoverIfMissing } from "@/lib/template/parse";
import {
  deleteAdminTemplate,
  saveTemplateDraftFromWizard,
  updateTemplateCover,
} from "@/lib/template/service";

// Minimal valid 2x2 PNG bytes
const TINY_PNG_BYTES = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x02,
  0x08, 0x02, 0x00, 0x00, 0x00, 0xfd, 0xd4, 0x9a,
  0x73, 0x00, 0x00, 0x00, 0x10, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9c, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d,
  0xb0, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
  0x44, 0xae, 0x42, 0x60, 0x82,
]);

describe("Template cover upload, CDN resolution & browser export helpers", () => {
  const prevForceLocal = process.env.CASEFOLIO_FORCE_LOCAL_STORAGE;
  const cleanupKeys: string[] = [];

  beforeEach(() => {
    process.env.CASEFOLIO_FORCE_LOCAL_STORAGE = "1";
  });

  afterEach(async () => {
    for (const key of cleanupKeys.splice(0)) {
      await deleteStoredObject(key).catch(() => undefined);
    }
    if (prevForceLocal === undefined) {
      delete process.env.CASEFOLIO_FORCE_LOCAL_STORAGE;
    } else {
      process.env.CASEFOLIO_FORCE_LOCAL_STORAGE = prevForceLocal;
    }
  });

  it("resolves uploaded /cdn/covers/*, external https:// URLs, and legacy sample placeholders", () => {
    expect(isLegacyPlaceholderCoverUrl("https://cdn.casefolio.app/templates/orbit/cover.png")).toBe(
      true,
    );
    expect(isLegacyPlaceholderCoverUrl("/cdn/covers/1234.png")).toBe(false);
    expect(isLegacyPlaceholderCoverUrl("https://images.unsplash.com/photo-1.jpg")).toBe(false);

    expect(resolveTemplateCoverUrl("/cdn/covers/abc.png", "custom")).toBe("/cdn/covers/abc.png");
    expect(resolveTemplateCoverUrl("https://images.unsplash.com/photo-1.jpg", "custom")).toBe(
      "https://images.unsplash.com/photo-1.jpg",
    );
    expect(
      resolveTemplateCoverUrl("https://cdn.casefolio.app/templates/orbit/cover.png", "orbit"),
    ).toBe("/templates/orbit/cover.svg");
    expect(
      resolveTemplateCoverUrl(
        "https://cdn.casefolio.app/templates/meridian-pro/cover.png",
        "meridian-pro",
      ),
    ).toBe("/templates/meridian-pro/cover.svg");
    expect(resolveTemplateCoverUrl("/landing/orbit-home.svg", "orbit")).toBe(
      "/templates/orbit/cover.svg",
    );
    expect(resolveTemplateCoverUrl("", "northwind")).toBe("/templates/northwind/cover.svg");
    expect(resolveTemplateCoverUrl("", "pulse")).toBe("/templates/pulse/cover.svg");
    expect(resolveTemplateCoverUrl("", "atlas")).toBe("/templates/atlas/cover.svg");
    expect(resolveTemplateCoverUrl("", "unknown-slug")).toBeNull();
  });

  it("prefers uploaded Hero mockup screenshot for project cards and falls back to template cover", () => {
    const puckWithHeroImage = {
      content: [
        {
          type: "Hero",
          props: {
            id: "hero-1",
            mockup: { src: "/cdn/images/asset-hero-1", alt: "App home" },
          },
        },
      ],
    };

    expect(
      resolveProjectOrTemplateThumbnailUrl(
        puckWithHeroImage,
        "/cdn/covers/template-cover.png",
        "custom",
      ),
    ).toBe("/cdn/images/asset-hero-1");

    expect(
      resolveProjectOrTemplateThumbnailUrl(
        { content: [] },
        "/cdn/covers/template-cover.png",
        "custom",
      ),
    ).toBe("/cdn/covers/template-cover.png");
  });

  it("normalizes missing template.cover in converter JSON so wizard Step 1 validates cleanly", () => {
    const rawMissingCover = JSON.stringify({
      template: { id: "tpl-1", name: "Pulse", slug: "pulse" },
      puck: { root: { props: {} }, content: [] },
    });

    const normalized = normalizeRawTemplateJsonCoverIfMissing(rawMissingCover);
    expect(normalized.coverWasMissing).toBe(true);
    const parsed = JSON.parse(normalized.normalizedJson) as {
      template: { cover: { src: string; ratio: string } };
    };
    expect(parsed.template.cover.src).toBe("/templates/pending-cover.png");
    expect(parsed.template.cover.ratio).toBe("4:3");
  });

  it("enforces admin role, presigns, stores, completes, and serves template cover via public CDN helper", async () => {
    const regularUser = { id: "user-1", role: "user" as const };
    const adminActor = { id: "admin-1", role: "admin" as const };

    const denied = await createAdminTemplateCoverPresign(
      {
        action: "presign",
        fileName: "cover.png",
        mimeType: "image/png",
        bytes: TINY_PNG_BYTES.byteLength,
        width: 1600,
        height: 1200,
      },
      regularUser,
    );
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.code).toBe("FORBIDDEN");
    }

    const presigned = await createAdminTemplateCoverPresign(
      {
        action: "presign",
        fileName: "cover.png",
        mimeType: "image/png",
        bytes: TINY_PNG_BYTES.byteLength,
        width: 1600,
        height: 1200,
      },
      adminActor,
    );
    expect(presigned.ok).toBe(true);
    if (!presigned.ok) return;

    cleanupKeys.push(presigned.r2Key);
    await writeStoredObject(presigned.r2Key, TINY_PNG_BYTES, {
      contentType: "image/png",
    });

    const completed = await completeAdminTemplateCoverUpload(
      {
        action: "complete",
        completeToken: presigned.completeToken,
      },
      adminActor,
    );
    expect(completed.ok).toBe(true);
    if (!completed.ok) return;

    expect(completed.coverUrl).toMatch(/^\/cdn\/covers\/[0-9a-f-]+\.png$/);
    const cdnFile = completed.coverUrl.replace("/cdn/covers/", "");

    const served = await readPublicTemplateCoverByFileName(cdnFile);
    expect(served.status).toBe("ok");
    if (served.status === "ok") {
      expect(served.contentType).toBe("image/png");
      expect(served.bytes.byteLength).toBe(TINY_PNG_BYTES.byteLength);
      expect(served.cacheControl).toContain("immutable");
    }

    // Reject path traversal
    const traversal = await readPublicTemplateCoverByFileName("../secret.png");
    expect(traversal.status).toBe("not_found");
  });

  it("retries via server fallbackUploadUrl when direct R2 PUT throws NETWORK_ERROR", async () => {
    const calls: string[] = [];
    const mockTransport = vi.fn(async ({ url }: { url: string }) => {
      calls.push(url);
      if (url.startsWith("https://r2.example.com")) {
        throw new UploadClientError("NETWORK_ERROR", "CORS blocked");
      }
    });

    await putBinaryWithFallback({
      uploadUrl: "https://r2.example.com/presigned",
      fallbackUploadUrl: "/api/uploads/local-put?token=signed",
      headers: { "Content-Type": "image/png" },
      body: TINY_PNG_BYTES,
      putTransport: mockTransport,
    });

    expect(calls).toEqual([
      "https://r2.example.com/presigned",
      "/api/uploads/local-put?token=signed",
    ]);
  });

  it("packages valid PKZIP archives and multi-page PDF 1.4 documents for client-assisted exports", () => {
    const zipBytes = buildBrowserZipArchive([
      { name: "01-behance-1400px.png", data: TINY_PNG_BYTES },
      { name: "02-behance-1400px.png", data: TINY_PNG_BYTES },
    ]);
    expect(listZipEntryNames(zipBytes)).toEqual([
      "01-behance-1400px.png",
      "02-behance-1400px.png",
    ]);

    const fakeJpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
    const pdfBytes = buildMultiPageJpegPdf([
      {
        jpegBytes: fakeJpeg,
        pixelWidth: 1440,
        pixelHeight: 900,
        pageWidthPt: 1080,
        pageHeightPt: 675,
      },
    ]);
    const pdfText = new TextDecoder().decode(pdfBytes);
    expect(pdfText.startsWith("%PDF-1.4\n")).toBe(true);
    expect(pdfText.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(pdfText).toContain("/Filter /DCTDecode");
  });

  it("persists template cover updates to Postgres + version JSON and completes client-assisted exports", async () => {
    const orbitPath = [
      resolve(process.cwd(), "reference/template.example.json"),
      resolve(process.cwd(), "../../reference/template.example.json"),
    ].find((p) => existsSync(p));
    expect(orbitPath).toBeDefined();

    const rawOrbit = JSON.parse(readFileSync(orbitPath!, "utf-8")) as {
      template: { name: string; slug: string; cover?: unknown };
      puck: Record<string, unknown>;
    };
    const uniqueSuffix = Date.now().toString(36);
    const slug = `cover-test-${uniqueSuffix}`;
    rawOrbit.template.name = `Cover Test ${uniqueSuffix}`;
    rawOrbit.template.slug = slug;
    delete rawOrbit.template.cover;

    const draftRes = await saveTemplateDraftFromWizard({
      actorId: null,
      rawJson: JSON.stringify(rawOrbit),
      metadata: {
        name: rawOrbit.template.name,
        slug,
        type: "mobile",
        category: "Fintech",
        tier: "free",
        coverUrl: "/cdn/covers/33333333-3333-4333-8333-333333333333.png",
        coverRatio: "4:3",
      },
    });
    expect(draftRes.ok).toBe(true);
    if (!draftRes.ok) return;

    let createdUserId: string | null = null;
    let createdProjectId: string | null = null;
    let createdExportId: string | null = null;

    try {
      const updatedCover = await updateTemplateCover({
        actorId: null,
        templateId: draftRes.templateId,
        coverUrl: "/cdn/covers/44444444-4444-4444-8444-444444444444.png",
        coverRatio: "16:10",
      });
      expect(updatedCover).toEqual({
        ok: true,
        coverUrl: "/cdn/covers/44444444-4444-4444-8444-444444444444.png",
        coverRatio: "16:10",
      });

      const [tplRow] = await db
        .select()
        .from(dbSchema.templates)
        .where(eq(dbSchema.templates.id, draftRes.templateId));
      expect(tplRow?.coverUrl).toBe("/cdn/covers/44444444-4444-4444-8444-444444444444.png");

      const [user] = await db
        .insert(dbSchema.users)
        .values({
          email: `tester-${uniqueSuffix}@casefolio.test`,
          emailVerified: true,
          name: "Beta Tester",
          role: "user",
          plan: "pro",
        })
        .returning();
      createdUserId = user!.id;

      const [proj] = await db
        .insert(dbSchema.projects)
        .values({
          ownerId: user!.id,
          templateVersionId: draftRes.versionId,
          name: "Tester Export Project",
          type: "mobile",
          puckData: rawOrbit.puck,
          theme: {},
        })
        .returning();
      createdProjectId = proj!.id;

      const [exp] = await db
        .insert(dbSchema.exportsTable)
        .values({
          projectId: proj!.id,
          format: "png_long",
          status: "queued",
        })
        .returning();
      createdExportId = exp!.id;

      // Reject mismatched binary header
      const invalidHeader = await completeQueuedExportFromClient(
        exp!.id,
        Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]),
        { id: user!.id, role: "user", plan: "pro" },
      );
      expect(invalidHeader.status).toBe("invalid_payload");

      // Complete with valid PNG binary
      const completed = await completeQueuedExportFromClient(exp!.id, TINY_PNG_BYTES, {
        id: user!.id,
        role: "user",
        plan: "pro",
      });
      expect(completed.status).toBe("ok");
      if (completed.status === "ok") {
        expect(completed.exportJob.status).toBe("completed");
        expect(completed.exportJob.downloadUrl).toBe(`/api/exports/${exp!.id}/download`);
        if (completed.exportJob.r2Key) {
          cleanupKeys.push(completed.exportJob.r2Key);
        }
      }

      const downloaded = await authorizeAndReadExportFile(exp!.id, {
        id: user!.id,
        role: "user",
        plan: "pro",
      });
      expect(downloaded.status).toBe("ok");
      if (downloaded.status === "ok") {
        expect(downloaded.contentType).toBe("image/png");
        expect(downloaded.bytes.byteLength).toBe(TINY_PNG_BYTES.byteLength);
      }
    } finally {
      if (createdExportId) {
        await db.delete(dbSchema.exportsTable).where(eq(dbSchema.exportsTable.id, createdExportId));
      }
      if (createdProjectId) {
        await db.delete(dbSchema.projects).where(eq(dbSchema.projects.id, createdProjectId));
      }
      if (createdUserId) {
        await db.delete(dbSchema.users).where(eq(dbSchema.users.id, createdUserId));
      }
      await deleteAdminTemplate({
        actorId: null,
        templateId: draftRes.templateId,
        confirmName: rawOrbit.template.name,
      });
    }
  });
});
