import { NextRequest, NextResponse } from "next/server";
import { deleteOldLogs } from "@/lib/blob-logs";

/**
 * GET /api/cron/cleanup-logs
 *
 * Vercel cron job that deletes log blobs older than 30 days.
 * Protected by CRON_SECRET to prevent unauthorized access.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  // Verify the request is from Vercel Cron
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);

  const { deletedCount } = await deleteOldLogs(cutoffDate);

  return NextResponse.json({
    success: true,
    message: `Cleaned up ${deletedCount} log blobs older than ${cutoffDate.toISOString()}`,
  });
}
