export interface SecurityHeadersOptions {
  isDev: boolean;
  posthogHost?: string;
  r2Endpoint?: string;
}

export interface HttpHeaderEntry {
  key: string;
  value: string;
}

function tryExtractOrigin(rawUrl: string | undefined): string | null {
  if (!rawUrl) return null;
  try {
    return new URL(rawUrl).origin;
  } catch {
    return null;
  }
}

export function buildContentSecurityPolicy(options: SecurityHeadersOptions): string {
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    ...(options.isDev ? ["'unsafe-eval'"] : []),
    "https://cdn.paddle.com",
    "https://sandbox-cdn.paddle.com",
    "https://public.profitwell.com",
  ];

  const extraConnectOrigins = [
    tryExtractOrigin(options.posthogHost),
    tryExtractOrigin(options.r2Endpoint),
  ].filter((origin): origin is string => Boolean(origin));

  const connectSrc = Array.from(
    new Set([
      "'self'",
      "https://*.paddle.com",
      "https://*.posthog.com",
      "https://*.i.posthog.com",
      "https://*.ingest.sentry.io",
      "https://*.ingest.us.sentry.io",
      "https://*.ingest.de.sentry.io",
      "https://*.r2.cloudflarestorage.com",
      ...extraConnectOrigins,
      ...(options.isDev ? ["ws:", "wss:", "http://localhost:*", "http://127.0.0.1:*"] : []),
    ]),
  );

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://rsms.me",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com https://rsms.me",
    `connect-src ${connectSrc.join(" ")}`,
    "frame-src 'self' https://*.paddle.com https://buy.paddle.com https://sandbox-buy.paddle.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self' https://accounts.google.com",
    "object-src 'none'",
    ...(!options.isDev ? ["upgrade-insecure-requests"] : []),
  ];

  return directives.join("; ");
}

export function buildSecurityHeaders(options: SecurityHeadersOptions): HttpHeaderEntry[] {
  const headers: HttpHeaderEntry[] = [
    {
      key: "Content-Security-Policy",
      value: buildContentSecurityPolicy(options),
    },
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "X-Frame-Options",
      value: "DENY",
    },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
    },
    {
      key: "Cross-Origin-Opener-Policy",
      value: "same-origin-allow-popups",
    },
    {
      key: "X-DNS-Prefetch-Control",
      value: "off",
    },
  ];

  if (!options.isDev) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }

  return headers;
}
