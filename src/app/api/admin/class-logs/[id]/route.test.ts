import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth
const mockWithAuth = vi.fn();
vi.mock("@/lib/auth-guard", () => ({
  withAuth: (...args: unknown[]) => mockWithAuth(...args),
}));

// Mock permissions
const mockHasPermission = vi.fn();
vi.mock("@/lib/permissions", () => ({
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));

// Mock db
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockSet = vi.fn();
const mockUpdateWhere = vi.fn();
const mockDeleteWhere = vi.fn();
const mockLeftJoin = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
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
}));

import { GET, PUT, DELETE } from "./route";
import { NextRequest } from "next/server";

function makeRequest(method: string, body?: unknown) {
  const opts: RequestInit = { method };
  if (body) {
    opts.body = JSON.stringify(body);
    opts.headers = { "Content-Type": "application/json" };
  }
  return new NextRequest("http://localhost/api/admin/class-logs/log-1", opts);
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/admin/class-logs/[id]", () => {
  const adminUser = {
    id: "admin-1",
    email: "admin@example.com",
    name: "Admin",
    image: "",
    roles: ["admin"],
  };

  const mockLog = {
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
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockWithAuth.mockResolvedValue([adminUser, null]);

    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ leftJoin: mockLeftJoin });
    mockLeftJoin.mockReturnValue({ leftJoin: mockLeftJoin, where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue([mockLog]);
  });

  it("returns 401 when not authenticated", async () => {
    mockWithAuth.mockResolvedValue([
      null,
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    ]);

    const res = await GET(makeRequest("GET"), makeParams("log-1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when log not found", async () => {
    mockLimit.mockResolvedValue([]);

    const res = await GET(makeRequest("GET"), makeParams("nonexistent"));
    expect(res.status).toBe(404);
  });

  it("returns class log data", async () => {
    const res = await GET(makeRequest("GET"), makeParams("log-1"));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.classLog.orphanageName).toBe("Chloe Orphanage");
  });
});

describe("PUT /api/admin/class-logs/[id]", () => {
  const adminUser = {
    id: "admin-1",
    email: "admin@example.com",
    name: "Admin",
    image: "",
    roles: ["admin"],
  };

  const teacherUser = {
    id: "teacher-1",
    email: "teacher@example.com",
    name: "Teacher",
    image: "",
    roles: ["teacher"],
  };

  const mockLog = {
    id: "log-1",
    orphanageId: "chloe",
    teacherId: "admin-1",
    classDate: "2026-02-12",
    classTime: "10:00 AM",
    studentCount: 15,
    notes: "Great class",
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockWithAuth.mockResolvedValue([adminUser, null]);
    mockHasPermission.mockReturnValue(true);

    // For fetching existing log
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue([mockLog]);

    // For update
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockResolvedValue(undefined);
  });

  it("returns 403 when not authenticated", async () => {
    mockWithAuth.mockResolvedValue([
      null,
      new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
    ]);

    const res = await PUT(
      makeRequest("PUT", { notes: "Updated" }),
      makeParams("log-1")
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when log not found", async () => {
    mockLimit.mockResolvedValue([]);

    const res = await PUT(
      makeRequest("PUT", { notes: "Updated" }),
      makeParams("nonexistent")
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when teacher tries to edit another teacher's log", async () => {
    mockWithAuth.mockResolvedValue([teacherUser, null]);
    mockHasPermission.mockReturnValue(false); // No edit_all permission

    const res = await PUT(
      makeRequest("PUT", { notes: "Updated" }),
      makeParams("log-1")
    );
    expect(res.status).toBe(403);
  });

  it("allows owner to update their own log", async () => {
    // Admin user owns this log (teacherId = admin-1)
    const res = await PUT(
      makeRequest("PUT", { notes: "Updated notes" }),
      makeParams("log-1")
    );
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON", async () => {
    const req = new NextRequest(
      "http://localhost/api/admin/class-logs/log-1",
      {
        method: "PUT",
        body: "not json",
        headers: { "Content-Type": "application/json" },
      }
    );
    const res = await PUT(req, makeParams("log-1"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when no fields provided", async () => {
    const res = await PUT(makeRequest("PUT", {}), makeParams("log-1"));
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/admin/class-logs/[id]", () => {
  const adminUser = {
    id: "admin-1",
    email: "admin@example.com",
    name: "Admin",
    image: "",
    roles: ["admin"],
  };

  const teacherUser = {
    id: "teacher-1",
    email: "teacher@example.com",
    name: "Teacher",
    image: "",
    roles: ["teacher"],
  };

  const mockLog = {
    id: "log-1",
    orphanageId: "chloe",
    teacherId: "admin-1",
    classDate: "2026-02-12",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockWithAuth.mockResolvedValue([adminUser, null]);
    mockHasPermission.mockReturnValue(true);

    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue([mockLog]);

    mockDelete.mockReturnValue({ where: mockDeleteWhere });
    mockDeleteWhere.mockResolvedValue(undefined);
  });

  it("returns 403 when not authenticated", async () => {
    mockWithAuth.mockResolvedValue([
      null,
      new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
    ]);

    const res = await DELETE(makeRequest("DELETE"), makeParams("log-1"));
    expect(res.status).toBe(403);
  });

  it("returns 404 when log not found", async () => {
    mockLimit.mockResolvedValue([]);

    const res = await DELETE(makeRequest("DELETE"), makeParams("nonexistent"));
    expect(res.status).toBe(404);
  });

  it("returns 403 when teacher tries to delete another teacher's log", async () => {
    mockWithAuth.mockResolvedValue([teacherUser, null]);
    mockHasPermission.mockReturnValue(false);

    const res = await DELETE(makeRequest("DELETE"), makeParams("log-1"));
    expect(res.status).toBe(403);
  });

  it("allows owner to delete their own log", async () => {
    const res = await DELETE(makeRequest("DELETE"), makeParams("log-1"));
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalled();
  });
});
