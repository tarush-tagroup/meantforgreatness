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

function matchBadgeColor(match: string | null) {
  switch (match) {
    case "high":
      return "bg-green-100 text-green-800";
    case "likely":
      return "bg-green-100 text-green-800";
    case "uncertain":
      return "bg-sage-100 text-sage-800";
    case "unlikely":
      return "bg-red-100 text-red-800";
    default:
      return "bg-sand-100 text-sand-600";
  }
}

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
      classDate: classLogs.classDate,
      classTime: classLogs.classTime,
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
        <div className="mt-6 max-w-2xl space-y-4">
          <div className="rounded-lg border border-sand-200 bg-white p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-sand-500">Date</p>
                <p className="text-sm text-sand-900">{row.classDate}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-sand-500">Time</p>
                <p className="text-sm text-sand-900">{row.classTime || "\u2014"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-sand-500">Orphanage</p>
                <p className="text-sm text-sand-900">
                  {row.orphanageName || row.orphanageId}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-sand-500">Teacher</p>
                <p className="text-sm text-sand-900">
                  {row.teacherName || "Unknown"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-sand-500">
                  Students Present
                </p>
                <p className="text-sm text-sand-900">
                  {row.studentCount ?? "\u2014"}
                </p>
              </div>
            </div>

            {/* Attendance breakdown */}
            {attendanceRecords.length > 0 && (
              <div className="pt-4 border-t border-sand-100">
                <p className="text-xs font-medium text-sand-500 mb-2">
                  Attendance ({attendanceRecords.length})
                </p>
                <div className="space-y-1">
                  {attendanceRecords.filter(a => a.attendanceType === "class_member").length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-green-700 mb-0.5">Class Members</p>
                      <div className="text-sm text-sand-700 space-y-0.5">
                        {attendanceRecords.filter(a => a.attendanceType === "class_member").map((a, i) => (
                          <p key={i}>
                            {a.kidName}
                            {a.note && <span className="text-xs text-sand-500 ml-1.5">&mdash; {a.note}</span>}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                  {attendanceRecords.filter(a => a.attendanceType === "orphanage_guest").length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-blue-700 mb-0.5">Other Orphanage Kids</p>
                      <div className="text-sm text-sand-700 space-y-0.5">
                        {attendanceRecords.filter(a => a.attendanceType === "orphanage_guest").map((a, i) => (
                          <p key={i}>
                            {a.kidName}
                            {a.note && <span className="text-xs text-sand-500 ml-1.5">&mdash; {a.note}</span>}
                          </p>
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
                <p className="text-xs font-medium text-sand-500 mb-2">
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
                <p className="text-xs font-medium text-sand-500 mb-1">Notes</p>
                <p className="text-sm text-sand-700 whitespace-pre-wrap">
                  {row.notes}
                </p>
              </div>
            )}
          </div>

          {/* AI Photo Analysis Metadata (read-only) */}
          {aiMetadata.aiAnalyzedAt && (
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-5">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
                <h3 className="text-sm font-semibold text-purple-900">AI Photo Analysis</h3>
                <span className="text-xs text-purple-500 ml-auto">
                  Analyzed {new Date(aiMetadata.aiAnalyzedAt!).toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-purple-600 mb-3">
                Automatically generated from uploaded photos. Cannot be edited manually.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-lg p-3 border border-purple-100">
                  <p className="text-xs font-medium text-purple-600">Students Detected by AI</p>
                  <p className="text-lg font-bold text-purple-900">
                    {aiMetadata.aiKidsCount ?? "N/A"}
                  </p>
                </div>

                <div className="bg-white rounded-lg p-3 border border-purple-100">
                  <p className="text-xs font-medium text-purple-600">Orphanage Match</p>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${matchBadgeColor(aiMetadata.aiOrphanageMatch)}`}>
                    {aiMetadata.aiOrphanageMatch || "N/A"}
                  </span>
                </div>

                {aiMetadata.aiLocation && (
                  <div className="bg-white rounded-lg p-3 border border-purple-100 col-span-2">
                    <p className="text-xs font-medium text-purple-600">Location Cues</p>
                    <p className="text-sm text-purple-900 mt-0.5">{aiMetadata.aiLocation}</p>
                  </div>
                )}

                {aiMetadata.aiPhotoTimestamp && (
                  <div className="bg-white rounded-lg p-3 border border-purple-100 col-span-2">
                    <p className="text-xs font-medium text-purple-600">Photo Timestamp Cues</p>
                    <p className="text-sm text-purple-900 mt-0.5">{aiMetadata.aiPhotoTimestamp}</p>
                  </div>
                )}

                {aiMetadata.aiConfidenceNotes && (
                  <div className="bg-white rounded-lg p-3 border border-purple-100 col-span-2">
                    <p className="text-xs font-medium text-purple-600">AI Confidence Notes</p>
                    <p className="text-xs text-purple-700 mt-0.5">{aiMetadata.aiConfidenceNotes}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
