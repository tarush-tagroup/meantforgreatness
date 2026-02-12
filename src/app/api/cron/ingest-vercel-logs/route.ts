import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

/**
 * GET /api/cron/ingest-vercel-logs
 *
 * Cron job (triggered via GitHub Actions every 10 min) that fetches
 * ALL runtime logs from the Vercel API and writes them into
 * centralized Vercel Blob logs, classified by level.
 *
 * Log level classification:
 *   - error: type=stderr or type=error, or text matches error patterns
 *   - warn:  text matches warning patterns
 *   - info:  everything else (stdout, general output)
 *
 * Protected by CRON_SECRET bearer token.
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

    // Step 3: Classify each event by log level
    const errorPattern = /(?:error|ERR|500|exception|unhandled|fatal|TypeError|ReferenceError)/i;
    const warnPattern = /(?:warn|WARN|deprecated|deprecation|slow|timeout)/i;

    function classifyLevel(event: { type?: string; text?: string; message?: string }): "error" | "warn" | "info" {
      // stderr / error type → error
      if (event.type === "stderr" || event.type === "error") return "error";
      const text = event.text || event.message || "";
      if (errorPattern.test(text)) return "error";
      if (warnPattern.test(text)) return "warn";
      return "info";
    }

    // Step 4: Write ALL log entries to centralized blob logs
    let ingested = 0;
    const counts = { error: 0, warn: 0, info: 0 };

    for (const event of events) {
      const text = event.text || event.message || "";
      // Skip empty/blank log lines
      if (!text.trim()) continue;

      const level = classifyLevel(event);
      counts[level]++;

      const meta = {
        type: event.type,
        deploymentId: deployment.uid,
        deploymentUrl: deployment.url,
      };

      if (level === "error") {
        await logger.error("vercel:runtime", text, meta);
      } else if (level === "warn") {
        await logger.warn("vercel:runtime", text, meta);
      } else {
        await logger.info("vercel:runtime", text, meta);
      }
      ingested++;
    }

    return NextResponse.json({
      success: true,
      message: `Ingested ${ingested} Vercel runtime logs (${counts.error} errors, ${counts.warn} warnings, ${counts.info} info)`,
      ingested,
      counts,
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      message: err instanceof Error ? err.message : "Unknown error",
    }, { status: 500 });
  }
}
