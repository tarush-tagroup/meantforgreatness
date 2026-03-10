import { getSessionUser } from "@/lib/auth-guard";
import { hasPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { classLogs, classLogAttendance, kids, orphanages, users } from "@/db/schema";
import { eq, desc, asc, and, gte, lte, sql, inArray } from "drizzle-orm";
import Link from "next/link";
import Image from "next/image";
import ClassLogFilters from "./ClassLogFilters";
import { parseTimeRange } from "@/lib/ai-photo-analysis";

export const dynamic = "force-dynamic";

/* ── Verification helpers ──────────────────────────────────────────────── */

function isOrphanageVerified(aiMatch: string | null): boolean | null {
  if (!aiMatch) return null;
  return aiMatch === "high" || aiMatch === "likely";
}

function formatStartTime(classTime: string | null): string | null {
  if (!classTime) return null;
  const normalized = classTime.replace(/\./g, ":");
  const rangeParts = normalized.split(/\s*-\s*/);
  const startStr = rangeParts[0].trim();
  const startAmPm = startStr.match(/\s*(am|pm)\s*$/i);
  const endPart = rangeParts[1]?.trim();
  const endAmPm = endPart?.match(/\s*(am|pm)\s*$/i);
  const suffix = startAmPm?.[1]?.toLowerCase() || endAmPm?.[1]?.toLowerCase() || null;
  const clean = startAmPm ? startStr.replace(/\s*(am|pm)\s*$/i, "").trim() : startStr;
  const match = clean.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (!match) return classTime;
  let hour = parseInt(match[1]);
  const min = match[2] || "00";
  if (suffix) {
    if (hour <= 12) {
      if (suffix === "pm" && hour !== 12) hour += 12;
      if (suffix === "am" && hour === 12) hour = 0;
    }
  }
  const period = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${min} ${period}`;
}

function computeVerificationLevel(log: {
  aiDateMatch: string | null;
  aiTimeMatch: string | null;
  aiGpsDistance: number | null;
  aiKidsCount: number | null;
  studentCount: number | null;
  exifDateTaken: string | null;
  classTime: string | null;
}): { level: "green" | "yellow" | "red"; label: string; reasons: string[] } | null {
  let level: "green" | "yellow" | "red" = "green";
  const reasons: string[] = [];
  let hasAnyMetric = false;
  const escalate = (to: "yellow" | "red", reason: string) => {
    reasons.push(reason);
    if (to === "red") level = "red";
    else if (to === "yellow" && level !== "red") level = "yellow";
  };

  const dateAvailable = log.aiDateMatch != null && log.aiDateMatch !== "no_exif";
  if (dateAvailable) {
    hasAnyMetric = true;
    if (log.aiDateMatch === "mismatch") escalate("red", "Date mismatch");
  }

  if (log.exifDateTaken && log.classTime) {
    const exifDate = new Date(log.exifDateTaken);
    if (!isNaN(exifDate.getTime())) {
      const range = parseTimeRange(log.classTime);
      if (range) {
        hasAnyMetric = true;
        const exifMinutes = exifDate.getHours() * 60 + exifDate.getMinutes();
        const rangeStartMin = range.startHour * 60;
        const rangeEndMin = range.endHour * 60;
        let gapMin = 0;
        if (exifMinutes < rangeStartMin) gapMin = rangeStartMin - exifMinutes;
        else if (exifMinutes > rangeEndMin) gapMin = exifMinutes - rangeEndMin;
        if (gapMin > 240) escalate("red", "Time >4h off");
        else if (gapMin > 120) escalate("yellow", "Time 2–4h off");
      }
    }
  } else if (log.aiTimeMatch != null && log.aiTimeMatch !== "no_exif" && log.aiTimeMatch !== "no_time") {
    hasAnyMetric = true;
    if (log.aiTimeMatch === "mismatch") escalate("yellow", "Time outside class range");
  }

  if (log.aiGpsDistance != null) {
    hasAnyMetric = true;
    if (log.aiGpsDistance > 500) escalate("red", `GPS ${log.aiGpsDistance}m away`);
  }

  if (log.aiKidsCount != null && log.studentCount != null && log.studentCount > 0) {
    hasAnyMetric = true;
    const diff = Math.abs(log.aiKidsCount - log.studentCount);
    const pctDiff = diff / log.studentCount;
    if (diff > 5 || pctDiff > 0.5) escalate("yellow", `Kid count off (${log.studentCount} reported, ${log.aiKidsCount} detected)`);
  }

  if (!hasAnyMetric) return null;
  const labels = { green: "Verified", yellow: "Check", red: "Audit required" };
  return { level, label: labels[level], reasons };
}

const levelStyles = {
  green: "text-green-700 bg-green-50 ring-1 ring-inset ring-green-600/20",
  yellow: "text-amber-700 bg-amber-50 ring-1 ring-inset ring-amber-600/20",
  red: "text-red-700 bg-red-50 ring-1 ring-inset ring-red-600/20",
} as const;

function VerificationPill({ level, label, reasons }: { level: "green" | "yellow" | "red"; label: string; reasons: string[] }) {
  const tooltip = reasons.length > 0 ? reasons.join(" · ") : undefined;
  return (
    <span className="relative group/pill inline-flex">
      <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full cursor-default ${levelStyles[level]}`}>
        {label}
      </span>
      {tooltip && (
        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-max max-w-sm rounded-md bg-sand-800 px-2.5 py-1.5 text-[10px] leading-snug text-white opacity-0 transition-opacity group-hover/pill:opacity-100 z-50 text-left break-words shadow-lg">
          {tooltip}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-sand-800" />
        </span>
      )}
    </span>
  );
}

/* ── Main page ────────────────────────────────────────────────────────── */

export default async function AdminClassesPage({
  searchParams,
}: {
  searchParams: Promise<{
    orphanageId?: string;
    teacherId?: string;
    kidId?: string;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: string;
    verification?: string;
    page?: string;
  }>;
}) {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.roles, "class_logs:view_all")) {
    redirect("/admin");
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1"));
  const limit = 24;
  const offset = (page - 1) * limit;

  // Parse multi-select filters (comma-separated)
  const conditions = [];
  if (params.orphanageId) {
    const ids = params.orphanageId.split(",").filter(Boolean);
    if (ids.length === 1) conditions.push(eq(classLogs.orphanageId, ids[0]));
    else if (ids.length > 1) conditions.push(inArray(classLogs.orphanageId, ids));
  }
  if (params.teacherId) {
    const ids = params.teacherId.split(",").filter(Boolean);
    if (ids.length === 1) conditions.push(eq(classLogs.teacherId, ids[0]));
    else if (ids.length > 1) conditions.push(inArray(classLogs.teacherId, ids));
  }
  if (params.kidId) {
    const ids = params.kidId.split(",").filter(Boolean);
    if (ids.length > 0) {
      conditions.push(
        sql`${classLogs.id} IN (
          SELECT ${classLogAttendance.classLogId}
          FROM ${classLogAttendance}
          WHERE ${classLogAttendance.kidId} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})
        )`
      );
    }
  }
  if (params.dateFrom) conditions.push(gte(classLogs.classDate, params.dateFrom));
  if (params.dateTo) conditions.push(lte(classLogs.classDate, params.dateTo));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Sort
  const sortBy = params.sortBy || "date";
  const orderByClause = sortBy === "students"
    ? [desc(classLogs.studentCount), desc(classLogs.classDate)]
    : [desc(classLogs.classDate), desc(classLogs.createdAt)];

  // Parse verification filter
  const verificationFilter = params.verification
    ? params.verification.split(",").filter(Boolean)
    : [];
  const useJsPagination = verificationFilter.length > 0;

  // Query: fetch all rows when verification filter active, else use SQL pagination
  const selectFields = {
    id: classLogs.id,
    orphanageId: classLogs.orphanageId,
    orphanageName: orphanages.name,
    teacherName: users.name,
    classDate: classLogs.classDate,
    classTime: classLogs.classTime,
    studentCount: classLogs.studentCount,
    notes: classLogs.notes,
    photoUrl: classLogs.photoUrl,
    aiKidsCount: classLogs.aiKidsCount,
    aiOrphanageMatch: classLogs.aiOrphanageMatch,
    aiPrimaryPhotoUrl: classLogs.aiPrimaryPhotoUrl,
    aiAnalyzedAt: classLogs.aiAnalyzedAt,
    aiDateMatch: classLogs.aiDateMatch,
    aiDateNotes: classLogs.aiDateNotes,
    aiTimeMatch: classLogs.aiTimeMatch,
    aiTimeNotes: classLogs.aiTimeNotes,
    aiGpsDistance: classLogs.aiGpsDistance,
    exifDateTaken: classLogs.exifDateTaken,
  };

  const baseQuery = db
    .select(selectFields)
    .from(classLogs)
    .leftJoin(orphanages, eq(classLogs.orphanageId, orphanages.id))
    .leftJoin(users, eq(classLogs.teacherId, users.id))
    .where(whereClause)
    .orderBy(...orderByClause);

  const allMatchingRows = useJsPagination
    ? await baseQuery
    : await baseQuery.limit(limit).offset(offset);

  // Verification level map
  const verificationLevelMap: Record<string, "green" | "yellow" | "red"> = {
    verified: "green",
    check: "yellow",
    audit: "red",
  };

  let rows: typeof allMatchingRows;
  let total: number;

  if (useJsPagination) {
    const filtered = allMatchingRows.filter((log) => {
      const vl = computeVerificationLevel(log);
      if (!vl) return false; // No verification data — exclude when filtering by verification
      return verificationFilter.some((f) => verificationLevelMap[f] === vl.level);
    });
    total = filtered.length;
    rows = filtered.slice(offset, offset + limit);
  } else {
    rows = allMatchingRows;
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(classLogs)
      .where(whereClause);
    total = Number(countResult?.count || 0);
  }

  const totalPages = Math.ceil(total / limit);

  // Counts for header
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10);

  const [recentCountResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(classLogs)
    .where(gte(classLogs.classDate, thirtyDaysAgoStr));
  const recentTotal = Number(recentCountResult?.count || 0);

  // Filter options
  const [orphanageOptions, teacherOptions, kidOptions] = await Promise.all([
    db.select({ id: orphanages.id, name: orphanages.name })
      .from(orphanages).orderBy(asc(orphanages.name)),
    db.select({ id: users.id, name: users.name })
      .from(users)
      .where(sql`${users.status} = 'active' AND ${users.roles} && ARRAY['teacher_manager', 'admin']::text[]`)
      .orderBy(asc(users.name)),
    db.selectDistinct({ id: kids.id, name: kids.name })
      .from(kids)
      .innerJoin(classLogAttendance, eq(classLogAttendance.kidId, kids.id))
      .orderBy(asc(kids.name)),
  ]);

  const canCreate = hasPermission(user.roles, "class_logs:create");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-sand-900">Class Logs</h1>
          <p className="mt-1 text-sm text-sand-500">
            {total} class log{total !== 1 ? "s" : ""} recorded &middot; {recentTotal} in last 30 days
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
        kids={kidOptions}
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((log) => {
            const vLevel = computeVerificationLevel(log);
            const hasAi = !!log.aiAnalyzedAt;
            const hasGps = log.aiGpsDistance != null;

            return (
              <Link
                key={log.id}
                href={`/admin/classes/${log.id}`}
                className="block rounded-xl border border-sand-200 bg-white overflow-hidden transition-shadow hover:shadow-md"
              >
                {/* Photo */}
                {(log.aiPrimaryPhotoUrl || log.photoUrl) ? (
                  <div className="relative h-40 w-full">
                    <Image
                      src={log.aiPrimaryPhotoUrl || log.photoUrl!}
                      alt="Class photo"
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  </div>
                ) : (
                  <div className="h-40 bg-sand-100 flex items-center justify-center">
                    <svg className="w-8 h-8 text-sand-300" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                    </svg>
                  </div>
                )}

                <div className="p-4 space-y-1.5">
                  {/* Date · Time + verification */}
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-sand-900 truncate">
                      {log.classDate}
                      {log.classTime && (
                        <span className="font-normal text-sand-500"> · {formatStartTime(log.classTime)}</span>
                      )}
                    </p>
                    {vLevel && (
                      <VerificationPill level={vLevel.level} label={vLevel.label} reasons={vLevel.reasons} />
                    )}
                  </div>

                  {/* Orphanage with GPS inline */}
                  <p className="text-sm text-sand-500 truncate">
                    {log.orphanageName || "—"}
                    {hasGps && (
                      <span className={`inline-flex items-center ml-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        isOrphanageVerified(log.aiOrphanageMatch)
                          ? "text-green-700 bg-green-50 ring-1 ring-inset ring-green-600/20"
                          : "text-amber-700 bg-amber-50 ring-1 ring-inset ring-amber-600/20"
                      }`}>
                        GPS
                      </span>
                    )}
                  </p>

                  {/* Teacher · student count */}
                  <p className="text-xs text-sand-400 truncate">
                    {log.teacherName || "Unknown"} · {log.studentCount ?? "?"} students
                    {hasAi && log.aiKidsCount != null && (
                      <span className={`ml-1 ${
                        log.studentCount != null && Math.abs(log.aiKidsCount - log.studentCount) <= 3
                          ? "text-green-600" : "text-sage-600"
                      }`}>
                        (AI: {log.aiKidsCount})
                      </span>
                    )}
                  </p>

                  {/* Notes at bottom */}
                  {log.notes && (
                    <p className="text-xs text-sand-400 line-clamp-2">{log.notes}</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
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

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-sand-400">
        <span className="flex items-center gap-1">
          <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full ${levelStyles.green}`}>Verified</span>
          = All checks passed
        </span>
        <span className="flex items-center gap-1">
          <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full ${levelStyles.yellow}`}>Check</span>
          = Minor issue
        </span>
        <span className="flex items-center gap-1">
          <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full ${levelStyles.red}`}>Audit required</span>
          = Needs review
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
  if (params.kidId) searchParams.set("kidId", params.kidId);
  if (params.dateFrom) searchParams.set("dateFrom", params.dateFrom);
  if (params.dateTo) searchParams.set("dateTo", params.dateTo);
  if (params.sortBy) searchParams.set("sortBy", params.sortBy);
  if (params.verification) searchParams.set("verification", params.verification);
  searchParams.set("page", String(page));
  return `/admin/classes?${searchParams.toString()}`;
}
