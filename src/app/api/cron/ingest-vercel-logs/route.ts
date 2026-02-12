import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

/**
 * GET /api/cron/ingest-vercel-logs
 *
 * Vercel Cron job that fetches runtime errors from the Vercel API
 * and writes them into centralized Vercel Blob logs.
 *
 * Runs every 10 minutes. Protected by CRON_SECRET.
 *
 * Required env vars:
 *   - CRON_SECRET: Vercel cron authentication
 *   - VERCEL_TOKEN: Vercel API access token
 *   - VERCEL_PROJECT_ID: Project ID
 *   - VERCEL_TEAM_ID: Team ID
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vercelToken = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID;

  if (!vercelToken || !projectId || !teamId) {
    return NextResponse.json({
      success: false,
      message: "Missing VERCEL_TOKEN, VERCEL_PROJECT_ID, or VERCEL_TEAM_ID",
    }, { status: 500 });
  }

  try {
    // Step 1: Get the latest production deployment
    const deploymentsRes = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${projectId}&teamId=${teamId}&target=production&limit=1&state=READY`,
      { headers: { Authorization: `Bearer ${vercelToken}` } }
    );

    if (!deploymentsRes.ok) {
      return NextResponse.json({
        success: false,
        message: `Vercel API error: ${deploymentsRes.status}`,
      }, { status: 502 });
    }

    const deployments = await deploymentsRes.json();
    const deployment = deployments.deployments?.[0];

    if (!deployment) {
      return NextResponse.json({
        success: true,
        message: "No production deployment found",
        ingested: 0,
      });
    }

    // Step 2: Fetch runtime logs for this deployment
    const eventsRes = await fetch(
      `https://api.vercel.com/v2/deployments/${deployment.uid}/events?teamId=${teamId}&limit=500&direction=backward`,
      { headers: { Authorization: `Bearer ${vercelToken}` } }
    );

    if (!eventsRes.ok) {
      return NextResponse.json({
        success: false,
        message: `Vercel events API error: ${eventsRes.status}`,
      }, { status: 502 });
    }

    const events = await eventsRes.json();

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No runtime logs",
        ingested: 0,
      });
    }

    // Step 3: Filter for errors
    const errorPattern = /(?:error|ERR|500|exception|unhandled|fatal|TypeError|ReferenceError)/i;
    const errors = events.filter((e: { type?: string; text?: string; message?: string }) => {
      if (e.type === "stderr" || e.type === "error") return true;
      const text = e.text || e.message || "";
      return errorPattern.test(text);
    });

    if (errors.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No errors in Vercel runtime logs",
        ingested: 0,
      });
    }

    // Step 4: Write each error to centralized blob logs
    let ingested = 0;
    for (const error of errors) {
      const message = error.text || error.message || "Unknown Vercel runtime error";
      await logger.error("vercel:runtime", message, {
        type: error.type,
        deploymentId: deployment.uid,
        deploymentUrl: deployment.url,
      });
      ingested++;
    }

    return NextResponse.json({
      success: true,
      message: `Ingested ${ingested} Vercel runtime errors`,
      ingested,
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      message: err instanceof Error ? err.message : "Unknown error",
    }, { status: 500 });
  }
}
