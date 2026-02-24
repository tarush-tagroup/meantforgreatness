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
 * Check date verification status from EXIF metadata comparison.
 */
function isDateVerified(aiDateMatch: string | null): boolean | null {
  if (!aiDateMatch || aiDateMatch === "no_exif") return null;
  return aiDateMatch === "match";
}

/**
 * Check time verification status from EXIF metadata comparison.
 */
function isTimeVerified(aiTimeMatch: string | null): boolean | null {
  if (!aiTimeMatch || aiTimeMatch === "no_exif" || aiTimeMatch === "no_time") return null;
  return aiTimeMatch === "match";
}

/**
 * Format a raw class time string into a clean start time.
 * "09.00-10.00 am" → "9:00 AM"
 * "20.00-21.00 pm" → "8:00 PM"
 * "3.00 pm - 6.00 pm" → "3:00 PM"
 * "17.00-18.00" → "5:00 PM"
 * "06:00 PM" → "6:00 PM"
 */
function formatStartTime(classTime: string | null): string | null {
  if (!classTime) return null;
  const normalized = classTime.replace(/\./g, ":");
  const rangeParts = normalized.split(/\s*-\s*/);
  const startStr = rangeParts[0].trim();

  // Check for am/pm on the start or end part
  const startAmPm = startStr.match(/\s*(am|pm)\s*$/i);
  const endPart = rangeParts[1]?.trim();
  const endAmPm = endPart?.match(/\s*(am|pm)\s*$/i);
  const suffix = startAmPm?.[1]?.toLowerCase() || endAmPm?.[1]?.toLowerCase() || null;
  const clean = startAmPm ? startStr.replace(/\s*(am|pm)\s*$/i, "").trim() : startStr;

  const match = clean.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (!match) return classTime; // fallback to raw
  let hour = parseInt(match[1]);
  const min = match[2] || "00";

  if (suffix) {
    if (hour <= 12) {
      if (suffix === "pm" && hour !== 12) hour += 12;
      if (suffix === "am" && hour === 12) hour = 0;
    }
  }

  // Convert to 12h format
  const period = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${min} ${period}`;
}

function VerifiedBadge({ verified, label = "AI", tooltip }: { verified: boolean; label?: string; tooltip?: string }) {
  const checkIcon = <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>;
  const warnIcon = <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>;

  return (
    <span className="relative group/badge inline-flex">
      <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1 py-0.5 rounded cursor-default ${
        verified
          ? "text-green-700 bg-green-50"
          : "text-amber-700 bg-amber-50"
      }`}>
        {verified ? checkIcon : warnIcon}
        {label}
      </span>
      {tooltip && (
        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-max max-w-[220px] rounded-md bg-sand-800 px-2.5 py-1.5 text-[10px] leading-snug text-white opacity-0 transition-opacity group-hover/badge:opacity-100 z-50 text-center shadow-lg">
          {tooltip}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-sand-800" />
        </span>
      )}
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
      aiDateMatch: classLogs.aiDateMatch,
      aiDateNotes: classLogs.aiDateNotes,
      aiTimeMatch: classLogs.aiTimeMatch,
      aiTimeNotes: classLogs.aiTimeNotes,
      aiConfidenceNotes: classLogs.aiConfidenceNotes,
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
      sql`${users.status} = 'active' AND ${users.roles} && ARRAY['teacher_manager', 'admin']::text[]`
    )
    .orderBy(users.name);

  const canCreate = hasPermission(user.roles, "class_logs:create");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-sand-900">Class Logs</h1>
          <p className="mt-1 text-sm text-sand-500">
            {total} class log{total !== 1 ? "s" : ""} recorded
          </p>
        </div>
        {canCreate && (
          <Link
            href="/admin/classes/new"
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
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
        <div className="rounded-lg border border-sand-200 bg-white p-12 text-center">
          <p className="text-sand-500">No class logs found.</p>
          {canCreate && (
            <Link
              href="/admin/classes/new"
              className="mt-3 inline-block text-sm font-medium text-green-600 hover:text-green-700"
            >
              Log your first class &rarr;
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Mobile card layout */}
          <div className="space-y-3 md:hidden">
            {rows.map((log) => {
              const hasAi = !!log.aiAnalyzedAt;
              const dateVerified = isDateVerified(log.aiDateMatch);
              const timeVerified = isTimeVerified(log.aiTimeMatch);
              const hasGps = log.aiConfidenceNotes?.includes("GPS (");

              return (
                <Link
                  key={log.id}
                  href={`/admin/classes/${log.id}`}
                  className="block rounded-lg border border-sand-200 bg-white p-3 hover:bg-sand-50 transition-colors"
                >
                  <div className="flex gap-3">
                    {/* Photo thumbnail */}
                    {(log.aiPrimaryPhotoUrl || log.photoUrl) ? (
                      <div className="relative w-14 h-14 shrink-0 rounded-lg overflow-hidden border border-sand-200">
                        <Image
                          src={log.aiPrimaryPhotoUrl || log.photoUrl!}
                          alt="Class photo"
                          fill
                          className="object-cover"
                          sizes="56px"
                        />
                      </div>
                    ) : (
                      <div className="w-14 h-14 shrink-0 rounded-lg bg-sand-100 flex items-center justify-center">
                        <svg className="w-5 h-5 text-sand-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                        </svg>
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-sand-900">
                          {log.orphanageName || log.orphanageId}
                        </span>
                        <span className="text-xs text-sand-500">
                          {log.classDate}{log.classTime ? ` · ${formatStartTime(log.classTime)}` : ""}
                        </span>
                      </div>
                      <p className="text-xs text-sand-600 mt-0.5">
                        {log.teacherName || "Unknown"} · {log.studentCount ?? "?"} students
                      </p>
                      {/* Verification badges */}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {hasGps && (
                          <VerifiedBadge
                            verified={isOrphanageVerified(log.aiOrphanageMatch) ?? false}
                            label="GPS"
                            tooltip={log.aiConfidenceNotes || undefined}
                          />
                        )}
                        {dateVerified !== null && (
                          <VerifiedBadge verified={dateVerified} label="Date" tooltip={log.aiDateNotes || undefined} />
                        )}
                        {timeVerified !== null && (
                          <VerifiedBadge verified={timeVerified} label="Time" tooltip={log.aiTimeNotes || undefined} />
                        )}
                        {hasAi && log.aiKidsCount != null && (
                          <span
                            className={`inline-flex items-center text-[10px] font-medium px-1 py-0.5 rounded ${
                              log.studentCount != null &&
                              Math.abs(log.aiKidsCount - log.studentCount) <= 3
                                ? "text-green-700 bg-green-50"
                                : "text-sage-700 bg-sage-50"
                            }`}
                          >
                            AI: {log.aiKidsCount} kids
                          </span>
                        )}
                      </div>
                      {log.notes && (
                        <p className="text-xs text-sand-400 mt-1 truncate">{log.notes}</p>
                      )}
                    </div>

                    {/* Chevron */}
                    <svg className="w-4 h-4 text-sand-400 shrink-0 self-center" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Desktop table layout */}
          <div className="hidden md:block rounded-lg border border-sand-200 bg-white overflow-hidden">
            <table className="min-w-full divide-y divide-sand-200">
              <thead className="bg-sand-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-sand-500 uppercase tracking-wider w-14">
                    Photo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-sand-500 uppercase tracking-wider">
                    Date / Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-sand-500 uppercase tracking-wider">
                    Orphanage
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-sand-500 uppercase tracking-wider">
                    Teacher
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-sand-500 uppercase tracking-wider">
                    Students
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-sand-500 uppercase tracking-wider">
                    Notes
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {rows.map((log) => {
                  const hasAi = !!log.aiAnalyzedAt;
                  const dateVerified = isDateVerified(log.aiDateMatch);
                  const timeVerified = isTimeVerified(log.aiTimeMatch);
                  const hasGps = log.aiConfidenceNotes?.includes("GPS (");

                  return (
                    <tr key={log.id} className="hover:bg-sand-50">
                      <td className="px-4 py-3">
                        {(log.aiPrimaryPhotoUrl || log.photoUrl) ? (
                          <div className="relative w-10 h-10 rounded overflow-hidden border border-sand-200">
                            <Image
                              src={log.aiPrimaryPhotoUrl || log.photoUrl!}
                              alt="Class photo"
                              fill
                              className="object-cover"
                              sizes="40px"
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded bg-sand-100 flex items-center justify-center">
                            <svg className="w-4 h-4 text-sand-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                            </svg>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div>
                            <span className="text-sand-900">{log.classDate}</span>
                            {log.classTime && (
                              <span className="block text-xs text-sand-500">{formatStartTime(log.classTime)}</span>
                            )}
                          </div>
                          <div className="flex flex-col gap-0.5">
                            {dateVerified !== null && (
                              <VerifiedBadge verified={dateVerified} label="Date" tooltip={log.aiDateNotes || undefined} />
                            )}
                            {timeVerified !== null && (
                              <VerifiedBadge verified={timeVerified} label="Time" tooltip={log.aiTimeNotes || undefined} />
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-sand-700">
                        <span>{log.orphanageName || log.orphanageId}</span>
                        {hasGps && (
                          <span className="ml-1.5">
                            <VerifiedBadge
                              verified={isOrphanageVerified(log.aiOrphanageMatch) ?? false}
                              label="GPS"
                              tooltip={log.aiConfidenceNotes || undefined}
                            />
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-sand-700">
                        {log.teacherName || "Unknown"}
                      </td>
                      <td className="px-4 py-3 text-sm text-sand-700 whitespace-nowrap">
                        {log.studentCount ?? "\u2014"}
                        {hasAi && log.aiKidsCount != null && (
                          <span
                            className={`ml-1 text-xs ${
                              log.studentCount != null &&
                              Math.abs(log.aiKidsCount - log.studentCount) <= 3
                                ? "text-green-600"
                                : "text-sage-600"
                            }`}
                            title={`AI detected ${log.aiKidsCount} student${log.aiKidsCount !== 1 ? "s" : ""} in photos`}
                          >
                            ({log.aiKidsCount})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-sand-500 max-w-xs truncate">
                        {log.notes || "\u2014"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/classes/${log.id}`}
                          className="text-sm font-medium text-green-600 hover:text-green-700"
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
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-sand-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={buildFilterUrl(params, page - 1)}
                className="rounded-lg border border-sand-200 px-3 py-1.5 text-sm text-sand-600 hover:bg-sand-50"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildFilterUrl(params, page + 1)}
                className="rounded-lg border border-sand-200 px-3 py-1.5 text-sm text-sand-600 hover:bg-sand-50"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Legend for AI badges */}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-sand-400">
        <span className="flex items-center gap-1">
          <VerifiedBadge verified={true} label="GPS" />
          <span>= GPS location verified</span>
        </span>
        <span className="flex items-center gap-1">
          <VerifiedBadge verified={true} label="Date" />
          <span>= Photo date matches</span>
        </span>
        <span className="flex items-center gap-1">
          <VerifiedBadge verified={true} label="Time" />
          <span>= Photo time matches</span>
        </span>
        <span className="flex items-center gap-1">
          <VerifiedBadge verified={false} label="" />
          <span>= Could not verify</span>
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
