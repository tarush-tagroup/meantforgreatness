import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";
import { db } from "@/db";
import { classLogs, orphanages, users } from "@/db/schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";

const createSchema = z.object({
  orphanageId: z.string().min(1),
  classDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  classTime: z.string().max(20).optional(),
  studentCount: z.number().int().min(0).optional(),
  photoUrl: z.string().url().optional(),
  notes: z.string().max(2000).optional(),
});

export async function GET(req: NextRequest) {
  const [, authError] = await withAuth("class_logs:view_all");
  if (authError) return authError;

  const url = req.nextUrl;
  const orphanageId = url.searchParams.get("orphanageId");
  const teacherId = url.searchParams.get("teacherId");
  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "25")));
  const offset = (page - 1) * limit;

  const conditions = [];
  if (orphanageId) conditions.push(eq(classLogs.orphanageId, orphanageId));
  if (teacherId) conditions.push(eq(classLogs.teacherId, teacherId));
  if (dateFrom) conditions.push(gte(classLogs.classDate, dateFrom));
  if (dateTo) conditions.push(lte(classLogs.classDate, dateTo));

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
      photoUrl: classLogs.photoUrl,
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

  // Get total count for pagination
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(classLogs)
    .where(whereClause);

  return NextResponse.json({
    classLogs: rows,
    pagination: {
      page,
      limit,
      total: Number(countResult?.count || 0),
      totalPages: Math.ceil(Number(countResult?.count || 0) / limit),
    },
  });
}

export async function POST(req: NextRequest) {
  const [user, authError] = await withAuth("class_logs:create");
  if (authError) return authError;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
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

  // Teachers are locked to their own ID. Admins and teacher_managers
  // can also create logs for themselves (teacherId is always the current user).
  const [created] = await db
    .insert(classLogs)
    .values({
      orphanageId: parsed.data.orphanageId,
      teacherId: user!.id,
      classDate: parsed.data.classDate,
      classTime: parsed.data.classTime || null,
      studentCount: parsed.data.studentCount ?? null,
      photoUrl: parsed.data.photoUrl || null,
      notes: parsed.data.notes || null,
    })
    .returning();

  return NextResponse.json({ classLog: created }, { status: 201 });
}
