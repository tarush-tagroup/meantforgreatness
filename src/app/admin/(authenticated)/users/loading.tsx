import {
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/admin/LoadingSkeleton";

export default function UsersLoading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <TableSkeleton rows={6} />
    </div>
  );
}
