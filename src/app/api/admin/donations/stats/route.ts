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

  // Monthly recurring total (active monthly subscriptions)
  const [monthlyResult] = await db
    .select({
      total: sql<number>`COALESCE(SUM(amount), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(donations)
    .where(
      and(
        eq(donations.status, "completed"),
        eq(donations.frequency, "monthly")
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
      monthlyRecurring: Number(monthlyResult?.total || 0),
      monthlyCount: Number(monthlyResult?.count || 0),
      oneTimeTotal: Number(oneTimeResult?.total || 0),
      oneTimeCount: Number(oneTimeResult?.count || 0),
      uniqueDonors: Number(donorCount?.count || 0),
    },
  });
}
