import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

/**
 * POST /api/admin/logs/ingest
 *
 * Accepts external log entries and writes them to centralized Vercel Blob storage.
 * Used by GitHub Actions monitor to push Vercel runtime errors into the central log.
 *
 * Auth: Bearer token (LOG_API_SECRET) — same token used for reading logs.
 *
 * Body: { entries: [{ level, source, message, meta? }] }
 */
export async function POST(req: NextRequest) {
  // Bearer token auth
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const logApiSecret = process.env.LOG_API_SECRET;

  if (!bearerToken || !logApiSecret || bearerToken !== logApiSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    entries: Array<{
      level: "info" | "warn" | "error";
      source: string;
      message: string;
      meta?: Record<string, unknown>;
    }>;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.entries || !Array.isArray(body.entries)) {
    return NextResponse.json({ error: "Missing entries array" }, { status: 400 });
  }

  // Cap at 100 entries per request to prevent abuse
  const entries = body.entries.slice(0, 100);
  let ingested = 0;

  for (const entry of entries) {
    const level = entry.level === "error" ? "error" : entry.level === "warn" ? "warn" : "info";
    const source = entry.source || "unknown";
    const message = entry.message || "";

    if (!message) continue;

    await logger[level](source, message, entry.meta);
    ingested++;
  }

  return NextResponse.json({ success: true, ingested });
}
