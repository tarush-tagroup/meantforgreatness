import { getSessionUser } from "@/lib/auth-guard";
import { hasPermission } from "@/lib/permissions";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { orphanages, classGroups, kids, classLogs, users } from "@/db/schema";
import { eq, asc, desc, sql, min, max } from "drizzle-orm";
import Link from "next/link";
import OrphanageEditForm from "./OrphanageEditForm";
import ClassGroupManager from "./ClassGroupManager";

export default async function AdminOrphanagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.roles, "orphanages:view")) {
    redirect("/admin");
  }

  const { id } = await params;
  const sp = await searchParams;
  const canEdit = hasPermission(user.roles, "orphanages:edit");
  const isEditing = canEdit && sp.edit === "true";

  const [orphanage] = await db
    .select()
    .from(orphanages)
    .where(eq(orphanages.id, id))
    .limit(1);

  if (!orphanage) {
    notFound();
  }

  const groups = await db
    .select()
    .from(classGroups)
    .where(eq(classGroups.orphanageId, id))
    .orderBy(asc(classGroups.sortOrder));

  // Get kid counts and age ranges per class group (auto-calculated)
  const kidStats = await db
    .select({
      classGroupId: kids.classGroupId,
      count: sql<number>`count(*)::int`,
      minAge: min(kids.age),
      maxAge: max(kids.age),
    })
    .from(kids)
    .where(eq(kids.orphanageId, id))
    .groupBy(kids.classGroupId);

  const statsMap = new Map(
    kidStats.map((s) => [
      s.classGroupId,
      {
        studentCount: s.count,
        ageRange:
          s.minAge === s.maxAge
            ? `${s.minAge}`
            : `${s.minAge}-${s.maxAge}`,
      },
    ])
  );

  // Total student count for this orphanage
  const totalStudents = kidStats.reduce((sum, s) => sum + s.count, 0);

  // Get recent classes at this orphanage
  const recentClasses = await db
    .select({
      id: classLogs.id,
      classDate: classLogs.classDate,
      classTime: classLogs.classTime,
      teacherName: users.name,
      classGroupName: classGroups.name,
      studentCount: classLogs.studentCount,
      notes: classLogs.notes,
    })
    .from(classLogs)
    .leftJoin(users, eq(classLogs.teacherId, users.id))
    .leftJoin(classGroups, eq(classLogs.classGroupId, classGroups.id))
    .where(eq(classLogs.orphanageId, id))
    .orderBy(desc(classLogs.classDate))
    .limit(20);

  return (
    <div className="mx-auto max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-sand-500 mb-4">
        <Link href="/admin/orphanages" className="hover:text-sand-700 transition-colors">
          Orphanages
        </Link>
        <span>/</span>
        <span className="text-sand-900">{orphanage.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-sand-900">
              {orphanage.name}
            </h1>
            {orphanage.indonesianName && (
              <span className="text-sm text-sand-400">
                ({orphanage.indonesianName})
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-sand-500">{orphanage.location}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canEdit && !isEditing && (
            <Link
              href={`/admin/orphanages/${orphanage.id}?edit=true`}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700"
            >
              Edit
            </Link>
          )}
          {canEdit && isEditing && (
            <Link
              href={`/admin/orphanages/${orphanage.id}`}
              className="rounded-lg border border-sand-300 px-4 py-2 text-sm font-medium text-sand-700 shadow-sm transition-colors hover:bg-sand-50"
            >
              Cancel
            </Link>
          )}
        </div>
      </div>

      {/* Edit mode */}
      {isEditing ? (
        <div className="mt-6 space-y-8">
          <div className="rounded-lg border border-sand-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-sand-900 mb-4">
              Orphanage Details
            </h2>
            <OrphanageEditForm orphanage={orphanage} />
          </div>

          <div className="rounded-lg border border-sand-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-sand-900 mb-4">
              Class Groups
            </h2>
            <ClassGroupManager
              orphanageId={orphanage.id}
              initialGroups={groups.map((g) => {
                const stats = statsMap.get(g.id);
                return {
                  id: g.id,
                  name: g.name,
                  studentCount: stats?.studentCount ?? 0,
                  ageRange: stats?.ageRange ?? "",
                  sortOrder: g.sortOrder,
                };
              })}
            />
          </div>
        </div>
      ) : (
        /* View mode */
        <>
          {/* Photo + details */}
          <div className="mt-6 rounded-lg border border-sand-200 bg-white overflow-hidden">
            {orphanage.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={orphanage.imageUrl}
                alt={orphanage.name}
                className="h-48 w-full object-cover sm:h-64"
              />
            )}
            <div className="p-5 space-y-3">
              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                  {totalStudents} student{totalStudents !== 1 ? "s" : ""}
                </span>
                <span className="inline-flex items-center rounded-full bg-sand-100 px-2.5 py-0.5 text-xs font-medium text-sand-600">
                  {groups.length} class group{groups.length !== 1 ? "s" : ""}
                </span>
                {orphanage.runningSince && (
                  <span className="inline-flex items-center rounded-full bg-sage-50 px-2.5 py-0.5 text-xs font-medium text-sage-700 ring-1 ring-inset ring-sage-600/20">
                    Since {orphanage.runningSince}
                  </span>
                )}
              </div>

              {orphanage.description && (
                <p className="text-sm text-sand-600 leading-relaxed">
                  {orphanage.description}
                </p>
              )}

              {orphanage.address && (
                <p className="text-sm text-sand-600">
                  <span className="font-medium text-sand-700">Address:</span>{" "}
                  {orphanage.address}
                </p>
              )}

              {orphanage.websiteUrl && (
                <p className="text-sm">
                  <span className="font-medium text-sand-700">Website:</span>{" "}
                  <a
                    href={orphanage.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-600 hover:text-green-700 underline"
                  >
                    {orphanage.websiteUrl}
                  </a>
                </p>
              )}
            </div>
          </div>

          {/* Class Groups */}
          {groups.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-sand-900 mb-3">
                Class Groups
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {groups.map((g) => {
                  const stats = statsMap.get(g.id);
                  return (
                    <div
                      key={g.id}
                      className="rounded-lg border border-sand-200 bg-white p-4"
                    >
                      <h3 className="font-medium text-sand-900">{g.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-sand-500">
                          {stats?.studentCount ?? 0} student{(stats?.studentCount ?? 0) !== 1 ? "s" : ""}
                        </span>
                        {stats?.ageRange && (
                          <>
                            <span className="text-sand-300">&middot;</span>
                            <span className="text-xs text-sand-500">
                              Ages {stats.ageRange}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent Classes */}
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-sand-900 mb-1">
              Recent Classes
            </h2>
            <p className="text-sm text-sand-500 mb-4">
              Last {recentClasses.length} class{recentClasses.length !== 1 ? "es" : ""} at this orphanage
            </p>

            {recentClasses.length === 0 ? (
              <div className="rounded-lg border border-sand-200 bg-white p-6 text-center">
                <p className="text-sand-500 text-sm">No classes logged yet.</p>
              </div>
            ) : (
              <div className="rounded-lg border border-sand-200 bg-white overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-sand-200">
                    <thead className="bg-sand-50">
                      <tr>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-sand-500 uppercase tracking-wider">Date</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-sand-500 uppercase tracking-wider">Class</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-sand-500 uppercase tracking-wider">Teacher</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-sand-500 uppercase tracking-wider hidden sm:table-cell">Students</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-sand-500 uppercase tracking-wider hidden sm:table-cell">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sand-100">
                      {recentClasses.map((entry) => (
                        <tr key={entry.id} className="hover:bg-sand-50">
                          <td className="px-4 py-2.5 text-sm whitespace-nowrap">
                            <Link
                              href={`/admin/classes/${entry.id}`}
                              className="text-green-600 hover:text-green-700 font-medium"
                            >
                              {entry.classDate}
                            </Link>
                          </td>
                          <td className="px-4 py-2.5 text-sm text-sand-700">{entry.classGroupName || "—"}</td>
                          <td className="px-4 py-2.5 text-sm text-sand-700">{entry.teacherName || "—"}</td>
                          <td className="px-4 py-2.5 text-sm text-sand-700 hidden sm:table-cell">{entry.studentCount ?? "—"}</td>
                          <td className="px-4 py-2.5 text-sm text-sand-500 max-w-xs truncate hidden sm:table-cell">{entry.notes || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
