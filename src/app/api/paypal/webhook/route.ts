import { NextRequest, NextResponse } from "next/server";
import { verifyPayPalWebhook } from "@/lib/paypal";
import { db } from "@/db";
import { donations, donors } from "@/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { createMagicLoginToken } from "@/lib/donor-auth";
import { sendDonorWelcomeEmail } from "@/lib/email/donor-welcome";

export async function POST(req: NextRequest) {
  const body = await req.text();
  let event: Record<string, unknown>;

  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Verify webhook signature (skip in development)
  if (process.env.NODE_ENV === "production") {
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    const verified = await verifyPayPalWebhook(headers, body);
    if (!verified) {
      logger.error("webhook:paypal", "Webhook signature verification failed");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }
  }

  const eventType = event.event_type as string;

  logger.info("webhook:paypal", "Received PayPal webhook", {
    eventType,
    id: event.id,
  });

  try {
    switch (eventType) {
      case "PAYMENT.CAPTURE.COMPLETED":
        await handlePaymentCaptured(event);
        break;

      case "BILLING.SUBSCRIPTION.ACTIVATED":
        await handleSubscriptionActivated(event);
        break;

      case "PAYMENT.SALE.COMPLETED":
        await handleSubscriptionPayment(event);
        break;

      case "BILLING.SUBSCRIPTION.CANCELLED":
      case "BILLING.SUBSCRIPTION.SUSPENDED":
        await handleSubscriptionEnded(event);
        break;

      default:
        logger.info("webhook:paypal", `Unhandled event type: ${eventType}`);
    }
  } catch (err) {
    logger.error("webhook:paypal", "Error processing webhook", {
      eventType,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return NextResponse.json({ received: true });
}

/**
 * Handle one-time payment captured (from direct checkout).
 * Note: Most one-time donations are captured in the capture-order route.
 * This handles edge cases where capture completes asynchronously.
 */
async function handlePaymentCaptured(event: Record<string, unknown>) {
  const resource = event.resource as Record<string, unknown>;
  const captureId = resource?.id as string;

  logger.info("webhook:paypal", "Payment capture completed", { captureId });
  // One-time payments are typically recorded in the capture-order API route.
  // This webhook serves as a backup confirmation.
}

/**
 * Handle recurring subscription activated.
 */
async function handleSubscriptionActivated(event: Record<string, unknown>) {
  const resource = event.resource as Record<string, unknown>;
  const subscriptionId = resource?.id as string;
  const customId = resource?.custom_id as string;
  const subscriber = resource?.subscriber as Record<string, unknown>;

  let frequency = "monthly";
  try {
    const parsed = JSON.parse(customId || "{}");
    frequency = parsed.frequency || "monthly";
  } catch {
    // ignore parse error
  }

  const email =
    (subscriber?.email_address as string) || "";
  const name = [
    (subscriber?.name as Record<string, string>)?.given_name,
    (subscriber?.name as Record<string, string>)?.surname,
  ]
    .filter(Boolean)
    .join(" ");

  const billingInfo = resource?.billing_info as Record<string, unknown>;
  const lastPayment = billingInfo?.last_payment as Record<string, unknown>;
  const amountValue = (lastPayment?.amount as Record<string, string>)?.value;
  const amountInCents = amountValue ? Math.round(parseFloat(amountValue) * 100) : 0;

  logger.info("webhook:paypal", "Subscription activated", {
    subscriptionId,
    email,
    frequency,
    amount: amountInCents,
  });

  if (email && amountInCents > 0) {
    // Record donation
    await db.insert(donations).values({
      donorEmail: email,
      donorName: name,
      amount: amountInCents,
      currency: "usd",
      frequency,
      status: "completed",
      provider: "paypal",
      stripeSubscriptionId: `paypal_sub_${subscriptionId}`,
      stripeSessionId: `paypal_sub_init_${subscriptionId}`,
      metadata: { paypalSubscriptionId: subscriptionId },
    });

    // Create donor account & send welcome email
    await createDonorAndSendWelcome(email, name, frequency);
  }
}

/**
 * Handle recurring subscription payment (renewal).
 */
async function handleSubscriptionPayment(event: Record<string, unknown>) {
  const resource = event.resource as Record<string, unknown>;
  const saleId = resource?.id as string;
  const billingAgreementId = resource?.billing_agreement_id as string;
  const amountValue = (resource?.amount as Record<string, string>)?.total;
  const amountInCents = amountValue ? Math.round(parseFloat(amountValue) * 100) : 0;

  logger.info("webhook:paypal", "Subscription payment completed", {
    saleId,
    billingAgreementId,
    amount: amountInCents,
  });

  // Find existing donation with this subscription to get email/frequency
  if (billingAgreementId) {
    const [existing] = await db
      .select()
      .from(donations)
      .where(
        eq(
          donations.stripeSubscriptionId,
          `paypal_sub_${billingAgreementId}`
        )
      )
      .limit(1);

    if (existing && amountInCents > 0) {
      await db.insert(donations).values({
        donorEmail: existing.donorEmail,
        donorName: existing.donorName,
        amount: amountInCents,
        currency: "usd",
        frequency: existing.frequency,
        status: "completed",
        provider: "paypal",
        stripeSubscriptionId: `paypal_sub_${billingAgreementId}`,
        stripeSessionId: `paypal_sale_${saleId}`,
        metadata: {
          paypalSaleId: saleId,
          paypalSubscriptionId: billingAgreementId,
        },
      });
    }
  }
}

/**
 * Handle subscription cancellation or suspension.
 */
async function handleSubscriptionEnded(event: Record<string, unknown>) {
  const resource = event.resource as Record<string, unknown>;
  const subscriptionId = resource?.id as string;
  const eventType = event.event_type as string;

  logger.info("webhook:paypal", `Subscription ${eventType}`, {
    subscriptionId,
  });

  // We don't need to update existing records — each payment was recorded individually.
  // This is informational for logging/monitoring.
}

/**
 * Helper: create a donor account and send welcome email.
 */
async function createDonorAndSendWelcome(
  email: string,
  name: string,
  frequency: string
) {
  try {
    const [existingDonor] = await db
      .select()
      .from(donors)
      .where(eq(donors.email, email))
      .limit(1);

    let donorId: string;

    if (!existingDonor) {
      const [newDonor] = await db
        .insert(donors)
        .values({ email, name })
        .returning({ id: donors.id });
      donorId = newDonor.id;
    } else {
      donorId = existingDonor.id;
    }

    const magicToken = createMagicLoginToken(donorId, email);
    sendDonorWelcomeEmail({
      to: email,
      donorName: name || "",
      frequency,
      magicLoginToken: magicToken,
    }).catch((err) => {
      logger.error("webhook:paypal", "Failed to send welcome email", {
        email,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  } catch (err) {
    logger.error("webhook:paypal", "Error creating donor account", {
      email,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
