import type { MetadataRoute } from "next";
import { resolvePublicAppBaseUrl } from "@/lib/projects/publish";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = resolvePublicAppBaseUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/templates",
          "/pricing",
          "/about",
          "/team",
          "/help",
          "/terms",
          "/privacy",
          "/p/",
        ],
        disallow: [
          "/api/",
          "/admin",
          "/account",
          "/dashboard",
          "/editor",
          "/export",
          "/new",
          "/notifications",
          "/onboarding",
          "/projects",
          "/verify",
          "/reset",
          "/dev",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
