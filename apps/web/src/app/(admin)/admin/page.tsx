import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Admin Overview — Casefolio",
};

const KPI_CARDS = [
  { label: "Total users", value: "1,248", badge: "+14% vs last period", tone: "published" },
  { label: "Active subscriptions", value: "186", badge: "+9%", tone: "published" },
  { label: "Published case studies", value: "642", badge: "+22%", tone: "published" },
  { label: "Templates live", value: "4", badge: "2 published · 2 drafts", tone: "neutral" },
] as const;

export default function AdminOverviewPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="type-heading-l text-foreground">Overview</h1>
          <p className="text-muted-foreground type-body-s">
            Platform health for the last 30 days.
          </p>
        </div>

        <Button>Upload template</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {KPI_CARDS.map((kpi) => (
          <Card key={kpi.label} variant="flat" className="gap-3 p-5">
            <span className="text-muted-foreground type-caption">{kpi.label}</span>
            <span className="text-foreground type-heading-l">{kpi.value}</span>
            <div>
              <Badge tone={kpi.tone}>{kpi.badge}</Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
