import { NextResponse } from "next/server";
import { db } from "@/db";
import { donors } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getDonorFromCookie } from "@/lib/donor-auth";

export async function GET() {
  const session = await getDonorFromCookie();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [donor] = await db
    .select({
      id: donors.id,
      email: donors.email,
      name: donors.name,
      stripeCustomerId: donors.stripeCustomerId,
    })
    .from(donors)
    .where(eq(donors.id, session.donorId))
    .limit(1);

  if (!donor) {
    return NextResponse.json({ error: "Donor not found" }, { status: 404 });
  }

  return NextResponse.json({
    donor: {
      id: donor.id,
      email: donor.email,
      name: donor.name,
      hasStripeCustomer: !!donor.stripeCustomerId,
    },
  });
}
