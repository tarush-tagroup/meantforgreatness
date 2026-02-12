import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";
import { db } from "@/db";
import { transparencyReports } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const [, authError] = await withAuth("transparency:view");
  if (authError) return authError;

  const rows = await db
    .select()
    .from(transparencyReports)
    .orderBy(desc(transparencyReports.year), desc(transparencyReports.quarter));

  return NextResponse.json({ reports: rows });
}
