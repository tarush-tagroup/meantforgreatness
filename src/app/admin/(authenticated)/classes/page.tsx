import { getSessionUser } from "@/lib/auth-guard";
import { hasPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { classLogs, orphanages, users } from "@/db/schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import Link from "next/link";
import ClassLogFilters from "./ClassLogFilters";

export const dynamic = "force-dynamic";

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
              {rows.map((log) => (
                <tr key={log.id} className="hover:bg-warmgray-50">
                  <td className="px-4 py-3 text-sm text-warmgray-900 whitespace-nowrap">
                    {log.classDate}
                  </td>
                  <td className="px-4 py-3 text-sm text-warmgray-700">
                    {log.orphanageName || log.orphanageId}
                  </td>
                  <td className="px-4 py-3 text-sm text-warmgray-700">
                    {log.teacherName || "Unknown"}
                  </td>
                  <td className="px-4 py-3 text-sm text-warmgray-700">
                    {log.studentCount ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-warmgray-500">
                    {log.classTime || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-warmgray-500 max-w-xs truncate">
                    {log.notes || "—"}
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
              ))}
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
