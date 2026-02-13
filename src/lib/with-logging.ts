import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

type RouteHandler = (
  req: NextRequest,
  ctx?: { params: Promise<Record<string, string>> }
) => Promise<NextResponse> | NextResponse;

interface WithLoggingOptions {
  /** Source name, e.g. "checkout", "webhook:stripe" */
  source: string;
  /** Threshold in ms for slow request logging (default: 2000) */
  slowThreshold?: number;
}

/**
 * Wraps a Next.js API route handler with timing and error logging.
 *
 * - Logs slow requests (>threshold) as warn
 * - Logs error responses (4xx/5xx) — warn for 4xx, error for 5xx
 * - Catches unhandled thrown errors, logs them, and re-throws
 *
 * Usage:
 *   async function postHandler(req: NextRequest) { ... }
 *   export const POST = withLogging(postHandler, { source: "checkout" });
 */
export function withLogging(
  handler: RouteHandler,
  options: WithLoggingOptions
): RouteHandler {
  const { source, slowThreshold = 2000 } = options;

  return async (req, ctx) => {
    const start = Date.now();

    try {
      const response = await handler(req, ctx);
      const duration = Date.now() - start;

      // Log slow requests
      if (duration > slowThreshold) {
        logger
          .warn(`api:${source}`, `Slow: ${req.method} ${req.nextUrl.pathname} ${duration}ms`, {
            method: req.method,
            path: req.nextUrl.pathname,
            status: response.status,
            duration,
          })
          .catch(() => {});
      }

      // Log error responses
      if (response.status >= 500) {
        logger
          .error(`api:${source}`, `${response.status} ${req.method} ${req.nextUrl.pathname}`, {
            method: req.method,
            path: req.nextUrl.pathname,
            status: response.status,
            duration,
          })
          .catch(() => {});
      } else if (response.status >= 400) {
        logger
          .warn(`api:${source}`, `${response.status} ${req.method} ${req.nextUrl.pathname}`, {
            method: req.method,
            path: req.nextUrl.pathname,
            status: response.status,
            duration,
          })
          .catch(() => {});
      }

      return response;
    } catch (err) {
      const duration = Date.now() - start;
      logger
        .error(
          `api:${source}`,
          `Unhandled: ${err instanceof Error ? err.message : String(err)}`,
          {
            method: req.method,
            path: req.nextUrl.pathname,
            duration,
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack?.slice(0, 1000) : undefined,
          }
        )
        .catch(() => {});

      throw err;
    }
  };
}
