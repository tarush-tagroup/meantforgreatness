import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth
const mockWithAuth = vi.fn();
vi.mock("@/lib/auth-guard", () => ({
  withAuth: (...args: unknown[]) => mockWithAuth(...args),
}));

// Mock db
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockValues = vi.fn();
const mockReturning = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();

vi.mock("@/db", () => ({
  db: {
    insert: (...args: unknown[]) => mockInsert(...args),
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

vi.mock("@/db/schema", () => ({
  users: { id: "id", email: "email", status: "status" },
}));

// Mock email
const mockSendInviteEmail = vi.fn();
vi.mock("@/lib/email/invite", () => ({
  sendInviteEmail: (...args: unknown[]) => mockSendInviteEmail(...args),
}));

import { POST } from "./route";
import { NextRequest } from "next/server";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/users/invite", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/admin/users/invite", () => {
  const adminUser = {
    id: "admin-1",
    email: "admin@example.com",
    name: "Admin",
    image: "",
    roles: ["admin"],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: auth succeeds as admin
    mockWithAuth.mockResolvedValue([adminUser, null]);

    // Default: no existing user
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue([]);

    // Default: insert succeeds
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ returning: mockReturning });
    mockReturning.mockResolvedValue([
      { id: "new-user-id", email: "test@example.com" },
    ]);

    // Default: email succeeds
    mockSendInviteEmail.mockResolvedValue(undefined);
  });

  it("returns 401 when not authenticated", async () => {
    mockWithAuth.mockResolvedValue([
      null,
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    ]);

    const req = makeRequest({ email: "test@example.com", roles: ["teacher"] });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 when user lacks invite permission", async () => {
    mockWithAuth.mockResolvedValue([
      null,
      new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
    ]);

    const req = makeRequest({ email: "test@example.com", roles: ["teacher"] });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 for missing email", async () => {
    const req = makeRequest({ roles: ["teacher"] });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("email");
  });

  it("returns 400 for invalid email", async () => {
    const req = makeRequest({ email: "notanemail", roles: ["teacher"] });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing roles", async () => {
    const req = makeRequest({ email: "test@example.com" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("role");
  });

  it("returns 400 for empty roles array", async () => {
    const req = makeRequest({ email: "test@example.com", roles: [] });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid role name", async () => {
    const req = makeRequest({
      email: "test@example.com",
      roles: ["superuser"],
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid role");
  });

  it("returns 409 when user is already active", async () => {
    mockLimit.mockResolvedValue([{ id: "existing", status: "active" }]);

    const req = makeRequest({
      email: "existing@example.com",
      roles: ["teacher"],
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain("already active");
  });

  it("returns 409 when user is already invited", async () => {
    mockLimit.mockResolvedValue([{ id: "existing", status: "invited" }]);

    const req = makeRequest({
      email: "pending@example.com",
      roles: ["teacher"],
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain("already been invited");
  });

  it("creates user and sends invite email on success", async () => {
    const req = makeRequest({
      email: "newteacher@example.com",
      roles: ["teacher", "teacher_manager"],
    });
    const res = await POST(req);
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.user.email).toBe("test@example.com");

    // Verify insert was called
    expect(mockInsert).toHaveBeenCalled();

    // Verify email was sent
    expect(mockSendInviteEmail).toHaveBeenCalledWith({
      to: "newteacher@example.com",
      invitedByName: "Admin",
      roles: ["teacher", "teacher_manager"],
    });
  });

  it("still creates user if email sending fails", async () => {
    mockSendInviteEmail.mockRejectedValue(new Error("Email failed"));

    const req = makeRequest({
      email: "test@example.com",
      roles: ["teacher"],
    });
    const res = await POST(req);
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("returns 400 for malformed JSON body", async () => {
    const req = new NextRequest("http://localhost/api/admin/users/invite", {
      method: "POST",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
