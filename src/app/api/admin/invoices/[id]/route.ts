import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";
import { db } from "@/db";
import {
  invoices,
  invoiceLineItems,
  invoiceMiscItems,
  orphanages,
} from "@/db/schema";
import { eq, asc, sql } from "drizzle-orm";
import { z } from "zod";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  _req: NextRequest,
  context: RouteContext
) {
  const [, authError] = await withAuth("invoices:view");
  if (authError) return authError;

  const { id } = await context.params;

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, id))
    .limit(1);

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const [lineItems, miscItems, allOrphanages] = await Promise.all([
    db
      .select()
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, id))
      .orderBy(asc(invoiceLineItems.orphanageName)),
    db
      .select()
      .from(invoiceMiscItems)
      .where(eq(invoiceMiscItems.invoiceId, id))
      .orderBy(asc(invoiceMiscItems.sortOrder)),
    db
      .select({ id: orphanages.id, name: orphanages.name })
      .from(orphanages)
      .orderBy(asc(orphanages.name)),
  ]);

  return NextResponse.json({ invoice, lineItems, miscItems, allOrphanages });
}

const patchSchema = z.object({
  status: z.enum(["draft", "final"]).optional(),
  lineItems: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        orphanageId: z.string().optional(),
        orphanageName: z.string().optional(),
        classCount: z.number().int().min(0),
      })
    )
    .optional(),
});

/**
 * PATCH /api/admin/invoices/[id]
 *
 * Update invoice status (draft/final) and/or line item class counts.
 */
export async function PATCH(
  req: NextRequest,
  context: RouteContext
) {
  const [, authError] = await withAuth("invoices:view");
  if (authError) return authError;

  const { id } = await context.params;

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, id))
    .limit(1);

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues?.[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const { status, lineItems: lineItemUpdates } = parsed.data;

  // Update line item class counts (update existing or create new)
  if (lineItemUpdates && lineItemUpdates.length > 0) {
    for (const item of lineItemUpdates) {
      const subtotal = item.classCount * invoice.ratePerClassIdr;

      if (item.id) {
        // Update existing line item
        await db
          .update(invoiceLineItems)
          .set({
            classCount: item.classCount,
            subtotalIdr: subtotal,
          })
          .where(eq(invoiceLineItems.id, item.id));
      } else if (item.orphanageId && item.orphanageName) {
        // Create new line item for orphanage not yet on invoice
        await db.insert(invoiceLineItems).values({
          invoiceId: id,
          orphanageId: item.orphanageId,
          orphanageName: item.orphanageName,
          classCount: item.classCount,
          ratePerClassIdr: invoice.ratePerClassIdr,
          subtotalIdr: subtotal,
        });
      }
    }

    // Recalculate invoice totals from line items
    const [totals] = await db
      .select({
        totalClasses: sql<number>`coalesce(sum(${invoiceLineItems.classCount}), 0)::int`,
        totalAmountIdr: sql<number>`coalesce(sum(${invoiceLineItems.subtotalIdr}), 0)::int`,
      })
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, id));

    // Also get misc totals
    const [miscTotals] = await db
      .select({
        miscTotalIdr: sql<number>`coalesce(sum(${invoiceMiscItems.subtotalIdr}), 0)::int`,
      })
      .from(invoiceMiscItems)
      .where(eq(invoiceMiscItems.invoiceId, id));

    await db
      .update(invoices)
      .set({
        totalClasses: totals.totalClasses,
        totalAmountIdr: totals.totalAmountIdr + (miscTotals?.miscTotalIdr || 0),
        miscTotalIdr: miscTotals?.miscTotalIdr || 0,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, id));
  }

  // Update status
  if (status) {
    await db
      .update(invoices)
      .set({ status, updatedAt: new Date() })
      .where(eq(invoices.id, id));

    logger.info("invoice", `Invoice ${invoice.invoiceNumber} status changed to ${status}`);
  }

  // Return updated invoice
  const [updated] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, id))
    .limit(1);

  return NextResponse.json({ invoice: updated });
}

/**
 * DELETE /api/admin/invoices/[id]
 *
 * Delete an invoice and all its line items (cascade).
 */
export async function DELETE(
  _req: NextRequest,
  context: RouteContext
) {
  const [, authError] = await withAuth("invoices:view");
  if (authError) return authError;

  const { id } = await context.params;

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, id))
    .limit(1);

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  await db.delete(invoices).where(eq(invoices.id, id));

  logger.info("invoice", `Deleted invoice ${invoice.invoiceNumber}`);

  return NextResponse.json({ success: true });
}
