import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { pruneOldPageViews } from "@/lib/analytics/page-views";
import { runExportMaintenance } from "@/lib/exports/maintenance";
import { retrySupportTicketDeliveries } from "@/lib/help/tickets";
import { processScheduledAccountDeletions } from "@/lib/retention/account";
import { purgeExpiredRecoverySpaces } from "@/lib/retention/recovery";
import { sanitizeErrorForLogging } from "@/lib/security/redact";
import { pruneSharedRateLimits } from "@/lib/security/shared-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request, secret: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function runAllMaintenanceJobs(now = new Date()) {
  const errors: Record<string, string> = {};

  const runSafe = async <T>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      errors[name] = sanitizeErrorForLogging(err).message;
      return fallback;
    }
  };

  const [
    accountDeletions,
    recoverySpaces,
    exportsMaintenance,
    supportTickets,
    prunedPageViews,
    prunedRateLimits,
  ] = await Promise.all([
    runSafe(
      "accountDeletions",
      () => processScheduledAccountDeletions(now),
      { processed: 0, purged: 0, blocked: 0, failed: 0 },
    ),
    runSafe(
      "recoverySpaces",
      () => purgeExpiredRecoverySpaces(now),
      { purgedSpaces: 0, purgedProjects: 0, purgedObjects: 0 },
    ),
    runSafe(
      "exportsMaintenance",
      () => runExportMaintenance({ now }),
      { staleExportsFailed: 0, reservationsReleased: 0, expiredBlobsPurged: 0 },
    ),
    runSafe(
      "supportTickets",
      () => retrySupportTicketDeliveries(25, now),
      { claimed: 0, delivered: 0, stillQueued: 0 },
    ),
    runSafe("prunedPageViews", () => pruneOldPageViews(365, now), 0),
    runSafe("prunedRateLimits", () => pruneSharedRateLimits(24 * 60 * 60 * 1000), 0),
  ]);

  const hasErrors = Object.keys(errors).length > 0;
  return {
    ok: !hasErrors,
    ranAtIso: now.toISOString(),
    accountDeletions,
    recoverySpaces,
    exportsMaintenance,
    supportTickets,
    prunedPageViews,
    prunedRateLimits,
    ...(hasErrors ? { errors } : {}),
  };
}

/**
 * Daily GDPR/retention/sweeper cron endpoint (`/api/cron/maintenance`, scheduled in `vercel.json`).
 * Protected by constant-time `CRON_SECRET` Bearer comparison; fails closed (503) if unset.
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

  const summary = await runAllMaintenanceJobs();
  return NextResponse.json(summary, { status: summary.ok ? 200 : 207 });
}

export async function POST(request: Request) {
  return GET(request);
}
