import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";
import { db } from "@/db";
import { donations } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

export async function GET() {
  const [, authError] = await withAuth("donations:view");
  if (authError) return authError;

  // Total raised (completed donations only)
  const [totalResult] = await db
    .select({
      total: sql<number>`COALESCE(SUM(amount), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(donations)
    .where(eq(donations.status, "completed"));

  // Recurring total (monthly + yearly subscriptions)
  const [recurringResult] = await db
    .select({
      total: sql<number>`COALESCE(SUM(amount), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(donations)
    .where(
      and(
        eq(donations.status, "completed"),
        sql`${donations.frequency} IN ('monthly', 'yearly')`
      )
    );

  // One-time donations total
  const [oneTimeResult] = await db
    .select({
      total: sql<number>`COALESCE(SUM(amount), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(donations)
    .where(
      and(
        eq(donations.status, "completed"),
        eq(donations.frequency, "one_time")
      )
    );

  // Unique donors
  const [donorCount] = await db
    .select({
      count: sql<number>`COUNT(DISTINCT donor_email)`,
    })
    .from(donations)
    .where(eq(donations.status, "completed"));

  return NextResponse.json({
    stats: {
      totalRaised: Number(totalResult?.total || 0),
      totalDonations: Number(totalResult?.count || 0),
      recurringTotal: Number(recurringResult?.total || 0),
      recurringCount: Number(recurringResult?.count || 0),
      // Keep old keys for backwards compatibility
      monthlyRecurring: Number(recurringResult?.total || 0),
      monthlyCount: Number(recurringResult?.count || 0),
      oneTimeTotal: Number(oneTimeResult?.total || 0),
      oneTimeCount: Number(oneTimeResult?.count || 0),
      uniqueDonors: Number(donorCount?.count || 0),
    },
  });
}
