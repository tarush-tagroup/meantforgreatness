import { getSessionUser } from "@/lib/auth-guard";
import { hasPermission } from "@/lib/permissions";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { classLogs, orphanages, users } from "@/db/schema";
import { eq, asc, sql } from "drizzle-orm";
import ClassLogForm from "../ClassLogForm";
import DeleteClassLogButton from "./DeleteClassLogButton";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ClassLogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.roles, "class_logs:view_all")) {
    redirect("/admin");
  }

  const { id } = await params;

  const [row] = await db
    .select({
      id: classLogs.id,
      orphanageId: classLogs.orphanageId,
      orphanageName: orphanages.name,
      teacherId: classLogs.teacherId,
      teacherName: users.name,
      classDate: classLogs.classDate,
      classTime: classLogs.classTime,
      studentCount: classLogs.studentCount,
      photoUrl: classLogs.photoUrl,
      notes: classLogs.notes,
      createdAt: classLogs.createdAt,
    })
    .from(classLogs)
    .leftJoin(orphanages, eq(classLogs.orphanageId, orphanages.id))
    .leftJoin(users, eq(classLogs.teacherId, users.id))
    .where(eq(classLogs.id, id))
    .limit(1);

  if (!row) {
    notFound();
  }

  // Determine edit/delete permissions
  const isOwner = row.teacherId === user.id;
  const canEditOwn = hasPermission(user.roles, "class_logs:edit_own");
  const canEditAll = hasPermission(user.roles, "class_logs:edit_all");
  const canEdit = (isOwner && canEditOwn) || canEditAll;

  const canDeleteOwn = hasPermission(user.roles, "class_logs:delete_own");
  const canDeleteAll = hasPermission(user.roles, "class_logs:delete_all");
  const canDelete = (isOwner && canDeleteOwn) || canDeleteAll;

  if (canEdit) {
    // Editable mode: show form
    const orphanageOptions = await db
      .select({ id: orphanages.id, name: orphanages.name })
      .from(orphanages)
      .orderBy(asc(orphanages.name));

    const teacherOptions = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(
        sql`${users.status} = 'active' AND ${users.roles} && ARRAY['teacher', 'teacher_manager', 'admin']::text[]`
      )
      .orderBy(asc(users.name));

    const isTeacherOnly =
      user.roles.includes("teacher") &&
      !user.roles.includes("admin") &&
      !user.roles.includes("teacher_manager");

    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-warmgray-900">
              Edit Class Log
            </h1>
            <p className="mt-1 text-sm text-warmgray-500">
              {row.classDate} at {row.orphanageName || row.orphanageId}
            </p>
          </div>
          {canDelete && <DeleteClassLogButton classLogId={row.id} />}
        </div>

        <div className="max-w-2xl">
          <ClassLogForm
            orphanages={orphanageOptions}
            teachers={teacherOptions}
            currentUserId={user.id}
            isTeacherLocked={isTeacherOnly}
            initialData={{
              id: row.id,
              orphanageId: row.orphanageId,
              classDate: row.classDate,
              classTime: row.classTime,
              studentCount: row.studentCount,
              notes: row.notes,
            }}
          />
        </div>
      </div>
    );
  }

  // Read-only view
  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/classes"
          className="text-sm text-warmgray-500 hover:text-warmgray-700"
        >
          &larr; Back to class logs
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-warmgray-900">
          Class Log Details
        </h1>
      </div>

      <div className="max-w-2xl rounded-lg border border-warmgray-200 bg-white p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-warmgray-500">Date</p>
            <p className="text-sm text-warmgray-900">{row.classDate}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-warmgray-500">Time</p>
            <p className="text-sm text-warmgray-900">{row.classTime || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-warmgray-500">Orphanage</p>
            <p className="text-sm text-warmgray-900">
              {row.orphanageName || row.orphanageId}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-warmgray-500">Teacher</p>
            <p className="text-sm text-warmgray-900">
              {row.teacherName || "Unknown"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-warmgray-500">
              Students Present
            </p>
            <p className="text-sm text-warmgray-900">
              {row.studentCount ?? "—"}
            </p>
          </div>
        </div>
        {row.notes && (
          <div className="pt-4 border-t border-warmgray-100">
            <p className="text-xs font-medium text-warmgray-500 mb-1">Notes</p>
            <p className="text-sm text-warmgray-700 whitespace-pre-wrap">
              {row.notes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
