import { getSessionUser } from "@/lib/auth-guard";
import { hasPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { orphanages, classGroups, classLogs, kids } from "@/db/schema";
import { asc, sql, gte } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminOrphanagesPage({
  searchParams,
}: {
  searchParams: Promise<{ sortBy?: string }>;
}) {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.roles, "orphanages:view")) {
    redirect("/admin");
  }

  const params = await searchParams;

  const rows = await db.select().from(orphanages).orderBy(asc(orphanages.name));
  const groups = await db
    .select()
    .from(classGroups)
    .orderBy(asc(classGroups.sortOrder));

  const groupCounts = new Map<string, number>();
  for (const g of groups) {
    groupCounts.set(g.orphanageId, (groupCounts.get(g.orphanageId) || 0) + 1);
  }

  // Auto-compute student counts from kids table
  const kidCounts = await db
    .select({
      orphanageId: kids.orphanageId,
      count: sql<number>`count(*)::int`,
    })
    .from(kids)
    .groupBy(kids.orphanageId);

  const kidCountMap = new Map(kidCounts.map((r) => [r.orphanageId, r.count]));

  // Total classes per orphanage
  const classCounts = await db
    .select({
      orphanageId: classLogs.orphanageId,
      count: sql<number>`count(*)::int`,
    })
    .from(classLogs)
    .groupBy(classLogs.orphanageId);

  const classCountMap = new Map(classCounts.map((r) => [r.orphanageId, r.count]));

  // Classes in last 30 days per orphanage
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10);

  const recentClassCounts = await db
    .select({
      orphanageId: classLogs.orphanageId,
      count: sql<number>`count(*)::int`,
    })
    .from(classLogs)
    .where(gte(classLogs.classDate, thirtyDaysAgoStr))
    .groupBy(classLogs.orphanageId);

  const recentClassCountMap = new Map(recentClassCounts.map((r) => [r.orphanageId, r.count]));

  const canEdit = hasPermission(user.roles, "orphanages:edit");

  // Sort rows based on sortBy param
  const sortBy = params.sortBy || "name";
  const sortedRows = [...rows].sort((a, b) => {
    switch (sortBy) {
      case "total_classes":
        return (classCountMap.get(b.id) ?? 0) - (classCountMap.get(a.id) ?? 0);
      case "recent_classes":
        return (recentClassCountMap.get(b.id) ?? 0) - (recentClassCountMap.get(a.id) ?? 0);
      case "running_since":
        // Sort by runningSince (YYYY-MM), oldest first; null values go last
        return (a.runningSince || "9999-99").localeCompare(b.runningSince || "9999-99");
      default:
        return a.name.localeCompare(b.name);
    }
  });

  function buildUrl(overrides: Record<string, string>) {
    const merged = { sortBy: params.sortBy || "", ...overrides };
    const p = new URLSearchParams();
    if (merged.sortBy) p.set("sortBy", merged.sortBy);
    const qs = p.toString();
    return `/admin/orphanages${qs ? `?${qs}` : ""}`;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-sand-900">Orphanages</h1>
          <p className="mt-1 text-sm text-sand-500">
            {rows.length} orphanage{rows.length !== 1 ? "s" : ""} in the program
          </p>
        </div>
        {canEdit && (
          <Link
            href="/admin/orphanages/new"
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700"
          >
            Add Orphanage
          </Link>
        )}
      </div>

      {/* Sort pills */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-xs text-sand-500 mr-1">Sort:</span>
        {[
          { label: "Name", value: "" },
          { label: "Total Classes", value: "total_classes" },
          { label: "Recent Classes", value: "recent_classes" },
          { label: "Running Since", value: "running_since" },
        ].map((s) => {
          const isActive = sortBy === s.value || (sortBy === "name" && s.value === "");
          return (
            <Link
              key={s.label}
              href={buildUrl({ sortBy: s.value })}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-green-600 text-white"
                  : "bg-sand-100 text-sand-600 hover:bg-sand-200"
              }`}
            >
              {s.label}
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {sortedRows.map((orphanage) => {
          const totalClasses = classCountMap.get(orphanage.id) ?? 0;
          const recentClasses = recentClassCountMap.get(orphanage.id) ?? 0;

          return (
            <Link
              key={orphanage.id}
              href={`/admin/orphanages/${orphanage.id}`}
              className="block rounded-xl border border-sand-200 bg-white overflow-hidden transition-shadow hover:shadow-md"
            >
              {orphanage.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={orphanage.imageUrl}
                  alt={orphanage.name}
                  className="h-40 w-full object-cover"
                />
              ) : (
                <div className="h-40 bg-sand-100 flex items-center justify-center">
                  <span className="text-4xl text-sand-300">
                    {orphanage.name.charAt(0)}
                  </span>
                </div>
              )}
              <div className="p-4 space-y-1.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-medium text-sand-900 truncate">
                    {orphanage.name}
                  </h2>
                  {orphanage.indonesianName && (
                    <span className="hidden sm:inline text-xs text-sand-400 truncate">
                      ({orphanage.indonesianName})
                    </span>
                  )}
                </div>
                <p className="text-sm text-sand-500 truncate">
                  {orphanage.location}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                    {kidCountMap.get(orphanage.id) ?? 0} students
                  </span>
                  <span className="inline-flex items-center rounded-full bg-sand-100 px-2 py-0.5 text-xs font-medium text-sand-600 ring-1 ring-inset ring-sand-200">
                    {groupCounts.get(orphanage.id) || 0} groups
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-sand-400">
                  <span>{totalClasses} class{totalClasses !== 1 ? "es" : ""} total</span>
                  <span className="text-sand-300">&middot;</span>
                  <span>{recentClasses} in last 30d</span>
                </div>
                {orphanage.description && (
                  <p className="text-xs text-sand-400 line-clamp-2">
                    {orphanage.description}
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
