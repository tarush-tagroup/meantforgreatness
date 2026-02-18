import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { logger } from "@/lib/logger";

// ─── Edge-compatible donor JWT verification (no Node.js crypto) ──────────────
const DONOR_JWT_SECRET = process.env.DONOR_JWT_SECRET || "";
// Note: If DONOR_JWT_SECRET is not set, all donor JWT verification will safely fail

async function verifyDonorJwtEdge(token: string): Promise<boolean> {
  try {
    const [header, body, signature] = token.split(".");
    if (!header || !body || !signature) return false;

    // Import HMAC key for Web Crypto
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(DONOR_JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    // Compute expected signature
    const data = encoder.encode(`${header}.${body}`);
    const sig = await crypto.subtle.sign("HMAC", key, data);

    // Convert to base64url
    const expectedSig = btoa(String.fromCharCode(...new Uint8Array(sig)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    if (signature !== expectedSig) return false;

    // Check expiry
    const payload = JSON.parse(atob(body.replace(/-/g, "+").replace(/_/g, "/")));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return false;

    // Must have sub + email
    if (!payload.sub || !payload.email) return false;

    return true;
  } catch {
    return false;
  }
}

export default async function middleware(req: NextRequest) {
  const start = Date.now();
  const { pathname } = req.nextUrl;

  // ─── Donor portal — check donor JWT cookie (except login page) ─────
  if (pathname.startsWith("/donor") && pathname !== "/donor/login") {
    const donorToken = req.cookies.get("donor_session")?.value;
    if (!donorToken || !(await verifyDonorJwtEdge(donorToken))) {
      const res = NextResponse.redirect(new URL("/donor/login", req.url));
      if (donorToken) res.cookies.delete("donor_session");
      return res;
    }
    return NextResponse.next();
  }

  // Login page and auth API routes — always pass through
  if (pathname === "/admin/login" || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Allow bearer-token auth for specific API routes (GitHub Actions, cron)
  // These routes handle their own auth in the route handler
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ") && pathname.startsWith("/api/admin/logs")) {
    return NextResponse.next();
  }

  // For protected routes, check session
  const session = await auth();

  // Protect admin pages — redirect to login if not authenticated
  if (pathname.startsWith("/admin")) {
    if (!session?.user) {
      const loginUrl = new URL("/admin/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      const duration = Date.now() - start;

      logger
        .warn("request:auth-rejected", `Redirect ${req.method} ${pathname}`, {
          method: req.method,
          path: pathname,
          status: 302,
          duration,
        })
        .catch(() => {});

      return NextResponse.redirect(loginUrl);
    }
  }

  // Protect admin API routes — return 401
  if (pathname.startsWith("/api/admin")) {
    if (!session?.user) {
      const duration = Date.now() - start;

      logger
        .warn("request:auth-rejected", `401 ${req.method} ${pathname}`, {
          method: req.method,
          path: pathname,
          status: 401,
          duration,
        })
        .catch(() => {});

      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Log slow middleware execution (>2s indicates auth/DB issues)
  const duration = Date.now() - start;
  if (duration > 2000) {
    logger
      .warn("request:slow", `Middleware ${req.method} ${pathname} took ${duration}ms`, {
        method: req.method,
        path: pathname,
        duration,
        userEmail: session?.user?.email || null,
      })
      .catch(() => {});
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/donor/:path*"],
};
