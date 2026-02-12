import { db } from "@/db";
import { orphanages, classGroups } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import type { Orphanage, ClassGroup } from "@/types/orphanage";

/**
 * Get all orphanages with their class groups.
 * Returns data matching the existing Orphanage interface
 * so the public frontend works without changes.
 */
export async function getAllOrphanages(): Promise<Orphanage[]> {
  const rows = await db.select().from(orphanages).orderBy(asc(orphanages.name));

  const groups = await db
    .select()
    .from(classGroups)
    .orderBy(asc(classGroups.sortOrder));

  // Group class groups by orphanage ID
  const groupsByOrphanage = new Map<string, ClassGroup[]>();
  for (const g of groups) {
    const list = groupsByOrphanage.get(g.orphanageId) || [];
    list.push({
      name: g.name,
      studentCount: g.studentCount,
      ageRange: g.ageRange || "",
    });
    groupsByOrphanage.set(g.orphanageId, list);
  }

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    indonesianName: row.indonesianName || undefined,
    address: row.address || undefined,
    location: row.location,
    studentCount: row.studentCount,
    classGroups: groupsByOrphanage.get(row.id) || [],
    classesPerWeek: row.classesPerWeek,
    hoursPerWeek: row.hoursPerWeek || undefined,
    description: row.description,
    curriculum: row.curriculum || undefined,
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

  return {
    id: row.id,
    name: row.name,
    indonesianName: row.indonesianName || undefined,
    address: row.address || undefined,
    location: row.location,
    studentCount: row.studentCount,
    classGroups: groups.map((g) => ({
      name: g.name,
      studentCount: g.studentCount,
      ageRange: g.ageRange || "",
    })),
    classesPerWeek: row.classesPerWeek,
    hoursPerWeek: row.hoursPerWeek || undefined,
    description: row.description,
    curriculum: row.curriculum || undefined,
    runningSince: row.runningSince || undefined,
    imageUrl: row.imageUrl || undefined,
  };
}
