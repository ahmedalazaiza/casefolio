// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { signExportRenderToken, verifyExportRenderToken } from "@casefolio/worker/token";
import { beforeEach, describe, expect, it } from "vitest";
import { signPaddleWebhookPayload, verifyPaddleWebhookSignature } from "@/lib/billing/signature";
import { can } from "@/lib/entitlements";
import {
  checkAuthEndpointRateLimit,
  resetAuthRateLimitsForTests,
} from "@/lib/security/auth-rate-limit";
import { buildContentSecurityPolicy, buildSecurityHeaders } from "@/lib/security/headers";
import {
  redactSensitiveText,
  sanitizeErrorForLogging,
  sanitizeHeaderFilename,
} from "@/lib/security/redact";
import { stripImageExifAndMetadata } from "@/lib/storage/exif";
import {
  detectImageMimeFromMagicBytes,
  getUploadQuotaForPlan,
  isAllowedUploadMimeType,
} from "@/lib/storage/quotas";
import { consumeUploadRateLimit, resetUploadRateLimitsForTests } from "@/lib/storage/rate-limit";

function resolveRepoRoot(): string {
  const cwd = process.cwd();
  return cwd.endsWith("apps/web") ? resolve(cwd, "../..") : cwd;
}

function collectFiles(dir: string, predicate: (filePath: string) => boolean): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === "dist") continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      found.push(...collectFiles(full, predicate));
    } else if (predicate(full)) {
      found.push(full);
    }
  }
  return found;
}

describe("Phase 11 Security Review & Hardening Audit (C-1101)", () => {
  beforeEach(() => {
    resetAuthRateLimitsForTests();
    resetUploadRateLimitsForTests();
  });

  it("1. enforces server-side authz or explicit public guards across every API route & Server Action", () => {
    const repoRoot = resolveRepoRoot();
    const appDir = join(repoRoot, "apps/web/src/app");
    const libDir = join(repoRoot, "apps/web/src/lib");

    const routeFiles = collectFiles(appDir, (f) => f.endsWith("/route.ts"));
    expect(routeFiles.length).toBeGreaterThanOrEqual(20);

    // Public/webhook/signed-token endpoints must enforce signature verification, rate limits, or NODE_ENV gate
    const explicitPublicRouteGuards: Record<string, RegExp> = {
      "api/auth/[...all]/route.ts": /checkAuthEndpointRateLimit/,
      "api/paddle/webhook/route.ts": /handleSignedPaddleWebhookRequest/,
      "api/uploads/local-put/route.ts": /verifyStorageToken/,
      "api/track/route.ts": /recordPublishedProjectView/,
      "api/reports/route.ts": /consumeUploadRateLimit/,
      "api/help/contact/route.ts": /consumeUploadRateLimit/,
      "api/dev/analytics-events/route.ts": /NODE_ENV\s*===\s*"production"/,
      "api/health/route.ts": /checkWebHealth|status/,
      "cdn/covers/[file]/route.ts": /readPublicTemplateCoverByFileName/,
    };

    for (const file of routeFiles) {
      const rel = file.slice(appDir.length + 1).replace(/\\/g, "/");
      const src = readFileSync(file, "utf-8");

      const matchedPublicGuard = explicitPublicRouteGuards[rel];
      if (matchedPublicGuard) {
        expect(src, `Expected guard in public route ${rel}`).toMatch(matchedPublicGuard);
      } else {
        expect(
          /getServerSession|ensureAdminApi|requireAdmin/.test(src),
          `Expected session/admin authz check in route ${rel}`,
        ).toBe(true);
      }
    }

    // Every `"use server"` file must check session/admin and NEVER export raw `*ForUser(userId, ...)` helpers
    const useServerFiles = collectFiles(
      libDir,
      (f) => f.endsWith(".ts") && !f.endsWith(".test.ts"),
    ).filter((f) => {
      const head = readFileSync(f, "utf-8").slice(0, 80);
      return head.includes('"use server"') || head.includes("'use server'");
    });

    expect(useServerFiles.length).toBeGreaterThanOrEqual(4);

    for (const file of useServerFiles) {
      const src = readFileSync(file, "utf-8");
      expect(
        /getServerSession|requireAdmin/.test(src),
        `Expected getServerSession or requireAdmin in "use server" module ${file}`,
      ).toBe(true);
      expect(
        /export\s+async\s+function\s+\w+ForUser\s*\(\s*userId\s*:/.test(src),
        `"use server" module ${file} must not export raw userId-accepting *ForUser helpers`,
      ).toBe(false);
    }
  });

  it("2. enforces single `can(plan, feature)` entitlement matrix across Free, Pro, and Team", () => {
    expect(can("free", "create_project", { projectsCount: 1 })).toBe(true);
    expect(can("free", "create_project", { projectsCount: 2 })).toBe(false);
    expect(can("pro", "create_project", { projectsCount: 19 })).toBe(true);
    expect(can("pro", "create_project", { projectsCount: 20 })).toBe(false);

    expect(can("free", "pro_templates")).toBe(false);
    expect(can("pro", "pro_templates")).toBe(true);

    expect(can("free", "export_pdf")).toBe(false);
    expect(can("pro", "export_pdf")).toBe(true);
    expect(can("free", "remove_watermark")).toBe(false);
    expect(can("pro", "remove_watermark")).toBe(true);

    expect(can("pro", "team_seats")).toBe(false);
    expect(can("team", "team_seats")).toBe(true);
  });

  it("3. verifies Paddle webhook HMAC-SHA256 signatures and rejects missing, tampered, or replayed requests", () => {
    const secret = "pdl_ntfset_test_webhook_secret_123456";
    const body = JSON.stringify({
      event_id: "evt_01sec_audit",
      event_type: "subscription.activated",
      data: { id: "sub_01sec" },
    });
    const nowMs = 1_760_000_000_000;
    const nowSec = Math.floor(nowMs / 1000);
    const validHeader = signPaddleWebhookPayload(body, secret, nowSec);

    expect(
      verifyPaddleWebhookSignature({
        rawBody: body,
        signatureHeader: validHeader,
        secret,
        nowMs,
      }),
    ).toEqual({ ok: true, timestampSeconds: nowSec });

    expect(
      verifyPaddleWebhookSignature({
        rawBody: body,
        signatureHeader: null,
        secret,
        nowMs,
      }),
    ).toMatchObject({ ok: false, code: "MISSING_SIGNATURE" });

    expect(
      verifyPaddleWebhookSignature({
        rawBody: `${body} `,
        signatureHeader: validHeader,
        secret,
        nowMs,
      }),
    ).toMatchObject({ ok: false, code: "INVALID_SIGNATURE" });

    const staleHeader = signPaddleWebhookPayload(body, secret, nowSec - 900);
    expect(
      verifyPaddleWebhookSignature({
        rawBody: body,
        signatureHeader: staleHeader,
        secret,
        nowMs,
      }),
    ).toMatchObject({ ok: false, code: "TIMESTAMP_EXPIRED" });
  });

  it("4. enforces upload MIME allowlist, per-plan quotas, magic-byte inspection, and EXIF metadata stripping", () => {
    expect(isAllowedUploadMimeType("image/png")).toBe(true);
    expect(isAllowedUploadMimeType("image/jpeg")).toBe(true);
    expect(isAllowedUploadMimeType("image/webp")).toBe(true);
    expect(isAllowedUploadMimeType("image/svg+xml")).toBe(false);
    expect(isAllowedUploadMimeType("text/html")).toBe(false);

    const freeQuota = getUploadQuotaForPlan("free");
    const proQuota = getUploadQuotaForPlan("pro");
    const teamQuota = getUploadQuotaForPlan("team");
    expect(freeQuota.maxFileBytes).toBeLessThan(proQuota.maxFileBytes);
    expect(proQuota.maxFileBytes).toBe(teamQuota.maxFileBytes);
    expect(proQuota.maxTotalBytes).toBeLessThan(teamQuota.maxTotalBytes);

    // Disguised SVG payload pretending to be PNG must fail magic-byte detection
    const svgPayload = new TextEncoder().encode('<svg onload="alert(1)"></svg>');
    expect(detectImageMimeFromMagicBytes(svgPayload)).toBeNull();

    // JPEG with APP1 EXIF segment (`FF E1`) must have APP1 stripped while keeping image SOI/EOI intact
    const fakeJpegWithExif = new Uint8Array([
      0xff,
      0xd8, // SOI
      0xff,
      0xe1,
      0x00,
      0x0a, // APP1 length = 10 bytes (2 len + 8 data)
      0x45,
      0x78,
      0x69,
      0x66,
      0x00,
      0x00,
      0x47,
      0x50, // "Exif\0\0GP"
      0xff,
      0xdb,
      0x00,
      0x04,
      0x00,
      0x01, // DQT
      0xff,
      0xd9, // EOI
    ]);
    expect(detectImageMimeFromMagicBytes(fakeJpegWithExif)).toBe("image/jpeg");
    const stripped = stripImageExifAndMetadata(fakeJpegWithExif, "image/jpeg");
    expect(stripped.byteLength).toBeLessThan(fakeJpegWithExif.byteLength);
    expect(Buffer.from(stripped).includes(Buffer.from("Exif"))).toBe(false);
  });

  it("5. requires short-lived signed HMAC token bound to exportId and projectId for export rendering", () => {
    const secret = "export-signing-secret-c1101-audit-key";
    const exportId = "11111111-1111-4111-8111-111111111111";
    const projectId = "22222222-2222-4222-8222-222222222222";
    const nowMs = 1_760_000_000_000;

    const token = signExportRenderToken({ exportId, projectId, ttlMs: 300_000, nowMs }, secret);

    expect(
      verifyExportRenderToken(token, { expectedExportId: exportId, secret, nowMs: nowMs + 60_000 }),
    ).toMatchObject({ exportId, projectId });

    // Expired after 5 minutes
    expect(
      verifyExportRenderToken(token, {
        expectedExportId: exportId,
        secret,
        nowMs: nowMs + 300_001,
      }),
    ).toBeNull();

    // Bound to specific exportId (cross-job replay blocked)
    expect(
      verifyExportRenderToken(token, {
        expectedExportId: "33333333-3333-4333-8333-333333333333",
        secret,
        nowMs,
      }),
    ).toBeNull();
  });

  it("6. rate-limits sensitive auth endpoints and upload/export/tracking buckets", () => {
    const makeAuthReq = () =>
      new Request("http://localhost:3000/api/auth/sign-in/email", {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.42" },
      });

    for (let i = 0; i < 3; i += 1) {
      expect(checkAuthEndpointRateLimit(makeAuthReq(), 3).allowed).toBe(true);
    }
    const blocked = checkAuthEndpointRateLimit(makeAuthReq(), 3);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);

    // Non-sensitive session read path is not throttled by auth mutation bucket
    const getSessionReq = new Request("http://localhost:3000/api/auth/get-session", {
      headers: { "x-forwarded-for": "203.0.113.42" },
    });
    expect(checkAuthEndpointRateLimit(getSessionReq, 3).allowed).toBe(true);

    // Upload/export bucket enforces window cap
    expect(consumeUploadRateLimit("audit:bucket", 2, 60_000).allowed).toBe(true);
    expect(consumeUploadRateLimit("audit:bucket", 2, 60_000).allowed).toBe(true);
    expect(consumeUploadRateLimit("audit:bucket", 2, 60_000).allowed).toBe(false);
  });

  it("7. builds strict CSP and security headers in production & dev and disables X-Powered-By", () => {
    const prodHeaders = buildSecurityHeaders({
      isDev: false,
      posthogHost: "https://us.i.posthog.com",
      r2Endpoint: "https://account123.r2.cloudflarestorage.com",
    });
    const map = Object.fromEntries(prodHeaders.map((h) => [h.key, h.value]));

    expect(map["Content-Security-Policy"]).toContain("default-src 'self'");
    expect(map["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(map["Content-Security-Policy"]).toContain("object-src 'none'");
    expect(map["Content-Security-Policy"]).toContain("upgrade-insecure-requests");
    expect(map["Content-Security-Policy"]).not.toContain("'unsafe-eval'");
    expect(map["X-Content-Type-Options"]).toBe("nosniff");
    expect(map["X-Frame-Options"]).toBe("DENY");
    expect(map["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(map["Strict-Transport-Security"]).toContain("max-age=63072000");

    const devCsp = buildContentSecurityPolicy({ isDev: true });
    expect(devCsp).toContain("'unsafe-eval'");

    const repoRoot = resolveRepoRoot();
    const nextConfigSrc = readFileSync(join(repoRoot, "apps/web/next.config.ts"), "utf-8");
    expect(nextConfigSrc).toContain("poweredByHeader: false");
    expect(nextConfigSrc).toContain("buildSecurityHeaders");
  });

  it("8. redacts tokens, API keys, and PII from logs, sanitizes header filenames, and gitignores .env", () => {
    const rawMsg =
      "Failed fetch https://casefolio.app/export/123?token=eyJhbGciOiJIUzI1NiJ9.secret for user designer@studio.io with Bearer sk_secret_999 and pdl_sdbx_apikey_12345";
    const redacted = redactSensitiveText(rawMsg);
    expect(redacted).not.toContain("eyJhbGciOiJIUzI1NiJ9.secret");
    expect(redacted).not.toContain("designer@studio.io");
    expect(redacted).not.toContain("sk_secret_999");
    expect(redacted).not.toContain("pdl_sdbx_apikey_12345");
    expect(redacted).toContain("[REDACTED_EMAIL]");
    expect(redacted).toContain("Bearer [REDACTED]");

    const safeErr = sanitizeErrorForLogging(new Error(rawMsg));
    expect(safeErr.message).not.toContain("designer@studio.io");

    expect(sanitizeHeaderFilename('invoice"\r\nX-Evil: 1.html')).toBe("invoiceX-Evil_1.html");

    const repoRoot = resolveRepoRoot();
    const gitignore = readFileSync(join(repoRoot, ".gitignore"), "utf-8");
    expect(gitignore).toMatch(/\.env/);
  });
});
