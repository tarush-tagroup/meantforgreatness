import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";
import { listLogs } from "@/lib/blob-logs";
import { timingSafeEqual } from "@/lib/timing-safe";

/**
 * GET /api/admin/logs
 *
 * Dual auth: session-based (admin panel) or bearer token (GitHub Actions).
 * Query params: level, source, since (ISO timestamp), limit (default 50, max 200), page
 */
export async function GET(req: NextRequest) {
  // Check bearer token first (for GitHub Actions)
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const logApiSecret = process.env.LOG_API_SECRET;

  let isAuthed = false;

  if (bearerToken && logApiSecret && timingSafeEqual(bearerToken, logApiSecret)) {
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

  // Build filter
  const sinceDate = since ? new Date(since) : undefined;
  const filter = {
    level: level || undefined,
    source: source || undefined,
    since: sinceDate && !isNaN(sinceDate.getTime()) ? sinceDate : undefined,
  };

  const result = await listLogs(filter, { limit, offset });

  return NextResponse.json({
    data: result.entries,
    pagination: {
      page,
      limit,
      total: result.total,
      totalPages: Math.ceil(result.total / limit),
    },
  });
}
