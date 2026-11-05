import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { NextConfig } from "next";
import { createValidatedEnv } from "./src/env";
import { buildSecurityHeaders } from "./src/lib/security/headers";

for (const candidate of [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env")]) {
  if (existsSync(candidate)) {
    process.loadEnvFile(candidate);
    break;
  }
}

// Fail fast at startup/build when any required environment variable is missing or invalid
const validatedEnv = createValidatedEnv(process.env, { isServer: true });

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@casefolio/db", "@casefolio/template-schema", "@casefolio/worker"],
  serverExternalPackages: ["pg-boss", "playwright", "playwright-core"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  images: {
    qualities: [75, 85, 90],
  },
  experimental: {
    authInterrupts: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: buildSecurityHeaders({
          isDev: process.env.NODE_ENV !== "production",
          posthogHost: validatedEnv.NEXT_PUBLIC_POSTHOG_HOST,
          r2Endpoint: `https://${validatedEnv.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        }),
      },
    ];
  },
};

export default nextConfig;
