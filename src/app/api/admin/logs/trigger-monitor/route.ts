import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";

/**
 * POST /api/admin/logs/trigger-monitor
 *
 * Triggers the Production Error Monitor GitHub Actions workflow on-demand.
 * Dispatches the workflow_dispatch event via the GitHub API.
 * Requires admin session auth with logs:view permission.
 */
export async function POST() {
  const [, authError] = await withAuth("logs:view");
  if (authError) return authError;

  const githubToken = process.env.GITHUB_PAT;
  const repo = process.env.GITHUB_REPO || "tarush-tagroup/meantforgreatness";

  if (!githubToken) {
    return NextResponse.json(
      { error: "GITHUB_PAT not configured — cannot trigger workflow" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/monitor.yml/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({ ref: "main" }),
      }
    );

    if (res.status === 204) {
      return NextResponse.json({ success: true, message: "Monitor workflow triggered" });
    }

    const text = await res.text();
    return NextResponse.json(
      { error: `GitHub API returned ${res.status}: ${text}` },
      { status: 502 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to trigger monitor" },
      { status: 500 }
    );
  }
}
