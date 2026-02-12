import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { db } from "@/db";
import { cronRuns } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/cron/ingest-vercel-logs
 *
 * Cron job (triggered via GitHub Actions every 10 min) that fetches
 * ALL runtime logs from the Vercel API and writes them into
 * centralized Vercel Blob logs, classified by level.
 *
 * Each run is recorded in the cron_runs table so the admin UI
 * can show last run time, status, and error details.
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

  // Record the start of this run
  const [run] = await db
    .insert(cronRuns)
    .values({ jobName: "ingest-vercel-logs", status: "running" })
    .returning({ id: cronRuns.id });

  try {
    // Step 1: Get the latest production deployment
    const deploymentsRes = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${projectId}&teamId=${teamId}&target=production&limit=1&state=READY`,
      { headers: { Authorization: `Bearer ${vercelToken}` } }
    );

    if (!deploymentsRes.ok) {
      const msg = `Vercel API error: ${deploymentsRes.status}`;
      await markRun(run.id, "error", msg, 0);
      return NextResponse.json({ success: false, message: msg }, { status: 502 });
    }

    const deployments = await deploymentsRes.json();
    const deployment = deployments.deployments?.[0];

    if (!deployment) {
      await markRun(run.id, "success", "No production deployment found", 0);
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
      const msg = `Vercel events API error: ${eventsRes.status}`;
      await markRun(run.id, "error", msg, 0);
      return NextResponse.json({ success: false, message: msg }, { status: 502 });
    }

    const events = await eventsRes.json();

    if (!Array.isArray(events) || events.length === 0) {
      await markRun(run.id, "success", "No runtime logs", 0);
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

    const message = `Ingested ${ingested} logs (${counts.error} errors, ${counts.warn} warnings, ${counts.info} info)`;
    await markRun(run.id, counts.error > 0 ? "error" : "success", message, ingested);

    return NextResponse.json({
      success: true,
      message,
      ingested,
      counts,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await markRun(run.id, "error", message, 0);
    return NextResponse.json({
      success: false,
      message,
    }, { status: 500 });
  }
}

/** Update the cron_runs row with final status. */
async function markRun(id: number, status: string, message: string, items: number) {
  try {
    await db
      .update(cronRuns)
      .set({
        status,
        message,
        itemsProcessed: items,
        finishedAt: new Date(),
      })
      .where(eq(cronRuns.id, id));
  } catch {
    // Don't let tracking failures break the endpoint
    console.error("[ingest] Failed to update cron_runs row", id);
  }
}
