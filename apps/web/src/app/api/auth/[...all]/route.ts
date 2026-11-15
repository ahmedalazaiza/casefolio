import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { checkSharedAuthEndpointRateLimit } from "@/lib/security/auth-rate-limit";

const handlers = toNextJsHandler(auth);

export const GET = handlers.GET;

export async function POST(request: Request): Promise<Response> {
  // checkAuthEndpointRateLimit via shared DB-backed limiter across instances
  const rate = await checkSharedAuthEndpointRateLimit(request);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        code: "RATE_LIMITED",
        message: "Too many authentication requests. Please wait and try again.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rate.retryAfterSeconds),
        },
      },
    );
  }

  return handlers.POST(request);
}
