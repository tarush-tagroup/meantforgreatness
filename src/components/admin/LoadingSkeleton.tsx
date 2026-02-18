/**
 * Reusable loading skeleton components for the admin panel.
 */

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="h-10 bg-sand-200 rounded-lg mb-4" />
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-14 bg-sand-100 rounded-lg mb-2"
          style={{ opacity: 1 - i * 0.15 }}
        />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-sand-200 bg-white p-6">
      <div className="h-5 w-1/3 bg-sand-200 rounded mb-4" />
      <div className="h-4 w-2/3 bg-sand-100 rounded mb-2" />
      <div className="h-4 w-1/2 bg-sand-100 rounded" />
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="animate-pulse max-w-2xl space-y-6">
      {/* Field */}
      <div>
        <div className="h-4 w-24 bg-sand-200 rounded mb-2" />
        <div className="h-10 bg-sand-100 rounded-lg" />
      </div>
      {/* Field */}
      <div>
        <div className="h-4 w-32 bg-sand-200 rounded mb-2" />
        <div className="h-10 bg-sand-100 rounded-lg" />
      </div>
      {/* Field */}
      <div>
        <div className="h-4 w-20 bg-sand-200 rounded mb-2" />
        <div className="h-24 bg-sand-100 rounded-lg" />
      </div>
      {/* Button */}
      <div className="h-10 w-32 bg-sand-200 rounded-lg" />
    </div>
  );
}

export function StatsGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className="animate-pulse grid gap-4"
      style={{
        gridTemplateColumns: `repeat(${Math.min(count, 4)}, minmax(0, 1fr))`,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-sand-200 bg-white p-5"
        >
          <div className="h-3 w-20 bg-sand-200 rounded mb-3" />
          <div className="h-7 w-16 bg-sand-100 rounded" />
        </div>
      ))}
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="animate-pulse mb-6">
      <div className="h-8 w-48 bg-sand-200 rounded mb-2" />
      <div className="h-4 w-72 bg-sand-100 rounded" />
    </div>
  );
}
