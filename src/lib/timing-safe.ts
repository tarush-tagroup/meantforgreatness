import crypto from "crypto";

/**
 * Constant-time string comparison to prevent timing attacks.
 * Uses crypto.timingSafeEqual under the hood.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still compare to avoid leaking length info via timing
    const buf = Buffer.from(a);
    crypto.timingSafeEqual(buf, buf);
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
