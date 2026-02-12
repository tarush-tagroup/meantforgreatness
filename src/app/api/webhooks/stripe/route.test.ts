import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock Stripe
const mockConstructEvent = vi.fn();
const mockSessionsList = vi.fn();
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    webhooks: {
      constructEvent: (...args: unknown[]) => mockConstructEvent(...args),
    },
    checkout: {
      sessions: {
        list: (...args: unknown[]) => mockSessionsList(...args),
      },
    },
  }),
}));

// Mock db
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockValues = vi.fn();
const mockReturning = vi.fn();
const mockSet = vi.fn();
const mockUpdateWhere = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}));

vi.mock("@/db/schema", () => ({
  donations: {
    id: "id",
    stripeSessionId: "stripe_session_id",
    stripeEventId: "stripe_event_id",
    status: "status",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: unknown, _val: unknown) => "eq"),
}));

import { POST } from "./route";

function makeWebhookRequest(body: string, signature: string | null = "sig_test") {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (signature) {
    headers["stripe-signature"] = signature;
  }
  return new NextRequest("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body,
    headers,
  });
}

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";

    // Default: no existing donation (for idempotency check)
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue([]);

    // Default: insert succeeds
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockResolvedValue(undefined);

    // Default: update succeeds
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockResolvedValue(undefined);
  });

  it("returns 400 when stripe-signature is missing", async () => {
    const res = await POST(makeWebhookRequest("{}", null));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Missing stripe-signature header");
  });

  it("returns 400 when signature verification fails", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("Signature mismatch");
    });

    const res = await POST(makeWebhookRequest("{}", "bad_sig"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid signature");
  });

  it("handles checkout.session.completed and inserts donation", async () => {
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_123",
          mode: "payment",
          customer: "cus_123",
          subscription: null,
          customer_details: {
            email: "donor@example.com",
            name: "Test Donor",
          },
          customer_email: null,
          amount_total: 5000,
          currency: "usd",
          metadata: {},
        },
      },
    });

    const res = await POST(makeWebhookRequest("{}", "sig_test"));
    expect(res.status).toBe(200);
    expect(mockInsert).toHaveBeenCalled();
  });

  it("skips duplicate checkout.session.completed (idempotency)", async () => {
    mockLimit.mockResolvedValue([{ id: "existing" }]); // Already exists

    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_123",
          mode: "payment",
          customer_details: { email: "donor@example.com" },
          amount_total: 5000,
          currency: "usd",
        },
      },
    });

    const res = await POST(makeWebhookRequest("{}", "sig_test"));
    expect(res.status).toBe(200);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("handles invoice.paid for recurring subscription", async () => {
    mockConstructEvent.mockReturnValue({
      type: "invoice.paid",
      data: {
        object: {
          id: "in_test_456",
          parent: {
            subscription_details: {
              subscription: "sub_123",
            },
          },
          customer: "cus_123",
          customer_email: "donor@example.com",
          customer_name: "Test Donor",
          amount_paid: 2500,
          currency: "usd",
          billing_reason: "subscription_cycle",
        },
      },
    });

    const res = await POST(makeWebhookRequest("{}", "sig_test"));
    expect(res.status).toBe(200);
    expect(mockInsert).toHaveBeenCalled();
  });

  it("skips invoice.paid for subscription_create (already recorded via checkout)", async () => {
    mockConstructEvent.mockReturnValue({
      type: "invoice.paid",
      data: {
        object: {
          id: "in_test_789",
          parent: {
            subscription_details: {
              subscription: "sub_123",
            },
          },
          billing_reason: "subscription_create",
        },
      },
    });

    const res = await POST(makeWebhookRequest("{}", "sig_test"));
    expect(res.status).toBe(200);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("handles charge.refunded", async () => {
    mockSessionsList.mockResolvedValue({
      data: [{ id: "cs_test_123" }],
    });

    mockConstructEvent.mockReturnValue({
      type: "charge.refunded",
      data: {
        object: {
          id: "ch_test_123",
          payment_intent: "pi_test_123",
        },
      },
    });

    const res = await POST(makeWebhookRequest("{}", "sig_test"));
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("returns 200 for unhandled event types", async () => {
    mockConstructEvent.mockReturnValue({
      type: "payment_intent.created",
      data: { object: {} },
    });

    const res = await POST(makeWebhookRequest("{}", "sig_test"));
    expect(res.status).toBe(200);
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
