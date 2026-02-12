import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth module
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

// Import after mocking
import { getSessionUser, withAuth } from "./auth-guard";

describe("auth-guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSessionUser", () => {
    it("returns null when not authenticated", async () => {
      mockAuth.mockResolvedValue(null);
      const user = await getSessionUser();
      expect(user).toBeNull();
    });

    it("returns null when session has no user", async () => {
      mockAuth.mockResolvedValue({ user: null });
      const user = await getSessionUser();
      expect(user).toBeNull();
    });

    it("returns null when user has no email", async () => {
      mockAuth.mockResolvedValue({ user: { name: "Test" } });
      const user = await getSessionUser();
      expect(user).toBeNull();
    });

    it("returns session user with roles", async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: "user-123",
          email: "test@example.com",
          name: "Test User",
          image: "https://example.com/photo.jpg",
          roles: ["admin", "teacher"],
        },
      });

      const user = await getSessionUser();
      expect(user).toEqual({
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
        image: "https://example.com/photo.jpg",
        roles: ["admin", "teacher"],
      });
    });

    it("defaults roles to empty array if missing", async () => {
      mockAuth.mockResolvedValue({
        user: {
          email: "test@example.com",
          name: "Test",
          image: "",
        },
      });

      const user = await getSessionUser();
      expect(user).not.toBeNull();
      expect(user!.roles).toEqual([]);
    });
  });

  describe("withAuth", () => {
    it("returns [user, null] when authenticated with no permission required", async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: "user-123",
          email: "admin@example.com",
          name: "Admin",
          image: "",
          roles: ["admin"],
        },
      });

      const [user, error] = await withAuth();
      expect(user).not.toBeNull();
      expect(user!.email).toBe("admin@example.com");
      expect(error).toBeNull();
    });

    it("returns [null, 401] when not authenticated", async () => {
      mockAuth.mockResolvedValue(null);

      const [user, error] = await withAuth();
      expect(user).toBeNull();
      expect(error).not.toBeNull();
      expect(error!.status).toBe(401);
    });

    it("returns [null, 403] when permission check fails", async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: "user-123",
          email: "teacher@example.com",
          name: "Teacher",
          image: "",
          roles: ["teacher"],
        },
      });

      const [user, error] = await withAuth("users:view");
      expect(user).toBeNull();
      expect(error).not.toBeNull();
      expect(error!.status).toBe(403);
    });

    it("returns [user, null] when permission check passes", async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: "user-123",
          email: "admin@example.com",
          name: "Admin",
          image: "",
          roles: ["admin"],
        },
      });

      const [user, error] = await withAuth("users:view");
      expect(user).not.toBeNull();
      expect(user!.roles).toContain("admin");
      expect(error).toBeNull();
    });

    it("teacher can access class_logs:view_all", async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: "teacher-1",
          email: "teacher@example.com",
          name: "Teacher",
          image: "",
          roles: ["teacher"],
        },
      });

      const [user, error] = await withAuth("class_logs:view_all");
      expect(user).not.toBeNull();
      expect(error).toBeNull();
    });

    it("teacher cannot access users:invite", async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: "teacher-1",
          email: "teacher@example.com",
          name: "Teacher",
          image: "",
          roles: ["teacher"],
        },
      });

      const [user, error] = await withAuth("users:invite");
      expect(user).toBeNull();
      expect(error).not.toBeNull();
      expect(error!.status).toBe(403);
    });

    it("donor_manager can access donations:view", async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: "donor-1",
          email: "donor@example.com",
          name: "Donor Manager",
          image: "",
          roles: ["donor_manager"],
        },
      });

      const [user, error] = await withAuth("donations:view");
      expect(user).not.toBeNull();
      expect(error).toBeNull();
    });

    it("donor_manager cannot access class_logs:view_all", async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: "donor-1",
          email: "donor@example.com",
          name: "Donor Manager",
          image: "",
          roles: ["donor_manager"],
        },
      });

      const [user, error] = await withAuth("class_logs:view_all");
      expect(user).toBeNull();
      expect(error!.status).toBe(403);
    });
  });
});
