import {
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/admin/LoadingSkeleton";

export default function ClassesLoading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <TableSkeleton rows={8} />
    </div>
  );
}
