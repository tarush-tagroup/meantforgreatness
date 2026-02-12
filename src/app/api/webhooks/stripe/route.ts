import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { db } from "@/db";
import { donations } from "@/db/schema";
import { eq } from "drizzle-orm";

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
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice);
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        await handleChargeRefunded(charge);
        break;
      }
      default:
        // Unhandled event type — acknowledge it
        break;
    }
  } catch (err) {
    console.error(`Error handling ${event.type}:`, err);
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
    console.error("Error processing refund:", err);
  }
}
