import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "@/lib/timing-safe";
import { syncMercury, syncWise, syncExchangeRate } from "@/lib/bank-sync";
import { db } from "@/db";
import { cronRuns } from "@/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

/**
 * GET /api/cron/sync-bank-accounts
 *
 * Daily cron job that fetches balances and transactions from Mercury and Wise,
 * plus the USD→IDR exchange rate. Protected by CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!cronSecret || !bearerToken || !timingSafeEqual(bearerToken, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Record cron run start
  const [run] = await db
    .insert(cronRuns)
    .values({ jobName: "sync-bank-accounts", status: "running" })
    .returning();

  let totalItems = 0;
  const errors: string[] = [];

  try {
    // Sync Mercury
    try {
      const mercuryItems = await syncMercury();
      totalItems += mercuryItems;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Mercury: ${msg}`);
      logger.error("bank-sync", "Mercury sync failed", { error: msg });
    }

    // Sync Wise
    try {
      const wiseItems = await syncWise();
      totalItems += wiseItems;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Wise: ${msg}`);
      logger.error("bank-sync", "Wise sync failed", { error: msg });
    }

    // Sync exchange rate
    await syncExchangeRate();

    // Mark cron run complete
    const status = errors.length > 0 ? "error" : "success";
    const message =
      errors.length > 0
        ? `Partial sync. Errors: ${errors.join("; ")}`
        : `Synced ${totalItems} transactions`;

    await db
      .update(cronRuns)
      .set({
        status,
        message,
        itemsProcessed: totalItems,
        finishedAt: new Date(),
      })
      .where(eq(cronRuns.id, run.id));

    return NextResponse.json({ success: true, totalItems, errors });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    await db
      .update(cronRuns)
      .set({
        status: "error",
        message: msg.slice(0, 1000),
        finishedAt: new Date(),
      })
      .where(eq(cronRuns.id, run.id));

    logger.error("bank-sync", "Bank sync cron failed", { error: msg });
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
