// @vitest-environment node
import { describe, expect, it } from "vitest";
import { evaluateEdgeGuard, hasSessionCookieHeader } from "./edge-guard";

describe("Edge guard (CSRF origin check + cookie default-deny, S7)", () => {
  it("detects valid Better Auth session cookies and rejects empty values", () => {
    expect(hasSessionCookieHeader(null)).toBe(false);
    expect(hasSessionCookieHeader("theme=dark; better-auth.session_token=")).toBe(false);
    expect(hasSessionCookieHeader("theme=dark; better-auth.session_token=tok_abc")).toBe(true);
    expect(hasSessionCookieHeader("__Secure-better-auth.session_token=tok_xyz")).toBe(true);
  });

  it("rejects cross-site mutating API requests via Origin or Sec-Fetch-Site", () => {
    const evilOrigin = evaluateEdgeGuard({
      method: "POST",
      pathname: "/api/team/invitations",
      requestOrigin: "https://casefolio.app",
      originHeader: "https://evil.example",
      secFetchSiteHeader: "cross-site",
      contentTypeHeader: "application/json",
      cookieHeader: "__Secure-better-auth.session_token=abc",
      envSource: { NEXT_PUBLIC_APP_URL: "https://casefolio.app", NODE_ENV: "production" },
    });
    expect(evilOrigin).toEqual({
      action: "reject",
      status: 403,
      error: "Cross-site API requests are not permitted.",
    });

    const nullOrigin = evaluateEdgeGuard({
      method: "DELETE",
      pathname: "/api/team/members",
      requestOrigin: "https://casefolio.app",
      originHeader: "null",
      secFetchSiteHeader: null,
      contentTypeHeader: "application/json",
      cookieHeader: "__Secure-better-auth.session_token=abc",
      envSource: { NEXT_PUBLIC_APP_URL: "https://casefolio.app", NODE_ENV: "production" },
    });
    expect(nullOrigin.action).toBe("reject");
    expect(nullOrigin.status).toBe(403);

    const formWithoutOrigin = evaluateEdgeGuard({
      method: "POST",
      pathname: "/api/help/contact",
      requestOrigin: "https://casefolio.app",
      originHeader: null,
      secFetchSiteHeader: null,
      contentTypeHeader: "application/x-www-form-urlencoded",
      cookieHeader: null,
      envSource: { NEXT_PUBLIC_APP_URL: "https://casefolio.app", NODE_ENV: "production" },
    });
    expect(formWithoutOrigin.action).toBe("reject");
    expect(formWithoutOrigin.status).toBe(403);
  });

  it("allows same-origin API mutations and signed webhook/cron exemptions", () => {
    const sameOrigin = evaluateEdgeGuard({
      method: "POST",
      pathname: "/api/help/contact",
      requestOrigin: "https://casefolio.app",
      originHeader: "https://casefolio.app",
      secFetchSiteHeader: "same-origin",
      contentTypeHeader: "application/json",
      cookieHeader: null,
      envSource: { NEXT_PUBLIC_APP_URL: "https://casefolio.app", NODE_ENV: "production" },
    });
    expect(sameOrigin).toEqual({ action: "next" });

    const webhook = evaluateEdgeGuard({
      method: "POST",
      pathname: "/api/paddle/webhook",
      requestOrigin: "https://casefolio.app",
      originHeader: null,
      secFetchSiteHeader: "cross-site",
      contentTypeHeader: "application/json",
      cookieHeader: null,
      envSource: { NEXT_PUBLIC_APP_URL: "https://casefolio.app", NODE_ENV: "production" },
    });
    expect(webhook).toEqual({ action: "next" });
  });

  it("blocks /api/admin/** with 401 and redirects /admin/** to /sign-in when no session cookie exists", () => {
    const adminApi = evaluateEdgeGuard({
      method: "GET",
      pathname: "/api/admin/settings",
      requestOrigin: "https://casefolio.app",
      originHeader: null,
      secFetchSiteHeader: "same-origin",
      contentTypeHeader: null,
      cookieHeader: null,
    });
    expect(adminApi).toEqual({
      action: "reject",
      status: 401,
      error: "Authentication required.",
    });

    const adminPage = evaluateEdgeGuard({
      method: "GET",
      pathname: "/admin/users",
      search: "?q=test",
      requestOrigin: "https://casefolio.app",
      originHeader: null,
      secFetchSiteHeader: "same-origin",
      contentTypeHeader: null,
      cookieHeader: null,
    });
    expect(adminPage).toEqual({
      action: "redirect",
      redirectPath: "/sign-in?callbackUrl=%2Fadmin%2Fusers%3Fq%3Dtest",
    });
  });
});
