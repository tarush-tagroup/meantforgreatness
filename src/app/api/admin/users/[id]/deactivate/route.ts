import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { withAuth } from "@/lib/auth-guard";
import { eq } from "drizzle-orm";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const [user, error] = await withAuth("users:deactivate");
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Prevent deactivating yourself
  if (id === user.id) {
    return NextResponse.json(
      { error: "You cannot deactivate yourself" },
      { status: 400 }
    );
  }

  // Find the user
  const [targetUser] = await db
    .select({ id: users.id, status: users.status })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (targetUser.status === "deactivated") {
    return NextResponse.json(
      { error: "User is already deactivated" },
      { status: 400 }
    );
  }

  // Deactivate
  await db
    .update(users)
    .set({ status: "deactivated", updatedAt: new Date() })
    .where(eq(users.id, id));

  return NextResponse.json({ success: true });
}
