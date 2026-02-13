import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

/**
 * POST /api/log-client
 *
 * Public endpoint for client-side logs. No authentication required
 * (browser JS cannot carry bearer tokens). Rate-limited per IP.
 *
 * Body: { entries: [{ level, source, message, meta? }] }
 */

// In-memory rate limiter (resets on cold start — fine for a charity site)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // entries per window
const RATE_WINDOW_MS = 60_000; // 1 minute

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT;
}

// Clean up stale entries periodically (every 100 requests)
let cleanupCounter = 0;
function maybeCleanup() {
  cleanupCounter++;
  if (cleanupCounter >= 100) {
    cleanupCounter = 0;
    const now = Date.now();
    for (const [ip, entry] of rateLimitMap) {
      if (now > entry.resetAt) {
        rateLimitMap.delete(ip);
      }
    }
  }
}

const VALID_LEVELS = new Set(["info", "warn", "error"]);

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  maybeCleanup();

  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  let body: {
    entries: Array<{
      level: string;
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
    return NextResponse.json(
      { error: "Missing entries array" },
      { status: 400 }
    );
  }

  // Cap at 10 entries per request
  const entries = body.entries.slice(0, 10);
  let ingested = 0;

  for (const entry of entries) {
    // Validate level
    if (!VALID_LEVELS.has(entry.level)) continue;

    // Source must start with "frontend:" to prevent abuse
    if (typeof entry.source !== "string" || !entry.source.startsWith("frontend:")) continue;

    // Message must be non-empty and max 2000 chars
    if (typeof entry.message !== "string" || !entry.message || entry.message.length > 2000) continue;

    // Truncate meta to prevent abuse
    let meta: Record<string, unknown> | undefined;
    if (entry.meta && typeof entry.meta === "object") {
      const keys = Object.keys(entry.meta).slice(0, 5);
      meta = {};
      for (const key of keys) {
        const val = entry.meta[key];
        meta[key] =
          typeof val === "string" ? val.slice(0, 500) : val;
      }
    }

    const level = entry.level as "info" | "warn" | "error";
    await logger[level](entry.source, entry.message, meta);
    ingested++;
  }

  return NextResponse.json({ success: true, ingested });
}
