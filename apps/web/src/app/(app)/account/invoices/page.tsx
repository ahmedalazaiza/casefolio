import { Download, ReceiptText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AccountSettingsShell } from "@/components/account/account-settings-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/session";
import { getUserBillingOverview } from "@/lib/billing/service";

export const metadata: Metadata = {
  title: "Invoices — Casefolio",
};

export default async function AccountInvoicesPage() {
  const { user } = await requireSession("/account/invoices");
  const overview = await getUserBillingOverview(user.id);

  return (
    <AccountSettingsShell activeTab="invoices">
      <section
        data-testid="invoices-settings-panel"
        className="border-border/80 bg-elevated shadow-card overflow-hidden rounded-3xl border"
      >
        {overview.invoices.length === 0 ? (
          <div
            data-testid="invoices-empty-state"
            className="flex flex-col items-center justify-center gap-3.5 px-6 py-18 text-center"
          >
            <div className="bg-accent text-primary flex size-12 items-center justify-center rounded-2xl">
              <ReceiptText className="size-5" />
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="text-foreground type-heading-m">No invoices yet</h2>
              <p className="text-muted-foreground type-body-s max-w-md">
                Receipts from Paddle appear here automatically whenever a Pro or Team
                subscription charge completes.
              </p>
            </div>
            <Button asChild variant="secondary" size="sm" className="mt-1">
              <Link href="/account/billing">View billing &amp; plans</Link>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left" data-testid="invoices-table">
              <thead>
                <tr className="border-border/70 bg-surface/50 border-b">
                  <th className="text-tertiary type-overline px-5 py-3.5">DATE</th>
                  <th className="text-tertiary type-overline px-5 py-3.5">PLAN</th>
                  <th className="text-tertiary type-overline px-5 py-3.5">AMOUNT</th>
                  <th className="text-tertiary type-overline px-5 py-3.5">STATUS</th>
                  <th className="text-tertiary type-overline px-5 py-3.5 text-right">
                    RECEIPT
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {overview.invoices.map((inv) => {
                  const formattedDate = new Date(inv.occurredAtIso).toLocaleDateString(
                    "en-GB",
                    {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    },
                  );

                  return (
                    <tr key={inv.id} data-testid="invoice-row">
                      <td className="text-foreground type-body-s px-5 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span>{formattedDate}</span>
                          <span className="text-tertiary type-caption font-mono">
                            {inv.invoiceNumber}
                          </span>
                        </div>
                      </td>
                      <td className="text-foreground type-body-s-strong px-5 py-4 whitespace-nowrap">
                        {inv.planLabel}
                      </td>
                      <td className="text-foreground type-body-s px-5 py-4 font-mono whitespace-nowrap">
                        ${inv.amountUsd}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <Badge tone={inv.status === "paid" ? "published" : "danger"}>
                          {inv.status === "paid" ? "Paid" : "Failed"}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <Button asChild variant="secondary" size="sm">
                          <a
                            href={inv.receiptUrl}
                            data-testid="invoice-download-link"
                            download
                          >
                            <Download className="size-3.5" />
                            Download
                          </a>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AccountSettingsShell>
  );
}
