import type { ReactNode } from "react";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { getSiteCmsContent } from "@/lib/cms/service";

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const cms = await getSiteCmsContent();
  return <MarketingShell brand={cms.brand}>{children}</MarketingShell>;
}

