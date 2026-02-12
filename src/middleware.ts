import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow auth routes through
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Allow webhook routes through (they use signature verification, not sessions)
  if (pathname.startsWith("/api/webhooks")) {
    return NextResponse.next();
  }

  // Protect admin pages — redirect to login
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    if (!req.auth?.user) {
      const loginUrl = new URL("/admin/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Protect admin API routes — return 401
  if (pathname.startsWith("/api/admin")) {
    if (!req.auth?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/api/auth/:path*"],
};
