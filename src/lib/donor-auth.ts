import crypto from "crypto";
import { cookies } from "next/headers";

function getDonorJwtSecret(): string {
  const secret = process.env.DONOR_JWT_SECRET;
  if (!secret) {
    throw new Error("DONOR_JWT_SECRET environment variable is required");
  }
  return secret;
}
const COOKIE_NAME = "donor_session";
const SESSION_MAX_AGE = 90 * 24 * 60 * 60; // 90 days in seconds
const MAGIC_TOKEN_MAX_AGE = 24 * 60 * 60; // 24 hours in seconds

// ─── OTP Generation ──────────────────────────────────────────────────────────

export function generateOtp(): string {
  return String(crypto.randomInt(100000, 999999));
}

// ─── JWT Helpers (HMAC-SHA256, no external deps) ─────────────────────────────

function base64url(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf-8") : input;
  return buf.toString("base64url");
}

function signJwt(
  payload: Record<string, unknown>,
  expiresInSeconds: number
): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const body = base64url(
    JSON.stringify({ ...payload, iat: now, exp: now + expiresInSeconds })
  );
  const signature = crypto
    .createHmac("sha256", getDonorJwtSecret())
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

function verifyJwt(token: string): Record<string, unknown> | null {
  try {
    const [header, body, signature] = token.split(".");
    if (!header || !body || !signature) return null;

    const expectedSig = crypto
      .createHmac("sha256", getDonorJwtSecret())
      .update(`${header}.${body}`)
      .digest("base64url");

    if (signature !== expectedSig) return null;

    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf-8")
    );

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}

// ─── Session Management ──────────────────────────────────────────────────────

export interface DonorSessionPayload {
  donorId: string;
  email: string;
}

export function createDonorSession(
  donorId: string,
  email: string
): string {
  return signJwt({ sub: donorId, email }, SESSION_MAX_AGE);
}

export function verifyDonorSession(
  token: string
): DonorSessionPayload | null {
  const payload = verifyJwt(token);
  if (!payload || !payload.sub || !payload.email) return null;
  return { donorId: payload.sub as string, email: payload.email as string };
}

export async function getDonorFromCookie(): Promise<DonorSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyDonorSession(token);
}

export async function setDonorCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearDonorCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// ─── Magic Login Token (for post-donation email link) ────────────────────────

export function createMagicLoginToken(
  donorId: string,
  email: string
): string {
  return signJwt({ sub: donorId, email, type: "magic" }, MAGIC_TOKEN_MAX_AGE);
}

export function verifyMagicLoginToken(
  token: string
): DonorSessionPayload | null {
  const payload = verifyJwt(token);
  if (!payload || !payload.sub || !payload.email || payload.type !== "magic")
    return null;
  return { donorId: payload.sub as string, email: payload.email as string };
}
