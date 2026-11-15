// @vitest-environment node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Security regression suite (static). Casefolio has no central middleware, so authN/authZ is enforced
 * per handler. These tests make "forgot the guard on a new route" a CI failure.
 */

const API_ROOT = join(process.cwd(), "apps/web/src/app/api");
const SRC_ROOT = join(process.cwd(), "apps/web/src");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry === "route.ts") out.push(full);
  }
  return out;
}

function routeKey(file: string): string {
  return "/" + relative(API_ROOT, file).split(sep).slice(0, -1).join("/");
}

/** Routes that are intentionally reachable without a user session, with the reason. */
const PUBLIC_BY_DESIGN: Record<string, string> = {
  "/health": "uptime probe",
  "/track": "anonymous analytics beacon (zod + rate limited)",
  "/auth/[...all]": "Better Auth handler",
  "/paddle/webhook": "HMAC-signed provider webhook",
  "/uploads/local-put": "signed upload token (dev storage driver)",
  "/cron/billing-reconcile": "CRON_SECRET bearer",
  "/cron/maintenance": "CRON_SECRET bearer",
  "/dev/analytics-events": "dev-only, 404 in production",
  "/help/contact": "anonymous support form (rate limited)",
  "/reports": "anonymous public abuse report (rate limited)",
  "/assets/[assetId]": "public delivery gated by authorizeAndReadAsset",
};

const GUARD_MARKERS = [
  "getServerSession",
  "requireSession",
  "requireAdmin",
  "hasAdminRole",
  "ensureAdminApi",
  "authorizeProjectAccess",
  "CRON_SECRET",
  "verifyPaddleSignature",
  "authorizeAndReadAsset",
  "verifyLocalUploadToken",
];

describe("API route authentication coverage", () => {
  const files = walk(API_ROOT);

  it("discovers the API surface", () => {
    expect(files.length).toBeGreaterThanOrEqual(30);
  });

  it("every non-public route contains an authentication/authorization guard", () => {
    const unguarded = files
      .filter((file) => !(routeKey(file) in PUBLIC_BY_DESIGN))
      .filter((file) => {
        const src = readFileSync(file, "utf8");
        return !GUARD_MARKERS.some((marker) => src.includes(marker));
      })
      .map(routeKey);
    expect(unguarded, `Routes missing a guard: ${unguarded.join(", ")}`).toEqual([]);
  });

  it("every /admin route enforces the admin role", () => {
    const missing = files
      .filter((file) => routeKey(file).startsWith("/admin"))
      .filter((file) => {
        const src = readFileSync(file, "utf8");
        return !/hasAdminRole|requireAdmin|ensureAdminApi/.test(src);
      })
      .map(routeKey);
    expect(missing).toEqual([]);
  });

  it("the PUBLIC_BY_DESIGN allowlist has no stale entries", () => {
    const keys = new Set(files.map(routeKey));
    const stale = Object.keys(PUBLIC_BY_DESIGN).filter((key) => !keys.has(key));
    expect(stale).toEqual([]);
  });

  it("webhook route delegates to the signed handler and never touches the DB directly", () => {
    const src = readFileSync(join(API_ROOT, "paddle/webhook/route.ts"), "utf8");
    expect(src).toContain("handleSignedPaddleWebhookRequest");
    expect(src).not.toMatch(/from "@\/lib\/db"/);
    const handler = readFileSync(join(SRC_ROOT, "lib/billing/webhooks.ts"), "utf8");
    const sigIdx = handler.search(/verifyPaddleSignature|verifyPaddleWebhookSignature|signature/i);
    expect(sigIdx).toBeGreaterThan(-1);
  });

  it("no client-bundled module reads server secrets", () => {
    const offenders: string[] = [];
    const scan = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          scan(full);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entry) || /\.test\./.test(entry)) continue;
        const src = readFileSync(full, "utf8");
        if (!/^\s*["']use client["']/m.test(src.slice(0, 200))) continue;
        if (/process\.env\.(?!NEXT_PUBLIC_|NODE_ENV|VITEST)[A-Z_]+/.test(src)) offenders.push(relative(SRC_ROOT, full));
      }
    };
    scan(SRC_ROOT);
    expect(offenders).toEqual([]);
  });

  it("the codebase never uses dangerouslySetInnerHTML or eval", () => {
    const hits: string[] = [];
    const scan = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          scan(full);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entry) || /\.test\./.test(entry)) continue;
        const src = readFileSync(full, "utf8");
        if (/dangerouslySetInnerHTML|\beval\(|new Function\(/.test(src)) hits.push(relative(SRC_ROOT, full));
      }
    };
    scan(SRC_ROOT);
    expect(hits).toEqual([]);
  });
});
