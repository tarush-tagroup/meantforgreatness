import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { donors, donorOtps } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateOtp } from "@/lib/donor-auth";
import { sendDonorOtpEmail } from "@/lib/email/donor-otp";
import { logger } from "@/lib/logger";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Rate limit: 5 OTP sends per 15 minutes per email
    const rateLimitResult = checkRateLimit(
      `otp-send:${normalizedEmail}`,
      RATE_LIMITS.otpSend
    );
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    // Look up donor — auto-create if not found
    let [donorRecord] = await db
      .select({ id: donors.id })
      .from(donors)
      .where(eq(donors.email, normalizedEmail))
      .limit(1);

    if (!donorRecord) {
      const [newDonor] = await db
        .insert(donors)
        .values({ email: normalizedEmail })
        .returning({ id: donors.id });
      donorRecord = newDonor;
      logger.info("donor:otp", "Auto-created donor account", { email: normalizedEmail });
    }

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await db.insert(donorOtps).values({
      donorId: donorRecord.id,
      code,
      expiresAt,
    });

    // Await email send — must complete before serverless function exits
    try {
      await sendDonorOtpEmail({ to: normalizedEmail, code });
      logger.info("donor:otp", "OTP sent", { email: normalizedEmail });
    } catch (emailErr) {
      logger.error("donor:otp", "Failed to send OTP email", {
        email: normalizedEmail,
        error: emailErr instanceof Error ? emailErr.message : String(emailErr),
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("donor:otp", "Error sending OTP", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
