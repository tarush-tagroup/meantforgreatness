import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { AppDrizzleLogger } from "@/lib/db-logger";
import { logger } from "@/lib/logger";

const SLOW_QUERY_MS = 200;

/**
 * Wraps the neon() SQL tagged-template function with a Proxy
 * that measures query execution time.
 * Queries >200ms → logger.warn("db:slow-query")
 * Failed queries → logger.error("db:error")
 */
function createTimedSql(sql: NeonQueryFunction<false, false>): NeonQueryFunction<false, false> {
  return new Proxy(sql, {
    apply(target, thisArg, args) {
      const start = Date.now();
      const queryPreview = String(args[0])?.slice(0, 300) || "unknown";

      const result = Reflect.apply(target, thisArg, args);

      // neon() returns a promise — attach timing to it
      if (result && typeof result.then === "function") {
        return result.then(
          (res: unknown) => {
            const duration = Date.now() - start;
            if (duration > SLOW_QUERY_MS) {
              logger
                .warn("db:slow-query", `Query took ${duration}ms`, {
                  duration,
                  query: queryPreview,
                })
                .catch(() => {});
            }
            return res;
          },
          (err: unknown) => {
            const duration = Date.now() - start;
            logger
              .error("db:error", `Query failed after ${duration}ms`, {
                duration,
                query: queryPreview,
                error: err instanceof Error ? err.message : String(err),
              })
              .catch(() => {});
            throw err;
          }
        );
      }

      return result;
    },
  });
}

let _db: NeonHttpDatabase<typeof schema> | null = null;

/**
 * Get the database connection, lazily initialized.
 * This avoids throwing during Next.js build when DATABASE_URL is not yet set.
 */
export function getDb(): NeonHttpDatabase<typeof schema> {
  if (!_db) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    const rawSql = neon(process.env.DATABASE_URL);
    const timedSql = createTimedSql(rawSql);
    _db = drizzle(timedSql, { schema, logger: new AppDrizzleLogger() });
  }
  return _db;
}

/**
 * Proxy-based db export for convenient usage: `db.select().from(...)`.
 * Lazily initializes the connection on first property access at runtime.
 */
export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    const realDb = getDb();
    const value = Reflect.get(realDb, prop, receiver);
    if (typeof value === "function") {
      return value.bind(realDb);
    }
    return value;
  },
});
