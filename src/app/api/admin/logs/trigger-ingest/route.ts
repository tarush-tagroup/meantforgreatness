import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";

/**
 * POST /api/admin/logs/trigger-ingest
 *
 * Triggers the Vercel log ingest endpoint on-demand from the admin UI.
 * Requires admin session auth with logs:view permission.
 */
export async function POST() {
  const [, authError] = await withAuth("logs:view");
  if (authError) return authError;

  const cronSecret = process.env.CRON_SECRET || process.env.LOG_API_SECRET;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
    || "http://localhost:3000";

  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET or LOG_API_SECRET not configured" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(`${baseUrl}/api/cron/ingest-vercel-logs`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to trigger ingest" },
      { status: 500 }
    );
  }
}
