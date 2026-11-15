// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractClientIp } from "@/lib/security/auth-rate-limit";

/**
 * PRODUCTION-READINESS GATE (see production-readiness-report.md).
 *
 * Each test encodes the DESIRED end-state of a finding from the audit. They are registered with
 * `it.fails`, which means:
 *   - while the gap EXISTS the test is "expected to fail" => suite stays green and the gap is tracked;
 *   - the moment the gap is FIXED the assertion passes and `it.fails` flips to RED,
 *     forcing the developer to delete `.fails` (promoting it to a permanent regression test).
 * When every `it.fails` below has been converted to `it`, the app has cleared the audit.
 */

const ROOT = process.cwd();
const web = (p: string) => readFileSync(join(ROOT, "apps/web/src", p), "utf8");
const exists = (p: string) => existsSync(join(ROOT, "apps/web/src", p));

describe("AUDIT BLOCKERS (B1–B7)", () => {
  it.fails("B1 account deletion aborts when Paddle cancellation fails (no swallowed error)", () => {
    const src = web("lib/account/actions.ts");
    expect(src).not.toMatch(/cancelUserSubscription\([\s\S]{0,300}\)\.catch\(\(\) => null\)/);
  });

  it.fails("B2 simulated billing requires an explicit opt-in flag and is refused on Vercel production", () => {
    const src = web("lib/billing/service.ts");
    expect(src).toContain("ALLOW_SIMULATED_BILLING");
    expect(src).toMatch(/VERCEL_ENV/);
  });

  it.fails("B3 production build does not run db:seed (and migrations are a separate gated step)", () => {
    const vercel = JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf8")) as { buildCommand?: string };
    expect(vercel.buildCommand ?? "").not.toContain("db:seed");
  });

  it.fails("B4 support contact never reports ok:true when delivery failed (no empty catch)", () => {
    const src = web("app/api/help/contact/route.ts");
    expect(src).not.toMatch(/catch\s*\{\s*\/\/[^\n]*\n\s*\}/);
  });

  it.fails("B5 editor offers a non-destructive conflict resolution (not Reload-only)", () => {
    const src = web("components/editor/constrained-editor.tsx");
    expect(src).toMatch(/keep (my|mine)|Keep my changes|download (a )?copy|Save as copy/i);
  });

  it.fails("B6 export worker rethrows so pg-boss retries transient failures", () => {
    const src = readFileSync(join(ROOT, "apps/worker/src/queue.ts"), "utf8");
    expect(src).not.toMatch(/return \{\s*status: "failed",\s*error: safeError,\s*\};/);
  });

  it.fails("B7 sitemap and robots are provided", () => {
    expect(exists("app/sitemap.ts") || exists("app/sitemap.tsx")).toBe(true);
    expect(exists("app/robots.ts") || exists("app/robots.tsx")).toBe(true);
  });
});

describe("AUDIT SECURITY (S1–S9)", () => {
  it.fails("S1 client IP extraction does not trust the spoofable cf-connecting-ip header on Vercel", () => {
    const headers = new Headers({ "cf-connecting-ip": "203.0.113.99", "x-forwarded-for": "198.51.100.5" });
    expect(extractClientIp(headers)).not.toBe("203.0.113.99");
  });

  it.fails("S1b anonymous endpoints use a shared (non in-memory) rate limiter", () => {
    const src = web("lib/storage/rate-limit.ts");
    expect(src).not.toMatch(/new Map</);
  });

  it.fails("S3 email/password sign-in requires a verified email", () => {
    expect(web("lib/auth/server.ts")).toMatch(/requireEmailVerification:\s*true/);
  });

  it.fails("S5 callback URL sanitizer rejects backslash/open-redirect tricks by parsing the URL", () => {
    const src = web("app/(auth)/sign-in/sign-in-form.tsx");
    expect(src).toMatch(/new URL\(|includes\("\\\\"\)/);
  });

  it.fails("S9a ownership transfer does not trust a client-supplied `reauthenticated` boolean", () => {
    expect(web("app/api/team/transfer-ownership/route.ts")).not.toMatch(/reauthenticated\s*:\s*z\.boolean/);
  });

  it.fails("S9b admin email CTA URL is restricted (http/https on the app origin only)", () => {
    const src = web("lib/admin/emails-types.ts");
    expect(src).toMatch(/ctaUrl[\s\S]{0,200}(refine|startsWith|protocol)/);
  });

  it.fails("S10 dev design-system page is not reachable in production", () => {
    expect(web("app/dev/ui/page.tsx")).toMatch(/notFound\(\)/);
  });

  it.fails("S11 recovery vault access is denied after recoveryUntil", () => {
    expect(web("lib/workspaces/acl.ts")).toMatch(/recoveryUntil/);
  });
});

describe("AUDIT PERFORMANCE (P1–P4)", () => {
  it.fails("P1 DB pool is explicitly sized for serverless", () => {
    const src = readFileSync(join(ROOT, "packages/db/src/client.ts"), "utf8");
    expect(src).toMatch(/max:\s*/);
    expect(src).toMatch(/idleTimeoutMillis/);
  });

  it.fails("P2 public case study page is cacheable (not force-dynamic)", () => {
    expect(web("app/p/[slug]/page.tsx")).not.toMatch(/dynamic\s*=\s*["']force-dynamic["']/);
  });

  it.fails("P3 the editor is code-split with next/dynamic", () => {
    const sources = ["app/editor/[projectId]/page.tsx", "app/editor/[projectId]/editor-client.tsx"]
      .filter(exists)
      .map(web)
      .join("\n");
    expect(sources).toMatch(/next\/dynamic/);
  });

  it.fails("P4 admin overview aggregates in SQL rather than loading whole tables", () => {
    expect(web("lib/admin/overview.ts")).toMatch(/count\(|groupBy\(/);
  });
});
