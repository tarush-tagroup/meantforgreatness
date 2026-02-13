import type { Logger } from "drizzle-orm/logger";

/**
 * Custom Drizzle logger.
 * In development: logs all queries to console for debugging.
 * In production: no-op (timing is handled by the neon proxy in db/index.ts).
 */
export class AppDrizzleLogger implements Logger {
  logQuery(query: string, params: unknown[]): void {
    if (process.env.NODE_ENV === "development") {
      console.log(
        "[drizzle]",
        query.slice(0, 200),
        `(${params.length} params)`
      );
    }
  }
}
