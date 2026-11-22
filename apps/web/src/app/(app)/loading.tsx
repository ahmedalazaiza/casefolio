import { CardGridSkeleton, PageHeaderSkeleton } from "@/components/ui/skeleton";

/** Instant skeleton for every workspace route while its server data loads (shell stays mounted). */
export default function WorkspaceLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading"
      className="mx-auto flex max-w-6xl flex-col gap-4 sm:gap-5"
    >
      <PageHeaderSkeleton />
      <CardGridSkeleton count={3} />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
