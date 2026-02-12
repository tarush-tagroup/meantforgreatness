import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import type { Permission, Role, SessionUser } from "@/types/auth";
import { NextResponse } from "next/server";

/**
 * Get the current authenticated user from the session.
 * Returns null if not authenticated.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.email) {
    return null;
  }

  const user = session.user as Record<string, unknown>;
  return {
    id: (user.id as string) || "",
    email: session.user.email || "",
    name: session.user.name || "",
    image: session.user.image || "",
    roles: (user.roles as Role[]) || [],
  };
}

/**
 * Require authentication and optionally check permissions.
 * Use in API route handlers.
 *
 * Returns the session user if authorized.
 * Throws a NextResponse with 401 or 403 if not.
 */
export async function requireAuth(
  requiredPermission?: Permission
): Promise<SessionUser> {
  const user = await getSessionUser();

  if (!user) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (requiredPermission && !hasPermission(user.roles, requiredPermission)) {
    throw NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return user;
}

/**
 * Helper to safely call requireAuth in API routes.
 * Returns [user, null] on success, or [null, response] on failure.
 */
export async function withAuth(
  requiredPermission?: Permission
): Promise<[SessionUser, null] | [null, NextResponse]> {
  try {
    const user = await requireAuth(requiredPermission);
    return [user, null];
  } catch (response) {
    return [null, response as NextResponse];
  }
}
