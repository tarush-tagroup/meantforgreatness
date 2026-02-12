import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";
import { db } from "@/db";
import { donations } from "@/db/schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const [, authError] = await withAuth("donations:view");
  if (authError) return authError;

  const url = req.nextUrl;
  const frequency = url.searchParams.get("frequency");
  const status = url.searchParams.get("status");
  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "25")));
  const offset = (page - 1) * limit;

  const conditions = [];
  if (frequency) conditions.push(eq(donations.frequency, frequency));
  if (status) conditions.push(eq(donations.status, status));
  if (dateFrom) conditions.push(gte(donations.createdAt, new Date(dateFrom)));
  if (dateTo) conditions.push(lte(donations.createdAt, new Date(dateTo + "T23:59:59Z")));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(donations)
    .where(whereClause)
    .orderBy(desc(donations.createdAt))
    .limit(limit)
    .offset(offset);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(donations)
    .where(whereClause);

  return NextResponse.json({
    donations: rows,
    pagination: {
      page,
      limit,
      total: Number(countResult?.count || 0),
      totalPages: Math.ceil(Number(countResult?.count || 0) / limit),
    },
  });
}
