import { CardGridSkeleton, PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading projects"
      className="mx-auto flex max-w-6xl flex-col gap-4 sm:gap-5"
    >
      <div className="flex flex-col gap-3 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-4">
        <Skeleton className="h-9 w-72 max-w-full" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-7 w-32 rounded-full" />
          <Skeleton className="h-7 w-28 rounded-full" />
        </div>
      </div>
      <PageHeaderSkeleton />
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-9 w-28" />
      </div>
      <CardGridSkeleton count={6} />
      <span className="sr-only">Loading projects…</span>
    </div>
  );
}
