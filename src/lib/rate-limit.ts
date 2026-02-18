/**
 * Simple in-memory rate limiter for serverless environments.
 *
 * Note: In a serverless environment each instance has its own memory,
 * so this is a best-effort approach. For strict enforcement across all
 * instances, use a Redis-backed solution.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Periodically clean up expired entries to prevent memory leaks
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check if a request is within the rate limit.
 *
 * @param key - Unique identifier for the rate limit (e.g., `upload:${userId}`)
 * @param config - Rate limit configuration
 * @returns Whether the request is allowed and remaining count
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanup();

  const now = Date.now();
  const entry = store.get(key);

  // No existing entry or window expired — reset
  if (!entry || now > entry.resetAt) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    store.set(key, newEntry);
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: newEntry.resetAt,
    };
  }

  // Window still active — increment
  entry.count++;

  if (entry.count > config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/** Pre-configured rate limits */
export const RATE_LIMITS = {
  /** Upload: 100 requests per hour per user */
  upload: { maxRequests: 100, windowMs: 60 * 60 * 1000 } as RateLimitConfig,
  /** AI analysis: 30 requests per hour per user */
  aiAnalysis: { maxRequests: 30, windowMs: 60 * 60 * 1000 } as RateLimitConfig,
  /** OTP send: 5 per 15 minutes per email (prevents email bombing) */
  otpSend: { maxRequests: 5, windowMs: 15 * 60 * 1000 } as RateLimitConfig,
  /** OTP verify: 10 attempts per 15 minutes per email (prevents brute force) */
  otpVerify: { maxRequests: 10, windowMs: 15 * 60 * 1000 } as RateLimitConfig,
} as const;
