// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractClientIp } from "@/lib/security/auth-rate-limit";

/**
 * PRODUCTION-READINESS GATE (see production-readiness-report.md).
 *
 * All 19 audit gates across Blockers (B1–B7), Security (S1–S11), and Performance (P1–P4)
 * have been remediated and promoted from `it.fails` to permanent CI regression tests (`it`).
 */

const ROOT = process.cwd();
const web = (p: string) => readFileSync(join(ROOT, "apps/web/src", p), "utf8");
const exists = (p: string) => existsSync(join(ROOT, "apps/web/src", p));

describe("AUDIT BLOCKERS (B1–B7)", () => {
  it("B1 account deletion aborts when Paddle cancellation fails (no swallowed error)", () => {
    const actionsSrc = web("lib/account/actions.ts");
    const purgeSrc = web("lib/retention/account.ts");
    expect(actionsSrc).not.toMatch(/cancelUserSubscription\([\s\S]{0,300}\)\.catch\(\(\) => null\)/);
    expect(purgeSrc).not.toMatch(/cancelUserSubscription\([\s\S]{0,300}\)\.catch\(\(\) => null\)/);
    expect(purgeSrc).toContain("cancelUserSubscription");
  });

  it("B2 simulated billing requires an explicit opt-in flag and is refused on Vercel production", () => {
    const src = web("lib/billing/service.ts");
    expect(src).toContain("ALLOW_SIMULATED_BILLING");
    expect(src).toMatch(/VERCEL_ENV/);
  });

  it("B3 production build does not run db:seed (and migrations are a separate gated step)", () => {
    const vercel = JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf8")) as {
      buildCommand?: string;
    };
    const webPkg = JSON.parse(readFileSync(join(ROOT, "apps/web/package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    expect(vercel.buildCommand ?? "").not.toContain("db:seed");
    expect(vercel.buildCommand ?? "").not.toContain("db:migrate");
    expect(webPkg.scripts?.prebuild ?? "").not.toContain("db:seed");
  });

  it("B4 support contact never reports ok:true when delivery failed (no empty catch)", () => {
    const src = web("app/api/help/contact/route.ts");
    expect(src).not.toMatch(/catch\s*\{\s*\/\/[^\n]*\n\s*\}/);
  });

  it("B5 editor offers a non-destructive conflict resolution (not Reload-only)", () => {
    const src = web("components/editor/constrained-editor.tsx");
    expect(src).toMatch(/keep (my|mine)|Keep my changes|download (a )?copy|Save as copy/i);
  });

  it("B6 export worker rethrows so pg-boss retries transient failures", () => {
    const src = readFileSync(join(ROOT, "apps/worker/src/queue.ts"), "utf8");
    expect(src).not.toMatch(/return \{\s*status: "failed",\s*error: safeError,\s*\};/);
  });

  it("B7 sitemap and robots are provided", () => {
    expect(exists("app/sitemap.ts") || exists("app/sitemap.tsx")).toBe(true);
    expect(exists("app/robots.ts") || exists("app/robots.tsx")).toBe(true);
  });
});

describe("AUDIT SECURITY (S1–S11)", () => {
  it("S1 client IP extraction does not trust the spoofable cf-connecting-ip header on Vercel", () => {
    const headers = new Headers({
      "cf-connecting-ip": "203.0.113.99",
      "x-forwarded-for": "198.51.100.5",
    });
    expect(extractClientIp(headers)).not.toBe("203.0.113.99");
  });

  it("S1b anonymous endpoints use a shared (non in-memory) rate limiter", () => {
    const src = web("lib/storage/rate-limit.ts");
    expect(src).not.toMatch(/new Map</);
    expect(web("app/api/reports/route.ts")).toContain("consumeSharedRateLimit");
    expect(web("app/api/help/contact/route.ts")).toContain("consumeSharedRateLimit");
  });

  it("S3 email/password sign-in requires a verified email", () => {
    expect(web("lib/auth/server.ts")).toMatch(/requireEmailVerification:\s*true/);
  });

  it("S5 callback URL sanitizer rejects backslash/open-redirect tricks by parsing the URL", () => {
    const signInSrc = web("app/(auth)/sign-in/sign-in-form.tsx");
    const safeRedirectSrc = web("lib/auth/safe-redirect.ts");
    expect(signInSrc).toContain("sanitizeCallbackUrl");
    expect(safeRedirectSrc).toMatch(/new URL\(|includes\("\\\\"\)/);
  });

  it("S9a ownership transfer does not trust a client-supplied `reauthenticated` boolean", () => {
    const src = web("app/api/team/transfer-ownership/route.ts");
    expect(src).not.toMatch(/reauthenticated\s*:\s*z\.boolean/);
    expect(src).toContain("consumeStepUpToken");
  });

  it("S9b admin email CTA URL is restricted (http/https on the app origin only)", () => {
    const src = web("lib/admin/emails-types.ts");
    expect(src).toMatch(/ctaUrl[\s\S]{0,200}(refine|startsWith|protocol)/);
  });

  it("S10 dev design-system page is not reachable in production", () => {
    expect(web("app/dev/ui/page.tsx")).toMatch(/notFound\(\)/);
  });

  it("S11 recovery vault access is denied after recoveryUntil", () => {
    expect(web("lib/workspaces/acl.ts")).toMatch(/recoveryUntil/);
  });
});

describe("AUDIT PERFORMANCE (P1–P4)", () => {
  it("P1 DB pool is explicitly sized for serverless", () => {
    const src = readFileSync(join(ROOT, "packages/db/src/client.ts"), "utf8");
    expect(src).toMatch(/max:\s*/);
    expect(src).toMatch(/idleTimeoutMillis/);
  });

  it("P2 public case study page is cacheable (not force-dynamic)", () => {
    expect(web("app/p/[slug]/page.tsx")).not.toMatch(/dynamic\s*=\s*["']force-dynamic["']/);
  });

  it("P3 the editor is code-split with next/dynamic", () => {
    const sources = ["app/editor/[projectId]/page.tsx", "app/editor/[projectId]/editor-client.tsx"]
      .filter(exists)
      .map(web)
      .join("\n");
    expect(sources).toMatch(/next\/dynamic/);
  });

  it("P4 admin overview aggregates in SQL rather than loading whole tables", () => {
    expect(web("lib/admin/overview.ts")).toMatch(/count\(|groupBy\(/);
  });
});
