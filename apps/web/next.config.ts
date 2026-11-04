import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@casefolio/db", "@casefolio/template-schema"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
