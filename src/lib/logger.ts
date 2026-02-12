import { put } from "@vercel/blob";

type LogLevel = "info" | "warn" | "error";

/**
 * Encode source name for use in blob path.
 * Replaces colons with double-hyphens (e.g. "stripe:checkout" → "stripe--checkout").
 */
function encodeSource(source: string): string {
  return source.replace(/:/g, "--");
}

/** Generate a short random ID for uniqueness. */
function generateId(): string {
  return Math.random().toString(36).substring(2, 8);
}

/**
 * Centralized application logger.
 *
 * Writes structured log entries as JSON blobs to Vercel Blob storage
 * AND mirrors to console for Vercel runtime log visibility.
 *
 * Path format: logs/{YYYY-MM-DD}/{level}/{encoded_source}/{timestamp_ms}-{random6}.json
 *
 * Blob writes are fire-and-forget (never throw from the logger).
 */
async function log(
  level: LogLevel,
  source: string,
  message: string,
  meta?: Record<string, unknown>
): Promise<void> {
  // Always log to console so Vercel logs still work
  const consoleFn =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : console.log;
  consoleFn(`[${level.toUpperCase()}] [${source}]`, message, meta ?? "");

  // Write to Vercel Blob (fire-and-forget — never let a logging failure break the app)
  try {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10); // "2026-02-12"
    const ts = now.getTime();
    const id = generateId();
    const encodedSource = encodeSource(source);

    const pathname = `logs/${dateStr}/${level}/${encodedSource}/${ts}-${id}.json`;
    const body = JSON.stringify({
      level,
      source,
      message,
      meta: meta ?? null,
      timestamp: now.toISOString(),
    });

    await put(pathname, body, {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
    });
  } catch (err) {
    // If blob write fails, just log the failure to console — don't throw
    console.error("[logger] Failed to write log to blob storage:", err);
  }
}

export const logger = {
  info: (source: string, message: string, meta?: Record<string, unknown>) =>
    log("info", source, message, meta),
  warn: (source: string, message: string, meta?: Record<string, unknown>) =>
    log("warn", source, message, meta),
  error: (source: string, message: string, meta?: Record<string, unknown>) =>
    log("error", source, message, meta),
};
