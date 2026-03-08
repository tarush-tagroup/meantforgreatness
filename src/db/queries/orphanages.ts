import { db } from "@/db";
import { orphanages, classGroups, kids } from "@/db/schema";
import { eq, asc, sql, min, max } from "drizzle-orm";
import type { Orphanage, ClassGroup } from "@/types/orphanage";

/**
 * Get all orphanages with their class groups.
 * Student counts and age ranges are auto-calculated from the kids table.
 */
export async function getAllOrphanages(): Promise<Orphanage[]> {
  const rows = await db.select().from(orphanages).orderBy(asc(orphanages.name));

  const groups = await db
    .select()
    .from(classGroups)
    .orderBy(asc(classGroups.sortOrder));

  // Get real kid counts and age ranges per class group
  const kidStats = await db
    .select({
      classGroupId: kids.classGroupId,
      count: sql<number>`count(*)::int`,
      minAge: min(kids.age),
      maxAge: max(kids.age),
    })
    .from(kids)
    .groupBy(kids.classGroupId);

  const statsMap = new Map(
    kidStats.map((s) => [
      s.classGroupId,
      {
        studentCount: s.count,
        ageRange:
          s.minAge === s.maxAge
            ? `${s.minAge}`
            : `${s.minAge}-${s.maxAge}`,
      },
    ])
  );

  // Get total kid count per orphanage
  const kidCountsByOrphanage = await db
    .select({
      orphanageId: kids.orphanageId,
      count: sql<number>`count(*)::int`,
    })
    .from(kids)
    .groupBy(kids.orphanageId);

  const orphanageKidCounts = new Map(
    kidCountsByOrphanage.map((r) => [r.orphanageId, r.count])
  );

  // Group class groups by orphanage ID
  const groupsByOrphanage = new Map<string, ClassGroup[]>();
  for (const g of groups) {
    const list = groupsByOrphanage.get(g.orphanageId) || [];
    const stats = statsMap.get(g.id);
    list.push({
      name: g.name,
      studentCount: stats?.studentCount ?? 0,
      ageRange: stats?.ageRange ?? "",
    });
    groupsByOrphanage.set(g.orphanageId, list);
  }

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    indonesianName: row.indonesianName || undefined,
    address: row.address || undefined,
    location: row.location,
    studentCount: orphanageKidCounts.get(row.id) ?? 0,
    classGroups: groupsByOrphanage.get(row.id) || [],
    description: row.description,
    runningSince: row.runningSince || undefined,
    imageUrl: row.imageUrl || undefined,
  }));
}

/**
 * Get a single orphanage by ID with class groups.
 */
export async function getOrphanageById(
  id: string
): Promise<Orphanage | undefined> {
  const [row] = await db
    .select()
    .from(orphanages)
    .where(eq(orphanages.id, id))
    .limit(1);

  if (!row) return undefined;

  const groups = await db
    .select()
    .from(classGroups)
    .where(eq(classGroups.orphanageId, id))
    .orderBy(asc(classGroups.sortOrder));

  // Get real kid counts per class group
  const kidStats = await db
    .select({
      classGroupId: kids.classGroupId,
      count: sql<number>`count(*)::int`,
      minAge: min(kids.age),
      maxAge: max(kids.age),
    })
    .from(kids)
    .where(eq(kids.orphanageId, id))
    .groupBy(kids.classGroupId);

  const statsMap = new Map(
    kidStats.map((s) => [
      s.classGroupId,
      {
        studentCount: s.count,
        ageRange:
          s.minAge === s.maxAge
            ? `${s.minAge}`
            : `${s.minAge}-${s.maxAge}`,
      },
    ])
  );

  // Get total kid count for this orphanage
  const [kidCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(kids)
    .where(eq(kids.orphanageId, id));

  return {
    id: row.id,
    name: row.name,
    indonesianName: row.indonesianName || undefined,
    address: row.address || undefined,
    location: row.location,
    studentCount: kidCount?.count ?? 0,
    classGroups: groups.map((g) => {
      const stats = statsMap.get(g.id);
      return {
        name: g.name,
        studentCount: stats?.studentCount ?? 0,
        ageRange: stats?.ageRange ?? "",
      };
    }),
    description: row.description,
    runningSince: row.runningSince || undefined,
    imageUrl: row.imageUrl || undefined,
  };
}
