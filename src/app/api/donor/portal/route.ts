import { NextResponse } from "next/server";
import { db } from "@/db";
import { donors } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getDonorFromCookie } from "@/lib/donor-auth";
import { getStripe } from "@/lib/stripe";
import { logger } from "@/lib/logger";

export async function POST() {
  const session = await getDonorFromCookie();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [donor] = await db
    .select({ stripeCustomerId: donors.stripeCustomerId })
    .from(donors)
    .where(eq(donors.id, session.donorId))
    .limit(1);

  if (!donor?.stripeCustomerId) {
    return NextResponse.json(
      { error: "No Stripe account linked. Please make a donation first." },
      { status: 400 }
    );
  }

  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || "https://www.meantforgreatness.org";

    const portalSession = await getStripe().billingPortal.sessions.create({
      customer: donor.stripeCustomerId,
      return_url: `${baseUrl}/donor`,
    });

    logger.info("donor:portal", "Stripe portal session created", {
      email: session.email,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err) {
    logger.error("donor:portal", "Error creating portal session", {
      email: session.email,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
}
