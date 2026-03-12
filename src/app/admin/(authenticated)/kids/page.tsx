import { getSessionUser } from "@/lib/auth-guard";
import { hasPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { kids, orphanages, classGroups } from "@/db/schema";
import { asc, desc, eq, gte, lte, and, sql, ilike, inArray } from "drizzle-orm";
import Link from "next/link";
import KidsFilters from "./KidsFilters";

export const dynamic = "force-dynamic";

export default async function AdminKidsPage({
  searchParams,
}: {
  searchParams: Promise<{
    orphanageId?: string;
    ageGroup?: string;
    classGroupId?: string;
    sortBy?: string;
    status?: string;
    q?: string;
    view?: string;
  }>;
}) {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.roles, "kids:view")) {
    redirect("/admin");
  }

  const params = await searchParams;
  const canEdit = hasPermission(user.roles, "kids:edit");

  // Build filters (supports comma-separated multi-select)
  const conditions = [];
  if (params.orphanageId) {
    const ids = params.orphanageId.split(",").filter(Boolean);
    if (ids.length === 1) conditions.push(eq(kids.orphanageId, ids[0]));
    else if (ids.length > 1) conditions.push(inArray(kids.orphanageId, ids));
  }
  if (params.classGroupId) {
    const ids = params.classGroupId.split(",").filter(Boolean);
    if (ids.length === 1) conditions.push(eq(kids.classGroupId, ids[0]));
    else if (ids.length > 1) conditions.push(inArray(kids.classGroupId, ids));
  }
  if (params.ageGroup) {
    const ageGroups = params.ageGroup.split(",").filter(Boolean);
    const ageConditions = [];
    for (const ag of ageGroups) {
      if (ag === "5-8") ageConditions.push(and(gte(kids.age, 5), lte(kids.age, 8)));
      else if (ag === "9-12") ageConditions.push(and(gte(kids.age, 9), lte(kids.age, 12)));
      else if (ag === "13+") ageConditions.push(gte(kids.age, 13));
    }
    if (ageConditions.length === 1) conditions.push(ageConditions[0]!);
    else if (ageConditions.length > 1) conditions.push(sql`(${sql.join(ageConditions.map(c => c!), sql` OR `)})`);
  }
  if (params.status) {
    const statuses = params.status.split(",").filter(Boolean);
    if (statuses.length === 1 && (statuses[0] === "active" || statuses[0] === "inactive")) {
      conditions.push(eq(kids.status, statuses[0]));
    } else if (statuses.length > 1) {
      conditions.push(inArray(kids.status, statuses));
    }
  }
  if (params.q) {
    conditions.push(ilike(kids.name, `%${params.q}%`));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // 30 days ago for recent classes count
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10);

  // Determine sort order
  const sortBy = params.sortBy || "";
  const orderByClause = (() => {
    switch (sortBy) {
      case "name":
        return asc(kids.name);
      case "age":
        return asc(kids.age);
      case "total_classes":
        return desc(sql`(SELECT COUNT(*)::int FROM class_log_attendance WHERE class_log_attendance.kid_id = ${kids.id})`);
      default: // "Date Registered" — most recently registered first
        return desc(kids.dateRegistered);
    }
  })();

  // Query with orphanage + class group join + attendance stats
  const rows = await db
    .select({
      id: kids.id,
      name: kids.name,
      age: kids.age,
      hobby: kids.hobby,
      location: kids.location,
      about: kids.about,
      favoriteWord: kids.favoriteWord,
      imageUrl: kids.imageUrl,
      orphanageId: kids.orphanageId,
      orphanageName: orphanages.name,
      classGroupId: kids.classGroupId,
      classGroupName: classGroups.name,
      status: kids.status,
      dateRegistered: kids.dateRegistered,
      totalClasses: sql<number>`COALESCE((
        SELECT COUNT(*)::int FROM class_log_attendance
        WHERE class_log_attendance.kid_id = ${kids.id}
      ), 0)`.as("total_classes"),
      recentClasses: sql<number>`COALESCE((
        SELECT COUNT(*)::int FROM class_log_attendance
        INNER JOIN class_logs ON class_logs.id = class_log_attendance.class_log_id
        WHERE class_log_attendance.kid_id = ${kids.id}
          AND class_logs.class_date >= ${thirtyDaysAgoStr}
      ), 0)`.as("recent_classes"),
    })
    .from(kids)
    .leftJoin(orphanages, eq(kids.orphanageId, orphanages.id))
    .leftJoin(classGroups, eq(kids.classGroupId, classGroups.id))
    .where(whereClause)
    .orderBy(orderByClause);

  // Get totals for the subtitle
  const totalKids = rows.length;
  const activeKids = rows.filter((k) => k.status === "active").length;

  // If filtering by status, we need the unfiltered counts
  let allActiveCount = activeKids;
  let allTotalCount = totalKids;
  if (conditions.length > 0) {
    const [counts] = await db
      .select({
        total: sql<number>`COUNT(*)::int`,
        active: sql<number>`COUNT(*) FILTER (WHERE ${kids.status} = 'active')::int`,
      })
      .from(kids);
    allActiveCount = counts?.active ?? 0;
    allTotalCount = counts?.total ?? 0;
  }

  // Get orphanage options for filter
  const orphanageOptions = await db
    .select({ id: orphanages.id, name: orphanages.name })
    .from(orphanages)
    .orderBy(asc(orphanages.name));

  // Get class group options for filter (grouped by orphanage)
  const classGroupOptions = await db
    .select({
      id: classGroups.id,
      name: classGroups.name,
      orphanageId: classGroups.orphanageId,
      orphanageName: orphanages.name,
    })
    .from(classGroups)
    .leftJoin(orphanages, eq(classGroups.orphanageId, orphanages.id))
    .orderBy(asc(orphanages.name), asc(classGroups.sortOrder));

  // Get all kid names for search autocomplete (unfiltered)
  const allKids = await db
    .select({ id: kids.id, name: kids.name })
    .from(kids)
    .orderBy(asc(kids.name));

  const hasFilters = !!(params.orphanageId || params.ageGroup || params.classGroupId || params.sortBy || params.status || params.q);
  const view = params.view === "list" ? "list" : "grid";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-sand-900">Kids</h1>
          <p className="mt-1 text-sm text-sand-500">
            {hasFilters ? (
              <>
                {rows.length} kid{rows.length !== 1 ? "s" : ""} shown &middot;{" "}
                {allActiveCount} active of {allTotalCount} total
              </>
            ) : (
              <>
                {activeKids} active kid{activeKids !== 1 ? "s" : ""} out of{" "}
                {totalKids} total
              </>
            )}
          </p>
        </div>
        {canEdit && (
          <Link
            href="/admin/kids/new"
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700"
          >
            Add Kid
          </Link>
        )}
      </div>

      {/* Filters */}
      <KidsFilters
        orphanageOptions={orphanageOptions}
        classGroupOptions={classGroupOptions}
        allKids={allKids}
      />

      {rows.length === 0 ? (
        <div className="rounded-lg border border-sand-200 bg-white p-8 text-center">
          <p className="text-sand-500">No kids found.</p>
          {canEdit && !hasFilters && (
            <Link
              href="/admin/kids/new"
              className="mt-3 inline-block text-sm font-medium text-green-600 hover:text-green-700"
            >
              Add your first kid profile
            </Link>
          )}
        </div>
      ) : view === "list" ? (
        /* ── List view ──────────────────────────────────────── */
        <div className="rounded-xl border border-sand-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sand-100 text-left text-xs font-medium text-sand-400">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Age</th>
                <th className="px-4 py-3 hidden sm:table-cell">Orphanage</th>
                <th className="px-4 py-3 hidden md:table-cell">Class</th>
                <th className="px-4 py-3 text-right">Classes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {rows.map((kid) => {
                const href = `/admin/kids/${kid.id}`;
                return (
                  <tr key={kid.id} className={`transition-colors hover:bg-sand-50 ${kid.status === "inactive" ? "opacity-60" : ""}`}>
                    <td className="px-4 py-3">
                      <Link href={href} className="flex items-center gap-2.5">
                        {kid.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={kid.imageUrl} alt="" className="h-7 w-7 rounded-full object-cover shrink-0" />
                        ) : (
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sand-100 text-xs font-medium text-sand-500 shrink-0">
                            {kid.name.charAt(0)}
                          </span>
                        )}
                        <span className="text-sand-900 truncate">{kid.name}</span>
                        {kid.status === "inactive" && (
                          <span className="inline-flex shrink-0 items-center rounded-full bg-sand-100 px-1.5 py-0.5 text-[10px] font-medium text-sand-500">
                            Inactive
                          </span>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={href} className="block text-sand-900">{kid.age}</Link>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <Link href={href} className="block text-sand-900 truncate max-w-[10rem]">{kid.orphanageName || "—"}</Link>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <Link href={href} className="block text-sand-900 truncate max-w-[10rem]">{kid.classGroupName || "—"}</Link>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={href} className="block text-sand-900 whitespace-nowrap">
                        {kid.totalClasses}
                        <span className="text-sand-400 ml-1">({kid.recentClasses} recent)</span>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* ── Grid view ──────────────────────────────────────── */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((kid) => (
            <Link
              key={kid.id}
              href={`/admin/kids/${kid.id}`}
              className={`block rounded-xl border border-sand-200 bg-white overflow-hidden transition-shadow hover:shadow-md ${
                kid.status === "inactive" ? "opacity-60" : ""
              }`}
            >
              {kid.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={kid.imageUrl}
                  alt={kid.name}
                  className="h-40 w-full object-cover object-[50%_25%]"
                />
              ) : (
                <div className="h-40 bg-sand-100 flex items-center justify-center">
                  <span className="text-4xl text-sand-300">
                    {kid.name.charAt(0)}
                  </span>
                </div>
              )}
              <div className="p-4 space-y-1.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-medium text-sand-900 truncate">
                    {kid.name}
                  </h2>
                  {kid.status === "inactive" && (
                    <span className="inline-flex shrink-0 items-center rounded-full bg-sand-100 px-2 py-0.5 text-xs font-medium text-sand-500 ring-1 ring-inset ring-sand-200">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                    Age {kid.age}
                  </span>
                  {kid.orphanageName && (
                    <span className="inline-flex items-center rounded-full bg-sage-50 px-2 py-0.5 text-xs font-medium text-sage-700 ring-1 ring-inset ring-sage-600/20 truncate max-w-[10rem]">
                      {kid.orphanageName}
                    </span>
                  )}
                  {kid.classGroupName && (
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20 truncate max-w-[10rem]">
                      {kid.classGroupName}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-sand-400">
                  <span>{kid.totalClasses} class{kid.totalClasses !== 1 ? "es" : ""} total</span>
                  <span className="text-sand-300">&middot;</span>
                  <span>{kid.recentClasses} in last 30d</span>
                </div>
                {kid.location && (
                  <p className="text-xs text-sand-400 truncate">{kid.location}</p>
                )}
                {kid.hobby && (
                  <p className="text-xs text-sand-400 line-clamp-1">Hobby: {kid.hobby}</p>
                )}
                {kid.about && (
                  <p className="text-xs text-sand-400 line-clamp-1">{kid.about}</p>
                )}
                {kid.favoriteWord && (
                  <p className="text-xs text-sand-400 line-clamp-1">Favorite word: {kid.favoriteWord}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
