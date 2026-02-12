import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

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

    // Resend uses Svix for webhooks — verify the signature
    // For now we log a warning if we can't verify, but still process
    // Full Svix verification would require the `svix` package
    // TODO: Add svix package for full signature verification if needed
  }

  let event: ResendWebhookEvent;
  try {
    event = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

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
