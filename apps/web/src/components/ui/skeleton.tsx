import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Flat pulsing placeholder block that mirrors the final layout while data streams in. */
function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("bg-sunken animate-pulse rounded-md", className)}
      {...props}
    />
  );
}

/** Page header placeholder (eyebrow + title + subtitle) used by route-level `loading.tsx` files. */
function PageHeaderSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-5 py-4 sm:px-6",
        className,
      )}
    >
      <Skeleton className="h-5 w-28 rounded-full" />
      <Skeleton className="h-7 w-64 max-w-full" />
      <Skeleton className="h-4 w-80 max-w-full" />
    </div>
  );
}

/** Thumbnail card placeholder matching project / template cards (16:10 cover + title + meta). */
function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      data-slot="card-skeleton"
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-3",
        className,
      )}
    >
      <Skeleton className="aspect-[16/10] w-full rounded-lg" />
      <div className="flex flex-col gap-2 px-0.5">
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-3.5 w-2/5" />
      </div>
    </div>
  );
}

function CardGridSkeleton({
  count = 6,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {Array.from({ length: count }, (_, index) => (
        <CardSkeleton key={index} />
      ))}
    </div>
  );
}

export { CardGridSkeleton, CardSkeleton, PageHeaderSkeleton, Skeleton };
