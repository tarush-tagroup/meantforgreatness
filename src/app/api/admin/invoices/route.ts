import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { desc, sql } from "drizzle-orm";
import { withLogging } from "@/lib/with-logging";

async function getHandler(req: NextRequest) {
  const [, authError] = await withAuth("invoices:view");
  if (authError) return authError;

  const url = req.nextUrl;
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "25")));
  const offset = (page - 1) * limit;

  const rows = await db
    .select()
    .from(invoices)
    .orderBy(desc(invoices.periodStart))
    .limit(limit)
    .offset(offset);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(invoices);

  const total = Number(countResult?.count || 0);

  // Stats
  const [stats] = await db
    .select({
      totalInvoices: sql<number>`count(*)::int`,
      totalClasses: sql<number>`coalesce(sum(${invoices.totalClasses}), 0)::int`,
      totalAmountIdr: sql<number>`coalesce(sum(${invoices.totalAmountIdr}), 0)::bigint`,
    })
    .from(invoices);

  return NextResponse.json({
    invoices: rows,
    stats: {
      totalInvoices: Number(stats?.totalInvoices || 0),
      totalClasses: Number(stats?.totalClasses || 0),
      totalAmountIdr: Number(stats?.totalAmountIdr || 0),
    },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export const GET = withLogging(getHandler, { source: "invoices" });
