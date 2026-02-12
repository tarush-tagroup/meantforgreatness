import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";
import { db } from "@/db";
import { users } from "@/db/schema";
import { asc, sql } from "drizzle-orm";

export async function GET() {
  const [, authError] = await withAuth("class_logs:view_all");
  if (authError) return authError;

  // Get all active users who have teacher-like roles (teacher, teacher_manager, admin)
  const teachers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .where(
      sql`${users.status} = 'active' AND ${users.roles} && ARRAY['teacher', 'teacher_manager', 'admin']::text[]`
    )
    .orderBy(asc(users.name));

  return NextResponse.json({ teachers });
}
