import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";
import { db } from "@/db";
import { classGroups, orphanages } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { z } from "zod";

const createSchema = z.object({
  orphanageId: z.string().min(1),
  name: z.string().min(1).max(255),
  studentCount: z.number().int().min(0),
  ageRange: z.string().max(50).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export async function GET(req: NextRequest) {
  const [, authError] = await withAuth("orphanages:view");
  if (authError) return authError;

  const orphanageId = req.nextUrl.searchParams.get("orphanageId");

  const query = orphanageId
    ? db
        .select()
        .from(classGroups)
        .where(eq(classGroups.orphanageId, orphanageId))
        .orderBy(asc(classGroups.sortOrder))
    : db.select().from(classGroups).orderBy(asc(classGroups.sortOrder));

  const rows = await query;
  return NextResponse.json({ classGroups: rows });
}

export async function POST(req: NextRequest) {
  const [, authError] = await withAuth("orphanages:edit");
  if (authError) return authError;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues?.[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  // Verify orphanage exists
  const [orphanage] = await db
    .select()
    .from(orphanages)
    .where(eq(orphanages.id, parsed.data.orphanageId))
    .limit(1);

  if (!orphanage) {
    return NextResponse.json(
      { error: "Orphanage not found" },
      { status: 404 }
    );
  }

  const [created] = await db
    .insert(classGroups)
    .values({
      orphanageId: parsed.data.orphanageId,
      name: parsed.data.name,
      studentCount: parsed.data.studentCount,
      ageRange: parsed.data.ageRange || null,
      sortOrder: parsed.data.sortOrder ?? 0,
    })
    .returning();

  return NextResponse.json({ classGroup: created }, { status: 201 });
}
