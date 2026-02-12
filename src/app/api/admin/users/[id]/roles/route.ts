import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { withAuth } from "@/lib/auth-guard";
import { isValidRole } from "@/lib/permissions";
import { eq } from "drizzle-orm";
import type { Role } from "@/types/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const [user, error] = await withAuth("users:invite");
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let body: { roles?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { roles: newRoles } = body;

  if (!newRoles || !Array.isArray(newRoles) || newRoles.length === 0) {
    return NextResponse.json(
      { error: "At least one role is required" },
      { status: 400 }
    );
  }

  for (const role of newRoles) {
    if (!isValidRole(role)) {
      return NextResponse.json(
        { error: `Invalid role: ${role}` },
        { status: 400 }
      );
    }
  }

  // Find the user
  const [targetUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Prevent removing admin role from yourself
  if (targetUser.id === user.id && !newRoles.includes("admin")) {
    return NextResponse.json(
      { error: "You cannot remove the admin role from yourself" },
      { status: 400 }
    );
  }

  // Update roles
  await db
    .update(users)
    .set({ roles: newRoles as Role[], updatedAt: new Date() })
    .where(eq(users.id, id));

  return NextResponse.json({ success: true });
}
