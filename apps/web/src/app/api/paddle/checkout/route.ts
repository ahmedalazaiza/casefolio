import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { prepareCheckoutSessionForUser } from "@/lib/billing/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const sessionData = await getServerSession();
  if (!sessionData) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", error: "Sign in required." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: "VALIDATION_ERROR", error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const result = await prepareCheckoutSessionForUser(
    {
      id: sessionData.user.id,
      email: sessionData.user.email,
      name: sessionData.user.name,
    },
    body,
  );

  if (!result.ok) {
    const status =
      result.code === "FORBIDDEN"
        ? 403
        : result.code === "RATE_LIMITED"
          ? 429
          : result.code === "ALREADY_SUBSCRIBED"
            ? 409
            : result.code === "BILLING_NOT_CONFIGURED"
              ? 503
              : 400;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result);
}
