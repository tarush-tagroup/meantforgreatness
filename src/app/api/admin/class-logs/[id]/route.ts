import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";
import { hasPermission } from "@/lib/permissions";
import { db } from "@/db";
import { classLogs, orphanages, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const updateSchema = z.object({
  orphanageId: z.string().min(1).optional(),
  classDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional(),
  classTime: z.string().max(20).nullable().optional(),
  studentCount: z.number().int().min(0).nullable().optional(),
  photoUrl: z.string().url().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const [, authError] = await withAuth("class_logs:view_all");
  if (authError) return authError;

  const { id } = await context.params;

  const [row] = await db
    .select({
      id: classLogs.id,
      orphanageId: classLogs.orphanageId,
      orphanageName: orphanages.name,
      teacherId: classLogs.teacherId,
      teacherName: users.name,
      classDate: classLogs.classDate,
      classTime: classLogs.classTime,
      studentCount: classLogs.studentCount,
      photoUrl: classLogs.photoUrl,
      notes: classLogs.notes,
      createdAt: classLogs.createdAt,
    })
    .from(classLogs)
    .leftJoin(orphanages, eq(classLogs.orphanageId, orphanages.id))
    .leftJoin(users, eq(classLogs.teacherId, users.id))
    .where(eq(classLogs.id, id))
    .limit(1);

  if (!row) {
    return NextResponse.json(
      { error: "Class log not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ classLog: row });
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const [user, authError] = await withAuth("class_logs:edit_own");
  if (authError) return authError;

  const { id } = await context.params;

  // Fetch existing log
  const [existing] = await db
    .select()
    .from(classLogs)
    .where(eq(classLogs.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json(
      { error: "Class log not found" },
      { status: 404 }
    );
  }

  // Ownership check: teacher can only edit their own logs
  const isOwner = existing.teacherId === user!.id;
  const canEditAll = hasPermission(user!.roles, "class_logs:edit_all");

  if (!isOwner && !canEditAll) {
    return NextResponse.json(
      { error: "You can only edit your own class logs" },
      { status: 403 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues?.[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  // If orphanageId is being changed, verify it exists
  if (parsed.data.orphanageId && parsed.data.orphanageId !== existing.orphanageId) {
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
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.orphanageId !== undefined) updateData.orphanageId = parsed.data.orphanageId;
  if (parsed.data.classDate !== undefined) updateData.classDate = parsed.data.classDate;
  if (parsed.data.classTime !== undefined) updateData.classTime = parsed.data.classTime;
  if (parsed.data.studentCount !== undefined) updateData.studentCount = parsed.data.studentCount;
  if (parsed.data.photoUrl !== undefined) updateData.photoUrl = parsed.data.photoUrl;
  if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: "No fields to update" },
      { status: 400 }
    );
  }

  await db.update(classLogs).set(updateData).where(eq(classLogs.id, id));

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const [user, authError] = await withAuth("class_logs:delete_own");
  if (authError) return authError;

  const { id } = await context.params;

  const [existing] = await db
    .select()
    .from(classLogs)
    .where(eq(classLogs.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json(
      { error: "Class log not found" },
      { status: 404 }
    );
  }

  // Ownership check
  const isOwner = existing.teacherId === user!.id;
  const canDeleteAll = hasPermission(user!.roles, "class_logs:delete_all");

  if (!isOwner && !canDeleteAll) {
    return NextResponse.json(
      { error: "You can only delete your own class logs" },
      { status: 403 }
    );
  }

  await db.delete(classLogs).where(eq(classLogs.id, id));

  return NextResponse.json({ success: true });
}
