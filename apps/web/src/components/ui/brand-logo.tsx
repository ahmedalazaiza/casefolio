import Link from "next/link";
import {
  CASEFOLIO_LOCKUP_VIEWBOX,
  CASEFOLIO_MARK_PATH,
  CASEFOLIO_MARK_VIEWBOX,
  CASEFOLIO_WORDMARK_PATHS,
} from "@/lib/brand/logo-paths";
import { cn } from "@/lib/utils";

export {
  CASEFOLIO_LOCKUP_VIEWBOX,
  CASEFOLIO_MARK_PATH,
  CASEFOLIO_MARK_VIEWBOX,
  CASEFOLIO_WORDMARK_PATHS,
};

export interface CasefolioMarkProps {
  /** Force the dark-surface Acid Lime mark variant regardless of ambient page theme. */
  inverted?: boolean;
  className?: string;
}

/** Official Casefolio geometric circular-diagonal mark, adaptive to light and dark surfaces. */
export function CasefolioMark({ inverted = false, className }: CasefolioMarkProps) {
  return (
    <svg
      viewBox={CASEFOLIO_MARK_VIEWBOX}
      width="28"
      height="28"
      fill="none"
      aria-hidden="true"
      data-slot="casefolio-mark"
      className={cn("shrink-0", className)}
    >
      <path
        d={CASEFOLIO_MARK_PATH}
        fill={inverted ? "var(--cf-logo-mark-dark-surface)" : "var(--cf-logo-mark)"}
      />
    </svg>
  );
}

export interface CasefolioLockupProps {
  /** Force the dark-surface variant (Acid Lime mark + Warm Cream wordmark). */
  inverted?: boolean;
  className?: string;
}

/** Official Casefolio full horizontal lockup (mark + wordmark), adaptive to light and dark surfaces. */
export function CasefolioLockup({ inverted = false, className }: CasefolioLockupProps) {
  const markFill = inverted ? "var(--cf-logo-mark-dark-surface)" : "var(--cf-logo-mark)";
  const wordmarkFill = inverted
    ? "var(--cf-logo-wordmark-dark-surface)"
    : "var(--cf-logo-wordmark)";

  return (
    <svg
      viewBox={CASEFOLIO_LOCKUP_VIEWBOX}
      width="141"
      height="27"
      fill="none"
      aria-hidden="true"
      data-slot="casefolio-lockup"
      className={cn("h-7 w-auto shrink-0", className)}
    >
      <path d={CASEFOLIO_MARK_PATH} fill={markFill} />
      {CASEFOLIO_WORDMARK_PATHS.map((d, index) => (
        <path key={index} d={d} fill={wordmarkFill} />
      ))}
    </svg>
  );
}

export interface BrandLogoProps {
  href?: string | null;
  subtitle?: string;
  inverted?: boolean;
  compact?: boolean;
  className?: string;
}

export function BrandLogo({
  href = "/",
  subtitle,
  inverted = false,
  compact = false,
  className,
}: BrandLogoProps) {
  const markAndWordmark = (
    <span className={cn("inline-flex flex-col items-start gap-1", compact && "items-center")}>
      {compact ? (
        <CasefolioMark
          inverted={inverted}
          className="size-7 transition-transform duration-200 group-hover:scale-105"
        />
      ) : (
        <CasefolioLockup
          inverted={inverted}
          className="h-[1.6875rem] w-auto transition-transform duration-200 group-hover:scale-[1.02]"
        />
      )}
      <span className="sr-only">Casefolio</span>
      {!compact && subtitle && (
        <span
          className={cn(
            "font-mono text-[0.625rem] font-medium tracking-[0.09em] uppercase",
            inverted ? "text-[var(--cf-lp-dark-muted)]" : "text-[var(--cf-lp-subtle)]",
          )}
        >
          {subtitle}
        </span>
      )}
    </span>
  );

  if (href === null) {
    return (
      <span className={cn("group inline-flex w-fit items-center", className)}>
        {markAndWordmark}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "focus-visible:ring-ring/40 group inline-flex w-fit items-center rounded-[0.3125rem] outline-none focus-visible:ring-2",
        className,
      )}
    >
      {markAndWordmark}
    </Link>
  );
}
