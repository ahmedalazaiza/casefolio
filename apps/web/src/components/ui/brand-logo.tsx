import Link from "next/link";
import { cn } from "@/lib/utils";

export interface BrandLogoProps {
  href?: string;
  subtitle?: string;
  className?: string;
}

export function BrandLogo({ href = "/", subtitle, className }: BrandLogoProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/40 rounded-xs",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="bg-primary text-primary-foreground inline-flex size-7 items-center justify-center rounded-xs type-body-s-strong"
      >
        C
      </span>
      <span className="text-foreground type-heading-s tracking-tight">casefolio</span>
      {subtitle && (
        <>
          <span aria-hidden="true" className="bg-border hidden h-4 w-px sm:block" />
          <span className="text-muted-foreground type-overline hidden sm:inline">
            {subtitle}
          </span>
        </>
      )}
    </Link>
  );
}

