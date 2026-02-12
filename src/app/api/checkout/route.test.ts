import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";

const mockSessionCreate = vi.fn();
const mockPriceCreate = vi.fn();

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    checkout: { sessions: { create: mockSessionCreate } },
    prices: { create: mockPriceCreate },
  }),
}));

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionCreate.mockResolvedValue({ url: "https://checkout.stripe.com/session_123" });
    mockPriceCreate.mockResolvedValue({ id: "price_123" });
  });

  describe("amount validation", () => {
    it("rejects non-numeric amount", async () => {
      const res = await POST(makeRequest({ amount: "abc", frequency: "one_time" }));
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toBe("Invalid donation amount.");
    });

    it("rejects NaN", async () => {
      const res = await POST(makeRequest({ amount: NaN, frequency: "one_time" }));
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toBe("Invalid donation amount.");
    });

    it("rejects Infinity", async () => {
      const res = await POST(makeRequest({ amount: Infinity, frequency: "one_time" }));
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toBe("Invalid donation amount.");
    });

    it("rejects amount less than $1", async () => {
      const res = await POST(makeRequest({ amount: 0.5, frequency: "one_time" }));
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toBe("Minimum donation is $1.");
    });

    it("rejects zero", async () => {
      const res = await POST(makeRequest({ amount: 0, frequency: "one_time" }));
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toBe("Minimum donation is $1.");
    });

    it("rejects negative amount", async () => {
      const res = await POST(makeRequest({ amount: -10, frequency: "one_time" }));
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toBe("Minimum donation is $1.");
    });

    it("rejects amount over $10,000", async () => {
      const res = await POST(makeRequest({ amount: 10001, frequency: "one_time" }));
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toContain("over $10,000");
    });

    it("accepts $1 (minimum)", async () => {
      const res = await POST(makeRequest({ amount: 1, frequency: "one_time" }));
      expect(res.status).toBe(200);
    });

    it("accepts $10,000 (maximum)", async () => {
      const res = await POST(makeRequest({ amount: 10000, frequency: "one_time" }));
      expect(res.status).toBe(200);
    });
  });

  describe("frequency validation", () => {
    it("rejects invalid frequency", async () => {
      const res = await POST(makeRequest({ amount: 50, frequency: "weekly" }));
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toBe("Invalid donation frequency.");
    });

    it("rejects missing frequency", async () => {
      const res = await POST(makeRequest({ amount: 50 }));
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toBe("Invalid donation frequency.");
    });
  });

  describe("one-time payment", () => {
    it("creates a payment checkout session", async () => {
      const res = await POST(makeRequest({ amount: 50, frequency: "one_time" }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.url).toBe("https://checkout.stripe.com/session_123");
      expect(mockSessionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "payment",
          payment_method_types: ["card"],
          line_items: [
            expect.objectContaining({
              price_data: expect.objectContaining({
                currency: "usd",
                unit_amount: 5000,
                product_data: { name: "Meant for Greatness — One-time Donation" },
              }),
              quantity: 1,
            }),
          ],
        })
      );
    });

    it("correctly converts dollars to cents", async () => {
      await POST(makeRequest({ amount: 25.5, frequency: "one_time" }));
      expect(mockSessionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [
            expect.objectContaining({
              price_data: expect.objectContaining({ unit_amount: 2550 }),
            }),
          ],
        })
      );
    });
  });

  describe("monthly subscription", () => {
    it("creates a price and subscription checkout session", async () => {
      const res = await POST(makeRequest({ amount: 100, frequency: "monthly" }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.url).toBe("https://checkout.stripe.com/session_123");

      expect(mockPriceCreate).toHaveBeenCalledWith({
        unit_amount: 10000,
        currency: "usd",
        recurring: { interval: "month" },
        product_data: { name: "Meant for Greatness — Monthly Donation" },
      });

      expect(mockSessionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "subscription",
          line_items: [{ price: "price_123", quantity: 1 }],
        })
      );
    });
  });

  describe("error handling", () => {
    it("returns 500 when Stripe throws", async () => {
      mockSessionCreate.mockRejectedValue(new Error("Stripe API down"));
      const res = await POST(makeRequest({ amount: 50, frequency: "one_time" }));
      const data = await res.json();
      expect(res.status).toBe(500);
      expect(data.error).toBe("An error occurred creating the checkout session.");
    });

    it("returns 500 for malformed request body", async () => {
      const req = new NextRequest("http://localhost:3000/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      });
      const res = await POST(req);
      expect(res.status).toBe(500);
    });
  });
});
