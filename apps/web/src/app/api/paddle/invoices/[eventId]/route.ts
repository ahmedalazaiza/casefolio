import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getUserBillingOverview } from "@/lib/billing/service";
import { sanitizeHeaderFilename } from "@/lib/security/redact";

export const runtime = "nodejs";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(_request: Request, context: { params: Promise<{ eventId: string }> }) {
  const sessionData = await getServerSession();
  if (!sessionData) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { eventId } = await context.params;
  const decodedId = decodeURIComponent(eventId);
  const overview = await getUserBillingOverview(sessionData.user.id);
  const invoice = overview.invoices.find((item) => item.id === decodedId);

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  const formattedDate = new Date(invoice.occurredAtIso).toUTCString();
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Receipt ${escapeHtml(invoice.invoiceNumber)} — Casefolio</title>
    <style>
      body { font-family: system-ui, -apple-system, sans-serif; max-width: 640px; margin: 48px auto; padding: 0 24px; color: #111827; line-height: 1.5; }
      .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; }
      .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f3f4f6; }
      .total { font-weight: 700; font-size: 18px; border-bottom: none; padding-top: 16px; }
      .muted { color: #6b7280; font-size: 13px; }
    </style>
  </head>
  <body>
    <div class="card">
      <p class="muted">CASEFOLIO · PADDLE BILLING RECEIPT (${escapeHtml(overview.environment.toUpperCase())})</p>
      <h1>Invoice ${escapeHtml(invoice.invoiceNumber)}</h1>
      <div class="row"><span>Billed to</span><span>${escapeHtml(sessionData.user.email)}</span></div>
      <div class="row"><span>Date</span><span>${escapeHtml(formattedDate)}</span></div>
      <div class="row"><span>Plan</span><span>${escapeHtml(invoice.planLabel)}</span></div>
      <div class="row"><span>Status</span><span>${escapeHtml(invoice.status.toUpperCase())}</span></div>
      <div class="row total"><span>Total paid</span><span>$${invoice.amountUsd.toFixed(2)} USD</span></div>
      <p class="muted">Processed by Paddle.com Market Limited (Merchant of Record).</p>
    </div>
  </body>
</html>`;

  const safeFilename = sanitizeHeaderFilename(`${invoice.invoiceNumber}.html`, "invoice.html");
  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeFilename}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
