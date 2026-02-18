import { logger } from "@/lib/logger";

const PAYPAL_API_BASE =
  process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

/**
 * Get a PayPal access token via client credentials grant.
 */
async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials not configured");
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error("paypal", "Failed to get access token", { status: res.status, body: text });
    throw new Error(`PayPal auth failed: ${res.status}`);
  }

  const data = await res.json();
  return data.access_token;
}

/**
 * Create a PayPal order for a one-time donation.
 */
export async function createPayPalOrder(
  amount: number,
  frequency: string
): Promise<{ id: string; approvalUrl: string }> {
  const accessToken = await getPayPalAccessToken();
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "https://www.meantforgreatness.org";

  if (frequency === "monthly" || frequency === "yearly") {
    // Create a subscription via PayPal billing
    return createPayPalSubscription(accessToken, amount, frequency, baseUrl);
  }

  // One-time payment — create an order
  const res = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value: amount.toFixed(2),
          },
          description: "Meant for Greatness — One-time Donation",
          custom_id: JSON.stringify({ frequency: "one_time" }),
        },
      ],
      application_context: {
        brand_name: "Meant for Greatness",
        landing_page: "NO_PREFERENCE",
        user_action: "PAY_NOW",
        return_url: `${baseUrl}/donate/success?provider=paypal`,
        cancel_url: `${baseUrl}/donate`,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error("paypal", "Failed to create order", { status: res.status, body: text });
    throw new Error(`PayPal order creation failed: ${res.status}`);
  }

  const order = await res.json();
  const approvalLink = order.links?.find(
    (l: { rel: string; href: string }) => l.rel === "approve"
  );

  if (!approvalLink) {
    throw new Error("PayPal order created but no approval URL found");
  }

  logger.info("paypal", "Order created", { orderId: order.id, frequency: "one_time" });

  return { id: order.id, approvalUrl: approvalLink.href };
}

/**
 * Create a PayPal billing subscription for recurring donations.
 */
async function createPayPalSubscription(
  accessToken: string,
  amount: number,
  frequency: string,
  baseUrl: string
): Promise<{ id: string; approvalUrl: string }> {
  const interval = frequency === "yearly" ? "YEAR" : "MONTH";
  const label = frequency === "yearly" ? "Yearly" : "Monthly";

  // Step 1: Create a product
  const productRes = await fetch(`${PAYPAL_API_BASE}/v1/catalogs/products`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: `Meant for Greatness — ${label} Donation`,
      type: "SERVICE",
      category: "CHARITY",
    }),
  });

  if (!productRes.ok) {
    const text = await productRes.text();
    logger.error("paypal", "Failed to create product", { status: productRes.status, body: text });
    throw new Error(`PayPal product creation failed: ${productRes.status}`);
  }

  const product = await productRes.json();

  // Step 2: Create a billing plan
  const planRes = await fetch(`${PAYPAL_API_BASE}/v1/billing/plans`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      product_id: product.id,
      name: `$${amount} ${label} Donation`,
      billing_cycles: [
        {
          frequency: {
            interval_unit: interval,
            interval_count: 1,
          },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0, // infinite
          pricing_scheme: {
            fixed_price: {
              value: amount.toFixed(2),
              currency_code: "USD",
            },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        payment_failure_threshold: 3,
      },
    }),
  });

  if (!planRes.ok) {
    const text = await planRes.text();
    logger.error("paypal", "Failed to create plan", { status: planRes.status, body: text });
    throw new Error(`PayPal plan creation failed: ${planRes.status}`);
  }

  const plan = await planRes.json();

  // Step 3: Create subscription
  const subRes = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      plan_id: plan.id,
      custom_id: JSON.stringify({ frequency }),
      application_context: {
        brand_name: "Meant for Greatness",
        user_action: "SUBSCRIBE_NOW",
        return_url: `${baseUrl}/donate/success?provider=paypal&subscription=true`,
        cancel_url: `${baseUrl}/donate`,
      },
    }),
  });

  if (!subRes.ok) {
    const text = await subRes.text();
    logger.error("paypal", "Failed to create subscription", { status: subRes.status, body: text });
    throw new Error(`PayPal subscription creation failed: ${subRes.status}`);
  }

  const subscription = await subRes.json();
  const approvalLink = subscription.links?.find(
    (l: { rel: string; href: string }) => l.rel === "approve"
  );

  if (!approvalLink) {
    throw new Error("PayPal subscription created but no approval URL found");
  }

  logger.info("paypal", "Subscription created", {
    subscriptionId: subscription.id,
    planId: plan.id,
    frequency,
  });

  return { id: subscription.id, approvalUrl: approvalLink.href };
}

/**
 * Capture a PayPal order (one-time payment) after buyer approval.
 */
export async function capturePayPalOrder(
  orderId: string
): Promise<{
  id: string;
  status: string;
  payer: { email: string; name: string };
  amount: number;
}> {
  const accessToken = await getPayPalAccessToken();

  const res = await fetch(
    `${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    logger.error("paypal", "Failed to capture order", { orderId, status: res.status, body: text });
    throw new Error(`PayPal capture failed: ${res.status}`);
  }

  const capture = await res.json();
  const captureDetails =
    capture.purchase_units?.[0]?.payments?.captures?.[0];

  const payerEmail =
    capture.payer?.email_address || capture.payment_source?.paypal?.email_address || "";
  const payerName = [
    capture.payer?.name?.given_name,
    capture.payer?.name?.surname,
  ]
    .filter(Boolean)
    .join(" ");

  logger.info("paypal", "Order captured", {
    orderId,
    captureId: captureDetails?.id,
    status: capture.status,
  });

  return {
    id: capture.id,
    status: capture.status,
    payer: { email: payerEmail, name: payerName },
    amount: parseFloat(captureDetails?.amount?.value || "0"),
  };
}

/**
 * Verify a PayPal webhook signature.
 */
export async function verifyPayPalWebhook(
  headers: Record<string, string>,
  body: string
): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    logger.error("paypal", "PAYPAL_WEBHOOK_ID not configured");
    return false;
  }

  const accessToken = await getPayPalAccessToken();

  const res = await fetch(
    `${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auth_algo: headers["paypal-auth-algo"],
        cert_url: headers["paypal-cert-url"],
        transmission_id: headers["paypal-transmission-id"],
        transmission_sig: headers["paypal-transmission-sig"],
        transmission_time: headers["paypal-transmission-time"],
        webhook_id: webhookId,
        webhook_event: JSON.parse(body),
      }),
    }
  );

  if (!res.ok) {
    logger.error("paypal", "Webhook verification request failed", {
      status: res.status,
    });
    return false;
  }

  const result = await res.json();
  return result.verification_status === "SUCCESS";
}
