import { NextResponse } from "next/server";
import { db } from "@/db";
import { donations } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getDonorFromCookie } from "@/lib/donor-auth";

export async function GET() {
  const session = await getDonorFromCookie();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      id: donations.id,
      amount: donations.amount,
      currency: donations.currency,
      frequency: donations.frequency,
      status: donations.status,
      createdAt: donations.createdAt,
    })
    .from(donations)
    .where(eq(donations.donorEmail, session.email))
    .orderBy(desc(donations.createdAt))
    .limit(100);

  return NextResponse.json({ donations: rows });
}
