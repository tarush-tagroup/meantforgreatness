import { NextResponse } from "next/server";
import { getPaymentConfig } from "@/lib/site-settings";

/**
 * Public endpoint — returns which payment providers are enabled.
 * Called by the DonationForm on mount.
 */
export async function GET() {
  try {
    const config = await getPaymentConfig();
    return NextResponse.json(config);
  } catch {
    // Default to Stripe-only if settings table doesn't exist yet
    return NextResponse.json({ stripeEnabled: true, paypalEnabled: false });
  }
}
