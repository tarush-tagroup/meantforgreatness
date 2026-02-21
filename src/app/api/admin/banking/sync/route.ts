import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";
import { syncMercury, syncWise, syncExchangeRate } from "@/lib/bank-sync";
import { checkRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/with-logging";

/**
 * POST /api/admin/banking/sync
 *
 * Manual trigger for bank sync (same logic as the daily cron).
 * Rate-limited to 5 syncs per hour per user.
 */
async function postHandler(req: NextRequest) {
  const [user, authError] = await withAuth("banking:view");
  if (authError) return authError;

  // Rate limit: 5 manual syncs per hour
  const rateLimitResult = checkRateLimit(`bank-sync:${user!.id}`, {
    maxRequests: 5,
    windowMs: 60 * 60 * 1000,
  });

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Sync rate limit exceeded. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)
          ),
        },
      }
    );
  }

  const errors: string[] = [];
  let totalItems = 0;

  try {
    const mercuryItems = await syncMercury();
    totalItems += mercuryItems;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Mercury: ${msg}`);
    logger.error("bank-sync", "Manual Mercury sync failed", { error: msg });
  }

  try {
    const wiseItems = await syncWise();
    totalItems += wiseItems;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Wise: ${msg}`);
    logger.error("bank-sync", "Manual Wise sync failed", { error: msg });
  }

  await syncExchangeRate();

  if (errors.length > 0 && totalItems === 0) {
    return NextResponse.json(
      { error: "Bank sync failed", details: errors },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    totalItems,
    errors: errors.length > 0 ? errors : undefined,
  });
}

export const POST = withLogging(postHandler, { source: "banking:sync" });
