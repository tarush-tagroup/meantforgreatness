import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkRateLimit, RATE_LIMITS } from "./rate-limit";

describe("rate-limit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests within limit", () => {
    const config = { maxRequests: 3, windowMs: 60000 };

    const r1 = checkRateLimit("test-user-1", config);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = checkRateLimit("test-user-1", config);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = checkRateLimit("test-user-1", config);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it("blocks requests exceeding limit", () => {
    const config = { maxRequests: 2, windowMs: 60000 };

    checkRateLimit("test-user-2", config);
    checkRateLimit("test-user-2", config);

    const r3 = checkRateLimit("test-user-2", config);
    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
  });

  it("resets after window expires", () => {
    const config = { maxRequests: 1, windowMs: 60000 };

    const r1 = checkRateLimit("test-user-3", config);
    expect(r1.allowed).toBe(true);

    const r2 = checkRateLimit("test-user-3", config);
    expect(r2.allowed).toBe(false);

    // Advance time past the window
    vi.advanceTimersByTime(61000);

    const r3 = checkRateLimit("test-user-3", config);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it("tracks different keys independently", () => {
    const config = { maxRequests: 1, windowMs: 60000 };

    const r1 = checkRateLimit("user-a", config);
    expect(r1.allowed).toBe(true);

    const r2 = checkRateLimit("user-b", config);
    expect(r2.allowed).toBe(true);

    // user-a is now blocked
    const r3 = checkRateLimit("user-a", config);
    expect(r3.allowed).toBe(false);

    // user-b is also blocked (used their 1 request)
    const r4 = checkRateLimit("user-b", config);
    expect(r4.allowed).toBe(false);
  });

  it("returns correct resetAt timestamp", () => {
    const now = Date.now();
    vi.setSystemTime(now);

    const config = { maxRequests: 5, windowMs: 3600000 }; // 1 hour
    const result = checkRateLimit("test-user-4", config);

    expect(result.resetAt).toBe(now + 3600000);
  });

  it("has correct upload rate limit config", () => {
    expect(RATE_LIMITS.upload.maxRequests).toBe(100);
    expect(RATE_LIMITS.upload.windowMs).toBe(3600000); // 1 hour
  });

  it("has correct AI analysis rate limit config", () => {
    expect(RATE_LIMITS.aiAnalysis.maxRequests).toBe(30);
    expect(RATE_LIMITS.aiAnalysis.windowMs).toBe(3600000); // 1 hour
  });
});
