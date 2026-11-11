// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { ctaSectionSchema, imageSlotValueSchema } from "@casefolio/template-schema";
import {
  resolveExportSigningSecret,
  signExportRenderToken,
  verifyExportRenderToken,
} from "@casefolio/worker/token";
import { eq } from "@casefolio/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as AuthEmailModule from "@/lib/auth/email";
import type * as AuthSessionModule from "@/lib/auth/session";
import { escapeCsvCell as escapeSettingsCsvCell } from "@/lib/admin/settings-types";
import { escapeCsvCell as escapeUsersCsvCell } from "@/lib/admin/users-types";
import { extractClientIpFromHeaders } from "@/lib/analytics/page-views-utils";
import { db, dbSchema } from "@/lib/db";
import { completeQueuedExportFromClient } from "@/lib/exports/service";
import { publishProjectForUser } from "@/lib/projects/publish";
import { createProjectFromTemplate } from "@/lib/projects/service";
import { extractClientIp, resetAuthRateLimitsForTests } from "@/lib/security/auth-rate-limit";
import { readCloudflareImagesConfig } from "@/lib/storage/cloudflare-images";
import {
  deleteStoredObject,
  isRealR2Configured,
  readStorageEnvConfig,
  readStoredObjectBytes,
  resolveSafeLocalFilePath,
  signStorageToken,
  verifyStorageToken,
} from "@/lib/storage/r2";
import { consumeUploadRateLimit, resetUploadRateLimitsForTests } from "@/lib/storage/rate-limit";
import {
  authorizeAndReadAsset,
  completePresignedUpload,
  createPresignedUpload,
} from "@/lib/storage/service";
import { publishTemplateVersion, saveTemplateDraftFromWizard } from "@/lib/template/service";

const { getServerSessionMock, renderAndDeliverEmailMock } = vi.hoisted(() => ({
  getServerSessionMock: vi.fn(),
  renderAndDeliverEmailMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof AuthSessionModule>();
  return {
    ...actual,
    getServerSession: getServerSessionMock,
  };
});

vi.mock("@/lib/auth/email", async (importOriginal) => {
  const actual = await importOriginal<typeof AuthEmailModule>();
  return {
    ...actual,
    renderAndDeliverEmail: renderAndDeliverEmailMock,
  };
});

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

function buildMinimalPngBytes(options?: { includeExif?: boolean; omitIend?: boolean }): Uint8Array {
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  function makeChunk(type: string, data: Uint8Array): Uint8Array {
    const out = new Uint8Array(12 + data.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, data.length, false);
    for (let i = 0; i < 4; i += 1) {
      out[4 + i] = type.charCodeAt(i);
    }
    out.set(data, 8);
    view.setUint32(8 + data.length, 0x12345678, false);
    return out;
  }

  const ihdr = makeChunk("IHDR", new Uint8Array([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]));
  const exif = makeChunk("eXIf", new TextEncoder().encode("Exif\0\0GPS-SECRET-COORDS"));
  const idat = makeChunk(
    "IDAT",
    new Uint8Array([0x78, 0x9c, 0x63, 0x60, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01]),
  );
  const iend = makeChunk("IEND", new Uint8Array(0));

  const chunks = [
    signature,
    ihdr,
    ...(options?.includeExif ? [exif] : []),
    idat,
    ...(options?.omitIend ? [] : [iend]),
  ];
  const total = chunks.reduce((acc, c) => acc + c.length, 0);
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  return combined;
}

describe("Principal Security & Architectural Audit Regression Suite", () => {
  beforeEach(() => {
    resetAuthRateLimitsForTests();
    resetUploadRateLimitsForTests();
    getServerSessionMock.mockReset();
    renderAndDeliverEmailMock.mockReset();
  });

  it("1. blocks dangerous URL schemes and active content in ctaSectionSchema and imageSlotValueSchema", () => {
    const baseCta = {
      id: "cta-1",
      background: "surface",
      heading: "Work together",
      primaryLabel: "Contact",
    };

    for (const unsafeHref of [
      "javascript:alert(1)",
      "  javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "//evil.example.com/phish",
      "/\\evil.example.com",
    ]) {
      expect(
        ctaSectionSchema.safeParse({
          type: "CTA",
          props: { ...baseCta, primaryHref: unsafeHref },
        }).success,
      ).toBe(false);
    }

    for (const safeHref of [
      "https://casefolio.app/contact",
      "mailto:hello@casefolio.app",
      "#contact",
      "/pricing",
    ]) {
      expect(
        ctaSectionSchema.safeParse({
          type: "CTA",
          props: { ...baseCta, primaryHref: safeHref },
        }).success,
      ).toBe(true);
    }

    for (const unsafeSrc of [
      "javascript:alert(1)",
      "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
      "data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+PC9zdmc+",
      "file:///etc/passwd",
      "//evil.example.com/image.png",
    ]) {
      expect(
        imageSlotValueSchema.safeParse({
          slot: "hero.mockup",
          src: unsafeSrc,
          alt: "Unsafe image",
          crop: null,
        }).success,
      ).toBe(false);
    }

    expect(
      imageSlotValueSchema.safeParse({
        slot: "hero.mockup",
        src: "/cdn/images/123e4567-e89b-12d3-a456-426614174000?nw=800&nh=600",
        alt: "Valid CDN asset",
        crop: null,
      }).success,
    ).toBe(true);
    expect(
      imageSlotValueSchema.safeParse({
        slot: "hero.mockup",
        src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        alt: "Valid raster data URI",
        crop: null,
      }).success,
    ).toBe(true);
  });

  it("2. fails closed in production when export or storage signing secrets are missing or too short", () => {
    expect(() =>
      resolveExportSigningSecret({
        NODE_ENV: "production",
        EXPORT_SIGNING_SECRET: "",
        BETTER_AUTH_SECRET: "short",
      }),
    ).toThrow(/required in production/i);

    const forgedDevToken = signExportRenderToken(
      {
        exportId: "123e4567-e89b-12d3-a456-426614174000",
        projectId: "123e4567-e89b-12d3-a456-426614174001",
      },
      "casefolio-dev-export-signing-secret-32chars",
    );
    expect(
      verifyExportRenderToken(forgedDevToken, {
        secret: "",
      }),
    ).toBeNull();

    const prodStorageConfig = readStorageEnvConfig({
      NODE_ENV: "production",
      STORAGE_SIGNING_SECRET: "",
      BETTER_AUTH_SECRET: "",
      EXPORT_SIGNING_SECRET: "",
    });
    expect(prodStorageConfig.signingSecret).toBe("");
    expect(() => signStorageToken({ exp: Date.now() + 60_000 }, prodStorageConfig.signingSecret)).toThrow(
      /required in production/i,
    );
    expect(verifyStorageToken("abc.def", prodStorageConfig.signingSecret)).toBeNull();
  });

  it("3. prevents server-only CF_IMAGES_ACCOUNT_HASH from leaking or causing SSR/CSR hydration drift", () => {
    const prevServerOnly = process.env.CF_IMAGES_ACCOUNT_HASH;
    const prevPublic = process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH;
    try {
      process.env.CF_IMAGES_ACCOUNT_HASH = "server_secret_hash_abcdef123456";
      delete process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH;

      // Default runtime call (shared between SSR and `"use client"`) must ignore server-only env
      const runtimeConfig = readCloudflareImagesConfig();
      expect(runtimeConfig.accountHash).toBe("");

      // Explicit envSource dictionary passed by unit tests preserves fallback behavior
      const explicitConfig = readCloudflareImagesConfig({
        CF_IMAGES_ACCOUNT_HASH: "explicit_hash_abcdef123456",
      });
      expect(explicitConfig.accountHash).toBe("explicit_hash_abcdef123456");
    } finally {
      if (prevServerOnly === undefined) {
        delete process.env.CF_IMAGES_ACCOUNT_HASH;
      } else {
        process.env.CF_IMAGES_ACCOUNT_HASH = prevServerOnly;
      }
      if (prevPublic === undefined) {
        delete process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH;
      } else {
        process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH = prevPublic;
      }
    }
  });

  it("4. enforces magic-byte validation + EXIF stripping in completePresignedUpload and scopes publishedAssetIds to referenced assets", async () => {
    if (isRealR2Configured()) {
      return;
    }

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const [admin] = await db
      .insert(dbSchema.users)
      .values({
        email: `audit-admin-${suffix}@casefolio.test`,
        name: "Audit Admin",
        role: "admin",
        plan: "pro",
        emailVerified: true,
      })
      .returning();
    const [owner] = await db
      .insert(dbSchema.users)
      .values({
        email: `audit-owner-${suffix}@casefolio.test`,
        name: "Audit Owner",
        role: "user",
        plan: "pro",
        emailVerified: true,
      })
      .returning();

    let templateId: string | null = null;
    const localKeysToCleanup: string[] = [];

    try {
      const draft = await saveTemplateDraftFromWizard({
        actorId: admin!.id,
        rawJson: readOrbitJson(),
        metadata: {
          name: `Audit Orbit ${suffix}`,
          slug: `audit-orbit-${suffix}`,
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
        actorId: admin!.id,
        templateId: draft.templateId,
        versionId: draft.versionId,
      });

      const created = await createProjectFromTemplate({
        userId: owner!.id,
        userPlan: "pro",
        input: {
          type: "mobile",
          templateId,
          name: `Audit Project ${suffix}`,
        },
      });
      expect(created.ok).toBe(true);
      if (!created.ok) return;
      const projectId = created.projectId;

      // 4a. Direct storage write bypassing local-put with disguised SVG/HTML bytes must be rejected & purged
      const disguisedSvg = new TextEncoder().encode("<svg onload='alert(1)'></svg>");
      const badPresign = await createPresignedUpload(
        {
          projectId,
          slot: "hero.mockup",
          fileName: "disguised.png",
          mimeType: "image/png",
          bytes: disguisedSvg.byteLength,
          width: 900,
          height: 1950,
        },
        { id: owner!.id, plan: "pro", role: "user" },
      );
      expect(badPresign.ok).toBe(true);
      if (!badPresign.ok) return;
      localKeysToCleanup.push(badPresign.r2Key);

      const badLocalPath = resolveSafeLocalFilePath(badPresign.r2Key);
      await mkdir(dirname(badLocalPath), { recursive: true });
      await writeFile(badLocalPath, disguisedSvg);

      const rejected = await completePresignedUpload(
        {
          completeToken: badPresign.completeToken,
        },
        { id: owner!.id, plan: "pro", role: "user" },
      );
      expect(rejected.ok).toBe(false);
      if (!rejected.ok) {
        expect(rejected.code).toBe("VALIDATION_ERROR");
      }

      // 4b. Direct storage write with EXIF chunk gets stripped in completePresignedUpload
      const pngWithExif = buildMinimalPngBytes({ includeExif: true });
      const unreferencedPresign = await createPresignedUpload(
        {
          projectId,
          slot: "hero.mockup",
          fileName: "old-draft.png",
          mimeType: "image/png",
          bytes: pngWithExif.byteLength,
          width: 900,
          height: 1950,
        },
        { id: owner!.id, plan: "pro", role: "user" },
      );
      expect(unreferencedPresign.ok).toBe(true);
      if (!unreferencedPresign.ok) return;
      localKeysToCleanup.push(unreferencedPresign.r2Key);

      const exifLocalPath = resolveSafeLocalFilePath(unreferencedPresign.r2Key);
      await mkdir(dirname(exifLocalPath), { recursive: true });
      await writeFile(exifLocalPath, pngWithExif);

      const completedUnref = await completePresignedUpload(
        {
          completeToken: unreferencedPresign.completeToken,
        },
        { id: owner!.id, plan: "pro", role: "user" },
      );
      expect(completedUnref.ok).toBe(true);
      if (!completedUnref.ok) return;

      const storedAfterComplete = await readStoredObjectBytes(unreferencedPresign.r2Key);
      expect(storedAfterComplete).not.toBeNull();
      expect(new TextDecoder("latin1").decode(storedAfterComplete!)).not.toContain(
        "GPS-SECRET-COORDS",
      );

      // 4c. Publish project WITHOUT referencing `completedUnref.asset.id` in puckData:
      // anonymous callers must NOT be able to read unreferenced draft assets!
      const published = await publishProjectForUser(
        {
          projectId,
          slug: `audit-proj-${suffix}`,
          visibility: "public",
          brandingRemoved: false,
        },
        { id: owner!.id, role: "user" },
      );
      expect(published.ok).toBe(true);

      const anonReadUnreferenced = await authorizeAndReadAsset(completedUnref.asset.id, null);
      expect(anonReadUnreferenced.status).toBe("not_found");

      const ownerReadUnreferenced = await authorizeAndReadAsset(completedUnref.asset.id, {
        id: owner!.id,
        role: "user",
        plan: "pro",
      });
      expect(ownerReadUnreferenced.status).toBe("ok");

      // 4d. Client export completion validates trailing IEND, rejects failed jobs, and clears cacheKey
      const [queuedExport] = await db
        .insert(dbSchema.exportsTable)
        .values({
          projectId,
          format: "png_long",
          status: "queued",
          scale: 1,
          cacheKey: `poison-test-${suffix}`,
        })
        .returning();

      const truncatedPng = buildMinimalPngBytes({ omitIend: true });
      const badExportRes = await completeQueuedExportFromClient(
        queuedExport!.id,
        truncatedPng,
        { id: owner!.id, plan: "pro", role: "user" },
      );
      expect(badExportRes.status).toBe("invalid_payload");

      const validPng = buildMinimalPngBytes();
      const okExportRes = await completeQueuedExportFromClient(
        queuedExport!.id,
        validPng,
        { id: owner!.id, plan: "pro", role: "user" },
      );
      expect(okExportRes.status).toBe("ok");

      const [updatedExport] = await db
        .select()
        .from(dbSchema.exportsTable)
        .where(eq(dbSchema.exportsTable.id, queuedExport!.id));
      expect(updatedExport?.cacheKey).toBeNull();
      if (updatedExport?.r2Key) {
        localKeysToCleanup.push(updatedExport.r2Key);
      }
    } finally {
      for (const key of localKeysToCleanup) {
        await deleteStoredObject(key).catch(() => undefined);
      }
      if (owner) {
        await db.delete(dbSchema.users).where(eq(dbSchema.users.id, owner.id));
      }
      if (templateId) {
        await db.delete(dbSchema.templates).where(eq(dbSchema.templates.id, templateId));
      }
      if (admin) {
        await db.delete(dbSchema.users).where(eq(dbSchema.users.id, admin.id));
      }
    }
  });

  it("5. prevents /api/help/contact from acting as an anonymous third-party email relay", async () => {
    const { POST } = await import("@/app/api/help/contact/route");
    getServerSessionMock.mockResolvedValue(null);
    renderAndDeliverEmailMock.mockResolvedValue(undefined);

    const req = new Request("http://localhost:3000/api/help/contact", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "cf-connecting-ip": "198.51.100.42",
      },
      body: JSON.stringify({
        email: "victim@external-domain.example",
        topic: "Billing & plans",
        subject: "Urgent question\r\nBcc: attacker@evil.example",
        message: "Testing support contact relay safety.",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(renderAndDeliverEmailMock).toHaveBeenCalledTimes(1);
    expect(renderAndDeliverEmailMock.mock.calls[0]?.[0]?.to).toBe("support@casefolio.app");
  });

  it("6. neutralizes CSV formula injection, hardens proxy IP extraction, and bounds rate-limit buckets", () => {
    expect(escapeSettingsCsvCell("=cmd|' /C calc'!A0")).toBe("'=cmd|' /C calc'!A0");
    expect(escapeUsersCsvCell("+SUM(A1:A2)")).toBe("'+SUM(A1:A2)");
    expect(escapeUsersCsvCell('@IMPORTXML("https://evil.test","//a")')).toBe(
      '"\'@IMPORTXML(""https://evil.test"",""//a"")"',
    );
    expect(escapeUsersCsvCell("Normal Name")).toBe("Normal Name");

    // Spoofed leftmost X-Forwarded-For hop must lose to cf-connecting-ip or rightmost proxy hop
    const cfHeaders = new Headers({
      "cf-connecting-ip": "203.0.113.9",
      "x-forwarded-for": "1.2.3.4, 203.0.113.9",
    });
    expect(extractClientIp(cfHeaders)).toBe("203.0.113.9");
    expect(extractClientIpFromHeaders(cfHeaders)).toBe("203.0.113.9");

    const multiHopHeaders = new Headers({
      "x-forwarded-for": "10.0.0.1, 198.51.100.77",
    });
    expect(extractClientIp(multiHopHeaders)).toBe("198.51.100.77");
    expect(extractClientIpFromHeaders(multiHopHeaders)).toBe("198.51.100.77");

    // Rate-limit bucket pruning stays fast and enforces per-key window under churn
    for (let i = 0; i < 200; i += 1) {
      expect(consumeUploadRateLimit(`churn-key-${i}`, 2, 60_000, 1_000).allowed).toBe(true);
    }
    expect(consumeUploadRateLimit("churn-key-199", 2, 60_000, 1_001).allowed).toBe(true);
    expect(consumeUploadRateLimit("churn-key-199", 2, 60_000, 1_002).allowed).toBe(false);
  });
});
