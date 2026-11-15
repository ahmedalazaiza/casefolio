// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, buildSecurityHeaders } from "./headers";

const header = (isDev: boolean, key: string) =>
  buildSecurityHeaders({ isDev }).find((h) => h.key === key)?.value;

describe("security headers (S6)", () => {
  it("never allows unsafe-eval in production, only in dev", () => {
    expect(buildContentSecurityPolicy({ isDev: false })).not.toContain("unsafe-eval");
    expect(buildContentSecurityPolicy({ isDev: true })).toContain("unsafe-eval");
  });

  it("sets same-origin COOP and a restrictive Permissions-Policy", () => {
    expect(header(false, "Cross-Origin-Opener-Policy")).toBe("same-origin");
    const pp = header(false, "Permissions-Policy") ?? "";
    for (const feature of ["camera=()", "microphone=()", "geolocation=()", "payment=(self)"]) {
      expect(pp).toContain(feature);
    }
  });

  it("keeps clickjacking and object protections", () => {
    const csp = buildContentSecurityPolicy({ isDev: false });
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });
});
