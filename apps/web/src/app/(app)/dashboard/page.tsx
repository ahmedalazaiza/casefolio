import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/ui/domain-cards";

export const metadata: Metadata = {
  title: "Projects — Casefolio",
};

export default function DashboardPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <span className="text-primary type-overline">Case Study Builder</span>
          <h1 className="type-display-m sm:type-display-l text-foreground">
            Your case studies
          </h1>
          <p className="text-muted-foreground type-body-m">
            Turn finished projects into polished, publishable stories.
          </p>
        </div>

        <Button size="lg" className="w-fit">
          <Plus className="size-4" />
          New project
        </Button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        <ProjectCard
          title="Mosaed — Debt app"
          subtitle="Mobile app · Edited 2h ago"
          statusLabel="Published"
          statusTone="published"
        />
        <ProjectCard
          title="Ghaith donation platform"
          subtitle="Website · Edited yesterday"
          statusLabel="Draft"
          statusTone="draft"
        />
        <ProjectCard
          title="Cinema booking"
          subtitle="Mobile app · Edited 3 days ago"
          statusLabel="Published"
          statusTone="published"
        />
      </div>
    </div>
  );
}

