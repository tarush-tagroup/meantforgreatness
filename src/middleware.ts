import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Login page and auth API routes — always pass through
  if (pathname === "/admin/login" || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Allow bearer-token auth for specific API routes (GitHub Actions, cron)
  // These routes handle their own auth in the route handler
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ") && pathname === "/api/admin/logs") {
    return NextResponse.next();
  }

  // For protected routes, check session
  const session = await auth();

  // Protect admin pages — redirect to login if not authenticated
  if (pathname.startsWith("/admin")) {
    if (!session?.user) {
      const loginUrl = new URL("/admin/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Protect admin API routes — return 401
  if (pathname.startsWith("/api/admin")) {
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
