import { Sparkles } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface CasefolioWatermarkProps {
  visible: boolean;
  interactive?: boolean;
  className?: string;
}

export function CasefolioWatermark({
  visible,
  interactive = true,
  className,
}: CasefolioWatermarkProps) {
  if (!visible) {
    return null;
  }

  const badgeBody = (
    <span
      data-testid="casefolio-watermark-badge"
      className={cn(
        "border-border bg-elevated text-foreground shadow-card type-body-s-strong inline-flex items-center gap-2 rounded-full border px-4 py-2",
        interactive && "hover:border-primary/45 hover:bg-surface transition-colors",
      )}
    >
      <Sparkles className="text-primary size-3.5 shrink-0" />
      <span>Made with Casefolio</span>
    </span>
  );

  return (
    <footer
      data-testid="casefolio-watermark-footer"
      className={cn(
        "border-border/60 bg-surface flex items-center justify-center border-t px-6 py-8",
        className,
      )}
    >
      {interactive ? (
        <Link href="/" aria-label="Made with Casefolio — create your own portfolio case study">
          {badgeBody}
        </Link>
      ) : (
        badgeBody
      )}
    </footer>
  );
}
