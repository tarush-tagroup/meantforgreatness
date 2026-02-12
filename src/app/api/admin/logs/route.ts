import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";
import { db } from "@/db";
import { appLogs } from "@/db/schema";
import { desc, eq, and, gte, sql } from "drizzle-orm";

/**
 * GET /api/admin/logs
 *
 * Dual auth: session-based (admin panel) or bearer token (GitHub Actions).
 * Query params: level, source, since (ISO timestamp), limit (default 50, max 200)
 */
export async function GET(req: NextRequest) {
  // Check bearer token first (for GitHub Actions)
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const logApiSecret = process.env.LOG_API_SECRET;

  let isAuthed = false;

  if (bearerToken && logApiSecret && bearerToken === logApiSecret) {
    isAuthed = true;
  } else {
    // Fall back to session auth
    const [, authError] = await withAuth("logs:view");
    if (!authError) {
      isAuthed = true;
    } else {
      return authError;
    }
  }

  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl;
  const level = url.searchParams.get("level");
  const source = url.searchParams.get("source");
  const since = url.searchParams.get("since");
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "50")));
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const offset = (page - 1) * limit;

  // Build filters
  const conditions = [];
  if (level) conditions.push(eq(appLogs.level, level));
  if (source) conditions.push(eq(appLogs.source, source));
  if (since) {
    const sinceDate = new Date(since);
    if (!isNaN(sinceDate.getTime())) {
      conditions.push(gte(appLogs.createdAt, sinceDate));
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, [countResult]] = await Promise.all([
    db
      .select()
      .from(appLogs)
      .where(whereClause)
      .orderBy(desc(appLogs.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(appLogs)
      .where(whereClause),
  ]);

  const total = Number(countResult?.count || 0);

  return NextResponse.json({
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
