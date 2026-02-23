import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";
import { db } from "@/db";
import { classLogs, orphanages, invoices, invoiceLineItems } from "@/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/with-logging";

const generateSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Must be YYYY-MM format")
    .optional(),
});

/**
 * POST /api/admin/invoices/generate
 *
 * Manual invoice generation. Accepts a month (YYYY-MM) including the current month.
 * Defaults to previous month if no month specified.
 */
async function postHandler(req: NextRequest) {
  const [, authError] = await withAuth("invoices:view");
  if (authError) return authError;

  let body;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues?.[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  // Determine month
  let year: number;
  let month: number;

  if (parsed.data.month) {
    const [y, m] = parsed.data.month.split("-").map(Number);
    year = y;
    month = m;
  } else {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    year = prev.getFullYear();
    month = prev.getMonth() + 1;
  }

  const periodStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0);
  const periodEnd = lastDay.toISOString().split("T")[0];
  const invoiceNumber = `INV-${year}-${String(month).padStart(2, "0")}`;

  // Check if already exists
  const [existing] = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(eq(invoices.invoiceNumber, invoiceNumber))
    .limit(1);

  if (existing) {
    return NextResponse.json(
      { error: `Invoice ${invoiceNumber} already exists` },
      { status: 409 }
    );
  }

  // Count classes per orphanage
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

  const RATE = 300000;
  let totalClasses = 0;
  let totalAmountIdr = 0;

  const lineItemsData = classCounts.map((row) => {
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

  const [invoice] = await db
    .insert(invoices)
    .values({
      invoiceNumber,
      periodStart,
      periodEnd,
      fromEntity: "TransforMe Academy",
      toEntity: "White Light Ventures, Inc",
      totalClasses,
      totalAmountIdr,
      ratePerClassIdr: RATE,
      status: "draft",
    })
    .returning();

  if (lineItemsData.length > 0) {
    await db.insert(invoiceLineItems).values(
      lineItemsData.map((li) => ({
        invoiceId: invoice.id,
        orphanageId: li.orphanageId,
        orphanageName: li.orphanageName,
        classCount: li.classCount,
        ratePerClassIdr: li.ratePerClassIdr,
        subtotalIdr: li.subtotalIdr,
      }))
    );
  }

  logger.info("invoice", `Generated ${invoiceNumber} (draft)`, {
    totalClasses,
    totalAmountIdr,
  });

  return NextResponse.json({
    invoice: { id: invoice.id, invoiceNumber, totalClasses, totalAmountIdr },
  }, { status: 201 });
}

export const POST = withLogging(postHandler, { source: "invoices:generate" });
