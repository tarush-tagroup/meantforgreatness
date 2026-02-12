import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { withAuth } from "@/lib/auth-guard";
import { desc } from "drizzle-orm";

export async function GET() {
  const [user, error] = await withAuth("users:view");
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      image: users.image,
      roles: users.roles,
      status: users.status,
      invitedAt: users.invitedAt,
      activatedAt: users.activatedAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  return NextResponse.json(allUsers);
}
