import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { FREE_LIFETIME_PROJECT_LIMIT } from "@/lib/billing/plans";

export function TestCanvasCtaSection({
  className = "py-20 sm:py-28",
}: {
  className?: string;
}) {
  return (
    <section className={className}>
      <div className="v3-container flex flex-col items-center text-center">
        <h2 className="v3-display-l max-w-2xl text-[var(--cf-text-primary)]">
          Test the canvas before paying{" "}
          <span className="italic text-[var(--cf-lp-subtle)]">a single cent.</span>
        </h2>
        <p className="v3-body-m mt-4 max-w-md text-[var(--cf-text-secondary)]">
          Build and publish {FREE_LIFETIME_PROJECT_LIMIT} Case Study free — no credit card required.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/sign-up" className="v3-btn-primary py-3.5 px-7 text-sm">
            <span>Start free</span>
            <ArrowRight className="size-4" />
          </Link>
          <Link href="/help/billing-and-plans" className="v3-btn-secondary py-3.5 px-7 text-sm">
            <span>Billing guide</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
