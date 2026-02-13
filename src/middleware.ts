import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { logger } from "@/lib/logger";

export default async function middleware(req: NextRequest) {
  const start = Date.now();
  const { pathname } = req.nextUrl;

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
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
