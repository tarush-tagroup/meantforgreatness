import {
  PageHeaderSkeleton,
  StatsGridSkeleton,
} from "@/components/admin/LoadingSkeleton";

export default function AdminLoading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <StatsGridSkeleton count={4} />
    </div>
  );
}
