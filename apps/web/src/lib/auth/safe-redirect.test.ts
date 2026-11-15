import { describe, expect, it } from "vitest";
import { sanitizeCallbackUrl, sanitizeRedirectPath } from "@/lib/auth/safe-redirect";

describe("sanitizeRedirectPath", () => {
  it("keeps clean same-origin paths, queries and hashes", () => {
    expect(sanitizeRedirectPath("/dashboard")).toBe("/dashboard");
    expect(sanitizeRedirectPath("/account/team?invitationId=abc&token=def")).toBe(
      "/account/team?invitationId=abc&token=def",
    );
    expect(sanitizeRedirectPath("/editor/1#section")).toBe("/editor/1#section");
    expect(sanitizeRedirectPath("/p/slug%20name")).toBe("/p/slug%20name");
  });

  it("falls back for empty / missing values", () => {
    expect(sanitizeRedirectPath(undefined)).toBe("/dashboard");
    expect(sanitizeRedirectPath(null)).toBe("/dashboard");
    expect(sanitizeRedirectPath("")).toBe("/dashboard");
    expect(sanitizeRedirectPath("", "/home")).toBe("/home");
  });

  it.each([
    ["protocol-relative", "//evil.com"],
    ["protocol-relative with path", "//evil.com/path"],
    ["backslash after slash", "/\\evil.com"],
    ["double backslash", "\\\\evil.com"],
    ["absolute https", "https://evil.com"],
    ["absolute http", "http://evil.com/dashboard"],
    ["javascript scheme", "javascript:alert(1)"],
    ["data scheme", "data:text/html,<script>alert(1)</script>"],
    ["encoded slashes without leading slash", "%2f%2fevil.com"],
    ["encoded double slash after slash", "/%2f%2fevil.com"],
    ["encoded backslash", "/%5cevil.com"],
    ["encoded backslash upper", "/%5Cevil.com"],
    ["tab inside", "/\t/evil.com"],
    ["newline inside", "/\n/evil.com"],
    ["carriage return", "/\r/evil.com"],
    ["tab-prefixed scheme", "\thttps://evil.com"],
    ["leading space", " //evil.com"],
    ["null byte", "/dash\u0000board"],
    ["unicode line separator", "/\u2028/evil.com"],
    ["at-trick", "https://casefolio.com@evil.com"],
    ["at-trick userinfo slash", "//casefolio.com@evil.com"],
    ["relative without slash", "evil.com"],
    ["dot segments to protocol relative", "/..//evil.com"],
    ["malformed percent encoding", "/%E0%A4%A"],
  ])("rejects %s", (_label, raw) => {
    expect(sanitizeRedirectPath(raw)).toBe("/dashboard");
  });

  it("rejects overly long values", () => {
    expect(sanitizeRedirectPath(`/${"a".repeat(3000)}`)).toBe("/dashboard");
  });

  it("never yields a value that resolves off-origin", () => {
    const hostile = [
      "//evil.com",
      "/\\evil.com",
      "/%2f/evil.com",
      "/../..//evil.com",
      "/./\\/evil.com",
      "/@evil.com",
      "/dashboard?next=//evil.com",
    ];
    for (const raw of hostile) {
      const out = sanitizeRedirectPath(raw, "/dashboard", "https://app.casefolio.test");
      const resolved = new URL(out, "https://app.casefolio.test");
      expect(resolved.origin).toBe("https://app.casefolio.test");
      expect(out.startsWith("//")).toBe(false);
    }
  });

  it("exposes sanitizeCallbackUrl as the same helper", () => {
    expect(sanitizeCallbackUrl).toBe(sanitizeRedirectPath);
  });
});
