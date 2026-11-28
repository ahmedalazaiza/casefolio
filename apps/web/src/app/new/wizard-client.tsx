"use client";

import type { ComponentProps } from "react";
import { CreateProjectWizard } from "@/app/new/create-project-wizard";

export type WizardClientProps = ComponentProps<typeof CreateProjectWizard>;

export function WizardClient(props: WizardClientProps) {
  return <CreateProjectWizard {...props} />;
}

