import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";
import { db } from "@/db";
import { media } from "@/db/schema";
import { desc, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const [user, authError] = await withAuth("media:upload");
  if (authError) return authError;

  const url = req.nextUrl;
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "30")));
  const offset = (page - 1) * limit;

  const rows = await db
    .select()
    .from(media)
    .orderBy(desc(media.createdAt))
    .limit(limit)
    .offset(offset);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(media);

  return NextResponse.json({
    media: rows,
    pagination: {
      page,
      limit,
      total: Number(countResult?.count || 0),
      totalPages: Math.ceil(Number(countResult?.count || 0) / limit),
    },
  });
}
