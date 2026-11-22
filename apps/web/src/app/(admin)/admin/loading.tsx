import { PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className="flex flex-col gap-4">
      <PageHeaderSkeleton />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
