import { getSessionUser } from "@/lib/auth-guard";
import { hasPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { orphanages, classGroups, kids } from "@/db/schema";
import { asc, sql } from "drizzle-orm";
import Link from "next/link";

export default async function AdminOrphanagesPage() {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.roles, "orphanages:view")) {
    redirect("/admin");
  }

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

  const canEdit = hasPermission(user.roles, "orphanages:edit");

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

      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map((orphanage) => (
          <Link
            key={orphanage.id}
            href={`/admin/orphanages/${orphanage.id}`}
            className="block rounded-lg border border-sand-200 bg-white overflow-hidden transition-shadow hover:shadow-md"
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
            <div className="p-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-sand-900 truncate">
                  {orphanage.name}
                </h2>
                {orphanage.indonesianName && (
                  <span className="hidden sm:inline text-sm text-sand-400 truncate">
                    ({orphanage.indonesianName})
                  </span>
                )}
              </div>
              <p className="text-sm text-sand-500 mt-1 truncate">
                {orphanage.location}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                  {kidCountMap.get(orphanage.id) ?? 0} students
                </span>
                <span className="inline-flex items-center rounded-full bg-sand-100 px-2.5 py-0.5 text-xs font-medium text-sand-600">
                  {groupCounts.get(orphanage.id) || 0} groups
                </span>
              </div>
              {orphanage.description && (
                <p className="mt-2 text-sm text-sand-600 line-clamp-2">
                  {orphanage.description}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
