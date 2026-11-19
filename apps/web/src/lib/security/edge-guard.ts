export interface EdgeGuardDecision {
  action: "next" | "reject" | "redirect";
  status?: number;
  error?: string;
  redirectPath?: string;
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const CSRF_EXEMPT_PREFIXES = [
  "/api/paddle/webhook",
  "/api/auth/",
  "/api/cron/",
  "/api/uploads/local-put",
] as const;

const SESSION_COOKIE_NAMES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
] as const;

const PROTECTED_PAGE_PREFIXES = [
  "/admin",
  "/dashboard",
  "/account",
  "/editor",
  "/new",
  "/notifications",
  "/onboarding",
  "/projects",
] as const;

const FORM_CSRF_CONTENT_TYPES = [
  "application/x-www-form-urlencoded",
  "multipart/form-data",
  "text/plain",
] as const;

export function hasSessionCookieHeader(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false;
  return SESSION_COOKIE_NAMES.some((name) => {
    const idx = cookieHeader.indexOf(`${name}=`);
    if (idx === -1) return false;
    const afterEq = cookieHeader.slice(idx + name.length + 1);
    const semi = afterEq.indexOf(";");
    const val = (semi === -1 ? afterEq : afterEq.slice(0, semi)).trim();
    return val.length > 0;
  });
}

function normalizeOrigin(raw: string | null | undefined): string | null {
  if (!raw || raw === "null") return null;
  try {
    return new URL(raw).origin.toLowerCase();
  } catch {
    return null;
  }
}

export function buildTrustedOrigins(
  requestOrigin: string,
  envSource: Record<string, string | undefined> = process.env,
): Set<string> {
  const set = new Set<string>();
  for (const candidate of [
    requestOrigin,
    envSource.NEXT_PUBLIC_APP_URL,
    envSource.BETTER_AUTH_URL,
    envSource.VERCEL_URL ? `https://${envSource.VERCEL_URL}` : undefined,
    envSource.VERCEL_BRANCH_URL ? `https://${envSource.VERCEL_BRANCH_URL}` : undefined,
    ...(envSource.NODE_ENV !== "production"
      ? ["http://localhost:3000", "http://127.0.0.1:3000"]
      : []),
  ]) {
    const normalized = normalizeOrigin(candidate);
    if (normalized) set.add(normalized);
  }
  return set;
}

export function evaluateEdgeGuard(input: {
  method: string;
  pathname: string;
  search?: string;
  requestOrigin: string;
  originHeader: string | null;
  secFetchSiteHeader: string | null;
  contentTypeHeader: string | null;
  cookieHeader: string | null;
  envSource?: Record<string, string | undefined>;
}): EdgeGuardDecision {
  const method = input.method.toUpperCase();
  const pathname = input.pathname;

  // 1. CSRF / Origin protection on mutating `/api/**` calls
  if (pathname.startsWith("/api/") && MUTATING_METHODS.has(method)) {
    const isExempt = CSRF_EXEMPT_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(prefix),
    );
    if (!isExempt) {
      const secFetchSite = input.secFetchSiteHeader?.trim().toLowerCase() ?? null;
      if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none") {
        return {
          action: "reject",
          status: 403,
          error: "Cross-site API requests are not permitted.",
        };
      }

      const trusted = buildTrustedOrigins(input.requestOrigin, input.envSource);
      if (input.originHeader !== null) {
        const parsedOrigin = normalizeOrigin(input.originHeader);
        if (!parsedOrigin || !trusted.has(parsedOrigin)) {
          return {
            action: "reject",
            status: 403,
            error: "Untrusted request origin.",
          };
        }
      } else {
        const ct = (input.contentTypeHeader ?? "").toLowerCase();
        if (FORM_CSRF_CONTENT_TYPES.some((prefix) => ct.startsWith(prefix))) {
          return {
            action: "reject",
            status: 403,
            error: "Missing Origin header on form submission.",
          };
        }
      }
    }
  }

  // 2. Fast default-deny on `/api/admin/**` without any session cookie
  if (pathname === "/api/admin" || pathname.startsWith("/api/admin/")) {
    if (!hasSessionCookieHeader(input.cookieHeader)) {
      return {
        action: "reject",
        status: 401,
        error: "Authentication required.",
      };
    }
  }

  // 3. Fast default-deny on `/admin/**` and authenticated app shells without a session cookie
  if (method === "GET" || method === "HEAD") {
    const matchesProtectedPage = PROTECTED_PAGE_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
    if (matchesProtectedPage && !hasSessionCookieHeader(input.cookieHeader)) {
      const callbackTarget = `${pathname}${input.search ?? ""}`;
      return {
        action: "redirect",
        redirectPath: `/sign-in?callbackUrl=${encodeURIComponent(callbackTarget)}`,
      };
    }
  }

  return { action: "next" };
}

