import {
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/admin/LoadingSkeleton";

export default function TransparencyLoading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <TableSkeleton rows={4} />
    </div>
  );
}
