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

      <div className="grid gap-4">
        {rows.map((orphanage) => (
          <div
            key={orphanage.id}
            className="rounded-lg border border-sand-200 bg-white p-5"
          >
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-sand-900 truncate">
                  {orphanage.name}
                </h2>
                {orphanage.indonesianName && (
                  <span className="hidden sm:inline text-sm text-sand-400 truncate">
                    ({orphanage.indonesianName})
                  </span>
                )}
              </div>
              <p className="text-sm text-sand-500 mt-1">
                {orphanage.location}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                  {orphanage.studentCount} students
                </span>
                <span className="inline-flex items-center rounded-full bg-sage-50 px-2.5 py-0.5 text-xs font-medium text-sage-700 ring-1 ring-inset ring-sage-600/20">
                  {orphanage.classesPerWeek}x/week
                </span>
                <span className="inline-flex items-center rounded-full bg-sand-100 px-2.5 py-0.5 text-xs font-medium text-sand-600">
                  {groupCounts.get(orphanage.id) || 0} groups
                </span>
              </div>
            </div>

            <p className="mt-3 text-sm text-sand-600 line-clamp-2">
              {orphanage.description}
            </p>

            {canEdit && (
              <div className="mt-4 pt-3 border-t border-sand-100">
                <Link
                  href={`/admin/orphanages/${orphanage.id}`}
                  className="text-sm font-medium text-green-600 hover:text-green-700"
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
