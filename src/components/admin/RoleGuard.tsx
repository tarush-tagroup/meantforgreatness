"use client";

import type { Role, Permission } from "@/types/auth";
import { hasPermission } from "@/lib/permissions";

interface RoleGuardProps {
  roles: Role[];
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Client-side component that conditionally renders children
 * based on the user's roles and required permission.
 */
export default function RoleGuard({
  roles,
  permission,
  children,
  fallback = null,
}: RoleGuardProps) {
  if (hasPermission(roles, permission)) {
    return <>{children}</>;
  }
  return <>{fallback}</>;
}
