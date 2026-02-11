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

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
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
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: price.id, quantity: 1 }],
        success_url: `${baseUrl}/donate/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/donate`,
      });

      return NextResponse.json({ url: session.url });
    } else {
      // One-time payment
      const session = await getStripe().checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
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

      return NextResponse.json({ url: session.url });
    }
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json(
      { error: "An error occurred creating the checkout session." },
      { status: 500 }
    );
  }
}
