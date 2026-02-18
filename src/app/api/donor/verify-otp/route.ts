import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { donors, donorOtps } from "@/db/schema";
import { eq, and, isNull, gt } from "drizzle-orm";
import { createDonorSession, setDonorCookie } from "@/lib/donor-auth";
import { logger } from "@/lib/logger";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json();

    if (!email || !code) {
      return NextResponse.json(
        { error: "Email and code are required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Rate limit: 10 verify attempts per 15 minutes per email (prevents brute force)
    const rateLimitResult = checkRateLimit(
      `otp-verify:${normalizedEmail}`,
      RATE_LIMITS.otpVerify
    );
    if (!rateLimitResult.allowed) {
      logger.warn("donor:auth", "OTP verify rate limit exceeded", {
        email: normalizedEmail,
      });
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 }
      );
    }

    // Look up donor
    const [donor] = await db
      .select({ id: donors.id, email: donors.email })
      .from(donors)
      .where(eq(donors.email, normalizedEmail))
      .limit(1);

    if (!donor) {
      return NextResponse.json(
        { error: "Invalid or expired code" },
        { status: 401 }
      );
    }

    // Find matching non-expired, non-used OTP
    const [validOtp] = await db
      .select({ id: donorOtps.id })
      .from(donorOtps)
      .where(
        and(
          eq(donorOtps.donorId, donor.id),
          eq(donorOtps.code, code.trim()),
          isNull(donorOtps.usedAt),
          gt(donorOtps.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!validOtp) {
      return NextResponse.json(
        { error: "Invalid or expired code" },
        { status: 401 }
      );
    }

    // Mark OTP as used
    await db
      .update(donorOtps)
      .set({ usedAt: new Date() })
      .where(eq(donorOtps.id, validOtp.id));

    // Update last login
    await db
      .update(donors)
      .set({ lastLoginAt: new Date() })
      .where(eq(donors.id, donor.id));

    // Create session and set cookie
    const token = createDonorSession(donor.id, donor.email);
    await setDonorCookie(token);

    logger.info("donor:auth", "OTP verified, session created", {
      email: normalizedEmail,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("donor:auth", "Error verifying OTP", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
