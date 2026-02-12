import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth
const mockWithAuth = vi.fn();
vi.mock("@/lib/auth-guard", () => ({
  withAuth: (...args: unknown[]) => mockWithAuth(...args),
}));

// Mock db
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockOrderBy = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

vi.mock("@/db/schema", () => ({
  orphanages: { id: "id", name: "name" },
  classGroups: { orphanageId: "orphanage_id", sortOrder: "sort_order" },
}));

vi.mock("drizzle-orm", () => ({
  asc: vi.fn((col: unknown) => col),
}));

import { GET } from "./route";

describe("GET /api/admin/orphanages", () => {
  const adminUser = {
    id: "admin-1",
    email: "admin@example.com",
    name: "Admin",
    image: "",
    roles: ["admin"],
  };

  const mockOrphanages = [
    { id: "chloe", name: "Chloe Orphanage", location: "Denpasar", studentCount: 18, classesPerWeek: 2 },
    { id: "seeds-of-hope", name: "Seeds of Hope", location: "Denpasar", studentCount: 40, classesPerWeek: 15 },
  ];

  const mockClassGroups = [
    { id: "g1", orphanageId: "chloe", name: "Kids", studentCount: 4, ageRange: "8-9", sortOrder: 0 },
    { id: "g2", orphanageId: "chloe", name: "Junior", studentCount: 14, ageRange: "10-16", sortOrder: 1 },
    { id: "g3", orphanageId: "seeds-of-hope", name: "Kids I", studentCount: 8, ageRange: "7-9", sortOrder: 0 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockWithAuth.mockResolvedValue([adminUser, null]);

    // First call: orphanages, second call: classGroups
    let callCount = 0;
    mockSelect.mockImplementation(() => ({
      from: (..._args: unknown[]) => {
        callCount++;
        return {
          orderBy: (..._orderArgs: unknown[]) =>
            callCount === 1
              ? Promise.resolve(mockOrphanages)
              : Promise.resolve(mockClassGroups),
        };
      },
    }));
  });

  it("returns 401 when not authenticated", async () => {
    mockWithAuth.mockResolvedValue([
      null,
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    ]);

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns orphanages with class groups", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.orphanages).toHaveLength(2);
    expect(data.orphanages[0].classGroups).toHaveLength(2);
    expect(data.orphanages[1].classGroups).toHaveLength(1);
  });

  it("returns 403 when user lacks permission", async () => {
    mockWithAuth.mockResolvedValue([
      null,
      new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
    ]);

    const res = await GET();
    expect(res.status).toBe(403);
  });
});
