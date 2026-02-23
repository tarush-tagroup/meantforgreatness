import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";
import { db } from "@/db";
import { invoices, invoiceMiscItems, invoiceLineItems } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const addMiscSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().int().min(1),
  rateIdr: z.number().int().min(0),
});

/**
 * POST /api/admin/invoices/[id]/misc-items
 *
 * Add a misc line item to an invoice.
 */
export async function POST(
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
  const parsed = addMiscSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues?.[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const { description, quantity, rateIdr } = parsed.data;
  const subtotalIdr = quantity * rateIdr;

  // Get current max sortOrder
  const [maxSort] = await db
    .select({ max: sql<number>`coalesce(max(${invoiceMiscItems.sortOrder}), 0)::int` })
    .from(invoiceMiscItems)
    .where(eq(invoiceMiscItems.invoiceId, id));

  const [item] = await db
    .insert(invoiceMiscItems)
    .values({
      invoiceId: id,
      description,
      quantity,
      rateIdr,
      subtotalIdr,
      sortOrder: (maxSort?.max || 0) + 1,
    })
    .returning();

  // Recalculate invoice totals
  await recalculateInvoiceTotals(id);

  return NextResponse.json({ item }, { status: 201 });
}

/**
 * DELETE /api/admin/invoices/[id]/misc-items
 *
 * Delete a misc item by ID (passed in body).
 */
export async function DELETE(
  req: NextRequest,
  context: RouteContext
) {
  const [, authError] = await withAuth("invoices:view");
  if (authError) return authError;

  const { id } = await context.params;
  const body = await req.json();
  const itemId = body.itemId;

  if (!itemId) {
    return NextResponse.json({ error: "itemId required" }, { status: 400 });
  }

  await db
    .delete(invoiceMiscItems)
    .where(eq(invoiceMiscItems.id, itemId));

  // Recalculate invoice totals
  await recalculateInvoiceTotals(id);

  return NextResponse.json({ success: true });
}

async function recalculateInvoiceTotals(invoiceId: string) {
  const [lineTotals] = await db
    .select({
      totalClasses: sql<number>`coalesce(sum(${invoiceLineItems.classCount}), 0)::int`,
      classAmountIdr: sql<number>`coalesce(sum(${invoiceLineItems.subtotalIdr}), 0)::int`,
    })
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.invoiceId, invoiceId));

  const [miscTotals] = await db
    .select({
      miscTotalIdr: sql<number>`coalesce(sum(${invoiceMiscItems.subtotalIdr}), 0)::int`,
    })
    .from(invoiceMiscItems)
    .where(eq(invoiceMiscItems.invoiceId, invoiceId));

  const miscTotal = miscTotals?.miscTotalIdr || 0;
  const classAmount = lineTotals?.classAmountIdr || 0;

  await db
    .update(invoices)
    .set({
      totalClasses: lineTotals?.totalClasses || 0,
      totalAmountIdr: classAmount + miscTotal,
      miscTotalIdr: miscTotal,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId));
}
