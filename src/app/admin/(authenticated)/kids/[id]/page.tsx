import { getSessionUser } from "@/lib/auth-guard";
import { hasPermission } from "@/lib/permissions";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { kids, orphanages, classGroups, classLogAttendance, classLogs, users } from "@/db/schema";
import { eq, asc, desc } from "drizzle-orm";
import Link from "next/link";
import KidEditForm from "./KidEditForm";
import DeleteKidButton from "./DeleteKidButton";

export default async function AdminKidPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.roles, "kids:view")) {
    redirect("/admin");
  }

  const { id } = await params;
  const sp = await searchParams;
  const canEdit = hasPermission(user.roles, "kids:edit");
  const isEditing = canEdit && sp.edit === "true";

  const [kid] = await db
    .select()
    .from(kids)
    .where(eq(kids.id, id))
    .limit(1);

  if (!kid) {
    notFound();
  }

  // Get orphanage + class group names for display
  const [orphanageRow] = kid.orphanageId
    ? await db.select({ name: orphanages.name }).from(orphanages).where(eq(orphanages.id, kid.orphanageId)).limit(1)
    : [null];
  const [classGroupRow] = kid.classGroupId
    ? await db.select({ name: classGroups.name }).from(classGroups).where(eq(classGroups.id, kid.classGroupId)).limit(1)
    : [null];

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
      classNotes: classLogs.notes,
    })
    .from(classLogAttendance)
    .innerJoin(classLogs, eq(classLogAttendance.classLogId, classLogs.id))
    .leftJoin(orphanages, eq(classLogs.orphanageId, orphanages.id))
    .leftJoin(users, eq(classLogs.teacherId, users.id))
    .leftJoin(classGroups, eq(classLogs.classGroupId, classGroups.id))
    .where(eq(classLogAttendance.kidId, id))
    .orderBy(desc(classLogs.classDate));

  // Only load edit dependencies if editing
  let orphanageList: { id: string; name: string }[] = [];
  let classGroupList: { id: string; name: string; orphanageId: string }[] = [];
  if (isEditing) {
    orphanageList = await db
      .select({ id: orphanages.id, name: orphanages.name })
      .from(orphanages)
      .orderBy(asc(orphanages.name));
    classGroupList = await db
      .select({
        id: classGroups.id,
        name: classGroups.name,
        orphanageId: classGroups.orphanageId,
      })
      .from(classGroups)
      .orderBy(asc(classGroups.sortOrder));
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-sand-500 mb-4">
        <Link href="/admin/kids" className="hover:text-sand-700 transition-colors">
          Kids
        </Link>
        <span>/</span>
        <span className="text-sand-900">{kid.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-sand-900">
              {kid.name}
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
        <div className="flex items-center gap-2">
          {canEdit && !isEditing && (
            <Link
              href={`/admin/kids/${kid.id}?edit=true`}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700"
            >
              Edit
            </Link>
          )}
          {canEdit && isEditing && (
            <Link
              href={`/admin/kids/${kid.id}`}
              className="rounded-lg border border-sand-300 px-4 py-2 text-sm font-medium text-sand-700 shadow-sm transition-colors hover:bg-sand-50"
            >
              Cancel
            </Link>
          )}
          {canEdit && <DeleteKidButton kidId={kid.id} kidName={kid.name} />}
        </div>
      </div>

      {/* Edit form or read-only profile */}
      {isEditing ? (
        <div className="mt-6 rounded-lg border border-sand-200 bg-white p-6">
          <KidEditForm kid={kid} orphanages={orphanageList} classGroups={classGroupList} />
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-sand-200 bg-white overflow-hidden">
          {/* Photo + details */}
          <div className="sm:flex">
            {kid.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={kid.imageUrl}
                alt={kid.name}
                className="h-56 w-full object-cover object-[50%_25%] sm:h-auto sm:w-48 sm:shrink-0"
              />
            ) : (
              <div className="hidden sm:flex h-auto w-48 shrink-0 items-center justify-center bg-sand-100">
                <span className="text-5xl text-sand-300">{kid.name.charAt(0)}</span>
              </div>
            )}
            <div className="p-5 space-y-3">
              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                  Age {kid.age}
                </span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                  kid.status === "active"
                    ? "bg-green-50 text-green-700 ring-green-600/20"
                    : "bg-sand-100 text-sand-500 ring-sand-200"
                }`}>
                  {kid.status === "active" ? "Active" : "Inactive"}
                </span>
                {orphanageRow?.name && (
                  <span className="inline-flex items-center rounded-full bg-sage-50 px-2.5 py-0.5 text-xs font-medium text-sage-700 ring-1 ring-inset ring-sage-600/20">
                    {orphanageRow.name}
                  </span>
                )}
                {classGroupRow?.name && (
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
                    {classGroupRow.name}
                  </span>
                )}
              </div>

              {kid.dateRegistered && (
                <p className="text-sm text-sand-600">
                  <span className="font-medium text-sand-700">Registered:</span>{" "}
                  {new Date(kid.dateRegistered + "T00:00:00").toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              )}
              {kid.hobby && (
                <p className="text-sm text-sand-600">
                  <span className="font-medium text-sand-700">Hobby:</span> {kid.hobby}
                </p>
              )}
              {kid.location && (
                <p className="text-sm text-sand-600">
                  <span className="font-medium text-sand-700">From:</span> {kid.location}
                </p>
              )}
              {kid.about && (
                <p className="text-sm text-sand-600 leading-relaxed">{kid.about}</p>
              )}
              {kid.favoriteWord && (
                <p className="text-sm text-sand-500 italic">
                  <span className="font-medium not-italic text-sand-700">Favorite word:</span>{" "}
                  {kid.favoriteWord}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Class History — always visible */}
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
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-sand-500 uppercase tracking-wider hidden sm:table-cell">Teacher</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-sand-500 uppercase tracking-wider hidden sm:table-cell">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-100">
                  {classHistory.map((entry, i) => {
                    const href = `/admin/classes/${entry.classLogId}`;
                    return (
                      <tr key={i} className="hover:bg-sand-50">
                        <td className="px-4 py-2.5 text-sm whitespace-nowrap">
                          <Link href={href} className="block text-sand-900 font-medium">{entry.classDate}</Link>
                        </td>
                        <td className="px-4 py-2.5 text-sm">
                          <Link href={href} className="block text-sand-700">{entry.orphanageName || "—"}</Link>
                        </td>
                        <td className="px-4 py-2.5 text-sm">
                          <Link href={href} className="block text-sand-700">{entry.classGroupName || "—"}</Link>
                        </td>
                        <td className="px-4 py-2.5 text-sm hidden sm:table-cell">
                          <Link href={href} className="block text-sand-700">{entry.teacherName || "—"}</Link>
                        </td>
                        <td className="px-4 py-2.5 text-sm text-sand-500 max-w-xs hidden sm:table-cell">
                          <Link href={href} className="block">
                            {entry.attendanceNote || entry.classNotes ? (
                              <div className="space-y-1">
                                {entry.attendanceNote && (
                                  <p className="truncate" title={entry.attendanceNote}>
                                    <span className="font-medium text-sand-600">Kid:</span> {entry.attendanceNote}
                                  </p>
                                )}
                                {entry.classNotes && (
                                  <p className="truncate" title={entry.classNotes}>
                                    <span className="font-medium text-sand-600">Class:</span> {entry.classNotes}
                                  </p>
                                )}
                              </div>
                            ) : (
                              "—"
                            )}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
