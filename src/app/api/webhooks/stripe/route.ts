import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { db } from "@/db";
import { donations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error("webhook:stripe", "STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    logger.error("webhook:stripe", "Webhook signature verification failed", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      // ─── Payment Success Events ─────────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        logger.info("webhook:stripe", "Checkout session completed", {
          sessionId: session.id,
          mode: session.mode,
          amount: session.amount_total,
          email: session.customer_details?.email,
        });
        await handleCheckoutCompleted(session);
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        logger.info("webhook:stripe", "Invoice paid", {
          invoiceId: invoice.id,
          amount: invoice.amount_paid,
          email: invoice.customer_email,
          billingReason: invoice.billing_reason,
        });
        await handleInvoicePaid(invoice);
        break;
      }

      // ─── Payment Failure Events ─────────────────────────────────────
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        logger.error("webhook:stripe", "Payment failed", {
          paymentIntentId: pi.id,
          amount: pi.amount,
          error: pi.last_payment_error?.message,
          errorCode: pi.last_payment_error?.code,
          email: pi.receipt_email,
        });
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        logger.error("webhook:stripe", "Invoice payment failed", {
          invoiceId: invoice.id,
          amount: invoice.amount_due,
          email: invoice.customer_email,
          attemptCount: invoice.attempt_count,
          nextAttempt: invoice.next_payment_attempt
            ? new Date(invoice.next_payment_attempt * 1000).toISOString()
            : null,
        });
        break;
      }

      // ─── Refund Events ──────────────────────────────────────────────
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        logger.info("webhook:stripe", "Charge refunded", {
          chargeId: charge.id,
          amount: charge.amount_refunded,
          email: charge.billing_details?.email,
        });
        await handleChargeRefunded(charge);
        break;
      }

      // ─── Dispute Events ─────────────────────────────────────────────
      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        logger.error("webhook:stripe", "Dispute created", {
          disputeId: dispute.id,
          chargeId: typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id,
          amount: dispute.amount,
          reason: dispute.reason,
          status: dispute.status,
        });
        break;
      }
      case "charge.dispute.closed": {
        const dispute = event.data.object as Stripe.Dispute;
        logger.info("webhook:stripe", "Dispute closed", {
          disputeId: dispute.id,
          status: dispute.status,
          reason: dispute.reason,
        });
        break;
      }

      // ─── Subscription Lifecycle Events ──────────────────────────────
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        logger.warn("webhook:stripe", "Subscription cancelled", {
          subscriptionId: sub.id,
          customerId: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
          canceledAt: sub.canceled_at
            ? new Date(sub.canceled_at * 1000).toISOString()
            : null,
          cancellationReason: (sub as unknown as Record<string, unknown>).cancellation_details
            ? ((sub as unknown as Record<string, unknown>).cancellation_details as Record<string, unknown>)?.reason
            : null,
        });
        // Update donation records for this subscription
        if (sub.id) {
          await db
            .update(donations)
            .set({ status: "cancelled", updatedAt: new Date() })
            .where(eq(donations.stripeSubscriptionId, sub.id));
        }
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        logger.info("webhook:stripe", "Subscription updated", {
          subscriptionId: sub.id,
          status: sub.status,
          customerId: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
        });
        break;
      }
      case "customer.subscription.paused": {
        const sub = event.data.object as Stripe.Subscription;
        logger.warn("webhook:stripe", "Subscription paused", {
          subscriptionId: sub.id,
          customerId: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
        });
        break;
      }

      default:
        // Unhandled event type — log for visibility
        logger.info("webhook:stripe", `Unhandled event type: ${event.type}`, {
          eventId: event.id,
        });
        break;
    }
  } catch (err) {
    logger.error("webhook:stripe", `Error handling ${event.type}`, { error: err instanceof Error ? err.message : String(err) });
    // Still return 200 to prevent Stripe from retrying
    // (we log the error for investigation)
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  // Idempotency: check if we already recorded this session
  const [existing] = await db
    .select()
    .from(donations)
    .where(eq(donations.stripeSessionId, session.id))
    .limit(1);

  if (existing) return;

  const isSubscription = session.mode === "subscription";

  await db.insert(donations).values({
    stripeSessionId: session.id,
    stripeCustomerId: session.customer as string | null,
    stripeSubscriptionId: isSubscription
      ? (session.subscription as string | null)
      : null,
    donorEmail: session.customer_details?.email || session.customer_email || "unknown",
    donorName: session.customer_details?.name || null,
    amount: session.amount_total || 0,
    currency: session.currency || "usd",
    frequency: isSubscription ? "monthly" : "one_time",
    status: "completed",
    stripeEventId: null,
    metadata: session.metadata || null,
  });
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // Only handle subscription invoices (recurring payments)
  // In Stripe API v2026, subscription info is in parent.subscription_details
  const subscriptionId =
    invoice.parent?.subscription_details?.subscription;
  if (!subscriptionId) return;

  // Idempotency: use invoice ID as the event key
  const [existing] = await db
    .select()
    .from(donations)
    .where(eq(donations.stripeEventId, invoice.id))
    .limit(1);

  if (existing) return;

  // Skip the first invoice — it's already recorded via checkout.session.completed
  // The billing_reason for the first invoice of a subscription is "subscription_create"
  if (invoice.billing_reason === "subscription_create") return;

  const subId =
    typeof subscriptionId === "string" ? subscriptionId : subscriptionId.id;

  await db.insert(donations).values({
    stripeSessionId: null,
    stripeCustomerId: invoice.customer as string | null,
    stripeSubscriptionId: subId,
    donorEmail: invoice.customer_email || "unknown",
    donorName: invoice.customer_name || null,
    amount: invoice.amount_paid || 0,
    currency: invoice.currency || "usd",
    frequency: "monthly",
    status: "completed",
    stripeEventId: invoice.id,
    metadata: null,
  });
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  // Find the donation by looking up the payment intent's checkout session
  // or by matching the customer and amount
  if (!charge.payment_intent) return;

  // Try to find via Stripe session — the checkout session has a payment_intent
  // We need to look up the session by its payment intent
  try {
    const stripe = getStripe();
    const sessions = await stripe.checkout.sessions.list({
      payment_intent: charge.payment_intent as string,
      limit: 1,
    });

    if (sessions.data.length > 0) {
      const sessionId = sessions.data[0].id;
      await db
        .update(donations)
        .set({ status: "refunded", updatedAt: new Date() })
        .where(eq(donations.stripeSessionId, sessionId));
    }
  } catch (err) {
    logger.error("webhook:stripe", "Error processing refund", { error: err instanceof Error ? err.message : String(err) });
  }
}
