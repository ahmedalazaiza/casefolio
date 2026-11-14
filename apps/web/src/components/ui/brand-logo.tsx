import Link from "next/link";
import { cn } from "@/lib/utils";

export interface BrandLogoProps {
  href?: string;
  subtitle?: string;
  inverted?: boolean;
  className?: string;
}

export function BrandLogo({
  href = "/",
  subtitle,
  inverted = false,
  className,
}: BrandLogoProps) {
  return (
    <Link
      href={href}
      className={cn(
        "focus-visible:ring-ring/40 group inline-flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "bg-brand-royal relative inline-flex size-7 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105",
          inverted && "ring-1 ring-white/25",
        )}
      >
        <svg viewBox="0 0 20 20" fill="none" className="size-4">
          <path
            d="M4.5 14.5L7.8 5.5L10 10.6L12.2 5.5L15.5 14.5H12.7L10 9.6L7.3 14.5H4.5Z"
            fill="var(--brand-on-royal)"
          />
          <circle cx="14.5" cy="5.5" r="2.1" fill="var(--brand-lime)" />
        </svg>
      </span>
      <span
        className={cn(
          "font-display text-lg font-bold tracking-tight",
          inverted ? "text-inherit" : "text-foreground",
        )}
      >
        Casefolio
      </span>
      {subtitle && (
        <>
          <span
            aria-hidden="true"
            className={cn(
              "hidden h-4 w-px sm:block",
              inverted ? "bg-current/25" : "bg-border",
            )}
          />
          <span
            className={cn(
              "type-overline hidden sm:inline",
              inverted ? "text-inherit" : "text-muted-foreground",
            )}
          >
            {subtitle}
          </span>
        </>
      )}
    </Link>
  );
}

