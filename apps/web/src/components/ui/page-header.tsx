import type { ReactNode } from "react";
import { Eyebrow } from "@/components/ui/eyebrow";
import { cn } from "@/lib/utils";

export interface MarketingPageHeaderProps {
  eyebrow: string;
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/** Centered page header shared by every public marketing page. */
export function MarketingPageHeader({
  eyebrow,
  icon,
  title,
  description,
  className,
  children,
}: MarketingPageHeaderProps) {
  return (
    <header
      className={cn(
        "mx-auto flex max-w-3xl flex-col items-center gap-6 text-center",
        className,
      )}
    >
      <Eyebrow icon={icon}>{eyebrow}</Eyebrow>
      <h1 className="type-section text-foreground text-balance">{title}</h1>
      {description && (
        <p className="text-muted-foreground type-lead max-w-xl text-pretty">
          {description}
        </p>
      )}
      {children}
    </header>
  );
}
