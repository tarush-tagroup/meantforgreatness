import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { timingSafeEqual } from "@/lib/timing-safe";

/**
 * POST /api/webhooks/resend
 *
 * Resend webhook endpoint for email delivery tracking.
 * Logs all email events (delivered, bounced, complained, etc.)
 * to centralized Vercel Blob logs.
 *
 * Configure in Resend dashboard:
 *   Webhook URL: https://www.meantforgreatness.org/api/webhooks/resend
 *   Events: all
 *   Signing secret: RESEND_WEBHOOK_SECRET env var
 *
 * Resend webhook payload: https://resend.com/docs/dashboard/webhooks/introduction
 */

interface ResendWebhookEvent {
  type: string;
  created_at: string;
  data: {
    email_id?: string;
    from?: string;
    to?: string[];
    subject?: string;
    created_at?: string;
    // Bounce/complaint specific
    bounce?: {
      message?: string;
      type?: string;
    };
    // Click/open specific
    click?: {
      link?: string;
    };
  };
}

/** Log a webhook event and return response */
function processEvent(event: ResendWebhookEvent): NextResponse {
  const { type, data } = event;
  const to = data.to?.join(", ") || "unknown";
  const subject = data.subject || "unknown";

  switch (type) {
    case "email.sent":
      logger.info("webhook:resend", "Email sent", {
        emailId: data.email_id,
        to,
        subject,
      });
      break;

    case "email.delivered":
      logger.info("webhook:resend", "Email delivered", {
        emailId: data.email_id,
        to,
        subject,
      });
      break;

    case "email.delivery_delayed":
      logger.warn("webhook:resend", "Email delivery delayed", {
        emailId: data.email_id,
        to,
        subject,
      });
      break;

    case "email.bounced":
      logger.error("webhook:resend", "Email bounced", {
        emailId: data.email_id,
        to,
        subject,
        bounceType: data.bounce?.type,
        bounceMessage: data.bounce?.message,
      });
      break;

    case "email.complained":
      logger.error("webhook:resend", "Email complaint (spam report)", {
        emailId: data.email_id,
        to,
        subject,
      });
      break;

    case "email.opened":
      logger.info("webhook:resend", "Email opened", {
        emailId: data.email_id,
        to,
        subject,
      });
      break;

    case "email.clicked":
      logger.info("webhook:resend", "Email link clicked", {
        emailId: data.email_id,
        to,
        subject,
        link: data.click?.link,
      });
      break;

    default:
      logger.info("webhook:resend", `Unhandled event type: ${type}`, {
        emailId: data.email_id,
      });
      break;
  }

  return NextResponse.json({ received: true });
}

export async function POST(req: NextRequest) {
  // Verify webhook signature if secret is configured
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (webhookSecret) {
    const svixId = req.headers.get("svix-id");
    const svixTimestamp = req.headers.get("svix-timestamp");
    const svixSignature = req.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      logger.error("webhook:resend", "Missing Svix signature headers");
      return NextResponse.json(
        { error: "Missing signature headers" },
        { status: 400 }
      );
    }

    // Verify timestamp is recent (within 5 minutes) to prevent replay attacks
    const timestampSeconds = parseInt(svixTimestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (isNaN(timestampSeconds) || Math.abs(now - timestampSeconds) > 300) {
      logger.error("webhook:resend", "Webhook timestamp too old or invalid");
      return NextResponse.json(
        { error: "Invalid timestamp" },
        { status: 400 }
      );
    }

    // Verify HMAC-SHA256 signature (Svix format)
    // Svix signs: "{svixId}.{timestamp}.{body}"
    const bodyText = await req.text();
    const signedContent = `${svixId}.${svixTimestamp}.${bodyText}`;

    // Svix webhook secrets are base64-encoded with "whsec_" prefix
    const secretBytes = Buffer.from(webhookSecret.replace("whsec_", ""), "base64");
    const { createHmac } = await import("crypto");
    const expectedSig = createHmac("sha256", secretBytes)
      .update(signedContent)
      .digest("base64");

    // Svix sends multiple signatures separated by spaces, each prefixed with "v1,"
    // Use timing-safe comparison to prevent timing attacks
    const signatures = svixSignature.split(" ");
    const isValid = signatures.some((sig) => {
      const sigValue = sig.replace("v1,", "");
      return timingSafeEqual(sigValue, expectedSig);
    });

    if (!isValid) {
      logger.error("webhook:resend", "Invalid webhook signature");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Parse the body we already read
    let event: ResendWebhookEvent;
    try {
      event = JSON.parse(bodyText);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    // Process the verified event
    return processEvent(event);
  }

  // No webhook secret configured — accept without verification (dev mode)
  let event: ResendWebhookEvent;
  try {
    event = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  return processEvent(event);
}
