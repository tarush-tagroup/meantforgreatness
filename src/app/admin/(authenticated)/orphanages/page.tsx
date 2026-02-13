import { getSessionUser } from "@/lib/auth-guard";
import { hasPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { orphanages, classGroups } from "@/db/schema";
import { asc } from "drizzle-orm";
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

  const canEdit = hasPermission(user.roles, "orphanages:edit");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-warmgray-900">Orphanages</h1>
          <p className="mt-1 text-sm text-warmgray-500">
            {rows.length} orphanage{rows.length !== 1 ? "s" : ""} in the program
          </p>
        </div>
        {canEdit && (
          <Link
            href="/admin/orphanages/new"
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-teal-700"
          >
            Add Orphanage
          </Link>
        )}
      </div>

      <div className="grid gap-4">
        {rows.map((orphanage) => (
          <div
            key={orphanage.id}
            className="rounded-lg border border-warmgray-200 bg-white p-5"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-warmgray-900 truncate">
                    {orphanage.name}
                  </h2>
                  {orphanage.indonesianName && (
                    <span className="text-sm text-warmgray-400 truncate">
                      ({orphanage.indonesianName})
                    </span>
                  )}
                </div>
                <p className="text-sm text-warmgray-500 mt-1">
                  {orphanage.location}
                </p>
              </div>

              <div className="flex items-center gap-2 ml-4">
                <span className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700 ring-1 ring-inset ring-teal-600/20">
                  {orphanage.studentCount} students
                </span>
                <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                  {orphanage.classesPerWeek}x/week
                </span>
                <span className="inline-flex items-center rounded-full bg-warmgray-100 px-2.5 py-0.5 text-xs font-medium text-warmgray-600">
                  {groupCounts.get(orphanage.id) || 0} groups
                </span>
              </div>
            </div>

            <p className="mt-3 text-sm text-warmgray-600 line-clamp-2">
              {orphanage.description}
            </p>

            {canEdit && (
              <div className="mt-4 pt-3 border-t border-warmgray-100">
                <Link
                  href={`/admin/orphanages/${orphanage.id}`}
                  className="text-sm font-medium text-teal-600 hover:text-teal-700"
                >
                  Edit details &rarr;
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
