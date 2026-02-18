import { describe, it, expect } from "vitest";
import {
  hasPermission,
  getPermissions,
  isValidRole,
} from "./permissions";
import type { Role, Permission } from "@/types/auth";

describe("permissions", () => {
  describe("hasPermission", () => {
    // ─── Admin has all permissions ────────────────────────────────────
    it("admin has all permissions", () => {
      const allPermissions: Permission[] = [
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
        "kids:view",
        "kids:edit",
        "media:upload",
        "logs:view",
        "costs:view",
      ];

      for (const permission of allPermissions) {
        expect(hasPermission(["admin"], permission)).toBe(true);
      }
    });

    // ─── Teacher Manager permissions ──────────────────────────────────
    it("teacher_manager inherits core teaching permissions", () => {
      expect(hasPermission(["teacher_manager"], "class_logs:view_all")).toBe(true);
      expect(hasPermission(["teacher_manager"], "class_logs:create")).toBe(true);
      expect(hasPermission(["teacher_manager"], "class_logs:edit_own")).toBe(true);
      expect(hasPermission(["teacher_manager"], "class_logs:delete_own")).toBe(true);
      expect(hasPermission(["teacher_manager"], "orphanages:view")).toBe(true);
      expect(hasPermission(["teacher_manager"], "events:view")).toBe(true);
      expect(hasPermission(["teacher_manager"], "events:manage")).toBe(true);
    });

    it("teacher_manager can edit any class log", () => {
      expect(hasPermission(["teacher_manager"], "class_logs:edit_all")).toBe(true);
      expect(hasPermission(["teacher_manager"], "class_logs:delete_all")).toBe(true);
    });

    it("teacher_manager can edit orphanages", () => {
      expect(hasPermission(["teacher_manager"], "orphanages:edit")).toBe(true);
    });

    it("teacher_manager can generate transparency reports", () => {
      expect(hasPermission(["teacher_manager"], "transparency:generate")).toBe(true);
      expect(hasPermission(["teacher_manager"], "transparency:view")).toBe(true);
    });

    it("teacher_manager cannot publish transparency reports", () => {
      expect(hasPermission(["teacher_manager"], "transparency:publish")).toBe(false);
    });

    it("teacher_manager can view kids", () => {
      expect(hasPermission(["teacher_manager"], "kids:view")).toBe(true);
    });

    it("teacher_manager can edit kids", () => {
      expect(hasPermission(["teacher_manager"], "kids:edit")).toBe(true);
    });

    it("teacher_manager cannot view donations", () => {
      expect(hasPermission(["teacher_manager"], "donations:view")).toBe(false);
    });

    it("teacher_manager can view but not invite users", () => {
      expect(hasPermission(["teacher_manager"], "users:view")).toBe(true);
      expect(hasPermission(["teacher_manager"], "users:invite")).toBe(false);
    });

    // ─── Donor Manager permissions ────────────────────────────────────
    it("donor_manager can view operations data", () => {
      expect(hasPermission(["donor_manager"], "orphanages:view")).toBe(true);
      expect(hasPermission(["donor_manager"], "kids:view")).toBe(true);
      expect(hasPermission(["donor_manager"], "class_logs:view_all")).toBe(true);
      expect(hasPermission(["donor_manager"], "events:view")).toBe(true);
      expect(hasPermission(["donor_manager"], "transparency:view")).toBe(true);
    });

    it("donor_manager cannot view donations or users", () => {
      expect(hasPermission(["donor_manager"], "donations:view")).toBe(false);
      expect(hasPermission(["donor_manager"], "users:view")).toBe(false);
      expect(hasPermission(["donor_manager"], "users:invite")).toBe(false);
    });

    // ─── Multiple roles ──────────────────────────────────────────────
    it("user with multiple roles gets combined permissions", () => {
      const roles: Role[] = ["teacher_manager", "donor_manager"];
      // Both roles share this permission
      expect(hasPermission(roles, "class_logs:view_all")).toBe(true);
      // teacher_manager has this, donor_manager doesn't — combined still grants it
      expect(hasPermission(roles, "orphanages:edit")).toBe(true);
      // Neither role has donations:view (admin-only)
      expect(hasPermission(roles, "donations:view")).toBe(false);
    });

    // ─── Empty roles ─────────────────────────────────────────────────
    it("empty roles array has no permissions", () => {
      expect(hasPermission([], "users:view")).toBe(false);
      expect(hasPermission([], "class_logs:view_all")).toBe(false);
    });
  });

  describe("getPermissions", () => {
    it("returns all permissions for admin", () => {
      const perms = getPermissions(["admin"]);
      expect(perms).toContain("users:view");
      expect(perms).toContain("donations:view");
      expect(perms).toContain("transparency:publish");
    });

    it("returns deduplicated permissions for overlapping roles", () => {
      const perms = getPermissions(["teacher_manager", "admin"]);
      const unique = new Set(perms);
      expect(perms.length).toBe(unique.size);
    });

    it("returns empty array for empty roles", () => {
      expect(getPermissions([])).toEqual([]);
    });
  });

  describe("isValidRole", () => {
    it("validates known roles", () => {
      expect(isValidRole("admin")).toBe(true);
      expect(isValidRole("teacher_manager")).toBe(true);
      expect(isValidRole("donor_manager")).toBe(true);
    });

    it("rejects invalid roles", () => {
      expect(isValidRole("superadmin")).toBe(false);
      expect(isValidRole("teacher")).toBe(false);
      expect(isValidRole("")).toBe(false);
      expect(isValidRole("student")).toBe(false);
    });
  });
});
