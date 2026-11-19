import { NextResponse, type NextRequest } from "next/server";
import { evaluateEdgeGuard } from "@/lib/security/edge-guard";

export function proxy(request: NextRequest) {
  const decision = evaluateEdgeGuard({
    method: request.method,
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    requestOrigin: request.nextUrl.origin,
    originHeader: request.headers.get("origin"),
    secFetchSiteHeader: request.headers.get("sec-fetch-site"),
    contentTypeHeader: request.headers.get("content-type"),
    cookieHeader: request.headers.get("cookie"),
  });

  if (decision.action === "reject") {
    return NextResponse.json(
      { ok: false, error: decision.error ?? "Forbidden." },
      { status: decision.status ?? 403 },
    );
  }

  if (decision.action === "redirect" && decision.redirectPath) {
    return NextResponse.redirect(new URL(decision.redirectPath, request.nextUrl.origin));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/:path*",
    "/admin/:path*",
    "/dashboard/:path*",
    "/account/:path*",
    "/editor/:path*",
    "/new/:path*",
    "/notifications/:path*",
    "/onboarding/:path*",
    "/projects/:path*",
  ],
};

