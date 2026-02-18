import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { donors } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  verifyMagicLoginToken,
  createDonorSession,
  setDonorCookie,
} from "@/lib/donor-auth";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "https://www.meantforgreatness.org";

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/donor/login`);
  }

  const payload = verifyMagicLoginToken(token);

  if (!payload) {
    // Token expired or invalid
    return NextResponse.redirect(`${baseUrl}/donor/login?expired=true`);
  }

  // Verify donor still exists
  const [donor] = await db
    .select({ id: donors.id, email: donors.email })
    .from(donors)
    .where(eq(donors.id, payload.donorId))
    .limit(1);

  if (!donor) {
    return NextResponse.redirect(`${baseUrl}/donor/login`);
  }

  // Update last login
  await db
    .update(donors)
    .set({ lastLoginAt: new Date() })
    .where(eq(donors.id, donor.id));

  // Create long-lived session and set cookie
  const sessionToken = createDonorSession(donor.id, donor.email);
  await setDonorCookie(sessionToken);

  logger.info("donor:auth", "Magic link login", { email: donor.email });

  return NextResponse.redirect(`${baseUrl}/donor`);
}
