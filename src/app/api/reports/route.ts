import { NextResponse } from "next/server";
import { db } from "@/db";
import { transparencyReports } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db
    .select()
    .from(transparencyReports)
    .where(eq(transparencyReports.published, true))
    .orderBy(desc(transparencyReports.year), desc(transparencyReports.quarter));

  return NextResponse.json({ reports: rows });
}
