// @vitest-environment node
import { describe, expect, it } from "vitest";
import robots from "./robots";
import sitemap from "./sitemap";

describe("SEO routes (sitemap.ts + robots.ts, B7)", () => {
  it("generates robots.txt disallowing private/admin routes and linking sitemap.xml", () => {
    const result = robots();
    expect(result.sitemap).toMatch(/\/sitemap\.xml$/);
    const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    expect(rule?.disallow).toEqual(
      expect.arrayContaining(["/api/", "/admin", "/account", "/dashboard", "/editor", "/dev"]),
    );
    expect(rule?.allow).toEqual(expect.arrayContaining(["/", "/templates", "/pricing", "/p/"]));
  });

  it("generates sitemap entries for core marketing and help pages", async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls.some((u) => u.endsWith("/"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/templates"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/pricing"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/terms"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/privacy"))).toBe(true);
    expect(urls.some((u) => u.includes("/help/"))).toBe(true);
  });
});
