import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth
const mockWithAuth = vi.fn();
vi.mock("@/lib/auth-guard", () => ({
  withAuth: (...args: unknown[]) => mockWithAuth(...args),
}));

// Mock db
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockSet = vi.fn();
const mockUpdateWhere = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}));

vi.mock("@/db/schema", () => ({
  users: { id: "id", status: "status" },
}));

import { PATCH } from "./route";
import { NextRequest } from "next/server";

function makeRequest() {
  return new NextRequest("http://localhost/api/admin/users/user-123/deactivate", {
    method: "PATCH",
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/admin/users/[id]/deactivate", () => {
  const adminUser = {
    id: "admin-1",
    email: "admin@example.com",
    name: "Admin",
    image: "",
    roles: ["admin"],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockWithAuth.mockResolvedValue([adminUser, null]);

    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue([{ id: "user-123", status: "active" }]);

    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockResolvedValue(undefined);
  });

  it("returns 401 when not authenticated", async () => {
    mockWithAuth.mockResolvedValue([
      null,
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    ]);

    const res = await PATCH(makeRequest(), makeParams("user-123"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when trying to deactivate yourself", async () => {
    const res = await PATCH(makeRequest(), makeParams("admin-1"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("yourself");
  });

  it("returns 404 when user not found", async () => {
    mockLimit.mockResolvedValue([]);

    const res = await PATCH(makeRequest(), makeParams("nonexistent"));
    expect(res.status).toBe(404);
  });

  it("returns 400 when user already deactivated", async () => {
    mockLimit.mockResolvedValue([{ id: "user-123", status: "deactivated" }]);

    const res = await PATCH(makeRequest(), makeParams("user-123"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("already deactivated");
  });

  it("deactivates user successfully", async () => {
    const res = await PATCH(makeRequest(), makeParams("user-123"));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
  });
});
