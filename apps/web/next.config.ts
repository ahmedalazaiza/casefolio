import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { NextConfig } from "next";
import { assertProductionBillingEnvironment, createValidatedEnv } from "./src/env";
import { buildSecurityHeaders } from "./src/lib/security/headers";

for (const candidate of [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env")]) {
  if (existsSync(candidate)) {
    process.loadEnvFile(candidate);
    break;
  }
}

try {
  assertProductionBillingEnvironment(process.env);
} catch (err) {
  if (process.env.ENFORCE_PRODUCTION_BILLING_GATE === "1") {
    throw err;
  }
  console.warn(
    `[env] Production deployment is running with non-live billing configuration: ${
      err instanceof Error ? err.message : String(err)
    }`,
  );
}

// Fail fast at startup/build when any required environment variable is missing or invalid
const validatedEnv = createValidatedEnv(process.env, { isServer: true });

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@casefolio/db", "@casefolio/template-schema", "@casefolio/worker"],
  serverExternalPackages: ["pg-boss", "playwright", "playwright-core"],
  outputFileTracingExcludes: {
    "*": [
      "./.data/**",
      "../../.data/**",
      "**/node_modules/playwright/**",
      "**/node_modules/playwright-core/**",
    ],
  },
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75, 85, 90],
  },
  experimental: {
    authInterrupts: true,
  },
  async redirects() {
    return [
      {
        source: "/legal/terms",
        destination: "/terms",
        permanent: true,
      },
      {
        source: "/legal/privacy",
        destination: "/privacy",
        permanent: true,
      },
    ];
  },
  async headers() {
    const baseSecurityOptions = {
      isDev: process.env.NODE_ENV !== "production",
      posthogHost: validatedEnv.NEXT_PUBLIC_POSTHOG_HOST,
      r2Endpoint: `https://${validatedEnv.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    };

    return [
      {
        source: "/:path*",
        headers: buildSecurityHeaders(baseSecurityOptions),
      },
      {
        source: "/export/:path*",
        headers: buildSecurityHeaders({
          ...baseSecurityOptions,
          allowSameOriginFraming: true,
        }),
      },
      // Static template artwork & landing images (public/): cache at the CDN/browser instead of
      // revalidating on every view. Two-segment match keeps the `/templates` page itself uncached-by-rule.
      {
        source: "/templates/:slug/:file",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        source: "/landing/:file",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
