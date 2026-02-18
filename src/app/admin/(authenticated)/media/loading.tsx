import { PageHeaderSkeleton } from "@/components/admin/LoadingSkeleton";

export default function MediaLoading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <div className="animate-pulse grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-lg bg-sand-100"
            style={{ opacity: 1 - i * 0.1 }}
          />
        ))}
      </div>
    </div>
  );
}
