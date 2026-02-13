import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/with-logging";

async function postHandler(req: NextRequest) {
  try {
    const body = await req.json();
    const rawName = body.name;
    const rawEmail = body.email;
    const rawMessage = body.message;

    if (!rawName || typeof rawName !== "string" || rawName.trim().length === 0) {
      return NextResponse.json(
        { error: "Name is required." },
        { status: 400 }
      );
    }

    if (!rawEmail || typeof rawEmail !== "string" || rawEmail.trim().length === 0) {
      return NextResponse.json(
        { error: "Email is required." },
        { status: 400 }
      );
    }

    if (!rawMessage || typeof rawMessage !== "string" || rawMessage.trim().length === 0) {
      return NextResponse.json(
        { error: "Message is required." },
        { status: 400 }
      );
    }

    const name = rawName.trim();
    const email = rawEmail.trim();
    const message = rawMessage.trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    if (message.length > 5000) {
      return NextResponse.json(
        { error: "Message must be under 5,000 characters." },
        { status: 400 }
      );
    }

    const contactEmail = process.env.CONTACT_EMAIL;
    if (!contactEmail) {
      logger.error("contact", "CONTACT_EMAIL environment variable is not set");
      return NextResponse.json(
        { error: "Contact form is not configured." },
        { status: 500 }
      );
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      logger.error("contact", "RESEND_API_KEY environment variable is not set");
      return NextResponse.json(
        { error: "Contact form is not configured." },
        { status: 500 }
      );
    }

    const resend = new Resend(resendApiKey);

    await resend.emails.send({
      from: "Meant for Greatness <tarush@meantforgreatness.org>",
      to: contactEmail,
      subject: `Contact Form: ${name}`,
      replyTo: email,
      text: [`Name: ${name}`, `Email: ${email}`, "", "Message:", message].join(
        "\n"
      ),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("contact", "Contact form error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json(
      { error: "An error occurred sending your message." },
      { status: 500 }
    );
  }
}

export const POST = withLogging(postHandler, { source: "contact" });
