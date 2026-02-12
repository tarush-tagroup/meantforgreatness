import type { Role, Permission } from "@/types/auth";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    "users:view",
    "users:invite",
    "users:deactivate",
    "orphanages:view",
    "orphanages:edit",
    "class_logs:view_all",
    "class_logs:create",
    "class_logs:edit_own",
    "class_logs:edit_all",
    "class_logs:delete_own",
    "class_logs:delete_all",
    "events:view",
    "events:manage",
    "donations:view",
    "transparency:view",
    "transparency:generate",
    "transparency:publish",
    "media:upload",
  ],
  teacher: [
    "orphanages:view",
    "class_logs:view_all",
    "class_logs:create",
    "class_logs:edit_own",
    "class_logs:delete_own",
    "events:view",
    "events:manage",
    "media:upload",
  ],
  teacher_manager: [
    "orphanages:view",
    "orphanages:edit",
    "class_logs:view_all",
    "class_logs:create",
    "class_logs:edit_own",
    "class_logs:edit_all",
    "class_logs:delete_own",
    "class_logs:delete_all",
    "events:view",
    "events:manage",
    "transparency:view",
    "transparency:generate",
    "media:upload",
  ],
  donor_manager: ["donations:view"],
};

/**
 * Check if a user with the given roles has a specific permission.
 */
export function hasPermission(
  userRoles: Role[],
  permission: Permission
): boolean {
  return userRoles.some((role) => ROLE_PERMISSIONS[role]?.includes(permission));
}

/**
 * Get all permissions for a set of roles (deduplicated).
 */
export function getPermissions(userRoles: Role[]): Permission[] {
  const permissions = new Set<Permission>();
  for (const role of userRoles) {
    const rolePerms = ROLE_PERMISSIONS[role];
    if (rolePerms) {
      for (const perm of rolePerms) {
        permissions.add(perm);
      }
    }
  }
  return [...permissions];
}

/**
 * Validate that a string is a valid role.
 */
export function isValidRole(role: string): role is Role {
  return ["admin", "teacher", "teacher_manager", "donor_manager"].includes(
    role
  );
}
