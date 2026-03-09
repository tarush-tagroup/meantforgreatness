import { getSessionUser } from "@/lib/auth-guard";
import { hasPermission } from "@/lib/permissions";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { kids, orphanages, classGroups, classLogAttendance, classLogs, users } from "@/db/schema";
import { eq, asc, desc } from "drizzle-orm";
import Link from "next/link";
import KidEditForm from "./KidEditForm";
import DeleteKidButton from "./DeleteKidButton";

export default async function AdminKidEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.roles, "kids:edit")) {
    redirect("/admin");
  }

  const { id } = await params;

  const [kid] = await db
    .select()
    .from(kids)
    .where(eq(kids.id, id))
    .limit(1);

  if (!kid) {
    notFound();
  }

  const orphanageList = await db
    .select({ id: orphanages.id, name: orphanages.name })
    .from(orphanages)
    .orderBy(asc(orphanages.name));

  const classGroupList = await db
    .select({
      id: classGroups.id,
      name: classGroups.name,
      orphanageId: classGroups.orphanageId,
    })
    .from(classGroups)
    .orderBy(asc(classGroups.sortOrder));

  // Fetch class history for this kid
  const classHistory = await db
    .select({
      classLogId: classLogs.id,
      classDate: classLogs.classDate,
      classTime: classLogs.classTime,
      orphanageName: orphanages.name,
      teacherName: users.name,
      classGroupName: classGroups.name,
      attendanceNote: classLogAttendance.note,
    })
    .from(classLogAttendance)
    .innerJoin(classLogs, eq(classLogAttendance.classLogId, classLogs.id))
    .leftJoin(orphanages, eq(classLogs.orphanageId, orphanages.id))
    .leftJoin(users, eq(classLogs.teacherId, users.id))
    .leftJoin(classGroups, eq(classLogs.classGroupId, classGroups.id))
    .where(eq(classLogAttendance.kidId, id))
    .orderBy(desc(classLogs.classDate));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-sand-500 mb-4">
        <Link
          href="/admin/kids"
          className="hover:text-sand-700 transition-colors"
        >
          Kids
        </Link>
        <span>/</span>
        <span className="text-sand-900">{kid.name}</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-sand-900">
              Edit: {kid.name}
            </h1>
            {kid.status === "inactive" && (
              <span className="inline-flex items-center rounded-full bg-sand-100 px-2.5 py-0.5 text-xs font-medium text-sand-500 ring-1 ring-inset ring-sand-200">
                Inactive
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-sand-500">
            Age {kid.age}{kid.location ? ` · ${kid.location}` : ""}
          </p>
        </div>
        <DeleteKidButton kidId={kid.id} kidName={kid.name} />
      </div>

      <div className="mt-6 rounded-lg border border-sand-200 bg-white p-6">
        <KidEditForm kid={kid} orphanages={orphanageList} classGroups={classGroupList} />
      </div>

      {/* Class History — read-only, autocomputed */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-sand-900 mb-1">
          Class History
        </h2>
        <p className="text-sm text-sand-500 mb-4">
          {classHistory.length} class{classHistory.length !== 1 ? "es" : ""} attended
        </p>

        {classHistory.length === 0 ? (
          <div className="rounded-lg border border-sand-200 bg-white p-6 text-center">
            <p className="text-sand-500 text-sm">No class attendance recorded yet.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-sand-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sand-200">
                <thead className="bg-sand-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-sand-500 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-sand-500 uppercase tracking-wider">Orphanage</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-sand-500 uppercase tracking-wider">Class</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-sand-500 uppercase tracking-wider">Teacher</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-sand-500 uppercase tracking-wider">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-100">
                  {classHistory.map((entry, i) => (
                    <tr key={i} className="hover:bg-sand-50">
                      <td className="px-4 py-2.5 text-sm whitespace-nowrap">
                        <Link
                          href={`/admin/classes/${entry.classLogId}`}
                          className="text-green-600 hover:text-green-700 font-medium"
                        >
                          {entry.classDate}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-sand-700">{entry.orphanageName || "—"}</td>
                      <td className="px-4 py-2.5 text-sm text-sand-700">{entry.classGroupName || "—"}</td>
                      <td className="px-4 py-2.5 text-sm text-sand-700">{entry.teacherName || "—"}</td>
                      <td className="px-4 py-2.5 text-sm text-sand-500 max-w-xs truncate">{entry.attendanceNote || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
