import { CardGridSkeleton, PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function TemplatesLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading templates"
      className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:gap-5 sm:px-8"
    >
      <PageHeaderSkeleton />
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-3">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="ml-auto h-8 w-56 max-w-full" />
      </div>
      <CardGridSkeleton count={6} />
      <span className="sr-only">Loading templates…</span>
    </div>
  );
}
