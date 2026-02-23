import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";
import { db } from "@/db";
import { invoices, invoiceMiscItems, invoiceLineItems } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { put } from "@vercel/blob";

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
 * Accepts multipart/form-data with optional receipt file, or JSON body.
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

  let description: string;
  let quantity: number;
  let rateIdr: number;
  let receiptUrl: string | null = null;

  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    // Handle form data with optional receipt file
    const formData = await req.formData();
    description = formData.get("description") as string;
    quantity = parseInt(formData.get("quantity") as string) || 1;
    rateIdr = parseInt(formData.get("rateIdr") as string) || 0;

    const receiptFile = formData.get("receipt") as File | null;
    if (receiptFile && receiptFile.size > 0) {
      // Upload receipt to Vercel Blob
      const ext = receiptFile.name.split(".").pop() || "jpg";
      const filename = `receipts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const blob = await put(filename, receiptFile, {
        access: "public",
        contentType: receiptFile.type,
      });
      receiptUrl = blob.url;
    }
  } else {
    // Handle JSON body
    const body = await req.json();
    const parsed = addMiscSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues?.[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }
    description = parsed.data.description;
    quantity = parsed.data.quantity;
    rateIdr = parsed.data.rateIdr;
  }

  if (!description?.trim() || rateIdr < 0) {
    return NextResponse.json(
      { error: "Description and rate are required" },
      { status: 400 }
    );
  }

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
      description: description.trim(),
      quantity,
      rateIdr,
      subtotalIdr,
      receiptUrl,
      sortOrder: (maxSort?.max || 0) + 1,
    })
    .returning();

  // Recalculate invoice totals
  await recalculateInvoiceTotals(id);

  return NextResponse.json({ item }, { status: 201 });
}

/**
 * PATCH /api/admin/invoices/[id]/misc-items
 *
 * Upload or replace receipt for an existing misc item.
 */
export async function PATCH(
  req: NextRequest,
  context: RouteContext
) {
  const [, authError] = await withAuth("invoices:view");
  if (authError) return authError;

  const { id } = await context.params;

  const formData = await req.formData();
  const itemId = formData.get("itemId") as string;
  const receiptFile = formData.get("receipt") as File | null;

  if (!itemId) {
    return NextResponse.json({ error: "itemId required" }, { status: 400 });
  }

  // Verify invoice exists
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, id))
    .limit(1);

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  let receiptUrl: string | null = null;

  if (receiptFile && receiptFile.size > 0) {
    const ext = receiptFile.name.split(".").pop() || "jpg";
    const filename = `receipts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const blob = await put(filename, receiptFile, {
      access: "public",
      contentType: receiptFile.type,
    });
    receiptUrl = blob.url;
  }

  await db
    .update(invoiceMiscItems)
    .set({ receiptUrl })
    .where(eq(invoiceMiscItems.id, itemId));

  return NextResponse.json({ success: true, receiptUrl });
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
