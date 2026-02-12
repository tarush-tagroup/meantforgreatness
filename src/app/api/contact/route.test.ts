import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";

const mockSend = vi.fn();

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mockSend };
  },
}));

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/contact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({ id: "email_123" });
    process.env.CONTACT_EMAIL = "test@example.com";
    process.env.RESEND_API_KEY = "re_test_123";
  });

  describe("name validation", () => {
    it("rejects missing name", async () => {
      const res = await POST(
        makeRequest({ email: "a@b.com", message: "hi" })
      );
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toBe("Name is required.");
    });

    it("rejects empty name", async () => {
      const res = await POST(
        makeRequest({ name: "  ", email: "a@b.com", message: "hi" })
      );
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toBe("Name is required.");
    });
  });

  describe("email validation", () => {
    it("rejects missing email", async () => {
      const res = await POST(
        makeRequest({ name: "John", message: "hi" })
      );
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toBe("Email is required.");
    });

    it("rejects invalid email format", async () => {
      const res = await POST(
        makeRequest({ name: "John", email: "not-an-email", message: "hi" })
      );
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toBe("Please enter a valid email address.");
    });
  });

  describe("message validation", () => {
    it("rejects missing message", async () => {
      const res = await POST(
        makeRequest({ name: "John", email: "a@b.com" })
      );
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toBe("Message is required.");
    });

    it("rejects empty message", async () => {
      const res = await POST(
        makeRequest({ name: "John", email: "a@b.com", message: "   " })
      );
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toBe("Message is required.");
    });

    it("rejects message over 5000 characters", async () => {
      const res = await POST(
        makeRequest({
          name: "John",
          email: "a@b.com",
          message: "x".repeat(5001),
        })
      );
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toBe("Message must be under 5,000 characters.");
    });
  });

  describe("successful submission", () => {
    it("sends email and returns success", async () => {
      const res = await POST(
        makeRequest({
          name: "John Doe",
          email: "john@example.com",
          message: "Hello there!",
        })
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockSend).toHaveBeenCalledWith({
        from: "Meant for Greatness <onboarding@resend.dev>",
        to: "test@example.com",
        subject: "Contact Form: John Doe",
        replyTo: "john@example.com",
        text: "Name: John Doe\nEmail: john@example.com\n\nMessage:\nHello there!",
      });
    });

    it("trims whitespace from inputs", async () => {
      await POST(
        makeRequest({
          name: "  Jane  ",
          email: "  jane@example.com  ",
          message: "  Hello  ",
        })
      );

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "Contact Form: Jane",
          replyTo: "jane@example.com",
          text: "Name: Jane\nEmail: jane@example.com\n\nMessage:\nHello",
        })
      );
    });
  });

  describe("configuration errors", () => {
    it("returns 500 when CONTACT_EMAIL is not set", async () => {
      delete process.env.CONTACT_EMAIL;
      const res = await POST(
        makeRequest({
          name: "John",
          email: "a@b.com",
          message: "hi",
        })
      );
      const data = await res.json();
      expect(res.status).toBe(500);
      expect(data.error).toBe("Contact form is not configured.");
    });

    it("returns 500 when RESEND_API_KEY is not set", async () => {
      delete process.env.RESEND_API_KEY;
      const res = await POST(
        makeRequest({
          name: "John",
          email: "a@b.com",
          message: "hi",
        })
      );
      const data = await res.json();
      expect(res.status).toBe(500);
      expect(data.error).toBe("Contact form is not configured.");
    });
  });

  describe("error handling", () => {
    it("returns 500 when Resend throws", async () => {
      mockSend.mockRejectedValue(new Error("Resend API error"));
      const res = await POST(
        makeRequest({
          name: "John",
          email: "a@b.com",
          message: "hi",
        })
      );
      const data = await res.json();
      expect(res.status).toBe(500);
      expect(data.error).toBe("An error occurred sending your message.");
    });

    it("returns 500 for malformed request body", async () => {
      const req = new NextRequest("http://localhost:3000/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      });
      const res = await POST(req);
      expect(res.status).toBe(500);
    });
  });
});
