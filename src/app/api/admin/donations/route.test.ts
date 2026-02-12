import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth
const mockWithAuth = vi.fn();
vi.mock("@/lib/auth-guard", () => ({
  withAuth: (...args: unknown[]) => mockWithAuth(...args),
}));

// Mock db
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockOffset = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

vi.mock("@/db/schema", () => ({
  donations: {
    id: "id",
    frequency: "frequency",
    status: "status",
    createdAt: "created_at",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: unknown, _val: unknown) => "eq"),
  desc: vi.fn((col: unknown) => col),
  and: vi.fn((...args: unknown[]) => args),
  gte: vi.fn((_col: unknown, _val: unknown) => "gte"),
  lte: vi.fn((_col: unknown, _val: unknown) => "lte"),
  sql: vi.fn(),
}));

import { GET } from "./route";
import { NextRequest } from "next/server";

function makeGetRequest(params?: Record<string, string>) {
  const url = new URL("http://localhost/api/admin/donations");
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  return new NextRequest(url, { method: "GET" });
}

describe("GET /api/admin/donations", () => {
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

    let selectCallCount = 0;
    mockSelect.mockImplementation(() => {
      selectCallCount++;
      return { from: mockFrom };
    });

    const mockCountWhere = vi.fn().mockResolvedValue([{ count: 1 }]);

    mockFrom.mockImplementation(() => {
      if (selectCallCount <= 1) {
        return { where: mockWhere };
      }
      return { where: mockCountWhere };
    });
    mockWhere.mockReturnValue({ orderBy: mockOrderBy });
    mockOrderBy.mockReturnValue({ limit: mockLimit });
    mockLimit.mockReturnValue({ offset: mockOffset });
    mockOffset.mockResolvedValue([
      {
        id: "d-1",
        donorEmail: "donor@example.com",
        donorName: "Test Donor",
        amount: 5000,
        currency: "usd",
        frequency: "one_time",
        status: "completed",
        createdAt: new Date(),
      },
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

  it("returns 403 for users without donations:view", async () => {
    mockWithAuth.mockResolvedValue([
      null,
      new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
    ]);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(403);
  });

  it("returns donations with pagination", async () => {
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.donations).toHaveLength(1);
    expect(data.pagination).toBeDefined();
    expect(data.pagination.page).toBe(1);
    expect(data.pagination.total).toBe(1);
  });
});
