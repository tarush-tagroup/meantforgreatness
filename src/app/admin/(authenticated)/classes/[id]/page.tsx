import { getSessionUser } from "@/lib/auth-guard";
import { hasPermission } from "@/lib/permissions";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import {
  classLogs,
  classLogPhotos,
  classLogAttendance,
  classGroups,
  kids,
  orphanages,
  users,
} from "@/db/schema";
import { eq, asc, sql } from "drizzle-orm";
import ClassLogForm from "../ClassLogForm";
import DeleteClassLogButton from "./DeleteClassLogButton";
import Link from "next/link";
import Image from "next/image";

export const dynamic = "force-dynamic";

export default async function ClassLogDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.roles, "class_logs:view_all")) {
    redirect("/admin");
  }

  const { id } = await params;
  const sp = await searchParams;

  const [row] = await db
    .select({
      id: classLogs.id,
      orphanageId: classLogs.orphanageId,
      orphanageName: orphanages.name,
      teacherId: classLogs.teacherId,
      teacherName: users.name,
      classGroupId: classLogs.classGroupId,
      classGroupName: classGroups.name,
      classDate: classLogs.classDate,
      classTime: classLogs.classTime,
      classDuration: classLogs.classDuration,
      studentCount: classLogs.studentCount,
      photoUrl: classLogs.photoUrl,
      notes: classLogs.notes,
      aiKidsCount: classLogs.aiKidsCount,
      aiLocation: classLogs.aiLocation,
      aiPhotoTimestamp: classLogs.aiPhotoTimestamp,
      aiOrphanageMatch: classLogs.aiOrphanageMatch,
      aiConfidenceNotes: classLogs.aiConfidenceNotes,
      aiPrimaryPhotoUrl: classLogs.aiPrimaryPhotoUrl,
      aiAnalyzedAt: classLogs.aiAnalyzedAt,
      aiDateMatch: classLogs.aiDateMatch,
      aiTimeMatch: classLogs.aiTimeMatch,
      aiGpsDistance: classLogs.aiGpsDistance,
      exifDateTaken: classLogs.exifDateTaken,
      createdAt: classLogs.createdAt,
    })
    .from(classLogs)
    .leftJoin(orphanages, eq(classLogs.orphanageId, orphanages.id))
    .leftJoin(users, eq(classLogs.teacherId, users.id))
    .leftJoin(classGroups, eq(classLogs.classGroupId, classGroups.id))
    .where(eq(classLogs.id, id))
    .limit(1);

  if (!row) {
    notFound();
  }

  // Fetch photos for this class log
  const photos = await db
    .select({
      id: classLogPhotos.id,
      url: classLogPhotos.url,
      caption: classLogPhotos.caption,
      sortOrder: classLogPhotos.sortOrder,
    })
    .from(classLogPhotos)
    .where(eq(classLogPhotos.classLogId, id))
    .orderBy(asc(classLogPhotos.sortOrder));

  // Determine edit/delete permissions
  const isOwner = row.teacherId === user.id;
  const canEditOwn = hasPermission(user.roles, "class_logs:edit_own");
  const canEditAll = hasPermission(user.roles, "class_logs:edit_all");
  const canEdit = (isOwner && canEditOwn) || canEditAll;
  const isEditing = canEdit && sp.edit === "true";

  const canDeleteOwn = hasPermission(user.roles, "class_logs:delete_own");
  const canDeleteAll = hasPermission(user.roles, "class_logs:delete_all");
  const canDelete = (isOwner && canDeleteOwn) || canDeleteAll;

  // Prepare AI metadata for both views
  // Always pass the object so the form can show "pending" state when aiAnalyzedAt is null
  const aiMetadata = {
    aiKidsCount: row.aiKidsCount,
    aiLocation: row.aiLocation,
    aiPhotoTimestamp: row.aiPhotoTimestamp,
    aiOrphanageMatch: row.aiOrphanageMatch,
    aiConfidenceNotes: row.aiConfidenceNotes,
    aiPrimaryPhotoUrl: row.aiPrimaryPhotoUrl,
    aiAnalyzedAt: row.aiAnalyzedAt?.toISOString() || null,
    aiDateMatch: row.aiDateMatch,
    aiTimeMatch: row.aiTimeMatch,
    aiGpsDistance: row.aiGpsDistance,
  };

  // Fetch attendance records for this class log
  const attendanceRecords = await db
    .select({
      kidId: classLogAttendance.kidId,
      kidName: classLogAttendance.kidName,
      attendanceType: classLogAttendance.attendanceType,
      note: classLogAttendance.note,
    })
    .from(classLogAttendance)
    .where(eq(classLogAttendance.classLogId, id));

  // If editing, fetch form options
  let orphanageOptions: { id: string; name: string }[] = [];
  let teacherOptions: { id: string; name: string | null; email: string }[] = [];
  let classGroupOptions: { id: string; name: string; orphanageId: string }[] = [];
  let kidsList: { id: string; name: string; orphanageId: string | null; classGroupId: string | null }[] = [];

  if (isEditing) {
    [orphanageOptions, teacherOptions, classGroupOptions, kidsList] = await Promise.all([
      db.select({ id: orphanages.id, name: orphanages.name }).from(orphanages).orderBy(asc(orphanages.name)),
      db.select({ id: users.id, name: users.name, email: users.email }).from(users)
        .where(sql`${users.status} = 'active' AND ${users.roles} && ARRAY['teacher_manager', 'admin']::text[]`)
        .orderBy(asc(users.name)),
      db.select({ id: classGroups.id, name: classGroups.name, orphanageId: classGroups.orphanageId })
        .from(classGroups).orderBy(asc(classGroups.sortOrder)),
      db.select({ id: kids.id, name: kids.name, orphanageId: kids.orphanageId, classGroupId: kids.classGroupId })
        .from(kids).orderBy(asc(kids.name)),
    ]);
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-sand-500 mb-4">
        <Link href="/admin/classes" className="hover:text-sand-700 transition-colors">
          Classes
        </Link>
        <span>/</span>
        <span className="text-sand-900">
          {row.classDate} at {row.orphanageName || "Unknown"}
        </span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-sand-900">
            {isEditing ? "Edit Class Log" : "Class Log Details"}
          </h1>
          <p className="mt-1 text-sm text-sand-500">
            {row.classGroupName && <>{row.classGroupName} · </>}
            {row.classDate} at {row.orphanageName || row.orphanageId}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canEdit && !isEditing && (
            <Link
              href={`/admin/classes/${row.id}?edit=true`}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700"
            >
              Edit
            </Link>
          )}
          {canEdit && isEditing && (
            <Link
              href={`/admin/classes/${row.id}`}
              className="rounded-lg border border-sand-300 px-4 py-2 text-sm font-medium text-sand-700 shadow-sm transition-colors hover:bg-sand-50"
            >
              Cancel
            </Link>
          )}
          {canDelete && isEditing && <DeleteClassLogButton classLogId={row.id} />}
        </div>
      </div>

      {/* Edit mode */}
      {isEditing ? (
        <div className="mt-6 max-w-2xl">
          <ClassLogForm
            orphanages={orphanageOptions}
            teachers={teacherOptions}
            currentUserId={user.id}
            userRole={user.roles.includes("admin") ? "admin" : "teacher_manager"}
            classGroups={classGroupOptions}
            allKids={kidsList}
            aiMetadata={aiMetadata}
            initialData={{
              id: row.id,
              orphanageId: row.orphanageId,
              teacherId: row.teacherId,
              classGroupId: row.classGroupId,
              classDate: row.classDate,
              classTime: row.classTime,
              classDuration: row.classDuration,
              studentCount: row.studentCount,
              notes: row.notes,
              photos: photos.map((p) => ({ url: p.url, caption: p.caption })),
              attendance: attendanceRecords.map((a) => ({
                kidId: a.kidId,
                kidName: a.kidName,
                type: a.attendanceType as "class_member" | "orphanage_guest" | "external",
                note: a.note || undefined,
              })),
            }}
          />
        </div>
      ) : (
        /* View mode */
        <div className="mt-6 max-w-2xl">
          <div className="rounded-xl border border-sand-200 bg-white p-5 sm:p-6 space-y-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {/* Date with EXIF verification */}
              <div>
                <p className="text-xs font-medium text-sand-400">Date</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="text-sm text-sand-900">{row.classDate}</p>
                  {row.aiDateMatch && row.aiDateMatch !== "no_exif" && (
                    <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                      row.aiDateMatch === "match"
                        ? "text-green-700 bg-green-50 ring-1 ring-inset ring-green-600/20"
                        : "text-red-700 bg-red-50 ring-1 ring-inset ring-red-600/20"
                    }`}>
                      {row.aiDateMatch === "match" ? "EXIF \u2713" : "EXIF \u2717"}
                    </span>
                  )}
                </div>
              </div>

              {/* Time with EXIF verification */}
              <div>
                <p className="text-xs font-medium text-sand-400">Time</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="text-sm text-sand-900">{row.classTime || "\u2014"}</p>
                  {row.aiTimeMatch && row.aiTimeMatch !== "no_exif" && row.aiTimeMatch !== "no_time" && (
                    <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                      row.aiTimeMatch === "match"
                        ? "text-green-700 bg-green-50 ring-1 ring-inset ring-green-600/20"
                        : "text-amber-700 bg-amber-50 ring-1 ring-inset ring-amber-600/20"
                    }`}>
                      {row.aiTimeMatch === "match" ? "EXIF \u2713" : "EXIF \u2717"}
                    </span>
                  )}
                </div>
              </div>

              {/* Class name */}
              <div>
                <p className="text-xs font-medium text-sand-400">Class</p>
                <p className="text-sm text-sand-900 mt-0.5">
                  {row.classGroupName || "—"}
                </p>
              </div>

              {/* Duration */}
              <div>
                <p className="text-xs font-medium text-sand-400">Duration</p>
                <p className="text-sm text-sand-900 mt-0.5">
                  {row.classDuration ?? 1} {(row.classDuration ?? 1) === 1 ? "hour" : "hours"}
                </p>
              </div>

              {/* Orphanage with GPS distance */}
              <div>
                <p className="text-xs font-medium text-sand-400">Orphanage</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="text-sm text-sand-900 truncate">
                    {row.orphanageName || row.orphanageId}
                  </p>
                  {row.aiGpsDistance != null && (
                    <span className={`inline-flex shrink-0 items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                      row.aiGpsDistance <= 500
                        ? "text-green-700 bg-green-50 ring-1 ring-inset ring-green-600/20"
                        : "text-red-700 bg-red-50 ring-1 ring-inset ring-red-600/20"
                    }`}>
                      GPS: {row.aiGpsDistance < 1000
                        ? `${Math.round(row.aiGpsDistance)}m`
                        : `${(row.aiGpsDistance / 1000).toFixed(1)}km`}
                    </span>
                  )}
                </div>
              </div>

              {/* Teacher */}
              <div>
                <p className="text-xs font-medium text-sand-400">Teacher</p>
                <p className="text-sm text-sand-900 mt-0.5">
                  {row.teacherName || "Unknown"}
                </p>
              </div>

              {/* Students with AI count */}
              <div>
                <p className="text-xs font-medium text-sand-400">Students Present</p>
                <p className="text-sm text-sand-900 mt-0.5">
                  {row.studentCount ?? "\u2014"}
                </p>
                {row.aiKidsCount != null && (
                  <p className="text-xs text-sand-400 mt-0.5">
                    AI detected: {row.aiKidsCount}
                    {row.studentCount != null && Math.abs(row.aiKidsCount - row.studentCount) > 3 && (
                      <span className="text-amber-600 ml-1">
                        ({row.aiKidsCount > row.studentCount ? "+" : ""}{row.aiKidsCount - row.studentCount})
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>

            {/* Analysis timestamp */}
            {row.aiAnalyzedAt && (
              <p className="text-xs text-sand-400 pt-3 border-t border-sand-100">
                Photo analyzed {row.aiAnalyzedAt.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            )}

            {/* Attendance breakdown */}
            {attendanceRecords.length > 0 && (
              <div className="pt-4 border-t border-sand-100">
                <p className="text-xs font-medium text-sand-400 mb-2">
                  Attendance ({attendanceRecords.length})
                </p>
                <div className="space-y-2">
                  {attendanceRecords.filter(a => a.attendanceType === "class_member").length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-green-700 mb-0.5">Class Members</p>
                      <div className="text-sm space-y-0.5">
                        {attendanceRecords.filter(a => a.attendanceType === "class_member").map((a, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            {a.kidId ? (
                              <Link href={`/admin/kids/${a.kidId}`} className="text-sand-900 hover:text-green-700 transition-colors">
                                {a.kidName}
                              </Link>
                            ) : (
                              <span className="text-sand-700">{a.kidName}</span>
                            )}
                            {a.note && <span className="text-xs text-sand-500">&mdash; {a.note}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {attendanceRecords.filter(a => a.attendanceType === "orphanage_guest").length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-blue-700 mb-0.5">Other Orphanage Kids</p>
                      <div className="text-sm space-y-0.5">
                        {attendanceRecords.filter(a => a.attendanceType === "orphanage_guest").map((a, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            {a.kidId ? (
                              <Link href={`/admin/kids/${a.kidId}`} className="text-sand-900 hover:text-green-700 transition-colors">
                                {a.kidName}
                              </Link>
                            ) : (
                              <span className="text-sand-700">{a.kidName}</span>
                            )}
                            {a.note && <span className="text-xs text-sand-500">&mdash; {a.note}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {attendanceRecords.filter(a => a.attendanceType === "external").length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-sage-700 mb-0.5">External Kids</p>
                      <p className="text-sm text-sand-700">
                        {attendanceRecords.filter(a => a.attendanceType === "external").map(a => a.kidName).join(", ")}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Photos */}
            {photos.length > 0 && (
              <div className="pt-4 border-t border-sand-100">
                <p className="text-xs font-medium text-sand-400 mb-2">
                  Photos ({photos.length})
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {photos.map((photo) => (
                    <div key={photo.id} className="relative aspect-video rounded-lg overflow-hidden border border-sand-200">
                      <Image
                        src={photo.url}
                        alt={photo.caption || "Class photo"}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, 33vw"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {row.notes && (
              <div className="pt-4 border-t border-sand-100">
                <p className="text-xs font-medium text-sand-400 mb-1">Notes</p>
                <p className="text-sm text-sand-700 whitespace-pre-wrap">
                  {row.notes}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
