import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { reconcileStaleSubscriptions } from "@/lib/billing/reconcile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request, secret: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Daily reconciliation of subscriptions whose paid-through date has lapsed without a Paddle
 * notification. Invoked by Vercel Cron (which sends `Authorization: Bearer $CRON_SECRET`).
 * Disabled (503) until `CRON_SECRET` is configured so it can never run unauthenticated.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) {
    return NextResponse.json(
      { ok: false, error: "Cron is not configured (set CRON_SECRET, 16+ chars)." },
      { status: 503 },
    );
  }
  if (!isAuthorized(request, secret)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const summary = await reconcileStaleSubscriptions();
  return NextResponse.json({ ok: true, ...summary });
}
