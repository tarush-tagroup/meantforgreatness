import { getSessionUser } from "@/lib/auth-guard";
import { hasPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { kids, orphanages, classGroups } from "@/db/schema";
import { asc, eq, gte, lte, and } from "drizzle-orm";
import Link from "next/link";
import KidsFilters from "./KidsFilters";

export const dynamic = "force-dynamic";

export default async function AdminKidsPage({
  searchParams,
}: {
  searchParams: Promise<{ orphanageId?: string; ageGroup?: string; classGroupId?: string }>;
}) {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.roles, "kids:view")) {
    redirect("/admin");
  }

  const params = await searchParams;
  const canEdit = hasPermission(user.roles, "kids:edit");

  // Build filters
  const conditions = [];
  if (params.orphanageId) {
    conditions.push(eq(kids.orphanageId, params.orphanageId));
  }
  if (params.classGroupId) {
    conditions.push(eq(kids.classGroupId, params.classGroupId));
  }
  if (params.ageGroup === "5-8") {
    conditions.push(gte(kids.age, 5));
    conditions.push(lte(kids.age, 8));
  } else if (params.ageGroup === "9-12") {
    conditions.push(gte(kids.age, 9));
    conditions.push(lte(kids.age, 12));
  } else if (params.ageGroup === "13+") {
    conditions.push(gte(kids.age, 13));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Query with orphanage + class group join
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
    })
    .from(kids)
    .leftJoin(orphanages, eq(kids.orphanageId, orphanages.id))
    .leftJoin(classGroups, eq(kids.classGroupId, classGroups.id))
    .where(whereClause)
    .orderBy(asc(kids.name));

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

  const hasFilters = !!(params.orphanageId || params.ageGroup || params.classGroupId);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-sand-900">Kids</h1>
          <p className="mt-1 text-sm text-sand-500">
            {rows.length} kid{rows.length !== 1 ? "s" : ""} in the program
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
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((kid) => (
            <div
              key={kid.id}
              className="rounded-lg border border-sand-200 bg-white overflow-hidden"
            >
              {kid.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={kid.imageUrl}
                  alt={kid.name}
                  className="h-48 w-full object-cover object-[50%_25%]"
                />
              ) : (
                <div className="h-48 bg-sand-100 flex items-center justify-center">
                  <span className="text-4xl text-sand-300">
                    {kid.name.charAt(0)}
                  </span>
                </div>
              )}
              <div className="p-4">
                <h2 className="font-semibold text-sand-900 truncate">
                  {kid.name}
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                    Age {kid.age}
                  </span>
                  {kid.orphanageName && (
                    <span className="inline-flex items-center rounded-full bg-sage-50 px-2 py-0.5 text-xs font-medium text-sage-700 ring-1 ring-inset ring-sage-600/20">
                      {kid.orphanageName}
                    </span>
                  )}
                  {kid.classGroupName && (
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
                      {kid.classGroupName}
                    </span>
                  )}
                  {kid.location && (
                    <span className="text-xs text-sand-500 truncate">
                      {kid.location}
                    </span>
                  )}
                </div>
                {kid.hobby && (
                  <p className="mt-2 text-sm text-sand-600 line-clamp-1">
                    <span className="font-medium text-sand-700">Hobby:</span> {kid.hobby}
                  </p>
                )}
                {kid.about && (
                  <p className="mt-1.5 text-sm text-sand-600 line-clamp-2">
                    {kid.about}
                  </p>
                )}
                {kid.favoriteWord && (
                  <p className="mt-1.5 text-sm text-sand-500 line-clamp-1 italic">
                    <span className="font-medium not-italic text-sand-700">Favorite word:</span>{" "}
                    {kid.favoriteWord}
                  </p>
                )}
                {canEdit && (
                  <div className="mt-3 pt-3 border-t border-sand-100">
                    <Link
                      href={`/admin/kids/${kid.id}`}
                      className="text-sm font-medium text-green-600 hover:text-green-700"
                    >
                      Edit &rarr;
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

