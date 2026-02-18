import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { anthropicUsage } from "@/db/schema";
import { timingSafeEqual } from "@/lib/timing-safe";

/**
 * Model pricing in cents per 1M tokens.
 * Used to calculate cost from token counts.
 */
const MODEL_PRICING: Record<string, { inputCentsPerMillion: number; outputCentsPerMillion: number }> = {
  "claude-sonnet-4-20250514": { inputCentsPerMillion: 300, outputCentsPerMillion: 1500 },
  "claude-haiku-3-5-20241022": { inputCentsPerMillion: 80, outputCentsPerMillion: 400 },
  // Default fallback for unknown models
  default: { inputCentsPerMillion: 300, outputCentsPerMillion: 1500 },
};

/**
 * POST /api/admin/anthropic-usage
 *
 * Records Anthropic API usage from external sources (e.g. GitHub Actions monitor).
 * Auth: Bearer token (LOG_API_SECRET).
 *
 * Body: { useCase, model, inputTokens, outputTokens, metadata? }
 */
export async function POST(req: NextRequest) {
  // Bearer token auth (same as logs ingest)
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const logApiSecret = process.env.LOG_API_SECRET;

  if (!bearerToken || !logApiSecret || !timingSafeEqual(bearerToken, logApiSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    useCase: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    metadata?: Record<string, unknown>;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.useCase || !body.model || typeof body.inputTokens !== "number" || typeof body.outputTokens !== "number") {
    return NextResponse.json(
      { error: "Missing required fields: useCase, model, inputTokens, outputTokens" },
      { status: 400 }
    );
  }

  // Calculate cost
  const pricing = MODEL_PRICING[body.model] || MODEL_PRICING.default;
  const inputCost = (body.inputTokens / 1_000_000) * pricing.inputCentsPerMillion;
  const outputCost = (body.outputTokens / 1_000_000) * pricing.outputCentsPerMillion;
  const costCents = Math.round(inputCost + outputCost);

  try {
    await db.insert(anthropicUsage).values({
      useCase: body.useCase,
      model: body.model,
      inputTokens: body.inputTokens,
      outputTokens: body.outputTokens,
      costCents,
      metadata: body.metadata || null,
    });

    return NextResponse.json({ success: true, costCents });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to record usage" },
      { status: 500 }
    );
  }
}
