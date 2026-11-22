import { PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function NewProjectLoading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className="flex min-h-screen flex-col">
      <div className="border-b border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)]">
        <div className="mx-auto flex h-17 max-w-7xl items-center justify-between px-4 sm:px-8">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="hidden h-9 w-64 md:block" />
          <Skeleton className="h-9 w-16" />
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-8 sm:px-8 sm:py-10">
        <PageHeaderSkeleton />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
