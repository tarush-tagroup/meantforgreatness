import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "@/lib/timing-safe";
import { db } from "@/db";
import { classLogs, orphanages, invoices, invoiceLineItems, cronRuns } from "@/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { logger } from "@/lib/logger";

/**
 * GET /api/cron/generate-invoice
 *
 * Monthly cron job (1st of each month at 8 AM UTC) that auto-generates
 * a combined invoice for all classes from the previous month.
 * Rate: 300,000 IDR per class, from Transforme to WhiteLightVentures.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!cronSecret || !bearerToken || !timingSafeEqual(bearerToken, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Record cron run
  const [run] = await db
    .insert(cronRuns)
    .values({ jobName: "generate-invoice", status: "running" })
    .returning();

  try {
    // Determine previous month
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const periodStart = prevMonth.toISOString().split("T")[0]; // first day
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
    const periodEnd = lastDay.toISOString().split("T")[0]; // last day

    const year = prevMonth.getFullYear();
    const month = String(prevMonth.getMonth() + 1).padStart(2, "0");
    const invoiceNumber = `INV-${year}-${month}`;

    // Check if already exists (idempotent)
    const [existing] = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.invoiceNumber, invoiceNumber))
      .limit(1);

    if (existing) {
      await db
        .update(cronRuns)
        .set({
          status: "success",
          message: `Invoice ${invoiceNumber} already exists, skipped`,
          finishedAt: new Date(),
        })
        .where(eq(cronRuns.id, run.id));

      return NextResponse.json({
        success: true,
        message: `Invoice ${invoiceNumber} already exists`,
      });
    }

    // Count classes per orphanage in the previous month
    const classCounts = await db
      .select({
        orphanageId: classLogs.orphanageId,
        orphanageName: orphanages.name,
        classCount: sql<number>`count(*)::int`,
      })
      .from(classLogs)
      .leftJoin(orphanages, eq(classLogs.orphanageId, orphanages.id))
      .where(
        and(
          gte(classLogs.classDate, periodStart),
          lte(classLogs.classDate, periodEnd)
        )
      )
      .groupBy(classLogs.orphanageId, orphanages.name);

    const RATE = 300000; // IDR per class
    let totalClasses = 0;
    let totalAmountIdr = 0;

    const lineItems = classCounts.map((row) => {
      const count = Number(row.classCount);
      const subtotal = count * RATE;
      totalClasses += count;
      totalAmountIdr += subtotal;
      return {
        orphanageId: row.orphanageId,
        orphanageName: row.orphanageName || row.orphanageId,
        classCount: count,
        ratePerClassIdr: RATE,
        subtotalIdr: subtotal,
      };
    });

    // Create invoice
    const [invoice] = await db
      .insert(invoices)
      .values({
        invoiceNumber,
        periodStart,
        periodEnd,
        totalClasses,
        totalAmountIdr,
        ratePerClassIdr: RATE,
      })
      .returning();

    // Create line items
    if (lineItems.length > 0) {
      await db.insert(invoiceLineItems).values(
        lineItems.map((li) => ({
          invoiceId: invoice.id,
          orphanageId: li.orphanageId,
          orphanageName: li.orphanageName,
          classCount: li.classCount,
          ratePerClassIdr: li.ratePerClassIdr,
          subtotalIdr: li.subtotalIdr,
        }))
      );
    }

    await db
      .update(cronRuns)
      .set({
        status: "success",
        message: `Generated ${invoiceNumber}: ${totalClasses} classes, ${totalAmountIdr.toLocaleString("id-ID")} IDR`,
        itemsProcessed: totalClasses,
        finishedAt: new Date(),
      })
      .where(eq(cronRuns.id, run.id));

    logger.info("invoice", `Generated ${invoiceNumber}`, {
      totalClasses,
      totalAmountIdr,
      lineItems: lineItems.length,
    });

    return NextResponse.json({
      success: true,
      invoice: { id: invoice.id, invoiceNumber, totalClasses, totalAmountIdr },
    });
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

    logger.error("invoice", "Invoice generation failed", { error: msg });
    return NextResponse.json({ error: "Invoice generation failed" }, { status: 500 });
  }
}
