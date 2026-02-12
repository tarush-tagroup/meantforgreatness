import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
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
    if (frequency !== "one_time" && frequency !== "monthly") {
      return NextResponse.json(
        { error: "Invalid donation frequency." },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.meantforgreatness.org";
    const amountInCents = Math.round(amount * 100);

    if (frequency === "monthly") {
      // Create a recurring subscription checkout
      const price = await getStripe().prices.create({
        unit_amount: amountInCents,
        currency: "usd",
        recurring: { interval: "month" },
        product_data: {
          name: "Meant for Greatness — Monthly Donation",
        },
      });

      const session = await getStripe().checkout.sessions.create({
        ui_mode: "hosted",
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: price.id, quantity: 1 }],
        success_url: `${baseUrl}/donate/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/donate`,
      });

      console.log("Stripe session created:", { id: session.id, url: session.url, status: session.status });

      if (!session.url) {
        return NextResponse.json(
          { error: `Checkout session ${session.id} created (status: ${session.status}) but no URL returned.` },
          { status: 500 }
        );
      }

      return NextResponse.json({ url: session.url });
    } else {
      // One-time payment
      const session = await getStripe().checkout.sessions.create({
        ui_mode: "hosted",
        mode: "payment",
        payment_method_types: ["card"],
        customer_creation: "always",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "Meant for Greatness — One-time Donation",
              },
              unit_amount: amountInCents,
            },
            quantity: 1,
          },
        ],
        success_url: `${baseUrl}/donate/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/donate`,
      });

      console.log("Stripe session created:", { id: session.id, url: session.url, status: session.status });

      if (!session.url) {
        return NextResponse.json(
          { error: `Checkout session ${session.id} created (status: ${session.status}) but no URL returned.` },
          { status: 500 }
        );
      }

      return NextResponse.json({ url: session.url });
    }
  } catch (err) {
    console.error("Checkout error:", err);

    // Return Stripe-specific error details for debugging
    if (err instanceof Error && "type" in err) {
      const stripeErr = err as { type: string; code?: string; message: string };
      return NextResponse.json(
        { error: stripeErr.message, code: stripeErr.code, type: stripeErr.type },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "An error occurred creating the checkout session." },
      { status: 500 }
    );
  }
}
