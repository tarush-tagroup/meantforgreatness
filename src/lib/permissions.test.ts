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
        "media:upload",
      ];

      for (const permission of allPermissions) {
        expect(hasPermission(["admin"], permission)).toBe(true);
      }
    });

    // ─── Teacher permissions ──────────────────────────────────────────
    it("teacher can view all class logs", () => {
      expect(hasPermission(["teacher"], "class_logs:view_all")).toBe(true);
    });

    it("teacher can create class logs", () => {
      expect(hasPermission(["teacher"], "class_logs:create")).toBe(true);
    });

    it("teacher can edit own class logs", () => {
      expect(hasPermission(["teacher"], "class_logs:edit_own")).toBe(true);
    });

    it("teacher cannot edit all class logs", () => {
      expect(hasPermission(["teacher"], "class_logs:edit_all")).toBe(false);
    });

    it("teacher cannot view users", () => {
      expect(hasPermission(["teacher"], "users:view")).toBe(false);
    });

    it("teacher cannot view donations", () => {
      expect(hasPermission(["teacher"], "donations:view")).toBe(false);
    });

    it("teacher cannot view transparency reports", () => {
      expect(hasPermission(["teacher"], "transparency:view")).toBe(false);
    });

    it("teacher can view orphanages", () => {
      expect(hasPermission(["teacher"], "orphanages:view")).toBe(true);
    });

    it("teacher cannot edit orphanages", () => {
      expect(hasPermission(["teacher"], "orphanages:edit")).toBe(false);
    });

    it("teacher can view and manage events", () => {
      expect(hasPermission(["teacher"], "events:view")).toBe(true);
      expect(hasPermission(["teacher"], "events:manage")).toBe(true);
    });

    it("teacher can upload media", () => {
      expect(hasPermission(["teacher"], "media:upload")).toBe(true);
    });

    // ─── Teacher Manager permissions ──────────────────────────────────
    it("teacher_manager inherits teacher view permissions", () => {
      expect(hasPermission(["teacher_manager"], "class_logs:view_all")).toBe(true);
      expect(hasPermission(["teacher_manager"], "orphanages:view")).toBe(true);
      expect(hasPermission(["teacher_manager"], "events:view")).toBe(true);
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

    it("teacher_manager cannot view donations", () => {
      expect(hasPermission(["teacher_manager"], "donations:view")).toBe(false);
    });

    it("teacher_manager cannot manage users", () => {
      expect(hasPermission(["teacher_manager"], "users:view")).toBe(false);
      expect(hasPermission(["teacher_manager"], "users:invite")).toBe(false);
    });

    // ─── Donor Manager permissions ────────────────────────────────────
    it("donor_manager can view donations", () => {
      expect(hasPermission(["donor_manager"], "donations:view")).toBe(true);
    });

    it("donor_manager cannot view class logs", () => {
      expect(hasPermission(["donor_manager"], "class_logs:view_all")).toBe(false);
    });

    it("donor_manager cannot view orphanages", () => {
      expect(hasPermission(["donor_manager"], "orphanages:view")).toBe(false);
    });

    it("donor_manager cannot manage users", () => {
      expect(hasPermission(["donor_manager"], "users:view")).toBe(false);
    });

    // ─── Multiple roles ──────────────────────────────────────────────
    it("user with multiple roles gets combined permissions", () => {
      const roles: Role[] = ["teacher", "donor_manager"];
      expect(hasPermission(roles, "class_logs:view_all")).toBe(true);
      expect(hasPermission(roles, "donations:view")).toBe(true);
    });

    it("teacher + teacher_manager gets all teacher_manager permissions", () => {
      const roles: Role[] = ["teacher", "teacher_manager"];
      expect(hasPermission(roles, "class_logs:edit_all")).toBe(true);
      expect(hasPermission(roles, "orphanages:edit")).toBe(true);
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
      const perms = getPermissions(["teacher", "teacher_manager"]);
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
      expect(isValidRole("teacher")).toBe(true);
      expect(isValidRole("teacher_manager")).toBe(true);
      expect(isValidRole("donor_manager")).toBe(true);
    });

    it("rejects invalid roles", () => {
      expect(isValidRole("superadmin")).toBe(false);
      expect(isValidRole("")).toBe(false);
      expect(isValidRole("student")).toBe(false);
    });
  });
});
