import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";
import { db } from "@/db";
import { transparencyReports, classLogs, users, orphanages } from "@/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const [user, authError] = await withAuth("transparency:generate");
  if (authError) return authError;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { quarter, year } = body;
  if (!quarter || !year || quarter < 1 || quarter > 4) {
    return NextResponse.json(
      { error: "quarter (1-4) and year are required" },
      { status: 400 }
    );
  }

  // Calculate date range for the quarter
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = quarter * 3;
  const startDate = `${year}-${String(startMonth).padStart(2, "0")}-01`;
  const endDate =
    endMonth === 12
      ? `${year}-12-31`
      : `${year}-${String(endMonth + 1).padStart(2, "0")}-01`;

  // Count total classes in the quarter
  const [classCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(classLogs)
    .where(
      and(
        gte(classLogs.classDate, startDate),
        lte(classLogs.classDate, endDate)
      )
    );

  // Count total students (sum of student counts from class logs)
  const [studentSum] = await db
    .select({ total: sql<number>`COALESCE(SUM(student_count), 0)` })
    .from(classLogs)
    .where(
      and(
        gte(classLogs.classDate, startDate),
        lte(classLogs.classDate, endDate)
      )
    );

  // Count unique teachers
  const [teacherCount] = await db
    .select({ count: sql<number>`COUNT(DISTINCT teacher_id)` })
    .from(classLogs)
    .where(
      and(
        gte(classLogs.classDate, startDate),
        lte(classLogs.classDate, endDate)
      )
    );

  // Count orphanages with classes
  const [orphanageCount] = await db
    .select({ count: sql<number>`COUNT(DISTINCT orphanage_id)` })
    .from(classLogs)
    .where(
      and(
        gte(classLogs.classDate, startDate),
        lte(classLogs.classDate, endDate)
      )
    );

  const quarterLabel = `Q${quarter} ${year}`;
  const content = `# Transparency Report — ${quarterLabel}

## Summary

- **Total Classes:** ${Number(classCount?.count || 0)}
- **Total Students Reached:** ${Number(studentSum?.total || 0)}
- **Active Teachers:** ${Number(teacherCount?.count || 0)}
- **Orphanages Served:** ${Number(orphanageCount?.count || 0)}

## Details

This report covers the period from ${startDate} to ${endDate}.

*Edit this section to add narrative details about the quarter's activities.*
`;

  const [report] = await db
    .insert(transparencyReports)
    .values({
      title: `Transparency Report — ${quarterLabel}`,
      quarter,
      year,
      totalClasses: Number(classCount?.count || 0),
      totalStudents: Number(studentSum?.total || 0),
      totalTeachers: Number(teacherCount?.count || 0),
      orphanageCount: Number(orphanageCount?.count || 0),
      content,
      published: false,
      createdBy: user!.id,
    })
    .returning();

  return NextResponse.json({ report }, { status: 201 });
}
