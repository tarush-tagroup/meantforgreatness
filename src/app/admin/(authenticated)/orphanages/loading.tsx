import {
  PageHeaderSkeleton,
  CardSkeleton,
} from "@/components/admin/LoadingSkeleton";

export default function OrphanagesLoading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <div className="grid gap-4 sm:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}
