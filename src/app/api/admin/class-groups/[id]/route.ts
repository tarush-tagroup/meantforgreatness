import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";
import { db } from "@/db";
import { classGroups } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(255),
  studentCount: z.number().int().min(0),
  ageRange: z.string().max(50).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const [, authError] = await withAuth("orphanages:edit");
  if (authError) return authError;

  const { id } = await context.params;

  const [existing] = await db
    .select()
    .from(classGroups)
    .where(eq(classGroups.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json(
      { error: "Class group not found" },
      { status: 404 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues?.[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  await db
    .update(classGroups)
    .set({
      name: parsed.data.name,
      studentCount: parsed.data.studentCount,
      ageRange: parsed.data.ageRange ?? null,
      sortOrder: parsed.data.sortOrder ?? existing.sortOrder,
      updatedAt: new Date(),
    })
    .where(eq(classGroups.id, id));

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const [, authError] = await withAuth("orphanages:edit");
  if (authError) return authError;

  const { id } = await context.params;

  const [existing] = await db
    .select()
    .from(classGroups)
    .where(eq(classGroups.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json(
      { error: "Class group not found" },
      { status: 404 }
    );
  }

  await db.delete(classGroups).where(eq(classGroups.id, id));

  return NextResponse.json({ success: true });
}
