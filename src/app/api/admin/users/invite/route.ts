import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { withAuth } from "@/lib/auth-guard";
import { isValidRole } from "@/lib/permissions";
import { eq } from "drizzle-orm";
import { sendInviteEmail } from "@/lib/email/invite";
import type { Role } from "@/types/auth";

export async function POST(request: NextRequest) {
  const [user, error] = await withAuth("users:invite");
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { email?: string; roles?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { email, roles: requestedRoles } = body;

  // Validate email
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json(
      { error: "Valid email is required" },
      { status: 400 }
    );
  }

  // Validate roles
  if (
    !requestedRoles ||
    !Array.isArray(requestedRoles) ||
    requestedRoles.length === 0
  ) {
    return NextResponse.json(
      { error: "At least one role is required" },
      { status: 400 }
    );
  }

  for (const role of requestedRoles) {
    if (!isValidRole(role)) {
      return NextResponse.json(
        { error: `Invalid role: ${role}` },
        { status: 400 }
      );
    }
  }

  // Check if user already exists
  const [existing] = await db
    .select({ id: users.id, status: users.status })
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()))
    .limit(1);

  if (existing) {
    if (existing.status === "active") {
      return NextResponse.json(
        { error: "User is already active" },
        { status: 409 }
      );
    }
    if (existing.status === "invited") {
      return NextResponse.json(
        { error: "User has already been invited" },
        { status: 409 }
      );
    }
    // If deactivated, we could re-invite — but for now, return conflict
    return NextResponse.json(
      { error: "User exists but is deactivated. Reactivate them instead." },
      { status: 409 }
    );
  }

  // Create invited user
  const [newUser] = await db
    .insert(users)
    .values({
      email: email.toLowerCase().trim(),
      roles: requestedRoles as Role[],
      status: "invited",
      invitedBy: user.id,
      invitedAt: new Date(),
    })
    .returning({ id: users.id, email: users.email });

  // Send invite email
  try {
    await sendInviteEmail({
      to: email.toLowerCase().trim(),
      invitedByName: user.name || user.email,
      roles: requestedRoles,
    });
  } catch (emailError) {
    console.error("Failed to send invite email:", emailError);
    // User was created, but email failed — don't roll back
  }

  return NextResponse.json(
    { success: true, user: newUser },
    { status: 201 }
  );
}
