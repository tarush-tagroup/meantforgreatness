import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth
const mockWithAuth = vi.fn();
vi.mock("@/lib/auth-guard", () => ({
  withAuth: (...args: unknown[]) => mockWithAuth(...args),
}));

// Mock db
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockOrderBy = vi.fn();
const mockValues = vi.fn();
const mockReturning = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
  },
}));

vi.mock("@/db/schema", () => ({
  classGroups: { orphanageId: "orphanage_id", sortOrder: "sort_order" },
  orphanages: { id: "id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: unknown, _val: unknown) => "eq"),
  asc: vi.fn((col: unknown) => col),
}));

import { GET, POST } from "./route";
import { NextRequest } from "next/server";

function makeGetRequest(orphanageId?: string) {
  const url = orphanageId
    ? `http://localhost/api/admin/class-groups?orphanageId=${orphanageId}`
    : "http://localhost/api/admin/class-groups";
  return new NextRequest(url, { method: "GET" });
}

function makePostRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/class-groups", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("GET /api/admin/class-groups", () => {
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
    mockFrom.mockReturnValue({ orderBy: mockOrderBy, where: mockWhere });
    mockWhere.mockReturnValue({ orderBy: mockOrderBy });
    mockOrderBy.mockResolvedValue([
      { id: "g1", orphanageId: "chloe", name: "Kids", studentCount: 4 },
    ]);
  });

  it("returns 401 when not authenticated", async () => {
    mockWithAuth.mockResolvedValue([
      null,
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    ]);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("returns class groups", async () => {
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.classGroups).toHaveLength(1);
  });
});

describe("POST /api/admin/class-groups", () => {
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

    // For orphanage existence check
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue([{ id: "chloe" }]);

    // For insert
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ returning: mockReturning });
    mockReturning.mockResolvedValue([
      { id: "new-group", orphanageId: "chloe", name: "New Group", studentCount: 5, ageRange: "10-12", sortOrder: 0 },
    ]);
  });

  it("returns 403 when user lacks edit permission", async () => {
    mockWithAuth.mockResolvedValue([
      null,
      new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
    ]);

    const res = await POST(
      makePostRequest({ orphanageId: "chloe", name: "Test", studentCount: 5 })
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 for missing fields", async () => {
    const res = await POST(makePostRequest({ orphanageId: "chloe" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when orphanage not found", async () => {
    mockLimit.mockResolvedValue([]);

    const res = await POST(
      makePostRequest({ orphanageId: "nonexistent", name: "Test", studentCount: 5 })
    );
    expect(res.status).toBe(404);
  });

  it("creates class group successfully", async () => {
    const res = await POST(
      makePostRequest({
        orphanageId: "chloe",
        name: "New Group",
        studentCount: 5,
        ageRange: "10-12",
      })
    );
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.classGroup.name).toBe("New Group");
  });
});
