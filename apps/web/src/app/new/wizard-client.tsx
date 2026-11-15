"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { CreateProjectWizard } from "@/app/new/create-project-wizard";

const DynamicCreateProjectWizard = dynamic(
  () =>
    import("@/app/new/create-project-wizard").then((mod) => ({
      default: mod.CreateProjectWizard,
    })),
  {
    loading: () => (
      <div
        role="status"
        aria-label="Loading project wizard"
        className="bg-background text-muted-foreground flex min-h-screen w-full items-center justify-center p-6"
      >
        <div className="border-border bg-card flex items-center gap-3 rounded-xl border px-5 py-3.5 text-sm font-medium">
          <span className="bg-primary size-2 animate-pulse rounded-full" aria-hidden="true" />
          <span>Preparing templates…</span>
        </div>
      </div>
    ),
  },
);

export type WizardClientProps = ComponentProps<typeof CreateProjectWizard>;

export function WizardClient(props: WizardClientProps) {
  return <DynamicCreateProjectWizard {...props} />;
}
