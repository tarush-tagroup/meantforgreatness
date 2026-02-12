import { db } from "@/db";
import { appLogs } from "@/db/schema";

type LogLevel = "info" | "warn" | "error";

/**
 * Centralized application logger.
 *
 * Writes structured log entries to the `app_logs` Neon DB table
 * AND mirrors to console for Vercel runtime log visibility.
 *
 * DB writes are fire-and-forget (never throw from the logger).
 */
async function log(
  level: LogLevel,
  source: string,
  message: string,
  meta?: Record<string, unknown>
): Promise<void> {
  // Always log to console so Vercel logs still work
  const consoleFn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  consoleFn(`[${level.toUpperCase()}] [${source}]`, message, meta ?? "");

  // Write to DB (fire-and-forget — never let a logging failure break the app)
  try {
    await db.insert(appLogs).values({
      level,
      source,
      message,
      meta: meta ?? null,
    });
  } catch (err) {
    // If DB write fails, just log the failure to console — don't throw
    console.error("[logger] Failed to write log to DB:", err);
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
