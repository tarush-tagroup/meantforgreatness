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
  orphanages: { id: "id", name: "name" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: unknown, _val: unknown) => "eq"),
}));

import { GET, PUT } from "./route";
import { NextRequest } from "next/server";

function makeGetRequest() {
  return new NextRequest("http://localhost/api/admin/orphanages/chloe", {
    method: "GET",
  });
}

function makePutRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/orphanages/chloe", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/admin/orphanages/[id]", () => {
  const adminUser = {
    id: "admin-1",
    email: "admin@example.com",
    name: "Admin",
    image: "",
    roles: ["admin"],
  };

  const mockOrphanage = {
    id: "chloe",
    name: "Chloe Orphanage",
    location: "Denpasar",
    description: "A great orphanage",
    studentCount: 18,
    classesPerWeek: 2,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockWithAuth.mockResolvedValue([adminUser, null]);

    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue([mockOrphanage]);
  });

  it("returns 401 when not authenticated", async () => {
    mockWithAuth.mockResolvedValue([
      null,
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    ]);

    const res = await GET(makeGetRequest(), makeParams("chloe"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when orphanage not found", async () => {
    mockLimit.mockResolvedValue([]);

    const res = await GET(makeGetRequest(), makeParams("nonexistent"));
    expect(res.status).toBe(404);
  });

  it("returns orphanage data", async () => {
    const res = await GET(makeGetRequest(), makeParams("chloe"));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.orphanage.name).toBe("Chloe Orphanage");
  });
});

describe("PUT /api/admin/orphanages/[id]", () => {
  const adminUser = {
    id: "admin-1",
    email: "admin@example.com",
    name: "Admin",
    image: "",
    roles: ["admin"],
  };

  const mockOrphanage = {
    id: "chloe",
    name: "Chloe Orphanage",
    location: "Denpasar",
    description: "A great orphanage",
    imageUrl: "/images/chloe.jpg",
    studentCount: 18,
    classesPerWeek: 2,
  };

  const validBody = {
    name: "Chloe Orphanage Updated",
    location: "Denpasar, Bali",
    description: "Updated description",
    studentCount: 20,
    classesPerWeek: 3,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockWithAuth.mockResolvedValue([adminUser, null]);

    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue([mockOrphanage]);

    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockResolvedValue(undefined);
  });

  it("returns 403 when user lacks edit permission", async () => {
    mockWithAuth.mockResolvedValue([
      null,
      new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
    ]);

    const res = await PUT(makePutRequest(validBody), makeParams("chloe"));
    expect(res.status).toBe(403);
  });

  it("returns 404 when orphanage not found", async () => {
    mockLimit.mockResolvedValue([]);

    const res = await PUT(makePutRequest(validBody), makeParams("nonexistent"));
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid body", async () => {
    const res = await PUT(
      makePutRequest({ name: "" }),
      makeParams("chloe")
    );
    expect(res.status).toBe(400);
  });

  it("updates orphanage successfully", async () => {
    const res = await PUT(makePutRequest(validBody), makeParams("chloe"));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON", async () => {
    const req = new NextRequest("http://localhost/api/admin/orphanages/chloe", {
      method: "PUT",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await PUT(req, makeParams("chloe"));
    expect(res.status).toBe(400);
  });
});
