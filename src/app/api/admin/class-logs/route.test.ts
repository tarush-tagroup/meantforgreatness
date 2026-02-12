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
const mockOffset = vi.fn();
const mockOrderBy = vi.fn();
const mockValues = vi.fn();
const mockReturning = vi.fn();
const mockLeftJoin = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
  },
}));

vi.mock("@/db/schema", () => ({
  classLogs: {
    id: "id",
    orphanageId: "orphanage_id",
    teacherId: "teacher_id",
    classDate: "class_date",
    classTime: "class_time",
    studentCount: "student_count",
    photoUrl: "photo_url",
    notes: "notes",
    createdAt: "created_at",
  },
  orphanages: { id: "id", name: "name" },
  users: { id: "id", name: "name" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: unknown, _val: unknown) => "eq"),
  desc: vi.fn((col: unknown) => col),
  and: vi.fn((...args: unknown[]) => args),
  gte: vi.fn((_col: unknown, _val: unknown) => "gte"),
  lte: vi.fn((_col: unknown, _val: unknown) => "lte"),
  sql: vi.fn(),
}));

import { GET, POST } from "./route";
import { NextRequest } from "next/server";

function makeGetRequest(params?: Record<string, string>) {
  const url = new URL("http://localhost/api/admin/class-logs");
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  return new NextRequest(url, { method: "GET" });
}

function makePostRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/class-logs", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("GET /api/admin/class-logs", () => {
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

    // First call: data query with leftJoin chain
    // Second call: count query with simple from().where() chain
    let selectCallCount = 0;
    mockSelect.mockImplementation(() => {
      selectCallCount++;
      return { from: mockFrom };
    });

    const mockCountWhere = vi.fn().mockResolvedValue([{ count: 1 }]);
    const mockCountFrom = vi.fn().mockReturnValue({ where: mockCountWhere });

    mockFrom.mockImplementation(() => {
      // Data query returns leftJoin chain; count query returns where chain
      if (selectCallCount <= 1) {
        return { leftJoin: mockLeftJoin };
      }
      return { where: mockCountWhere };
    });
    mockLeftJoin.mockReturnValue({ leftJoin: mockLeftJoin, where: mockWhere, orderBy: mockOrderBy });
    mockWhere.mockReturnValue({ orderBy: mockOrderBy, limit: mockLimit });
    mockOrderBy.mockReturnValue({ limit: mockLimit });
    mockLimit.mockReturnValue({ offset: mockOffset });
    mockOffset.mockResolvedValue([
      {
        id: "log-1",
        orphanageId: "chloe",
        orphanageName: "Chloe Orphanage",
        teacherId: "admin-1",
        teacherName: "Admin",
        classDate: "2026-02-12",
        classTime: "10:00 AM",
        studentCount: 15,
        notes: "Great class",
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

  it("returns class logs with pagination", async () => {
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.classLogs).toHaveLength(1);
    expect(data.pagination).toBeDefined();
    expect(data.pagination.page).toBe(1);
    expect(data.pagination.total).toBe(1);
  });
});

describe("POST /api/admin/class-logs", () => {
  const adminUser = {
    id: "admin-1",
    email: "admin@example.com",
    name: "Admin",
    image: "",
    roles: ["admin"],
  };

  const validBody = {
    orphanageId: "chloe",
    classDate: "2026-02-12",
    classTime: "10:00 AM",
    studentCount: 15,
    notes: "Great class",
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
      {
        id: "new-log",
        orphanageId: "chloe",
        teacherId: "admin-1",
        classDate: "2026-02-12",
        classTime: "10:00 AM",
        studentCount: 15,
        notes: "Great class",
        createdAt: new Date(),
      },
    ]);
  });

  it("returns 403 when user lacks create permission", async () => {
    mockWithAuth.mockResolvedValue([
      null,
      new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
    ]);

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(403);
  });

  it("returns 400 for missing required fields", async () => {
    const res = await POST(makePostRequest({ orphanageId: "chloe" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid date format", async () => {
    const res = await POST(
      makePostRequest({ orphanageId: "chloe", classDate: "not-a-date" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when orphanage not found", async () => {
    mockLimit.mockResolvedValue([]);

    const res = await POST(
      makePostRequest({ orphanageId: "nonexistent", classDate: "2026-02-12" })
    );
    expect(res.status).toBe(404);
  });

  it("creates class log with teacherId locked to current user", async () => {
    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.classLog.teacherId).toBe("admin-1");
    expect(mockInsert).toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON", async () => {
    const req = new NextRequest("http://localhost/api/admin/class-logs", {
      method: "POST",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
