import { getSessionUser } from "@/lib/auth-guard";
import { hasPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { classLogs, orphanages, users } from "@/db/schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import Link from "next/link";
import Image from "next/image";
import ClassLogFilters from "./ClassLogFilters";

export const dynamic = "force-dynamic";

/**
 * Check if AI orphanage match indicates "verified".
 * "high" or "likely" = verified; "uncertain"/"unlikely" = not verified.
 */
function isOrphanageVerified(aiMatch: string | null): boolean | null {
  if (!aiMatch) return null; // no AI data
  return aiMatch === "high" || aiMatch === "likely";
}

/**
 * Check if AI photo timestamp is within 2 hours of the logged class time.
 * Returns null if no AI timestamp data available.
 */
function isTimeVerified(
  classTime: string | null,
  aiPhotoTimestamp: string | null
): boolean | null {
  if (!aiPhotoTimestamp || !classTime) return null;

  // Try to parse both times. AI timestamps are free-text like "10:30 AM", "around midday", etc.
  // We extract hours from both and compare within a 2-hour window.
  const classHour = parseHour(classTime);
  const aiHour = parseHour(aiPhotoTimestamp);

  if (classHour === null || aiHour === null) return null;

  return Math.abs(classHour - aiHour) <= 2;
}

/**
 * Extract approximate hour (0-23) from a time string.
 * Handles: "10:00 AM", "2:30 PM", "14:00", "around 10am", etc.
 */
function parseHour(time: string): number | null {
  // Try HH:MM AM/PM format
  const amPm = time.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (amPm) {
    let hour = parseInt(amPm[1]);
    const isPm = amPm[3].toLowerCase() === "pm";
    if (isPm && hour !== 12) hour += 12;
    if (!isPm && hour === 12) hour = 0;
    return hour;
  }

  // Try 24-hour format
  const h24 = time.match(/(\d{1,2}):(\d{2})/);
  if (h24) {
    return parseInt(h24[1]);
  }

  // Try just a number
  const justNum = time.match(/\b(\d{1,2})\b/);
  if (justNum) {
    const n = parseInt(justNum[1]);
    if (n >= 0 && n <= 23) return n;
  }

  return null;
}

function VerifiedBadge({ verified }: { verified: boolean }) {
  if (verified) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-green-700 bg-green-50 px-1 py-0.5 rounded" title="Verified by AI photo analysis">
        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>
        AI
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-700 bg-amber-50 px-1 py-0.5 rounded" title="Could not be verified by AI photo analysis">
      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
      AI
    </span>
  );
}

export default async function AdminClassesPage({
  searchParams,
}: {
  searchParams: Promise<{
    orphanageId?: string;
    teacherId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: string;
  }>;
}) {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.roles, "class_logs:view_all")) {
    redirect("/admin");
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1"));
  const limit = 25;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (params.orphanageId) conditions.push(eq(classLogs.orphanageId, params.orphanageId));
  if (params.teacherId) conditions.push(eq(classLogs.teacherId, params.teacherId));
  if (params.dateFrom) conditions.push(gte(classLogs.classDate, params.dateFrom));
  if (params.dateTo) conditions.push(lte(classLogs.classDate, params.dateTo));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: classLogs.id,
      orphanageId: classLogs.orphanageId,
      orphanageName: orphanages.name,
      teacherId: classLogs.teacherId,
      teacherName: users.name,
      classDate: classLogs.classDate,
      classTime: classLogs.classTime,
      studentCount: classLogs.studentCount,
      notes: classLogs.notes,
      photoUrl: classLogs.photoUrl,
      aiKidsCount: classLogs.aiKidsCount,
      aiOrphanageMatch: classLogs.aiOrphanageMatch,
      aiPhotoTimestamp: classLogs.aiPhotoTimestamp,
      aiPrimaryPhotoUrl: classLogs.aiPrimaryPhotoUrl,
      aiAnalyzedAt: classLogs.aiAnalyzedAt,
      createdAt: classLogs.createdAt,
    })
    .from(classLogs)
    .leftJoin(orphanages, eq(classLogs.orphanageId, orphanages.id))
    .leftJoin(users, eq(classLogs.teacherId, users.id))
    .where(whereClause)
    .orderBy(desc(classLogs.classDate), desc(classLogs.createdAt))
    .limit(limit)
    .offset(offset);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(classLogs)
    .where(whereClause);

  const total = Number(countResult?.count || 0);
  const totalPages = Math.ceil(total / limit);

  // Get filter options
  const orphanageOptions = await db
    .select({ id: orphanages.id, name: orphanages.name })
    .from(orphanages)
    .orderBy(orphanages.name);

  const teacherOptions = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(
      sql`${users.status} = 'active' AND ${users.roles} && ARRAY['teacher', 'teacher_manager', 'admin']::text[]`
    )
    .orderBy(users.name);

  const canCreate = hasPermission(user.roles, "class_logs:create");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-warmgray-900">Class Logs</h1>
          <p className="mt-1 text-sm text-warmgray-500">
            {total} class log{total !== 1 ? "s" : ""} recorded
          </p>
        </div>
        {canCreate && (
          <Link
            href="/admin/classes/new"
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors"
          >
            Log a Class
          </Link>
        )}
      </div>

      <ClassLogFilters
        orphanages={orphanageOptions}
        teachers={teacherOptions}
        currentFilters={params}
      />

      {rows.length === 0 ? (
        <div className="rounded-lg border border-warmgray-200 bg-white p-12 text-center">
          <p className="text-warmgray-500">No class logs found.</p>
          {canCreate && (
            <Link
              href="/admin/classes/new"
              className="mt-3 inline-block text-sm font-medium text-teal-600 hover:text-teal-700"
            >
              Log your first class &rarr;
            </Link>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-warmgray-200 bg-white overflow-hidden">
          <table className="min-w-full divide-y divide-warmgray-200">
            <thead className="bg-warmgray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-warmgray-500 uppercase tracking-wider w-14">
                  Photo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-warmgray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-warmgray-500 uppercase tracking-wider">
                  Orphanage
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-warmgray-500 uppercase tracking-wider">
                  Teacher
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-warmgray-500 uppercase tracking-wider">
                  Students
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-warmgray-500 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-warmgray-500 uppercase tracking-wider">
                  Notes
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warmgray-100">
              {rows.map((log) => {
                const hasAi = !!log.aiAnalyzedAt;
                const orphanageVerified = isOrphanageVerified(log.aiOrphanageMatch);
                const timeVerified = isTimeVerified(log.classTime, log.aiPhotoTimestamp);

                return (
                  <tr key={log.id} className="hover:bg-warmgray-50">
                    <td className="px-4 py-3">
                      {(log.aiPrimaryPhotoUrl || log.photoUrl) ? (
                        <div className="relative w-10 h-10 rounded overflow-hidden border border-warmgray-200">
                          <Image
                            src={log.aiPrimaryPhotoUrl || log.photoUrl!}
                            alt="Class photo"
                            fill
                            className="object-cover"
                            sizes="40px"
                          />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded bg-warmgray-100 flex items-center justify-center">
                          <svg className="w-4 h-4 text-warmgray-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                          </svg>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-warmgray-900 whitespace-nowrap">
                      <span>{log.classDate}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-warmgray-700">
                      <span>{log.orphanageName || log.orphanageId}</span>
                      {orphanageVerified !== null && (
                        <span className="ml-1.5">
                          <VerifiedBadge verified={orphanageVerified} />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-warmgray-700">
                      {log.teacherName || "Unknown"}
                    </td>
                    <td className="px-4 py-3 text-sm text-warmgray-700 whitespace-nowrap">
                      {log.studentCount ?? "\u2014"}
                      {hasAi && log.aiKidsCount != null && (
                        <span
                          className={`ml-1 text-xs ${
                            log.studentCount != null &&
                            Math.abs(log.aiKidsCount - log.studentCount) <= 3
                              ? "text-green-600"
                              : "text-amber-600"
                          }`}
                          title={`AI detected ${log.aiKidsCount} student${log.aiKidsCount !== 1 ? "s" : ""} in photos`}
                        >
                          ({log.aiKidsCount})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-warmgray-500 whitespace-nowrap">
                      <span>{log.classTime || "\u2014"}</span>
                      {timeVerified !== null && (
                        <span className="ml-1.5">
                          <VerifiedBadge verified={timeVerified} />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-warmgray-500 max-w-xs truncate">
                      {log.notes || "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/classes/${log.id}`}
                        className="text-sm font-medium text-teal-600 hover:text-teal-700"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-warmgray-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={buildFilterUrl(params, page - 1)}
                className="rounded-lg border border-warmgray-200 px-3 py-1.5 text-sm text-warmgray-600 hover:bg-warmgray-50"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildFilterUrl(params, page + 1)}
                className="rounded-lg border border-warmgray-200 px-3 py-1.5 text-sm text-warmgray-600 hover:bg-warmgray-50"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Legend for AI badges */}
      <div className="mt-3 flex items-center gap-4 text-xs text-warmgray-400">
        <span className="flex items-center gap-1">
          <VerifiedBadge verified={true} />
          <span>= AI verified from photos</span>
        </span>
        <span className="flex items-center gap-1">
          <VerifiedBadge verified={false} />
          <span>= AI could not verify</span>
        </span>
      </div>
    </div>
  );
}

function buildFilterUrl(
  params: Record<string, string | undefined>,
  page: number
) {
  const searchParams = new URLSearchParams();
  if (params.orphanageId) searchParams.set("orphanageId", params.orphanageId);
  if (params.teacherId) searchParams.set("teacherId", params.teacherId);
  if (params.dateFrom) searchParams.set("dateFrom", params.dateFrom);
  if (params.dateTo) searchParams.set("dateTo", params.dateTo);
  searchParams.set("page", String(page));
  return `/admin/classes?${searchParams.toString()}`;
}
