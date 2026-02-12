import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";
import { db } from "@/db";
import { orphanages, classGroups } from "@/db/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  const [, authError] = await withAuth("orphanages:view");
  if (authError) return authError;

  const rows = await db.select().from(orphanages).orderBy(asc(orphanages.name));

  const groups = await db
    .select()
    .from(classGroups)
    .orderBy(asc(classGroups.sortOrder));

  const groupsByOrphanage = new Map<string, typeof groups>();
  for (const g of groups) {
    const list = groupsByOrphanage.get(g.orphanageId) || [];
    list.push(g);
    groupsByOrphanage.set(g.orphanageId, list);
  }

  const result = rows.map((row) => ({
    ...row,
    classGroups: groupsByOrphanage.get(row.id) || [],
  }));

  return NextResponse.json({ orphanages: result });
}
