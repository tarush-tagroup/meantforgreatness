import {
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/admin/LoadingSkeleton";

export default function EventsLoading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <TableSkeleton rows={5} />
    </div>
  );
}
