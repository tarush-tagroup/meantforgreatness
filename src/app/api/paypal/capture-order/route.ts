import { NextRequest, NextResponse } from "next/server";
import { capturePayPalOrder } from "@/lib/paypal";
import { db } from "@/db";
import { donations, donors } from "@/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { createMagicLoginToken } from "@/lib/donor-auth";
import { sendDonorWelcomeEmail } from "@/lib/email/donor-welcome";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, frequency } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: "Missing orderId" },
        { status: 400 }
      );
    }

    const result = await capturePayPalOrder(orderId);

    if (result.status !== "COMPLETED") {
      return NextResponse.json(
        { error: `Payment not completed. Status: ${result.status}` },
        { status: 400 }
      );
    }

    const donorEmail = result.payer.email;
    const donorName = result.payer.name;
    const amountInCents = Math.round(result.amount * 100);
    const donationFrequency = frequency || "one_time";

    // Record the donation
    await db.insert(donations).values({
      donorEmail,
      donorName,
      amount: amountInCents,
      currency: "usd",
      frequency: donationFrequency,
      status: "completed",
      provider: "paypal",
      stripeSessionId: `paypal_${orderId}`, // Use PayPal order ID with prefix
      metadata: { paypalOrderId: orderId, captureStatus: result.status },
    });

    logger.info("paypal:capture", "PayPal payment captured and recorded", {
      orderId,
      email: donorEmail,
      amount: amountInCents,
      frequency: donationFrequency,
    });

    // Create or find donor account
    if (donorEmail) {
      try {
        const [existingDonor] = await db
          .select()
          .from(donors)
          .where(eq(donors.email, donorEmail))
          .limit(1);

        let donorId: string;

        if (!existingDonor) {
          const [newDonor] = await db
            .insert(donors)
            .values({ email: donorEmail, name: donorName })
            .returning({ id: donors.id });
          donorId = newDonor.id;
        } else {
          donorId = existingDonor.id;
        }

        // Send welcome email
        const magicToken = createMagicLoginToken(donorId, donorEmail);
        sendDonorWelcomeEmail({
          to: donorEmail,
          donorName: donorName || "",
          frequency: donationFrequency,
          magicLoginToken: magicToken,
        }).catch((err) => {
          logger.error("paypal:capture", "Failed to send welcome email", {
            email: donorEmail,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      } catch (err) {
        logger.error("paypal:capture", "Error creating donor account", {
          email: donorEmail,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return NextResponse.json({
      success: true,
      orderId: result.id,
    });
  } catch (err) {
    logger.error("paypal:capture", "Failed to capture PayPal order", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "An error occurred capturing the payment.",
      },
      { status: 500 }
    );
  }
}
