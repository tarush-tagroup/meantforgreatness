import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";
import { analyzeClassLogPhotos } from "@/lib/ai-photo-analysis";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { db } from "@/db";
import { classLogs, orphanages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const analyzeSchema = z.object({
  classLogId: z.string().uuid(),
  photoUrls: z.array(z.string().url()).min(1),
});

export async function POST(req: NextRequest) {
  const [user, authError] = await withAuth("class_logs:create");
  if (authError) return authError;

  // Rate limit: 30 AI analysis requests per hour per user
  const rateLimitResult = checkRateLimit(
    `ai-analysis:${user!.id}`,
    RATE_LIMITS.aiAnalysis
  );
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "AI analysis rate limit exceeded. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)
          ),
        },
      }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = analyzeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues?.[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const { classLogId, photoUrls } = parsed.data;

  // Fetch the class log and orphanage name
  const [row] = await db
    .select({
      id: classLogs.id,
      orphanageId: classLogs.orphanageId,
      orphanageName: orphanages.name,
    })
    .from(classLogs)
    .leftJoin(orphanages, eq(classLogs.orphanageId, orphanages.id))
    .where(eq(classLogs.id, classLogId))
    .limit(1);

  if (!row) {
    return NextResponse.json(
      { error: "Class log not found" },
      { status: 404 }
    );
  }

  const orphanageName = row.orphanageName || row.orphanageId;

  try {
    const analysis = await analyzeClassLogPhotos(photoUrls, orphanageName);

    if (!analysis) {
      return NextResponse.json(
        { error: "AI analysis unavailable — ANTHROPIC_API_KEY may not be set" },
        { status: 503 }
      );
    }

    // Save the AI metadata to the class log
    await db
      .update(classLogs)
      .set({
        aiKidsCount: analysis.kidsCount,
        aiLocation: analysis.location,
        aiPhotoTimestamp: analysis.photoTimestamp,
        aiOrphanageMatch: analysis.orphanageMatch,
        aiConfidenceNotes: analysis.confidenceNotes,
        aiPrimaryPhotoUrl: analysis.primaryPhotoUrl,
        aiAnalyzedAt: new Date(),
      })
      .where(eq(classLogs.id, classLogId));

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("AI photo analysis error:", error);
    return NextResponse.json(
      { error: "AI analysis failed — please try again later" },
      { status: 500 }
    );
  }
}
