import {
  PageHeaderSkeleton,
  StatsGridSkeleton,
  TableSkeleton,
} from "@/components/admin/LoadingSkeleton";

export default function DonationsLoading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <StatsGridSkeleton count={3} />
      <div className="mt-6">
        <TableSkeleton rows={8} />
      </div>
    </div>
  );
}
