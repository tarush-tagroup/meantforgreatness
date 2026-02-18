import { NextRequest, NextResponse } from "next/server";
import { createPayPalOrder } from "@/lib/paypal";
import { getPaymentConfig } from "@/lib/site-settings";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    // Check if PayPal is enabled
    const config = await getPaymentConfig();
    if (!config.paypalEnabled) {
      return NextResponse.json(
        { error: "PayPal is not currently enabled." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { amount, frequency } = body;

    // Validate amount
    if (typeof amount !== "number" || !isFinite(amount)) {
      return NextResponse.json(
        { error: "Invalid donation amount." },
        { status: 400 }
      );
    }

    if (amount < 1) {
      return NextResponse.json(
        { error: "Minimum donation is $1." },
        { status: 400 }
      );
    }

    if (amount > 10000) {
      return NextResponse.json(
        { error: "For donations over $10,000, please contact us directly." },
        { status: 400 }
      );
    }

    // Validate frequency
    if (
      frequency !== "one_time" &&
      frequency !== "monthly" &&
      frequency !== "yearly"
    ) {
      return NextResponse.json(
        { error: "Invalid donation frequency." },
        { status: 400 }
      );
    }

    const { id, approvalUrl } = await createPayPalOrder(amount, frequency);

    logger.info("paypal:checkout", "PayPal order created", {
      orderId: id,
      amount,
      frequency,
    });

    return NextResponse.json({ id, approvalUrl });
  } catch (err) {
    logger.error("paypal:checkout", "Failed to create PayPal order", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "An error occurred creating the PayPal order.",
      },
      { status: 500 }
    );
  }
}
